//! Validation commands.

use serde::{Deserialize, Serialize};

use super::{CommandError, CommandResult};

#[derive(Debug, Deserialize)]
pub struct StepValidateInput {
    pub session_id: String,
    pub step_id: String,
}

#[derive(Debug, Serialize)]
pub struct StepValidateOutput {
    pub step_id: String,
    pub status: String,
    pub log_artifact_path: Option<String>,
}

/// Run the configured validation command for a step. The command itself
/// is detected and stored by the orchestrator; this entry point only
/// authorises the run and streams progress.
#[tauri::command]
pub async fn step_validate(_input: StepValidateInput) -> CommandResult<StepValidateOutput> {
    Err(CommandError::NotImplemented(
        "step_validate placeholder".into(),
    ))
}
