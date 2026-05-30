//! Allowlisted Tauri commands.
//!
//! SECURITY POLICY
//! ---------------
//! 1. Only commands registered in `tauri::generate_handler![...]` inside
//!    `lib.rs` are reachable from the frontend. Adding a command here is a
//!    security decision - review carefully and keep the registry in sync.
//! 2. Each command MUST validate its inputs and resolve any filesystem path
//!    via [`crate::security::path`]. Never pass user input to a shell.
//! 3. Long-running work returns a session/step id and streams progress over
//!    events (see [`crate::events`]) rather than blocking the command.
//! 4. Errors are returned as typed [`CommandError`] values so the UI can
//!    render them without parsing strings.

use serde::{Deserialize, Serialize};
use thiserror::Error;

pub mod artifact;
pub mod project;
pub mod scan;
pub mod step;
pub mod validation;
pub mod workspace;

/// Canonical error type returned by every command. Serialised to JSON so the
/// UI can render a structured error message.
#[derive(Debug, Error, Serialize)]
#[serde(tag = "kind", content = "message")]
pub enum CommandError {
    #[error("invalid input: {0}")]
    InvalidInput(String),
    #[error("path not allowed: {0}")]
    PathNotAllowed(String),
    #[error("not implemented: {0}")]
    NotImplemented(String),
    #[error("internal error: {0}")]
    Internal(String),
}

/// Convenience result alias used across command modules.
pub type CommandResult<T> = Result<T, CommandError>;

/// Empty payload helper for commands that take no input.
#[derive(Debug, Deserialize)]
pub struct EmptyPayload {}
