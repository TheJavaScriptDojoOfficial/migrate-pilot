/**
 * React 19 migration — domain types.
 *
 * Rework Milestone R1 — Product Rebaseline to React 19 Migration Pilot.
 *
 * These types are the shared language for Scanner V2, Planner V2, and
 * Executor V2. They describe the React 19 migration target, the chosen
 * track for a given source project, and the recommended phases.
 *
 * Scope rules for R1:
 *   - These types are intentionally minimal and stable.
 *   - R1 only ADDS the types; it does NOT wire them into the scanner,
 *     planner, or executor yet. That happens in Scanner V2 / Planner V2 /
 *     Executor V2.
 *   - The Scanner V2 milestone will compute a `React19MigrationContext`
 *     from the deterministic scan report; Planner V2 will turn it into
 *     `ReactMigrationPhase`-tagged steps; Executor V2 will dispatch on
 *     phase + executor metadata.
 *
 * Why these live in a feature folder, not in `shared/types/`:
 *   `shared/types/` is reserved for cross-feature primitives. React 19
 *   migration is a first-class product feature with its own state
 *   machine and UI surface, so it owns its own types.
 */

/* -------------------------------------------------------------------------- */
/* Source / target                                                            */
/* -------------------------------------------------------------------------- */

/**
 * The set of source React major versions Migrate Pilot V1 can migrate
 * from. Anything outside this set is unsupported in V1.
 */
export type ReactMigrationSourceMajor = 16 | 17 | 18;

/**
 * The target React major version for V1. Pinned to React 19.
 *
 * Encoded as a literal (not `number`) so the compiler can prove the
 * target is 19 wherever this type is used.
 */
export type ReactMigrationTargetMajor = 19;

/* -------------------------------------------------------------------------- */
/* Track                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Migration track — the high-level shape of the React 19 upgrade for a
 * given source major.
 *
 *   `react-16-to-19`  React 16 → React 18 bridge → React 19.
 *   `react-17-to-19`  React 17 → React 18 bridge → React 19.
 *   `react-18-to-19`  React 18 → React 19 directly (no bridge).
 *
 * The track is derived from the detected source major; the planner uses
 * it to decide whether to include the `react-18-bridge` phase.
 */
export type ReactMigrationTrack =
  | 'react-16-to-19'
  | 'react-17-to-19'
  | 'react-18-to-19';

/* -------------------------------------------------------------------------- */
/* Phases                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * React 19 migration phases. The order here matches the recommended
 * execution order — earlier phases unlock later ones.
 *
 *   preflight             Environment + version checks.
 *   tooling               Build tool, TypeScript, ESLint, test runner.
 *   react-18-bridge       `createRoot`, new JSX transform (React 16/17
 *                         sources only — skipped for React 18 sources).
 *   api-compatibility     `ReactDOM.render`, `findDOMNode`, string refs,
 *                         legacy context, deprecated lifecycles,
 *                         `propTypes` / `defaultProps`.
 *   jsx-transform         `tsconfig` / Babel / Vite alignment for React 19.
 *   react-19-upgrade      Upgrade `react`, `react-dom`, types to React 19.
 *   source-modernization  Small, safe modernization (functional comps,
 *                         hooks, ref-as-prop, `use` hook).
 *   validation            Lint, typecheck, tests, build.
 *   final-review          Generate the React 19 migration summary.
 */
export type ReactMigrationPhase =
  | 'preflight'
  | 'tooling'
  | 'react-18-bridge'
  | 'api-compatibility'
  | 'jsx-transform'
  | 'react-19-upgrade'
  | 'source-modernization'
  | 'validation'
  | 'final-review';

/**
 * Legacy risk-engine phase ids (R3). These remain supported so Planner V2 can
 * adapt older risk phase buckets into canonical plan phases.
 */
export type React19RiskEnginePhase =
  | 'preflight'
  | 'tooling'
  | 'react-bridge'
  | 'api-compatibility'
  | 'dependency-modernization'
  | 'typescript-readiness'
  | 'routing-readiness'
  | 'testing-readiness'
  | 'validation-readiness';

/* -------------------------------------------------------------------------- */
/* Context                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * React 19 migration context for a single project.
 *
 * Produced by Scanner V2 (future milestone) from the deterministic scan
 * report. Consumed by Planner V2 to seed the React 19 migration plan
 * (track + phases + steps) and by the UI to communicate the chosen
 * direction to the user.
 *
 * Fields:
 *   `sourceReactVersion`  The exact React version string detected in
 *                         `package.json` (e.g. `"^17.0.2"`,
 *                         `"18.2.0"`). Kept as a string so we never lose
 *                         precision (pre-releases, range operators).
 *   `sourceReactMajor`    The derived source major (16, 17, or 18).
 *   `targetReactMajor`    Always `19` in V1.
 *   `track`               One of the three React 19 migration tracks.
 *   `recommendedPhases`   Phases the planner should include for this
 *                         project, in execution order. The
 *                         `react-18-bridge` phase is omitted for the
 *                         `react-18-to-19` track.
 */
export interface React19MigrationContext {
  readonly sourceReactVersion: string;
  readonly sourceReactMajor: ReactMigrationSourceMajor;
  readonly targetReactMajor: ReactMigrationTargetMajor;
  readonly track: ReactMigrationTrack;
  readonly recommendedPhases: readonly ReactMigrationPhase[];
}

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * The target React major version for V1. Exposed as a constant so the UI
 * and future planner can use the same literal value the type pins.
 */
export const REACT_MIGRATION_TARGET_MAJOR: ReactMigrationTargetMajor = 19;

/**
 * Phases ordered for the V1 React 19 migration. Useful for sorting,
 * rendering progress timelines, and validating planner output.
 */
export const REACT_MIGRATION_PHASES_ORDERED: readonly ReactMigrationPhase[] = [
  'preflight',
  'tooling',
  'react-18-bridge',
  'api-compatibility',
  'jsx-transform',
  'react-19-upgrade',
  'source-modernization',
  'validation',
  'final-review',
];

/**
 * Canonical React 19 phase order consumed by Planner/Plan UI.
 */
export const REACT_19_CANONICAL_PHASE_ORDER: readonly ReactMigrationPhase[] =
  REACT_MIGRATION_PHASES_ORDERED;

const REACT_19_PHASE_LABELS: Readonly<Record<ReactMigrationPhase, string>> = {
  preflight: 'Preflight',
  tooling: 'Tooling',
  'react-18-bridge': 'React 18 bridge',
  'api-compatibility': 'API compatibility',
  'jsx-transform': 'JSX transform',
  'react-19-upgrade': 'React 19 upgrade',
  'source-modernization': 'Source modernization',
  validation: 'Validation',
  'final-review': 'Final review',
};

const REACT_19_PHASE_DESCRIPTIONS: Readonly<Record<ReactMigrationPhase, string>> = {
  preflight: 'Validate repository, package manager, and migration prerequisites.',
  tooling: 'Align bundler/build tooling for stable React 19 migration runs.',
  'react-18-bridge':
    'Bridge React 16/17 projects through React 18 compatibility before React 19.',
  'api-compatibility':
    'Resolve deprecated or legacy React API usage incompatible with modern React.',
  'jsx-transform': 'Enable and verify the modern JSX transform path.',
  'react-19-upgrade': 'Upgrade React/React DOM packages and core dependency alignment.',
  'source-modernization':
    'Modernize project source patterns and supporting readiness tracks.',
  validation: 'Run lint/typecheck/test/build gates to verify migration stability.',
  'final-review': 'Confirm migration outcomes and capture final rollout review.',
};

const RISK_ENGINE_PHASE_TO_CANONICAL_PHASE: Readonly<
  Record<React19RiskEnginePhase, ReactMigrationPhase>
> = {
  preflight: 'preflight',
  tooling: 'tooling',
  'react-bridge': 'react-18-bridge',
  'api-compatibility': 'api-compatibility',
  'dependency-modernization': 'react-19-upgrade',
  'typescript-readiness': 'source-modernization',
  'routing-readiness': 'source-modernization',
  'testing-readiness': 'validation',
  'validation-readiness': 'validation',
};

const JSX_TRANSFORM_RISK_ISSUE_CODES = new Set<string>([
  'jsx-transform-classic',
  'jsx-transform-config-not-detected',
  'jsx-transform-outdated',
]);

export function getReactMigrationPhaseLabel(phase: ReactMigrationPhase): string {
  return REACT_19_PHASE_LABELS[phase];
}

export function getReactMigrationPhaseDescription(phase: ReactMigrationPhase): string {
  return REACT_19_PHASE_DESCRIPTIONS[phase];
}

export function getReactMigrationPhaseOrder(phase: ReactMigrationPhase): number {
  return REACT_19_CANONICAL_PHASE_ORDER.indexOf(phase);
}

/**
 * Adapter for R3 risk-engine phases into canonical plan phases.
 *
 * JSX transform issue codes are always elevated to the dedicated `jsx-transform`
 * phase, even when risk-engine metadata tags them as `tooling`.
 */
export function mapRiskEnginePhaseToReactMigrationPhase(
  phase: React19RiskEnginePhase,
  sourceIssueCode?: string,
): ReactMigrationPhase {
  if (
    phase === 'tooling' &&
    sourceIssueCode !== undefined &&
    (JSX_TRANSFORM_RISK_ISSUE_CODES.has(sourceIssueCode) ||
      sourceIssueCode.startsWith('jsx-transform-'))
  ) {
    return 'jsx-transform';
  }
  return RISK_ENGINE_PHASE_TO_CANONICAL_PHASE[phase];
}

/**
 * Recommended phases per migration track.
 *
 * React 16 / 17 → React 19 routes through React 18, so the
 * `react-18-bridge` phase is required. React 18 → React 19 is a direct
 * upgrade and skips the bridge.
 *
 * The arrays are deliberately frozen-shaped (`readonly`) and ordered so
 * the UI and the future planner can render the same sequence without
 * re-sorting.
 */
export const REACT_MIGRATION_PHASES_BY_TRACK: Readonly<
  Record<ReactMigrationTrack, readonly ReactMigrationPhase[]>
> = {
  'react-16-to-19': [
    'preflight',
    'tooling',
    'react-18-bridge',
    'api-compatibility',
    'jsx-transform',
    'react-19-upgrade',
    'source-modernization',
    'validation',
    'final-review',
  ],
  'react-17-to-19': [
    'preflight',
    'tooling',
    'react-18-bridge',
    'api-compatibility',
    'react-19-upgrade',
    'validation',
    'final-review',
  ],
  'react-18-to-19': [
    'preflight',
    'api-compatibility',
    'react-19-upgrade',
    'validation',
    'final-review',
  ],
};

/* -------------------------------------------------------------------------- */
/* Support status                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Coarse "buckets" the report UI dispatches on to pick tone/iconography:
 *
 *   `supported`  React 16/17/18 source, react and react-dom present and
 *                aligned. Plan generation is unlocked.
 *   `blocked`    A hard precondition is missing (no package.json, no
 *                package manager, no react / react-dom, major out of
 *                supported range, mismatched majors, …). Plan generation
 *                must be refused.
 *   `warning`    The project is already on React 19. Migration is not
 *                required but the scanner is not in an error state.
 *   `unknown`    A required version string could not be parsed safely
 *                (e.g. `workspace:*`, `file:../react`, `latest`). The
 *                scanner cannot make a confident decision; plan
 *                generation is gated until the user resolves the
 *                ambiguity.
 */
export type React19SupportLevel =
  | 'supported'
  | 'blocked'
  | 'warning'
  | 'unknown';

/**
 * Stable codes describing why React 19 migration planning is or is not
 * supported for the scanned project. Switched exhaustively by the UI so
 * each blocker can render a tailored copy line.
 *
 *   `supported-react-16`               React 16 source, plan can proceed.
 *   `supported-react-17`               React 17 source, plan can proceed.
 *   `supported-react-18`               React 18 source, plan can proceed.
 *   `package-json-missing`             The deterministic scanner could
 *                                      not locate `package.json`.
 *   `package-manager-not-detected`     No supported lockfile
 *                                      (`package-lock.json`, `yarn.lock`,
 *                                      `pnpm-lock.yaml`, `bun.lockb` /
 *                                      `bun.lock`) was found.
 *   `react-not-found`                  `package.json` parsed but neither
 *                                      `dependencies` nor
 *                                      `devDependencies` declared
 *                                      `react`.
 *   `react-version-unparseable`        `react` is declared but the
 *                                      version string did not yield a
 *                                      numeric major (e.g.
 *                                      `workspace:*`, `latest`).
 *   `react-major-below-minimum`        Detected React major is below 16
 *                                      (e.g. 0.x / 15.x).
 *   `react-major-above-target`         Detected React major is above 19
 *                                      (a future React version we do not
 *                                      plan for).
 *   `react-major-is-target`            Project already runs React 19 —
 *                                      nothing to migrate.
 *   `react-dom-not-found`              `react-dom` is not declared.
 *   `react-dom-version-unparseable`    `react-dom` is declared but its
 *                                      version string did not yield a
 *                                      numeric major.
 *   `react-dom-major-mismatch`         `react` and `react-dom` declare
 *                                      different majors. The migration
 *                                      cannot proceed until they agree.
 */
export type React19SupportReasonCode =
  | 'supported-react-16'
  | 'supported-react-17'
  | 'supported-react-18'
  | 'package-json-missing'
  | 'package-manager-not-detected'
  | 'react-not-found'
  | 'react-version-unparseable'
  | 'react-major-below-minimum'
  | 'react-major-above-target'
  | 'react-major-is-target'
  | 'react-dom-not-found'
  | 'react-dom-version-unparseable'
  | 'react-dom-major-mismatch';

/**
 * Concrete package manager inferred from the project lockfile (mirrors
 * `PackageManager` from `@features/project-selection`). Redeclared here
 * so the React 19 status type stays a leaf module with no inbound
 * dependencies on other features.
 */
export type React19PackageManager =
  | 'npm'
  | 'yarn'
  | 'pnpm'
  | 'bun'
  | 'unknown';

/**
 * Structured status describing whether a project qualifies for the V1
 * React 19 migration path.
 *
 * Shape contract
 * --------------
 *   - `isSupported` is `true` only when the source React major is 16, 17,
 *     or 18 AND `react-dom` is declared, parseable, and its major matches
 *     `react`. In every other case `isSupported` is `false`.
 *   - `status` is the coarse bucket the UI dispatches on (`supported` /
 *     `blocked` / `warning` / `unknown`).
 *   - `canGeneratePlan` is the single boolean Planner V2 and the
 *     migration-plan UI must gate on. It is always `true` for
 *     `status === 'supported'` and `false` otherwise.
 *   - `message` is a fully-formed, user-facing copy line tailored to the
 *     `code`. The UI never has to compose its own sentence — it can
 *     surface `message` directly.
 *
 * The `sourceReactVersion` / `sourceReactMajor` / `reactDomVersion` /
 * `reactDomMajor` / `packageManager` fields are mirrored on every branch
 * so consumers always have the same shape to read.
 */
export interface React19SupportStatus {
  readonly isSupported: boolean;
  readonly status: React19SupportLevel;
  readonly code: React19SupportReasonCode;
  readonly message: string;
  readonly canGeneratePlan: boolean;
  readonly sourceReactVersion?: string;
  readonly sourceReactMajor?: number;
  readonly reactDomVersion?: string;
  readonly reactDomMajor?: number;
  readonly packageManager?: React19PackageManager;
}
