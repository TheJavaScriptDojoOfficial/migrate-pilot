//! Subprocess management.
//!
//! Owns the lifecycle of the Python orchestrator sidecar and any short-lived
//! child processes spawned for validation (typecheck, lint, build, tests).
//!
//! Rules
//! -----
//! * No arbitrary command execution. Every child process is spawned with an
//!   explicit, allowlisted command and validated argument set.
//! * Working directory must be inside the migration workspace (never the
//!   original project) for any write-capable command.
//! * stdout/stderr are streamed line-by-line into NDJSON event files and
//!   forwarded over the event bus.

pub mod orchestrator;
pub mod validation;
