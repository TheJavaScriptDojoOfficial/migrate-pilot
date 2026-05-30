/**
 * Session-level state machine for a migration session.
 *
 * Mirror of the orchestrator's canonical enum. Keep in sync with
 * `orchestrator/core/session_manager.py`.
 *
 * Stored as plain string literals so they round-trip cleanly through
 * Tauri IPC / SQLite / JSON without an enum value mismatch.
 */
export const SessionState = {
  DRAFT: 'DRAFT',
  PROJECT_SELECTED: 'PROJECT_SELECTED',
  SCANNING: 'SCANNING',
  SCAN_COMPLETED: 'SCAN_COMPLETED',
  PLAN_GENERATED: 'PLAN_GENERATED',
  PLAN_APPROVED: 'PLAN_APPROVED',
  WORKSPACE_CREATING: 'WORKSPACE_CREATING',
  WORKSPACE_READY: 'WORKSPACE_READY',
  EXECUTING_STEP: 'EXECUTING_STEP',
  STEP_EXECUTED: 'STEP_EXECUTED',
  AWAITING_DIFF_REVIEW: 'AWAITING_DIFF_REVIEW',
  VALIDATING: 'VALIDATING',
  STEP_APPROVED: 'STEP_APPROVED',
  STEP_COMMITTED: 'STEP_COMMITTED',
  STEP_FAILED: 'STEP_FAILED',
  ROLLING_BACK: 'ROLLING_BACK',
  ROLLED_BACK: 'ROLLED_BACK',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;

export type SessionState = (typeof SessionState)[keyof typeof SessionState];

/** Ordered list of session states for UI rendering and state validation. */
export const SESSION_STATE_ORDER: readonly SessionState[] = [
  SessionState.DRAFT,
  SessionState.PROJECT_SELECTED,
  SessionState.SCANNING,
  SessionState.SCAN_COMPLETED,
  SessionState.PLAN_GENERATED,
  SessionState.PLAN_APPROVED,
  SessionState.WORKSPACE_CREATING,
  SessionState.WORKSPACE_READY,
  SessionState.EXECUTING_STEP,
  SessionState.STEP_EXECUTED,
  SessionState.AWAITING_DIFF_REVIEW,
  SessionState.VALIDATING,
  SessionState.STEP_APPROVED,
  SessionState.STEP_COMMITTED,
  SessionState.STEP_FAILED,
  SessionState.ROLLING_BACK,
  SessionState.ROLLED_BACK,
  SessionState.COMPLETED,
  SessionState.CANCELLED,
];

/** Terminal session states - no further transitions allowed. */
export const TERMINAL_SESSION_STATES: ReadonlySet<SessionState> = new Set([
  SessionState.COMPLETED,
  SessionState.CANCELLED,
]);
