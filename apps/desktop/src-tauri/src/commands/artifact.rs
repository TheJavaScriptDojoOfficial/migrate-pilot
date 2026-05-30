//! Artifact read commands.
//!
//! Artifacts (logs, diffs, prompts, responses, reports) live on disk and
//! are referenced from the SQLite state store. The UI should request them
//! on demand and stream large ones - never preload.

use serde::{Deserialize, Serialize};

use super::{CommandError, CommandResult};

#[derive(Debug, Deserialize)]
pub struct ArtifactReadTextInput {
    pub session_id: String,
    /// Path RELATIVE to the session artifact directory. Validated server-side.
    pub relative_path: String,
}

#[derive(Debug, Serialize)]
pub struct ArtifactReadTextOutput {
    pub content: String,
    pub truncated: bool,
}

/// Read a text artifact for a session. Path traversal is rejected.
#[tauri::command]
pub async fn artifact_read_text(
    _input: ArtifactReadTextInput,
) -> CommandResult<ArtifactReadTextOutput> {
    // TODO:
    //   1. Resolve session artifact root via crate::filesystem::artifacts.
    //   2. Join relative_path and verify result is still under that root.
    //   3. Cap response size and set `truncated` accordingly.
    Err(CommandError::NotImplemented(
        "artifact_read_text placeholder".into(),
    ))
}
