/**
 * Milestone 7 — Diff Review types.
 *
 * Why these live in the feature folder (and not `shared/types/`):
 *   The Milestone 7 contract is narrow — it is the local state produced by
 *   the safe Tauri `diff_load` / `diff_approve` / `diff_reject` commands
 *   plus a small UI state machine. Keeping these types feature-local keeps
 *   the diff-review feature self-contained and safe to evolve without
 *   destabilising the eventual orchestrator/session contracts.
 *
 * Architectural rules
 * -------------------
 * - Pure types. No React, no Zustand, no IPC imports.
 * - The state machine documented here is the single source of truth used
 *   by both the store and the screen.
 */

/* -------------------------------------------------------------------------- */
/* State machine                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Lifecycle of the diff review screen.
 *
 *   blocked    → no execution run / workspace / approved plan yet.
 *   idle       → prerequisites met but the diff has not been requested.
 *   loading    → `diff_load` is in flight.
 *   ready      → diff is loaded and awaiting an approve/reject decision.
 *   approving  → `diff_approve` is in flight.
 *   approved   → user approved; workflow `diff` step is complete.
 *   rejecting  → `diff_reject` is in flight.
 *   rejected   → user rejected; reverted-files list is captured.
 *   failed     → load / approve / reject hit a recoverable error.
 */
export type DiffReviewStatus =
  | 'blocked'
  | 'idle'
  | 'loading'
  | 'ready'
  | 'approving'
  | 'approved'
  | 'rejecting'
  | 'rejected'
  | 'failed';

/**
 * Per-file change classification. `unknown` is the safe fallback when
 * `git status --short` returns an unexpected `XY` pair.
 */
export type DiffFileStatus =
  | 'modified'
  | 'created'
  | 'deleted'
  | 'renamed'
  | 'unknown';

export type DiffReviewDecisionType = 'approved' | 'rejected';

/* -------------------------------------------------------------------------- */
/* Domain types                                                               */
/* -------------------------------------------------------------------------- */

export interface DiffFile {
  readonly path: string;
  readonly status: DiffFileStatus;
  readonly additions: number;
  readonly deletions: number;
  readonly diffText: string;
  /** True when the diff was binary; UI should render a "binary" badge. */
  readonly isBinary?: boolean;
  /** True when the diff was capped at the per-file ceiling. */
  readonly tooLarge?: boolean;
}

export interface DiffCommandLog {
  readonly command: string;
  readonly status: 'passed' | 'failed';
  readonly stdout?: string;
  readonly stderr?: string;
}

export interface DiffReviewError {
  readonly code: string;
  readonly message: string;
  readonly detail?: string;
}

export interface DiffReviewDecision {
  readonly type: DiffReviewDecisionType;
  readonly decidedAt: string;
  readonly reason?: string;
  /** Files restored on disk. Only populated for `rejected`. */
  readonly revertedFiles?: readonly string[];
  /**
   * Files the safe revert refused to delete (typically newly created).
   * Surfaced as a manual-cleanup hint in the UI. Only populated for
   * `rejected`.
   */
  readonly manualCleanupFiles?: readonly string[];
}

/**
 * Snapshot loaded by `diff_load`. The store keeps a single in-flight
 * session bound to the latest execution run.
 */
export interface DiffReviewSession {
  readonly id: string;
  readonly executionRunId: string;
  readonly planId: string;
  readonly planStepId: string;
  readonly stepTitle?: string;
  readonly workspacePath: string;
  readonly branchName?: string;
  readonly status: DiffReviewStatus;
  readonly files: readonly DiffFile[];
  readonly selectedFilePath?: string;
  readonly decision?: DiffReviewDecision;
  readonly loadedAt?: string;
  readonly decidedAt?: string;
  readonly commandLogs: readonly DiffCommandLog[];
  readonly error?: DiffReviewError;
  /** Total additions across all loaded files (cached for the UI). */
  readonly totalAdditions: number;
  /** Total deletions across all loaded files. */
  readonly totalDeletions: number;
}

/* -------------------------------------------------------------------------- */
/* Store-shaped state                                                         */
/* -------------------------------------------------------------------------- */

export interface DiffReviewState {
  readonly status: DiffReviewStatus;
  readonly session?: DiffReviewSession;
  readonly error?: DiffReviewError;
  /** Plan id bound to the current session. */
  readonly planId?: string;
  /** Workspace path bound to the current session. */
  readonly workspacePath?: string;
  /** Execution run id bound to the current session. */
  readonly executionRunId?: string;
}
