//! Python orchestrator sidecar lifecycle.
//!
//! TODO:
//!   * Locate the orchestrator executable (bundled binary in release, local
//!     `python -m orchestrator` in dev).
//!   * Spawn with stdin/stdout pipes for line-delimited JSON IPC.
//!   * Monitor health, restart on crash with backoff.
//!   * Cleanly shut down on app exit.
