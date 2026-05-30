//! Migrate Pilot desktop shell.
//!
//! Architectural notes
//! -------------------
//! * The Tauri layer is a thin, secure bridge between the React UI and the
//!   local machine. It must never expose arbitrary shell execution.
//! * Every command surfaced to the UI is registered exactly once in the
//!   `tauri::generate_handler![...]` block inside [`run`] and is documented in
//!   `apps/desktop/src/shared/utils/commands.ts`.
//! * Filesystem access is path-validated via [`security::path`]. All paths
//!   are normalised and checked against the active project + workspace roots.
//! * Long-running work (scan, AI execution, validation) is delegated to the
//!   Python orchestrator and surfaced to the UI as structured events via
//!   [`events`].

pub mod commands;
pub mod events;
pub mod filesystem;
pub mod process;
pub mod security;

pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .init();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            commands::project::project_select,
            commands::scan::scan_start,
            commands::scan::scan_get_report,
            commands::workspace::workspace_create,
            commands::step::step_execute,
            commands::validation::step_validate,
            commands::artifact::artifact_read_text,
        ])
        .setup(|_app| {
            tracing::info!("Migrate Pilot desktop shell starting up");
            // TODO: bootstrap orchestrator sidecar handle here (process::orchestrator).
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Migrate Pilot tauri application");
}
