//! Step execution commands.

use serde::{Deserialize, Serialize};

use super::{CommandError, CommandResult};

#[derive(Debug, Deserialize)]
pub struct StepExecuteInput {
    pub session_id: String,
    pub step_id: String,
}

#[derive(Debug, Serialize)]
pub struct StepExecuteOutput {
    pub step_id: String,
    pub state: String,
}

/// Execute the next migration step inside the workspace. The actual AI
/// call is performed by the orchestrator. Output is streamed via events.
#[tauri::command]
pub async fn step_execute(_input: StepExecuteInput) -> CommandResult<StepExecuteOutput> {
    Err(CommandError::NotImplemented(
        "step_execute placeholder".into(),
    ))
}
