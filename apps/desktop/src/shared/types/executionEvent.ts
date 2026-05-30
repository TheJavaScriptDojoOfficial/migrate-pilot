/**
 * Append-only event emitted by the orchestration engine.
 * Streamed to the UI over Tauri events; persisted as NDJSON to disk.
 *
 * The UI must NOT accumulate all events in global state. Render incrementally,
 * cap in-memory history (e.g. last N events) and read older events from disk
 * artifacts on demand.
 */
export type ExecutionEventKind =
  | 'session.state_changed'
  | 'step.state_changed'
  | 'step.log_line'
  | 'ai.token'
  | 'ai.completed'
  | 'validation.started'
  | 'validation.finished'
  | 'git.commit_created'
  | 'git.rollback_completed'
  | 'error.raised';

export interface ExecutionEvent {
  readonly id: string;
  readonly sessionId: string;
  readonly stepId?: string;
  readonly kind: ExecutionEventKind;
  /** ISO timestamp at the orchestrator. */
  readonly at: string;
  /** Small structured payload. Large blobs must be artifact references. */
  readonly payload?: Readonly<Record<string, unknown>>;
}
