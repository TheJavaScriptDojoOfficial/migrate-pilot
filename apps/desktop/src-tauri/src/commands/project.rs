//! Project selection commands.

use serde::{Deserialize, Serialize};

use super::{CommandError, CommandResult};

#[derive(Debug, Deserialize)]
pub struct ProjectSelectInput {
    pub suggested_path: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ProjectSelectOutput {
    pub id: String,
    pub name: String,
    pub path: String,
}

/// Open a folder picker (or accept `suggested_path`), validate it as a
/// readable Git working tree, and register it as a project.
///
/// SAFETY: this command must NEVER mutate the chosen path. It only records
/// metadata and persists the path in SQLite.
#[tauri::command]
pub async fn project_select(_input: ProjectSelectInput) -> CommandResult<ProjectSelectOutput> {
    // TODO:
    //   1. Open native folder picker via tauri-plugin-dialog (when present).
    //   2. Validate path: must exist, must be a directory, must contain .git.
    //   3. Resolve the canonical path and reject symlink escapes via
    //      `crate::security::path::resolve_within`.
    //   4. Persist via orchestrator IPC.
    Err(CommandError::NotImplemented(
        "project_select is a scaffold placeholder".into(),
    ))
}
