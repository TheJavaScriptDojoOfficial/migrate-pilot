/**
 * React 19 migration context — deterministic compute service.
 *
 * Rework Milestone R2 — React 19 Readiness Report V2, Step 1.
 *
 * Pure, side-effect-free function that turns the React + React DOM
 * version strings detected by the deterministic scanner into either:
 *
 *   - a {@link React19MigrationContext} (when the project is a
 *     supported React 16 / 17 / 18 source), or
 *   - an unsupported {@link React19SupportStatus} with a stable reason
 *     code the UI can branch on.
 *
 * Architectural rules
 * -------------------
 *   - No React, no IPC, no filesystem — trivially unit-testable and
 *     reusable by Scanner V2 wiring, Planner V2, and any future CLI
 *     surface.
 *   - The function NEVER fabricates data. If the scanner could not see
 *     a React version, the result reflects that exactly.
 *   - All branches return both `context` (only when supported) and
 *     `status` so callers always have a structured outcome to render.
 */
import {
  REACT_MIGRATION_PHASES_BY_TRACK,
  REACT_MIGRATION_TARGET_MAJOR,
} from '../types/react19Migration.types';
import type {
  React19MigrationContext,
  React19SupportStatus,
  ReactMigrationSourceMajor,
  ReactMigrationTrack,
} from '../types/react19Migration.types';

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Inputs for the compute step. Mirrors what the deterministic scanner
 * already extracts from `package.json` — no additional plumbing needed.
 */
export interface React19MigrationContextInput {
  /** Exact `react` version string from `dependencies` / `devDependencies`. */
  readonly reactVersion?: string;
  /** Exact `react-dom` version string, when declared. */
  readonly reactDomVersion?: string;
  /**
   * Whether the scanner was able to read a `package.json` for the
   * project. The distinct "no package.json" branch produces a clearer
   * blocked-state message than "react not found".
   */
  readonly packageJsonPresent: boolean;
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
 * Decision order (first match wins):
 *
 *   1. `package.json` missing                  → `package-json-missing`
 *   2. `react` not declared                    → `react-not-found`
 *   3. `react` version cannot be parsed        → `react-version-unparseable`
 *   4. React major < 16                        → `react-major-below-minimum`
 *   5. React major === 19 (target reached)     → `react-major-is-target`
 *   6. React major > 19                        → `react-major-above-target`
 *   7. `react-dom` parsed and majors disagree  → `react-dom-major-mismatch`
 *   8. otherwise                               → `supported`
 *
 * `react-dom` mismatch is only flagged when *both* versions parse to a
 * numeric major. A missing or unparseable `react-dom` is non-fatal — V1
 * will surface it as a warning elsewhere but it does not block planning.
 */
export function computeReact19MigrationContext(
  input: React19MigrationContextInput,
): React19MigrationContextResult {
  if (!input.packageJsonPresent) {
    return {
      status: {
        isSupported: false,
        code: 'package-json-missing',
        reason:
          'package.json was not found in the selected project, so the React version cannot be detected.',
      },
    };
  }

  if (input.reactVersion === undefined || input.reactVersion.length === 0) {
    return {
      status: {
        isSupported: false,
        code: 'react-not-found',
        reason:
          'react is not declared in dependencies or devDependencies. Migrate Pilot V1 only supports projects that already use React 16, 17, or 18.',
      },
    };
  }

  const sourceReactMajor = parseReactMajor(input.reactVersion);
  const reactDomMajor =
    input.reactDomVersion !== undefined
      ? parseReactMajor(input.reactDomVersion)
      : undefined;

  const baseStatus: Pick<
    React19SupportStatus,
    'sourceReactVersion' | 'reactDomVersion'
  > = {
    sourceReactVersion: input.reactVersion,
    ...(input.reactDomVersion !== undefined
      ? { reactDomVersion: input.reactDomVersion }
      : {}),
  };

  if (sourceReactMajor === undefined) {
    return {
      status: {
        isSupported: false,
        code: 'react-version-unparseable',
        reason: `Could not parse the React major from version "${input.reactVersion}". Use a standard semver string such as "18.2.0" or "^17.0.2".`,
        ...baseStatus,
        ...(reactDomMajor !== undefined ? { reactDomMajor } : {}),
      },
    };
  }

  if (sourceReactMajor < MIN_SUPPORTED_SOURCE_MAJOR) {
    return {
      status: {
        isSupported: false,
        code: 'react-major-below-minimum',
        reason: `React ${sourceReactMajor} is below the minimum supported source version (React ${MIN_SUPPORTED_SOURCE_MAJOR}). Migrate Pilot V1 cannot plan a React 19 migration for this project.`,
        ...baseStatus,
        sourceReactMajor,
        ...(reactDomMajor !== undefined ? { reactDomMajor } : {}),
      },
    };
  }

  if (sourceReactMajor === REACT_MIGRATION_TARGET_MAJOR) {
    return {
      status: {
        isSupported: false,
        code: 'react-major-is-target',
        reason:
          'This project already runs React 19. There is nothing for Migrate Pilot to migrate.',
        ...baseStatus,
        sourceReactMajor,
        ...(reactDomMajor !== undefined ? { reactDomMajor } : {}),
      },
    };
  }

  if (sourceReactMajor > REACT_MIGRATION_TARGET_MAJOR) {
    return {
      status: {
        isSupported: false,
        code: 'react-major-above-target',
        reason: `React ${sourceReactMajor} is newer than the React ${REACT_MIGRATION_TARGET_MAJOR} target. Migrate Pilot V1 does not downgrade React.`,
        ...baseStatus,
        sourceReactMajor,
        ...(reactDomMajor !== undefined ? { reactDomMajor } : {}),
      },
    };
  }

  if (reactDomMajor !== undefined && reactDomMajor !== sourceReactMajor) {
    return {
      status: {
        isSupported: false,
        code: 'react-dom-major-mismatch',
        reason: `react (major ${sourceReactMajor}) and react-dom (major ${reactDomMajor}) declare different versions. Align them before planning the React 19 migration.`,
        ...baseStatus,
        sourceReactMajor,
        reactDomMajor,
      },
    };
  }

  // Supported: 16 | 17 | 18.
  const supportedMajor = sourceReactMajor as ReactMigrationSourceMajor;
  const track = TRACK_BY_SOURCE_MAJOR[supportedMajor];

  const context: React19MigrationContext = {
    sourceReactVersion: input.reactVersion,
    sourceReactMajor: supportedMajor,
    targetReactMajor: REACT_MIGRATION_TARGET_MAJOR,
    track,
    recommendedPhases: REACT_MIGRATION_PHASES_BY_TRACK[track],
  };

  return {
    context,
    status: {
      isSupported: true,
      code: 'supported',
      ...baseStatus,
      sourceReactMajor: supportedMajor,
      ...(reactDomMajor !== undefined ? { reactDomMajor } : {}),
    },
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

/**
 * Parse the React major version from an npm semver string.
 *
 * Accepts the forms documented in the V1 scope:
 *
 *   `"16.14.0"`, `"^16.14.0"`, `"~17.0.2"`, `"18.2.0"`, `"^18.3.1"`,
 *   `">=18.0.0 <19.0.0"`, `"18"`.
 *
 * Returns `undefined` when:
 *
 *   - the string is empty / whitespace only,
 *   - the string contains no digits at all (e.g. `"latest"`, `"next"`,
 *     `"link:../local-react"`),
 *   - the leading numeric token isn't a finite integer.
 *
 * Notes:
 *
 *   - We deliberately tolerate optional range operators (`^`, `~`,
 *     `>=`, `>`, `<=`, `<`, `=`) and whitespace before the first digit.
 *   - We do NOT pre-resolve ranges. The migration plan cares about the
 *     declared major; if the lockfile pins something else, the
 *     resolution mismatch is a planner-V2 concern.
 *   - Git / npm-alias forms like `"npm:react@18.0.0"` resolve to the
 *     first numeric token (`18`), which matches the user's intent.
 */
export function parseReactMajor(version: string | undefined): number | undefined {
  if (version === undefined) return undefined;
  const trimmed = version.trim();
  if (trimmed.length === 0) return undefined;
  // Same shape as the existing dependency parser in `scannerService.ts`
  // (extract the first digit run). Kept local so this service has zero
  // dependencies on the scanner internals.
  const match = trimmed.match(/(\d+)/);
  if (!match || match[1] === undefined) return undefined;
  const major = Number.parseInt(match[1], 10);
  return Number.isFinite(major) ? major : undefined;
}
