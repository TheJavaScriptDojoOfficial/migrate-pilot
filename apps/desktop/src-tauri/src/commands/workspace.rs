//! Git workspace lifecycle commands.

use serde::{Deserialize, Serialize};

use super::{CommandError, CommandResult};

#[derive(Debug, Deserialize)]
pub struct WorkspaceCreateInput {
    pub session_id: String,
}

#[derive(Debug, Serialize)]
pub struct WorkspaceCreateOutput {
    pub workspace_id: String,
    pub path: String,
    pub branch_name: String,
}

/// Create the migration workspace for a session. The orchestrator owns the
/// actual Git operations; this command only authorises the request and
/// streams progress.
///
/// SAFETY GATES (enforced server-side):
///   * Original repo must have a clean working tree.
///   * Base branch must exist.
///   * Workspace path must not already exist (unless user opts to reuse).
///   * Branch name must not already exist (unless user opts to reuse).
#[tauri::command]
pub async fn workspace_create(
    _input: WorkspaceCreateInput,
) -> CommandResult<WorkspaceCreateOutput> {
    Err(CommandError::NotImplemented(
        "workspace_create placeholder".into(),
    ))
}
