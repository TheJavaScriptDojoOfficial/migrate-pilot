/**
 * Milestone 6 — Execution Engine types.
 *
 * Why these live in the feature folder (and not `shared/types/`):
 *   `shared/types/migrationStep.ts` and `shared/types/executionEvent.ts`
 *   are older sketches reserved for the eventual orchestrator layer (they
 *   carry `sessionId`, `commitSha`, etc.). The Milestone 6 contract is
 *   narrower — it is the local state produced by the safe scripted
 *   executor commands plus a small UI state machine. Keeping these types
 *   feature-local keeps the execution feature self-contained and safe to
 *   evolve without destabilising the eventual orchestrator contracts.
 *
 * Architectural rules
 * -------------------
 * - Pure types. No React, no Zustand, no IPC imports.
 * - The state machine documented here is the single source of truth used
 *   by both the store and the screen. Add a state by extending
 *   {@link ExecutionStatus} and the exhaustive switch in
 *   `executionPresentationService` will force every callsite to update.
 * - Executors are looked up via `MigrationStepExecution.executorKey` and
 *   the {@link executorRegistry}. The execution layer NEVER hardcodes a
 *   plan step id.
 */
import type {
  MigrationStepExecution,
  MigrationStepExecutionMode,
} from '@features/migration-plan';

/* -------------------------------------------------------------------------- */
/* State machine                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Lifecycle of the execution screen.
 *
 *   blocked    → workspace and/or approved plan missing.
 *   idle       → workspace + plan present but no step selected yet.
 *   ready      → a supported step is selected and ready to run.
 *   running    → the scripted executor is in flight.
 *   completed  → the most recent run finished successfully.
 *   failed     → the most recent run failed; retry is available.
 */
export type ExecutionStatus =
  | 'blocked'
  | 'idle'
  | 'ready'
  | 'running'
  | 'completed'
  | 'failed';

/**
 * Per-step execution lifecycle. This is *execution-time* status — the plan-
 * time `MigrationStepStatus` lives in `migration-plan` and is independent.
 *
 *   pending     → never executed.
 *   running     → executor is currently running this step.
 *   completed   → executor finished successfully for this step.
 *   failed      → executor failed; retry is available.
 *   unsupported → no executor is available for this step yet (manual,
 *                 AI, validation-only, missing metadata, or unknown
 *                 executor key).
 *   skipped     → the user chose to skip this step.
 */
export type ExecutionStepStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'unsupported'
  | 'skipped';

/* -------------------------------------------------------------------------- */
/* Domain types                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Coarse classification used by the UI to render the right badge per
 * step. Computed by the local capability classifier; the IPC capability
 * probe can upgrade `scripted-unverified` → `executable`.
 */
export type ExecutionCapabilityBadge =
  | 'executable'
  | 'scripted-unverified'
  | 'manual'
  | 'validation'
  | 'ai-not-available'
  | 'unsupported-executor'
  | 'missing-metadata';

export type ExecutionLogLevel = 'info' | 'warning' | 'error' | 'success';

export type ExecutionChangeType = 'modified' | 'created' | 'deleted';

export interface ExecutionLogEntry {
  readonly timestamp: string;
  readonly level: ExecutionLogLevel;
  readonly message: string;
  readonly detail?: string;
}

export interface ExecutionChangedFile {
  readonly path: string;
  readonly changeType: ExecutionChangeType;
  readonly summary: string;
}

export interface ExecutionError {
  readonly code: string;
  readonly message: string;
  readonly detail?: string;
}

/**
 * Capability probe result for a plan step.
 *
 * `executable === true` implies a registered + supported `executorKey`
 * is set. The UI uses `reason` verbatim when the step is not executable
 * so the user is never left wondering why a Run button is greyed out.
 */
export interface ExecutionCapability {
  readonly planStepId: string;
  readonly executable: boolean;
  /** Execution mode declared by the plan step (when present). */
  readonly mode?: MigrationStepExecutionMode;
  /** Generic executor key declared by the plan step (when present). */
  readonly executorKey?: string;
  /** Coarse badge used by the UI. */
  readonly badge: ExecutionCapabilityBadge;
  readonly reason: string;
  /** Human-readable list of missing requirements (capability probe only). */
  readonly missingRequirements?: readonly string[];
}

/**
 * Complete record of a single execution attempt for a plan step.
 *
 * The runtime state machine narrows `status` down to `'running' |
 * 'completed' | 'failed'` because `pending`/`unsupported`/`skipped` apply
 * to the per-step status, not to a captured run.
 *
 * `requiresManualVerification` is the fourth distinguishing state Phase
 * R6 Step 4 introduces. A `completed` run with `requiresManualVerification
 * === true` finished cleanly but is intentionally observational —
 * Migrate Pilot did not (or cannot) verify the result on the user's
 * behalf. The UI uses this flag to render a distinct
 * "Manual verification required" banner instead of the plain
 * "Completed" banner, and downstream gates can refuse to mark the step
 * truly done until the user accepts. The flag is independent of
 * `status`: a `failed` run is still surfaced as a failure even if the
 * executor declared the work was manual-only.
 */
export interface ExecutionStepRun {
  readonly id: string;
  readonly planId: string;
  readonly planStepId: string;
  readonly stepTitle: string;
  readonly workspacePath: string;
  readonly status: 'running' | 'completed' | 'failed';
  readonly startedAt: string;
  readonly completedAt?: string;
  /** Generic executor key that produced this run (e.g. `package-json-dependency-update`). */
  readonly executorKey: string;
  /** Execution mode that was dispatched. Always `'scripted'` today. */
  readonly mode: MigrationStepExecutionMode;
  readonly changedFiles: readonly ExecutionChangedFile[];
  readonly logs: readonly ExecutionLogEntry[];
  readonly error?: ExecutionError;
  /**
   * True when the user MUST manually verify the run before treating
   * the step as truly complete. Set by executors that intentionally
   * leave verification to the human author (manual-instruction
   * checklist runs, AI-assisted bounded edits the user still needs to
   * diff-review, etc.).
   *
   * Optional so older runs persisted before Phase R6 Step 4 — and
   * deterministic runs that self-verify (validation commands,
   * package-dependency edits) — continue to satisfy the type without
   * extra ceremony.
   */
  readonly requiresManualVerification?: boolean;
}

/* Re-export the planner's execution metadata type so external execution
 * callers can type-check without crossing into the migration-plan barrel. */
export type { MigrationStepExecution, MigrationStepExecutionMode };

/* -------------------------------------------------------------------------- */
/* Store-shaped state                                                         */
/* -------------------------------------------------------------------------- */

export interface ExecutionEngineState {
  readonly status: ExecutionStatus;
  /** Plan id the engine state is tied to. Reset when the plan changes. */
  readonly planId?: string;
  /** Workspace path the engine state is tied to. Reset when it changes. */
  readonly workspacePath?: string;
  /** Optional Git branch name surfaced in the workspace card. */
  readonly branchName?: string;
  /** Source project path, used for safety checks and presentation. */
  readonly sourcePath?: string;
  /** Currently selected plan step id (if any). */
  readonly selectedPlanStepId?: string;
  /** Capability cache keyed by plan step id. */
  readonly capabilities: Readonly<Record<string, ExecutionCapability>>;
  /** Per-step execution status. Steps not in the map default to `pending`. */
  readonly stepStatuses: Readonly<Record<string, ExecutionStepStatus>>;
  /** Latest execution run captured per plan step. */
  readonly runs: Readonly<Record<string, ExecutionStepRun>>;
  /** Most recent run reference, regardless of step. */
  readonly latestRun?: ExecutionStepRun;
  /** Engine-level error (e.g. capability lookup failed). */
  readonly error?: ExecutionError;
}
