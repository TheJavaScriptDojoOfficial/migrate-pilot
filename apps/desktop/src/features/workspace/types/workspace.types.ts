/**
 * Milestone 5 — Migration Workspace types.
 *
 * Why these live in the feature folder (and not `shared/types/`):
 *   `shared/types/gitWorkspace.ts` holds an older sketch reserved for the
 *   eventual orchestrator/execution layer (carries `sessionId`, `projectId`,
 *   etc.). The Milestone 5 contract is narrower — it is the local state
 *   produced by the safe Tauri preflight + worktree commands. Keeping these
 *   types feature-local keeps the workspace feature self-contained and safe
 *   to evolve without destabilising the eventual orchestrator contracts.
 *
 * Architectural rules
 * -------------------
 * - Pure types. No React, no Zustand, no IPC imports.
 * - The state machine documented here is the single source of truth used
 *   by both the store and the screen. Add a state by extending
 *   {@link WorkspaceStatus} and the exhaustive switch in
 *   `workspacePresentationService` will force every callsite to update.
 */

/* -------------------------------------------------------------------------- */
/* State machine                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Lifecycle of the workspace setup screen.
 *
 *   blocked   → no approved plan; the screen is gated.
 *   idle      → plan approved; preflight has not run yet.
 *   checking  → preflight in flight.
 *   ready     → preflight succeeded; user may create the workspace.
 *   creating  → worktree creation in flight.
 *   created   → workspace exists; workflow step is completed.
 *   failed    → either preflight or creation hit an error.
 */
export type WorkspaceStatus =
  | 'blocked'
  | 'idle'
  | 'checking'
  | 'ready'
  | 'creating'
  | 'created'
  | 'failed';

/**
 * Workspace creation strategy.
 *
 * - `git-worktree` is the default safe strategy for Git projects.
 * - `copy` is a fallback for non-Git projects. V1 surfaces the option in
 *   preflight but keeps the action disabled — implementing copy safely
 *   (skip lists, size limits, atomicity) is deferred until a later
 *   milestone. Only one of these values is ever returned by preflight.
 */
export type WorkspaceStrategy = 'git-worktree' | 'copy';

/**
 * Best-effort cleanliness signal from `git status --porcelain`.
 * `unknown` is returned when Git is unavailable or the source is not a
 * working tree at all.
 */
export type GitCleanliness = 'clean' | 'dirty' | 'unknown';

/* -------------------------------------------------------------------------- */
/* Issues                                                                     */
/* -------------------------------------------------------------------------- */

export type WorkspaceIssueSeverity = 'blocker' | 'warning' | 'info';

/**
 * Stable issue codes the UI can branch on (icon, copy, follow-up action).
 * Keep this union small — codes returned from Rust must always be members
 * of this union (the service layer validates and falls back to `UNKNOWN`
 * on drift).
 */
export type WorkspaceIssueCode =
  | 'GIT_NOT_AVAILABLE'
  | 'NOT_A_GIT_REPOSITORY'
  | 'GIT_DIRTY'
  | 'GIT_CLEANLINESS_UNKNOWN'
  | 'BRANCH_EXISTS'
  | 'WORKSPACE_PATH_EXISTS'
  | 'WORKSPACE_INSIDE_SOURCE'
  | 'COPY_FALLBACK_DISABLED'
  | 'TAURI_UNAVAILABLE'
  | 'UNKNOWN';

export interface WorkspaceIssue {
  readonly code: WorkspaceIssueCode;
  readonly severity: WorkspaceIssueSeverity;
  readonly message: string;
  readonly detail?: string;
}

/* -------------------------------------------------------------------------- */
/* Preflight                                                                  */
/* -------------------------------------------------------------------------- */

export interface WorkspacePreflight {
  readonly sourcePath: string;
  readonly projectName: string;
  readonly isGitRepository: boolean;
  readonly gitAvailable: boolean;
  readonly currentBranch?: string;
  readonly gitCleanliness: GitCleanliness;
  readonly recommendedStrategy: WorkspaceStrategy;
  readonly fallbackAvailable: boolean;
  readonly proposedBranchName: string;
  readonly proposedWorkspacePath: string;
  readonly blockers: readonly WorkspaceIssue[];
  readonly warnings: readonly WorkspaceIssue[];
}

/* -------------------------------------------------------------------------- */
/* Creation result                                                            */
/* -------------------------------------------------------------------------- */

export interface WorkspaceCommandLog {
  readonly command: string;
  readonly status: 'passed' | 'failed';
  readonly stdout?: string;
  readonly stderr?: string;
}

export interface WorkspaceCreationResult {
  readonly id: string;
  readonly sourcePath: string;
  readonly workspacePath: string;
  readonly strategy: WorkspaceStrategy;
  readonly branchName?: string;
  readonly createdAt: string;
  readonly commandLogs: readonly WorkspaceCommandLog[];
}

/* -------------------------------------------------------------------------- */
/* Errors                                                                     */
/* -------------------------------------------------------------------------- */

export type WorkspaceErrorKind =
  | 'tauri-unavailable'
  | 'no-approved-plan'
  | 'preflight-failed'
  | 'preflight-blocked'
  | 'creation-failed'
  | 'invalid-input';

export interface WorkspaceError {
  readonly kind: WorkspaceErrorKind;
  readonly message: string;
  readonly detail?: string;
}

/* -------------------------------------------------------------------------- */
/* Store-shaped state                                                         */
/* -------------------------------------------------------------------------- */

export interface WorkspaceSetupState {
  readonly status: WorkspaceStatus;
  readonly preflight?: WorkspacePreflight;
  readonly result?: WorkspaceCreationResult;
  readonly error?: WorkspaceError;
  /**
   * The plan id the preflight + result snapshot were captured against.
   * Used to invalidate the workspace if the upstream plan changes.
   */
  readonly planId?: string;
}
