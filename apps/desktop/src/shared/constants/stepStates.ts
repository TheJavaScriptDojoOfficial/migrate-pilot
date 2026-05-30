/**
 * Per-step state machine for an individual migration step.
 *
 * Mirror of the orchestrator's canonical enum. Keep in sync with
 * `orchestrator/core/workflow_engine.py`.
 */
export const StepState = {
  PENDING: 'PENDING',
  READY: 'READY',
  RUNNING: 'RUNNING',
  AI_COMPLETED: 'AI_COMPLETED',
  DIFF_READY: 'DIFF_READY',
  VALIDATION_RUNNING: 'VALIDATION_RUNNING',
  VALIDATION_PASSED: 'VALIDATION_PASSED',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  WAITING_FOR_APPROVAL: 'WAITING_FOR_APPROVAL',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  FIX_REQUESTED: 'FIX_REQUESTED',
  COMMITTED: 'COMMITTED',
  ROLLED_BACK: 'ROLLED_BACK',
  FAILED: 'FAILED',
  SKIPPED: 'SKIPPED',
} as const;

export type StepState = (typeof StepState)[keyof typeof StepState];

export const TERMINAL_STEP_STATES: ReadonlySet<StepState> = new Set([
  StepState.COMMITTED,
  StepState.ROLLED_BACK,
  StepState.FAILED,
  StepState.SKIPPED,
  StepState.REJECTED,
]);

/** Validation status reported per validation run. */
export const ValidationStatus = {
  NOT_CONFIGURED: 'NOT_CONFIGURED',
  QUEUED: 'QUEUED',
  RUNNING: 'RUNNING',
  PASSED: 'PASSED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
} as const;

export type ValidationStatus = (typeof ValidationStatus)[keyof typeof ValidationStatus];
