/**
 * React 19 migration context — deterministic compute service.
 *
 * Rework Milestone R2 — React 19 Readiness Report V2.
 *
 *   - Step 1 (initial) added the supported / unsupported branch and the
 *     `React19MigrationContext` for React 16 / 17 / 18 projects.
 *   - Step 2 (this revision) extends the service into a full eligibility
 *     detector. It now classifies every supported and unsupported case
 *     (package.json / package manager / react / react-dom / version
 *     parseability / major range / major mismatch) into a coarse
 *     `React19SupportLevel` bucket the report UI can switch on and
 *     surfaces a single `canGeneratePlan` boolean for the plan-generation
 *     gate.
 *
 * Architectural rules
 * -------------------
 *   - Pure: no React, no IPC, no filesystem. Trivially unit-testable and
 *     reusable by Scanner V2 wiring, Planner V2, and any future CLI
 *     surface.
 *   - Deterministic: same input → same output (no randomness, no clock).
 *   - The function NEVER fabricates data. If the scanner could not see
 *     a `react` version, the result reflects that exactly.
 *   - All branches return both `context` (only when supported) and
 *     `status` so callers always have a structured outcome to render.
 *   - Side-effect-free: it never throws. Callers are guaranteed a status
 *     even for malformed inputs.
 */
import {
  REACT_MIGRATION_PHASES_BY_TRACK,
  REACT_MIGRATION_TARGET_MAJOR,
} from '../types/react19Migration.types';
import type {
  React19MigrationContext,
  React19PackageManager,
  React19SupportLevel,
  React19SupportReasonCode,
  React19SupportStatus,
  ReactMigrationSourceMajor,
  ReactMigrationTrack,
} from '../types/react19Migration.types';

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Inputs for the compute step. Mirrors what the deterministic scanner
 * already extracts from `package.json` and the project's lockfile — no
 * additional plumbing is needed.
 *
 *   - `packageJsonPresent` — explicit so the "no package.json" branch
 *     produces a clearer blocked-state message than "react not found".
 *   - `reactVersion` / `reactDomVersion` — the raw declared version
 *     strings (`"^17.0.2"`, `"18.2.0"`, `"workspace:*"`, …). Pass them
 *     verbatim; the service does its own safe parsing.
 *   - `packageManager` — `'npm' | 'yarn' | 'pnpm' | 'bun' | 'unknown'`
 *     from the scanner. `undefined` is treated identically to
 *     `'unknown'` so the input is forgiving for callers that have not
 *     wired the field yet.
 */
export interface React19MigrationContextInput {
  /** Exact `react` version string from `dependencies` / `devDependencies`. */
  readonly reactVersion?: string;
  /** Exact `react-dom` version string, when declared. */
  readonly reactDomVersion?: string;
  /** Whether the scanner was able to read a `package.json` for the project. */
  readonly packageJsonPresent: boolean;
  /**
   * Concrete package manager inferred from lockfiles. Treated as
   * "not detected" when the value is `'unknown'` or `undefined`.
   */
  readonly packageManager?: React19PackageManager;
}

/**
 * Structured outcome of the compute step.
 *
 *   `context` is defined ⇔ `status.isSupported === true`. Callers can
 *   use either field to drive branching; they are kept side-by-side so
 *   the UI does not need to encode the invariant itself.
 */
export interface React19MigrationContextResult {
  readonly context?: React19MigrationContext;
  readonly status: React19SupportStatus;
}

/**
 * Compute the React 19 migration context for a single project.
 *
 * Decision order (first match wins, matches `docs/DEV_PLAN_V1.md` §R2):
 *
 *   1.  `package.json` missing                  → `package-json-missing`
 *   2.  Package manager not detected            → `package-manager-not-detected`
 *   3.  `react` not declared                    → `react-not-found`
 *   4.  `react` version cannot be parsed        → `react-version-unparseable`
 *   5.  React major < 16                        → `react-major-below-minimum`
 *   6.  React major > 19                        → `react-major-above-target`
 *   7.  React major === 19                      → `react-major-is-target`
 *   8.  `react-dom` not declared                → `react-dom-not-found`
 *   9.  `react-dom` version cannot be parsed    → `react-dom-version-unparseable`
 *   10. `react-dom` and `react` majors disagree → `react-dom-major-mismatch`
 *   11. otherwise (React 16 / 17 / 18 aligned)  → `supported-react-{major}`
 *
 * Why this exact order:
 *
 *   - Foundation signals (package.json, lockfile) are checked before
 *     dependency signals — without them no migration plan is meaningful.
 *   - `react-dom` is checked AFTER react's major is confirmed in the
 *     16 / 17 / 18 range; React 19 / pre-16 / unparseable-react cases
 *     produce a more useful blocker than a chained `react-dom-not-found`.
 *
 * Plan-generation gate: `canGeneratePlan === true` only for the
 * `supported-react-{16|17|18}` branch. The migration-plan screen and
 * Planner V2 must refuse to generate when this is `false`.
 */
export function computeReact19MigrationContext(
  input: React19MigrationContextInput,
): React19MigrationContextResult {
  const packageManager = normalisePackageManager(input.packageManager);

  // 1. package.json missing
  if (!input.packageJsonPresent) {
    return {
      status: buildStatus({
        isSupported: false,
        status: 'blocked',
        code: 'package-json-missing',
        message:
          'React 19 migration planning is blocked because package.json was not found.',
        canGeneratePlan: false,
        packageManager,
      }),
    };
  }

  // 2. Package manager not detected
  if (packageManager === 'unknown') {
    return {
      status: buildStatus({
        isSupported: false,
        status: 'blocked',
        code: 'package-manager-not-detected',
        message:
          'React 19 migration planning is blocked because no supported package manager lockfile was detected.',
        canGeneratePlan: false,
        packageManager,
      }),
    };
  }

  // 3. React not declared
  if (input.reactVersion === undefined || input.reactVersion.length === 0) {
    return {
      status: buildStatus({
        isSupported: false,
        status: 'blocked',
        code: 'react-not-found',
        message:
          'React 19 migration planning is blocked because this project does not declare a React dependency.',
        canGeneratePlan: false,
        packageManager,
      }),
    };
  }

  const sourceReactMajor = parseReactMajor(input.reactVersion);
  const hasReactDom =
    input.reactDomVersion !== undefined && input.reactDomVersion.length > 0;
  const reactDomMajor = hasReactDom
    ? parseReactMajor(input.reactDomVersion)
    : undefined;

  // 4. React version cannot be parsed
  if (sourceReactMajor === undefined) {
    return {
      status: buildStatus({
        isSupported: false,
        status: 'unknown',
        code: 'react-version-unparseable',
        message:
          'React 19 migration planning is blocked because the React version could not be parsed safely.',
        canGeneratePlan: false,
        packageManager,
        sourceReactVersion: input.reactVersion,
        ...(hasReactDom ? { reactDomVersion: input.reactDomVersion } : {}),
        ...(reactDomMajor !== undefined ? { reactDomMajor } : {}),
      }),
    };
  }

  // 5. React below 16
  if (sourceReactMajor < MIN_SUPPORTED_SOURCE_MAJOR) {
    return {
      status: buildStatus({
        isSupported: false,
        status: 'blocked',
        code: 'react-major-below-minimum',
        message:
          'React 19 migration planning is blocked because this project uses React below version 16.',
        canGeneratePlan: false,
        packageManager,
        sourceReactVersion: input.reactVersion,
        sourceReactMajor,
        ...(hasReactDom ? { reactDomVersion: input.reactDomVersion } : {}),
        ...(reactDomMajor !== undefined ? { reactDomMajor } : {}),
      }),
    };
  }

  // 6. React above 19 (e.g. an as-yet-unreleased future major)
  if (sourceReactMajor > REACT_MIGRATION_TARGET_MAJOR) {
    return {
      status: buildStatus({
        isSupported: false,
        status: 'blocked',
        code: 'react-major-above-target',
        message:
          'React 19 migration planning is blocked because this project is already above the React 19 target range.',
        canGeneratePlan: false,
        packageManager,
        sourceReactVersion: input.reactVersion,
        sourceReactMajor,
        ...(hasReactDom ? { reactDomVersion: input.reactDomVersion } : {}),
        ...(reactDomMajor !== undefined ? { reactDomMajor } : {}),
      }),
    };
  }

  // 7. React 19 project — out of scope for the 16/17/18 → 19 pilot.
  if (sourceReactMajor === REACT_MIGRATION_TARGET_MAJOR) {
    return {
      status: buildStatus({
        isSupported: false,
        status: 'warning',
        code: 'react-major-is-target',
        message:
          'This project already uses React 19. The React 16/17/18 to React 19 migration pilot is not required.',
        canGeneratePlan: false,
        packageManager,
        sourceReactVersion: input.reactVersion,
        sourceReactMajor,
        ...(hasReactDom ? { reactDomVersion: input.reactDomVersion } : {}),
        ...(reactDomMajor !== undefined ? { reactDomMajor } : {}),
      }),
    };
  }

  // 8. React DOM missing
  if (!hasReactDom) {
    return {
      status: buildStatus({
        isSupported: false,
        status: 'blocked',
        code: 'react-dom-not-found',
        message:
          'React 19 migration planning is blocked because react-dom is not declared.',
        canGeneratePlan: false,
        packageManager,
        sourceReactVersion: input.reactVersion,
        sourceReactMajor,
      }),
    };
  }

  // 9. React DOM version cannot be parsed
  if (reactDomMajor === undefined) {
    return {
      status: buildStatus({
        isSupported: false,
        status: 'unknown',
        code: 'react-dom-version-unparseable',
        message:
          'React 19 migration planning is blocked because the React DOM version could not be parsed safely.',
        canGeneratePlan: false,
        packageManager,
        sourceReactVersion: input.reactVersion,
        sourceReactMajor,
        reactDomVersion: input.reactDomVersion,
      }),
    };
  }

  // 10. React / React DOM major mismatch
  if (reactDomMajor !== sourceReactMajor) {
    return {
      status: buildStatus({
        isSupported: false,
        status: 'blocked',
        code: 'react-dom-major-mismatch',
        message:
          'React 19 migration planning is blocked because React and React DOM major versions do not match.',
        canGeneratePlan: false,
        packageManager,
        sourceReactVersion: input.reactVersion,
        sourceReactMajor,
        reactDomVersion: input.reactDomVersion,
        reactDomMajor,
      }),
    };
  }

  // 11. Supported React 16 / 17 / 18 with aligned react-dom.
  const supportedMajor = sourceReactMajor as ReactMigrationSourceMajor;
  const track = TRACK_BY_SOURCE_MAJOR[supportedMajor];
  const supportedCode = SUPPORTED_CODE_BY_MAJOR[supportedMajor];
  const supportedMessage = SUPPORTED_MESSAGE_BY_MAJOR[supportedMajor];

  const context: React19MigrationContext = {
    sourceReactVersion: input.reactVersion,
    sourceReactMajor: supportedMajor,
    targetReactMajor: REACT_MIGRATION_TARGET_MAJOR,
    track,
    recommendedPhases: REACT_MIGRATION_PHASES_BY_TRACK[track],
  };

  return {
    context,
    status: buildStatus({
      isSupported: true,
      status: 'supported',
      code: supportedCode,
      message: supportedMessage,
      canGeneratePlan: true,
      packageManager,
      sourceReactVersion: input.reactVersion,
      sourceReactMajor: supportedMajor,
      reactDomVersion: input.reactDomVersion,
      reactDomMajor,
    }),
  };
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Minimum source React major Migrate Pilot V1 can migrate from. Encoded
 * as a constant so the boundary is testable without re-deriving it from
 * the `ReactMigrationSourceMajor` literal union.
 */
const MIN_SUPPORTED_SOURCE_MAJOR = 16 as const;

const TRACK_BY_SOURCE_MAJOR: Readonly<
  Record<ReactMigrationSourceMajor, ReactMigrationTrack>
> = {
  16: 'react-16-to-19',
  17: 'react-17-to-19',
  18: 'react-18-to-19',
};

const SUPPORTED_CODE_BY_MAJOR: Readonly<
  Record<ReactMigrationSourceMajor, React19SupportReasonCode>
> = {
  16: 'supported-react-16',
  17: 'supported-react-17',
  18: 'supported-react-18',
};

const SUPPORTED_MESSAGE_BY_MAJOR: Readonly<
  Record<ReactMigrationSourceMajor, string>
> = {
  16: 'This React 16 project is supported for the React 19 migration pilot.',
  17: 'This React 17 project is supported for the React 19 migration pilot.',
  18: 'This React 18 project is supported for the React 19 migration pilot.',
};

/**
 * Parse the React major version from an npm semver string.
 *
 * Accepts the forms documented in the V1 scope:
 *
 *   `"16.14.0"`, `"^16.14.0"`, `"~17.0.2"`, `"18.2.0"`, `"^18.3.1"`,
 *   `">=18.0.0 <19.0.0"`, `">=17"`, `"18"`.
 *
 * Returns `undefined` when:
 *
 *   - the string is empty / whitespace only,
 *   - the string contains no digits at all (e.g. `"latest"`, `"next"`,
 *     `"workspace:*"`, `"file:../local-react"`),
 *   - the leading token before the first digit is not a semver-shaped
 *     range operator (range protocols like `workspace:` and `file:` are
 *     explicitly rejected so we don't silently mis-parse a path like
 *     `file:./vendor/react-16.0.0` as React 16).
 *
 * Notes:
 *
 *   - We deliberately tolerate optional range operators (`^`, `~`,
 *     `>=`, `>`, `<=`, `<`, `=`, `||`) and whitespace before the first
 *     digit.
 *   - We do NOT pre-resolve ranges. The migration plan cares about the
 *     declared major; if the lockfile pins something else, the
 *     resolution mismatch is a planner-V2 concern.
 */
export function parseReactMajor(
  version: string | undefined,
): number | undefined {
  if (version === undefined) return undefined;
  const trimmed = version.trim();
  if (trimmed.length === 0) return undefined;

  // Reject npm "protocol" specifiers explicitly — they happen to contain
  // digits but never describe a semver range we should parse.
  // Examples: workspace:*, file:../react, npm:@scope/react@18, link:./pkg, git+https://…
  if (UNPARSEABLE_PROTOCOL_RE.test(trimmed)) return undefined;

  // Tags like "latest" / "next" / "*" do not encode a numeric major.
  if (trimmed === '*' || /^[a-z][a-z0-9-]*$/i.test(trimmed)) return undefined;

  const match = trimmed.match(/(\d+)/);
  if (!match || match[1] === undefined) return undefined;
  const major = Number.parseInt(match[1], 10);
  return Number.isFinite(major) ? major : undefined;
}

/**
 * Range protocols that may carry digits but never describe a parseable
 * semver range. Rejected up-front so the safe parser stays "no false
 * positives" — i.e. we'd rather block planning on an ambiguous version
 * than silently mis-classify it.
 */
const UNPARSEABLE_PROTOCOL_RE =
  /^(workspace:|file:|link:|npm:|git\+|git:|https?:|portal:|catalog:)/i;

function normalisePackageManager(
  value: React19PackageManager | undefined,
): React19PackageManager {
  return value ?? 'unknown';
}

/**
 * Internal helper used by every branch above to build a
 * {@link React19SupportStatus} while respecting `exactOptionalPropertyTypes`.
 *
 * Each optional field is only added to the resulting object when a real
 * value is available — undefined entries are filtered out so callers
 * never have to assert on the presence of a field they expect.
 */
function buildStatus(args: {
  readonly isSupported: boolean;
  readonly status: React19SupportLevel;
  readonly code: React19SupportReasonCode;
  readonly message: string;
  readonly canGeneratePlan: boolean;
  readonly packageManager?: React19PackageManager;
  readonly sourceReactVersion?: string;
  readonly sourceReactMajor?: number;
  readonly reactDomVersion?: string;
  readonly reactDomMajor?: number;
}): React19SupportStatus {
  return {
    isSupported: args.isSupported,
    status: args.status,
    code: args.code,
    message: args.message,
    canGeneratePlan: args.canGeneratePlan,
    ...(args.packageManager !== undefined
      ? { packageManager: args.packageManager }
      : {}),
    ...(args.sourceReactVersion !== undefined
      ? { sourceReactVersion: args.sourceReactVersion }
      : {}),
    ...(args.sourceReactMajor !== undefined
      ? { sourceReactMajor: args.sourceReactMajor }
      : {}),
    ...(args.reactDomVersion !== undefined
      ? { reactDomVersion: args.reactDomVersion }
      : {}),
    ...(args.reactDomMajor !== undefined
      ? { reactDomMajor: args.reactDomMajor }
      : {}),
  };
}
