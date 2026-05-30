//! Run package.json scripts for validation (typecheck, lint, build, tests).
//!
//! TODO:
//!   * Resolve the validation command from the orchestrator (NEVER from
//!     untrusted UI input).
//!   * Spawn with `cwd = workspace_path` and capture stdout/stderr to disk.
//!   * Emit start/finish events and surface the exit code + log path.
