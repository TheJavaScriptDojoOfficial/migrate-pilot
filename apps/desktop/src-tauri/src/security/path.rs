//! Path validation helpers.
//!
//! All filesystem operations must use these helpers to normalise paths and
//! enforce that the result remains under an approved root (the selected
//! project, the migration workspace, or the local app data directory).
//!
//! Rules
//! -----
//! * Reject empty inputs.
//! * Reject paths containing NUL bytes.
//! * Resolve symlinks via [`std::fs::canonicalize`] before comparing roots.
//! * Reject relative path components that escape the root (`..`).

use std::path::{Path, PathBuf};

#[derive(Debug, thiserror::Error)]
pub enum PathError {
    #[error("path is empty")]
    Empty,
    #[error("path contains NUL byte")]
    NulByte,
    #[error("path traversal not allowed")]
    Traversal,
    #[error("path is outside allowed root")]
    OutsideRoot,
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
}

/// Validate that `candidate`, once canonicalised, lives under `root`.
///
/// Returns the canonicalised absolute path on success.
///
/// TODO: integrate against the active project + workspace roots tracked by
/// the orchestrator. For V1 we additionally maintain an allowlist of roots
/// in memory (selected project path + workspace path + app data dir).
pub fn resolve_within(root: &Path, candidate: &Path) -> Result<PathBuf, PathError> {
    if candidate.as_os_str().is_empty() {
        return Err(PathError::Empty);
    }
    if candidate.to_string_lossy().contains('\0') {
        return Err(PathError::NulByte);
    }
    let joined = root.join(candidate);
    let canonical = std::fs::canonicalize(&joined)?;
    if !canonical.starts_with(root) {
        return Err(PathError::OutsideRoot);
    }
    Ok(canonical)
}
