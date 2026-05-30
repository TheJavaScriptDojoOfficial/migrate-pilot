/**
 * Milestone 2 — Project Selection types.
 *
 * Why these live in a feature folder, not in `shared/types/`:
 *   `shared/types/` holds *cross-feature* domain models (Project,
 *   MigrationSession, ScanReport). These types are tightly scoped to the
 *   project-selection workflow step — they describe the validation pipeline
 *   that converts a raw filesystem snapshot into a vetted ProjectMetadata
 *   record. Future steps (scanner, planner) consume the result via
 *   `useSessionStore.project`, never via this state machine.
 */

/**
 * Concrete package manager inferred from lock files. `unknown` means we
 * could not determine one — this surfaces as a non-fatal warning so the
 * user can still continue the workflow if they intend to install later.
 */
export type PackageManager = 'npm' | 'yarn' | 'pnpm' | 'bun' | 'unknown';

/**
 * State machine for the project-selection screen.
 *
 *   idle       → no folder picked yet
 *   selecting  → native folder picker is open (best-effort signal)
 *   validating → metadata read in flight
 *   valid      → metadata read OK and required signals are present
 *   invalid    → metadata read OK but required signals are missing
 *                (e.g. package.json absent, React not in deps)
 *   error      → the read itself failed (path inaccessible, IPC error)
 */
export type ProjectValidationStatus =
  | 'idle'
  | 'selecting'
  | 'validating'
  | 'valid'
  | 'invalid'
  | 'error';

export interface ProjectMetadataScripts {
  readonly start?: string;
  readonly dev?: string;
  readonly build?: string;
  readonly test?: string;
  readonly lint?: string;
  readonly typecheck?: string;
}

/**
 * Vetted, UI-ready metadata snapshot for the selected project.
 *
 * Only emitted once validation has succeeded. The shape is intentionally
 * compact so it can be persisted later without bloating the session store.
 */
export interface ProjectMetadata {
  readonly path: string;
  readonly name: string;
  readonly packageManager: PackageManager;
  readonly reactVersion?: string;
  readonly reactDomVersion?: string;
  readonly isGitRepository: boolean;
  readonly currentBranch?: string;
  readonly hasTypeScript: boolean;
  readonly scripts: ProjectMetadataScripts;
}

export type ProjectValidationIssueType = 'error' | 'warning' | 'info';

/**
 * Stable error codes the UI can branch on (icons, copy, follow-up actions).
 * Add a new code here whenever a new validation rule is introduced — the
 * union is exhaustively switched in `ProjectValidationIssues`.
 */
export type ProjectValidationIssueCode =
  | 'PACKAGE_JSON_MISSING'
  | 'PACKAGE_JSON_INVALID'
  | 'REACT_NOT_FOUND'
  | 'GIT_NOT_FOUND'
  | 'LOCK_FILE_NOT_FOUND'
  | 'UNKNOWN_PACKAGE_MANAGER'
  | 'METADATA_READ_FAILED'
  | 'PICKER_UNAVAILABLE';

export interface ProjectValidationIssue {
  readonly type: ProjectValidationIssueType;
  readonly code: ProjectValidationIssueCode;
  readonly title: string;
  readonly description: string;
}

/**
 * Top-level state owned by the project-selection store.
 *
 * `metadata` is populated whenever a read succeeds — even when validation
 * fails afterwards — so the UI can show partial information ("we found a
 * package.json but no React dependency") rather than a useless empty card.
 */
export interface ProjectSelectionState {
  readonly status: ProjectValidationStatus;
  readonly metadata?: ProjectMetadata;
  readonly issues: readonly ProjectValidationIssue[];
}
