//! Project selection commands.
//!
//! Milestone 2 contract
//! --------------------
//! These commands are intentionally narrow and **read-only**. They never
//! mutate the user-selected path. They never spawn a shell. They never run
//! `npm`/`git` binaries — any "git branch" detection works by parsing the
//! plain-text `.git/HEAD` file.
//!
//! Three commands are exposed:
//!
//! * [`project_pick_folder`] - opens a native folder picker; returns the
//!   chosen path or `None` if the user cancelled.
//! * [`project_read_metadata`] - inspects the chosen path and returns the
//!   raw signals the UI needs (package.json contents, lockfile presence,
//!   tsconfig presence, .git presence, current branch).
//! * [`project_select`] - existing scaffold placeholder for the orchestrator
//!   integration that will land in a later milestone.
//!
//! Path scoping
//! ------------
//! Reads are restricted to a small, fixed set of well-known relative paths
//! under the user-selected root. The candidate root is canonicalised; if
//! canonicalisation fails (broken symlink, missing dir, …) we return a
//! typed error so the UI can render it safely.

use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use tauri::AppHandle;
use tauri_plugin_dialog::{DialogExt, FilePath};

use super::{CommandError, CommandResult};

// ---------------------------------------------------------------------------
// Existing orchestrator-backed scaffold (kept for forward compatibility).
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSelectInput {
    pub suggested_path: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
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
    // TODO (later milestone):
    //   1. Resolve canonical path via `crate::security::path::resolve_within`.
    //   2. Persist via orchestrator IPC.
    //   3. Return Project shape consumed by the session store.
    Err(CommandError::NotImplemented(
        "project_select is a scaffold placeholder".into(),
    ))
}

// ---------------------------------------------------------------------------
// Milestone 2: folder picker.
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PickFolderOutput {
    /// Absolute path to the picked folder, or `null` if the user cancelled.
    pub path: Option<String>,
}

/// Open the native folder picker dialog.
///
/// Returns the chosen absolute path, or `None` if the user cancelled.
#[tauri::command]
pub async fn project_pick_folder(app: AppHandle) -> CommandResult<PickFolderOutput> {
    let (tx, rx) = tokio::sync::oneshot::channel::<Option<FilePath>>();
    app.dialog()
        .file()
        .set_title("Select a React project folder")
        .pick_folder(move |folder_path| {
            let _ = tx.send(folder_path);
        });

    let picked = rx
        .await
        .map_err(|e| CommandError::Internal(format!("dialog channel closed: {e}")))?;

    let path = picked
        .as_ref()
        .and_then(|fp| fp.as_path())
        .map(|p| p.to_string_lossy().to_string());

    Ok(PickFolderOutput { path })
}

// ---------------------------------------------------------------------------
// Milestone 2: read-only project metadata.
// ---------------------------------------------------------------------------

/// Maximum number of bytes we are willing to read from `package.json`.
/// A 1 MB ceiling is generous for a real-world manifest and protects the
/// UI from a pathological / malicious file.
const MAX_PACKAGE_JSON_BYTES: u64 = 1_048_576;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LockFilePresence {
    pub npm: bool,
    pub yarn: bool,
    pub pnpm: bool,
    pub bun: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadMetadataOutput {
    /// Canonical absolute path of the inspected folder.
    pub path: String,
    /// Basename of the folder (used as the project's display name fallback).
    pub folder_name: String,
    /// Raw `package.json` text. `None` when the file is missing.
    pub package_json_text: Option<String>,
    /// Lock-file presence flags.
    pub lock_files: LockFilePresence,
    /// `tsconfig.json` exists at the project root.
    pub tsconfig_present: bool,
    /// `.git` (file or directory) exists at the project root.
    pub is_git_repository: bool,
    /// Current branch name when discoverable. `None` for detached HEAD,
    /// missing HEAD, or any unexpected `.git` shape.
    pub current_branch: Option<String>,
}

/// Inspect the user-selected folder and return the read-only signals the
/// UI needs to validate it. Never writes, never spawns a process.
///
/// Tauri parameter binding: the `path` argument is destructured directly
/// from the JS payload (`{ path: "..." }`). We deliberately avoid wrapping
/// in a struct so the TS bridge stays flat and the call site reads cleanly.
#[tauri::command]
pub async fn project_read_metadata(path: String) -> CommandResult<ReadMetadataOutput> {
    if path.trim().is_empty() {
        return Err(CommandError::InvalidInput("project path is empty".into()));
    }
    if path.contains('\0') {
        return Err(CommandError::InvalidInput(
            "project path contains NUL byte".into(),
        ));
    }

    let raw_path = PathBuf::from(&path);
    let canonical = fs::canonicalize(&raw_path)
        .map_err(|e| CommandError::InvalidInput(format!("path not accessible: {e}")))?;

    let stat = fs::metadata(&canonical)
        .map_err(|e| CommandError::InvalidInput(format!("cannot stat path: {e}")))?;
    if !stat.is_dir() {
        return Err(CommandError::InvalidInput(
            "selected path is not a directory".into(),
        ));
    }

    let folder_name = canonical
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "project".to_string());

    let package_json_text = read_capped_text_file(&canonical.join("package.json"))?;

    let lock_files = LockFilePresence {
        npm: file_exists(&canonical.join("package-lock.json")),
        yarn: file_exists(&canonical.join("yarn.lock")),
        pnpm: file_exists(&canonical.join("pnpm-lock.yaml")),
        bun: file_exists(&canonical.join("bun.lockb")) || file_exists(&canonical.join("bun.lock")),
    };

    let tsconfig_present = file_exists(&canonical.join("tsconfig.json"));

    let git_path = canonical.join(".git");
    let is_git_repository = git_path.exists();
    let current_branch = if is_git_repository {
        detect_current_branch(&canonical, &git_path)
    } else {
        None
    };

    Ok(ReadMetadataOutput {
        path: canonical.to_string_lossy().to_string(),
        folder_name,
        package_json_text,
        lock_files,
        tsconfig_present,
        is_git_repository,
        current_branch,
    })
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

fn file_exists(path: &Path) -> bool {
    path.is_file()
}

/// Read a text file with a hard byte cap. Returns `Ok(None)` when the file
/// is missing; returns an error when the file exists but cannot be read.
fn read_capped_text_file(path: &Path) -> CommandResult<Option<String>> {
    let stat = match fs::metadata(path) {
        Ok(m) => m,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(e) => return Err(CommandError::Internal(format!("stat {path:?}: {e}"))),
    };

    if !stat.is_file() {
        return Ok(None);
    }
    if stat.len() > MAX_PACKAGE_JSON_BYTES {
        return Err(CommandError::InvalidInput(format!(
            "{} is larger than {} bytes",
            path.display(),
            MAX_PACKAGE_JSON_BYTES
        )));
    }

    let text = fs::read_to_string(path)
        .map_err(|e| CommandError::Internal(format!("read {path:?}: {e}")))?;
    Ok(Some(text))
}

/// Detect the current Git branch by parsing `.git/HEAD`.
///
/// Two `.git` shapes are supported:
///
/// * `.git` is a directory — read `.git/HEAD` directly.
/// * `.git` is a file (Git worktree) — it contains `gitdir: <relative-path>`
///   pointing at the real gitdir; read `<gitdir>/HEAD`.
///
/// Any unexpected shape, missing file, detached HEAD, or read error returns
/// `None` rather than failing the whole command — branch detection is a
/// best-effort signal and must not block project selection.
fn detect_current_branch(project_root: &Path, git_path: &Path) -> Option<String> {
    let head_path = if git_path.is_dir() {
        Some(git_path.join("HEAD"))
    } else if git_path.is_file() {
        // Worktree case: `.git` is a plain text pointer.
        let pointer = fs::read_to_string(git_path).ok()?;
        let rel = pointer.lines().find_map(|line| {
            line.strip_prefix("gitdir:")
                .map(|s| s.trim().to_string())
        })?;
        let rel_path = PathBuf::from(&rel);
        let resolved = if rel_path.is_absolute() {
            rel_path
        } else {
            project_root.join(rel_path)
        };
        Some(resolved.join("HEAD"))
    } else {
        None
    }?;

    let head = fs::read_to_string(&head_path).ok()?;
    let trimmed = head.trim();

    // `ref: refs/heads/<branch>` => return the branch name.
    if let Some(rest) = trimmed.strip_prefix("ref:") {
        let ref_name = rest.trim();
        if let Some(branch) = ref_name.strip_prefix("refs/heads/") {
            if !branch.is_empty() {
                return Some(branch.to_string());
            }
        }
        return None;
    }

    // Detached HEAD (raw SHA) — no branch name to surface.
    None
}
