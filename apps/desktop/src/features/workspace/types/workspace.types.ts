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
import type { React19MigrationPlanV2 } from '@features/migration-plan';

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
/* Phase R5 — Persisted workspace metadata                                    */
/* -------------------------------------------------------------------------- */

/**
 * Coarse package-manager identification carried with the persisted
 * workspace state. Mirrors the planner-facing union but normalises the
 * scanner's `bun` value to `unknown` since the workspace step only
 * cares about the dominant Node-ecosystem package managers.
 */
export type WorkspacePackageManager = 'npm' | 'yarn' | 'pnpm' | 'unknown';

/**
 * Baseline Git status snapshot captured at the moment the workspace is
 * created. Persisted verbatim so the execution screen can show the
 * starting commit/branch + dirty-file list without re-running a Git
 * inspection (the Tauri `workspace_create` flow already verified the
 * working tree was clean before the worktree was created).
 */
export interface WorkspaceGitStatus {
  readonly isGitRepository: boolean;
  readonly isClean: boolean;
  readonly currentBranch?: string;
  readonly changedFiles?: readonly string[];
  readonly summary?: string;
}

/**
 * Phase R5 canonical workspace metadata.
 *
 * `WorkspaceState` is the persisted post-creation contract that the
 * execution screen, diff review, and any future orchestrator stages
 * consume. It deliberately keeps a flat shape so it can be serialised
 * to `localStorage` and to the on-disk session artifact under
 * `.migration-orchestrator/session/workspace.json` without
 * normalisation.
 *
 * Field semantics:
 *   - `originalProjectPath` — the immutable read-only source path. The
 *     workspace step is the only place we ever record it; downstream
 *     features must use `workspacePath` for any mutation.
 *   - `workspacePath` — the migration workspace root. Always created
 *     outside `originalProjectPath`.
 *   - `branchName` — non-empty for `git-worktree`. The copy fallback
 *     also stores a branch-shaped label (without ever creating a
 *     branch) so the UI can render a stable identifier for the
 *     workspace.
 *   - `gitStatus` — snapshot at workspace-creation time only. Not
 *     refreshed automatically.
 *   - `planId` — id of the approved plan the workspace was bound to.
 *     `clearIfPlanChanges` invalidates the workspace when this id no
 *     longer matches the active plan.
 */
export interface WorkspaceState {
  readonly originalProjectPath: string;
  readonly workspacePath: string;
  readonly branchName: string;
  readonly strategy: WorkspaceStrategy;
  readonly createdAt: string;
  readonly gitStatus: WorkspaceGitStatus;
  readonly packageManager?: WorkspacePackageManager;
  readonly planId: string;
}

/**
 * Request payload sent into the workspace creation pipeline (Phase R5).
 *
 * Built by the workspace screen from the approved plan + selected
 * project + scanner-derived package manager. The store/service layer
 * is the only consumer — it merges the request with the preflight
 * output (proposed branch + path + strategy) and dispatches the Tauri
 * `workspace_create` command.
 */
export interface CreateWorkspaceRequest {
  readonly originalProjectPath: string;
  readonly planId: string;
  readonly planSnapshot: React19MigrationPlanV2;
  readonly packageManager?: WorkspacePackageManager;
  readonly preferredStrategy?: WorkspaceStrategy;
}

/**
 * Result envelope produced by the workspace creation pipeline.
 *
 * `success: true` means a `WorkspaceState` was persisted and the
 * execution screen can advance. `success: false` carries an `error`
 * string the UI renders verbatim. `warnings` lists non-fatal advisories
 * (e.g. fallback strategy selected, missing package manager).
 */
export interface CreateWorkspaceResult {
  readonly success: boolean;
  readonly workspace?: WorkspaceState;
  readonly error?: string;
  readonly warnings?: readonly string[];
}

/**
 * Plan snapshot persisted alongside `WorkspaceState`.
 *
 * Captures only the fields the workspace/execution layer needs from
 * the approved plan so that downstream consumers can keep working even
 * if the upstream `MigrationPlan` schema evolves.
 */
export interface WorkspacePlanSnapshot {
  readonly planId: string;
  readonly planVersion: string;
  readonly track: React19MigrationPlanV2['track'];
  readonly title: string;
  readonly summaryText: string;
  readonly sourceReactVersion: string;
  readonly targetReactVersion: '19';
  readonly approvedAt?: string;
  readonly steps: React19MigrationPlanV2['steps'];
  readonly workspacePath: string;
  readonly branchName: string;
  readonly strategy: WorkspaceStrategy;
  readonly createdAt: string;
}

/* -------------------------------------------------------------------------- */
/* Validation                                                                 */
/* -------------------------------------------------------------------------- */

export interface WorkspaceStateValidation {
  readonly valid: boolean;
  readonly reasons: readonly string[];
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
  readonly workspace?: WorkspaceState;
  readonly planSnapshot?: WorkspacePlanSnapshot;
  readonly error?: WorkspaceError;
  /**
   * The plan id the preflight + result snapshot were captured against.
   * Used to invalidate the workspace if the upstream plan changes.
   */
  readonly planId?: string;
}
