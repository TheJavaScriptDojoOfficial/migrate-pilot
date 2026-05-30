//! Scanner commands.

use serde::{Deserialize, Serialize};

use super::{CommandError, CommandResult};

#[derive(Debug, Deserialize)]
pub struct ScanStartInput {
    pub project_id: String,
}

#[derive(Debug, Serialize)]
pub struct ScanStartOutput {
    pub session_id: String,
}

/// Kick off a scan. Returns a session id immediately; progress is emitted
/// over events as the orchestrator streams it back.
#[tauri::command]
pub async fn scan_start(_input: ScanStartInput) -> CommandResult<ScanStartOutput> {
    // TODO: forward to orchestrator sidecar via IPC.
    Err(CommandError::NotImplemented("scan_start placeholder".into()))
}

#[derive(Debug, Deserialize)]
pub struct ScanGetReportInput {
    pub session_id: String,
}

/// Read the most recent scan-report.json artifact for a session.
#[tauri::command]
pub async fn scan_get_report(_input: ScanGetReportInput) -> CommandResult<serde_json::Value> {
    // TODO: resolve artifact path via crate::filesystem::artifacts,
    //       enforce session ownership, return parsed JSON.
    Err(CommandError::NotImplemented(
        "scan_get_report placeholder".into(),
    ))
}
