//! Event streaming bridge from the orchestrator to the UI.
//!
//! The orchestrator emits structured events (state changes, log lines,
//! validation outcomes, errors). This module forwards those events to the
//! frontend via Tauri's event system using the channel names below.
//!
//! Channel names are stable and mirrored in
//! `apps/desktop/src/shared/types/executionEvent.ts`.

/// Tauri event channel constants - keep in sync with the frontend.
pub mod channels {
    pub const SESSION_STATE_CHANGED: &str = "session.state_changed";
    pub const STEP_STATE_CHANGED: &str = "step.state_changed";
    pub const STEP_LOG_LINE: &str = "step.log_line";
    pub const AI_TOKEN: &str = "ai.token";
    pub const AI_COMPLETED: &str = "ai.completed";
    pub const VALIDATION_STARTED: &str = "validation.started";
    pub const VALIDATION_FINISHED: &str = "validation.finished";
    pub const GIT_COMMIT_CREATED: &str = "git.commit_created";
    pub const GIT_ROLLBACK_COMPLETED: &str = "git.rollback_completed";
    pub const ERROR_RAISED: &str = "error.raised";
}

// TODO:
//   * Spawn a background task that reads NDJSON events from the orchestrator
//     stdout and re-emits them on the channels above via `app_handle.emit`.
//   * Apply debouncing for high-frequency channels (AI_TOKEN, STEP_LOG_LINE).
//   * Drop events for closed windows to avoid unbounded queueing.
