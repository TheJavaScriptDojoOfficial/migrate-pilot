//! Migration workspace commands (Milestone 5).
//!
//! Two read-only / safe commands are exposed:
//!
//! * [`workspace_preflight`] — gathers the read-only signals the UI needs
//!   to decide whether and how a workspace can be created (Git availability,
//!   working-tree cleanliness, current branch, proposed branch name, proposed
//!   workspace path, blockers, warnings). It NEVER mutates the source path.
//!
//! * [`workspace_create`] — creates the migration workspace using the
//!   selected strategy. For Milestone 5 the only supported strategy is
//!   `git-worktree`; the `copy` fallback is intentionally not implemented in
//!   V1 (the UI surfaces this clearly and disables the action).
//!
//! Safety guarantees enforced server-side
//! --------------------------------------
//! * The `source_path` is canonicalised and must be an existing directory.
//! * The `workspace_path` must NOT exist before creation and must not live
//!   inside the canonicalised source path.
//! * Branch names are validated against a strict allowlist regex — there is
//!   no chance of a shell metacharacter sneaking through.
//! * Every Git invocation goes through [`std::process::Command`] with a
//!   fixed `args` array. There is no `sh -c`, no shell interpolation, and
//!   no eval. Stdout/stderr are captured and returned to the UI verbatim.
//! * No file in the source project is ever modified outside the very narrow
//!   `git worktree add -b <branch>` call (which writes only metadata under
//!   `.git/worktrees/...` and the branch ref). No application source file is
//!   touched.

use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::Instant;

use serde::Serialize;

use super::{CommandError, CommandResult};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceIssueRaw {
    pub code: String,
    pub severity: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspacePreflightRaw {
    pub source_path: String,
    pub project_name: String,
    pub is_git_repository: bool,
    pub git_available: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub current_branch: Option<String>,
    /// `"clean" | "dirty" | "unknown"`.
    pub git_cleanliness: String,
    /// `"git-worktree" | "copy"`.
    pub recommended_strategy: String,
    pub fallback_available: bool,
    pub proposed_branch_name: String,
    pub proposed_workspace_path: String,
    pub blockers: Vec<WorkspaceIssueRaw>,
    pub warnings: Vec<WorkspaceIssueRaw>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceCommandLogRaw {
    pub command: String,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stdout: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stderr: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceCreationResultRaw {
    pub id: String,
    pub source_path: String,
    pub workspace_path: String,
    /// `"git-worktree" | "copy"`.
    pub strategy: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub branch_name: Option<String>,
    pub created_at: String,
    pub command_logs: Vec<WorkspaceCommandLogRaw>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceArtifactWriteResultRaw {
    pub workspace_path: String,
    pub artifacts: Vec<WorkspaceArtifactEntryRaw>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceArtifactEntryRaw {
    pub relative_path: String,
    pub absolute_path: String,
    pub bytes_written: u64,
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/// Maximum bytes captured per command stream. Caps log size so the UI does
/// not have to render runaway output.
const COMMAND_OUTPUT_CAP: usize = 8 * 1024;

/// Branch name allowlist — lowercase alphanumerics, `.`, `_`, `-`, and `/`.
/// Mirrors the subset of `git check-ref-format` rules we generate ourselves.
fn is_valid_branch_segment(c: char) -> bool {
    matches!(c, 'a'..='z' | '0'..='9' | '-' | '_' | '.' | '/')
}

fn is_valid_branch_name(name: &str) -> bool {
    if name.is_empty() || name.len() > 200 {
        return false;
    }
    if name.starts_with('/') || name.starts_with('-') || name.starts_with('.') {
        return false;
    }
    if name.ends_with('/') || name.ends_with('.') {
        return false;
    }
    if name.contains("..") || name.contains("//") {
        return false;
    }
    name.chars().all(is_valid_branch_segment)
}

// ---------------------------------------------------------------------------
// Preflight
// ---------------------------------------------------------------------------

/// Read-only preflight. Never mutates the source path.
///
/// Tauri parameter binding: the `sourcePath` and `projectName` arguments
/// are destructured directly from the JS payload (`{ sourcePath, projectName }`).
/// We deliberately avoid wrapping in a struct so the TS bridge stays flat
/// and the call site reads cleanly — matching the convention used by
/// `project_read_metadata` and `project_scan`.
#[tauri::command(rename_all = "camelCase")]
pub async fn workspace_preflight(
    source_path: String,
    project_name: String,
) -> CommandResult<WorkspacePreflightRaw> {
    let project_name = project_name.trim().to_string();
    if project_name.is_empty() {
        return Err(CommandError::InvalidInput("project name is empty".into()));
    }

    let source = canonicalise_directory(&source_path)?;
    let source_path_str = source.to_string_lossy().to_string();

    // Move the read-only inspection off the async runtime so the UI thread
    // stays responsive on slow disks.
    let scan_root = source.clone();
    let project_name_blocking = project_name.clone();
    let raw = tokio::task::spawn_blocking(move || {
        run_preflight(&scan_root, &project_name_blocking)
    })
    .await
    .map_err(|e| CommandError::Internal(format!("preflight task failed: {e}")))??;

    Ok(WorkspacePreflightRaw {
        source_path: source_path_str,
        ..raw
    })
}

fn run_preflight(source: &Path, project_name: &str) -> CommandResult<WorkspacePreflightRaw> {
    let mut blockers: Vec<WorkspaceIssueRaw> = Vec::new();
    let mut warnings: Vec<WorkspaceIssueRaw> = Vec::new();

    let git_available = detect_git_available();

    let is_git_repository = source.join(".git").exists()
        && (git_available && git_is_inside_work_tree(source).unwrap_or(false));

    let current_branch = if is_git_repository {
        git_current_branch(source).ok().flatten()
    } else {
        None
    };

    // Cleanliness check — read-only `git status --porcelain` is safe.
    let git_cleanliness = if !is_git_repository {
        "unknown".to_string()
    } else {
        match git_is_clean(source) {
            Ok(true) => "clean".to_string(),
            Ok(false) => "dirty".to_string(),
            Err(_) => "unknown".to_string(),
        }
    };

    // Strategy decision.
    let recommended_strategy = if is_git_repository && git_available {
        "git-worktree".to_string()
    } else {
        "copy".to_string()
    };

    // V1 keeps the copy fallback intentionally disabled.
    let fallback_available = false;

    // Surface blockers / warnings.
    if !git_available {
        blockers.push(WorkspaceIssueRaw {
            code: "GIT_NOT_AVAILABLE".into(),
            severity: "blocker".into(),
            message: "Git is not available on this machine.".into(),
            detail: Some(
                "The Git worktree strategy requires the `git` binary on your PATH. Install Git and retry the preflight."
                    .into(),
            ),
        });
    }
    if !is_git_repository {
        blockers.push(WorkspaceIssueRaw {
            code: "NOT_A_GIT_REPOSITORY".into(),
            severity: "blocker".into(),
            message: "Selected project is not a Git repository.".into(),
            detail: Some(
                "Workspace creation in V1 requires the project to be a Git repository so the original source stays read-only via a worktree. The copy fallback is preflighted but disabled in V1."
                    .into(),
            ),
        });
    }
    if git_cleanliness == "dirty" {
        blockers.push(WorkspaceIssueRaw {
            code: "GIT_DIRTY".into(),
            severity: "blocker".into(),
            message: "The Git working tree has uncommitted changes.".into(),
            detail: Some(
                "Commit, stash, or revert your local changes before creating a migration worktree. This guarantees the migration starts from a known commit."
                    .into(),
            ),
        });
    } else if git_cleanliness == "unknown" && is_git_repository {
        warnings.push(WorkspaceIssueRaw {
            code: "GIT_CLEANLINESS_UNKNOWN".into(),
            severity: "warning".into(),
            message: "Could not determine Git cleanliness.".into(),
            detail: Some(
                "The preflight could not run `git status` cleanly. Re-check manually before creating the workspace."
                    .into(),
            ),
        });
    }

    // Branch name proposal — deterministic, but we use a coarse timestamp
    // so re-running preflight does not collide with a stale branch.
    let timestamp = current_timestamp_label();
    let safe_project = sanitise_for_branch(project_name);
    let mut proposed_branch_name = format!(
        "migration/{safe}-react-modernization-{ts}",
        safe = safe_project,
        ts = timestamp
    );

    // If the proposed branch happens to already exist, pick a small unique
    // suffix. Never overwrite or reset.
    if is_git_repository
        && git_branch_exists(source, &proposed_branch_name).unwrap_or(false)
    {
        let suffixed = format!("{proposed_branch_name}-{}", short_random_suffix());
        warnings.push(WorkspaceIssueRaw {
            code: "BRANCH_EXISTS".into(),
            severity: "warning".into(),
            message: "Proposed branch already exists. A unique suffix was appended.".into(),
            detail: Some(format!("Resolved branch name: {suffixed}")),
        });
        proposed_branch_name = suffixed;
    }

    // Workspace path proposal — sibling of the source dir.
    let proposed_workspace_path = propose_workspace_path(source, project_name, &timestamp);

    // Final guardrails on the proposed workspace path.
    if proposed_workspace_path.exists() {
        blockers.push(WorkspaceIssueRaw {
            code: "WORKSPACE_PATH_EXISTS".into(),
            severity: "blocker".into(),
            message: "Proposed workspace path already exists.".into(),
            detail: Some(proposed_workspace_path.to_string_lossy().to_string()),
        });
    }
    if path_starts_with(&proposed_workspace_path, source) {
        blockers.push(WorkspaceIssueRaw {
            code: "WORKSPACE_INSIDE_SOURCE".into(),
            severity: "blocker".into(),
            message: "Workspace path must not live inside the source project.".into(),
            detail: None,
        });
    }

    Ok(WorkspacePreflightRaw {
        source_path: source.to_string_lossy().to_string(),
        project_name: project_name.to_string(),
        is_git_repository,
        git_available,
        current_branch,
        git_cleanliness,
        recommended_strategy,
        fallback_available,
        proposed_branch_name,
        proposed_workspace_path: proposed_workspace_path.to_string_lossy().to_string(),
        blockers,
        warnings,
    })
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

#[tauri::command(rename_all = "camelCase")]
pub async fn workspace_create(
    source_path: String,
    workspace_path: String,
    branch_name: String,
    strategy: String,
) -> CommandResult<WorkspaceCreationResultRaw> {
    let strategy = strategy.trim().to_string();
    let branch_name = branch_name.trim().to_string();
    let workspace_path_input = workspace_path.trim().to_string();
    let source_path_input = source_path.trim().to_string();

    if strategy.is_empty() {
        return Err(CommandError::InvalidInput("strategy is empty".into()));
    }
    if strategy != "git-worktree" && strategy != "copy" {
        return Err(CommandError::InvalidInput(format!(
            "unsupported strategy: {strategy}"
        )));
    }
    if strategy == "copy" {
        // Intentional: V1 surfaces the copy fallback in the UI but does not
        // execute it. Returning a typed error keeps the bridge contract
        // honest rather than silently falling back to git-worktree.
        return Err(CommandError::NotImplemented(
            "copy fallback is not implemented in V1".into(),
        ));
    }

    if !is_valid_branch_name(&branch_name) {
        return Err(CommandError::InvalidInput(
            "branch name contains invalid characters".into(),
        ));
    }

    let source = canonicalise_directory(&source_path_input)?;
    let workspace = validate_workspace_path(&workspace_path_input, &source)?;

    // We've validated everything we can statically. Now do the actual git
    // worktree add inside spawn_blocking so the async runtime stays free.
    let source_for_task = source.clone();
    let workspace_for_task = workspace.clone();
    let branch_for_task = branch_name.clone();

    let result = tokio::task::spawn_blocking(move || {
        run_git_worktree_add(&source_for_task, &workspace_for_task, &branch_for_task)
    })
    .await
    .map_err(|e| CommandError::Internal(format!("worktree task failed: {e}")))??;

    Ok(result)
}

fn run_git_worktree_add(
    source: &Path,
    workspace: &Path,
    branch_name: &str,
) -> CommandResult<WorkspaceCreationResultRaw> {
    let mut command_logs: Vec<WorkspaceCommandLogRaw> = Vec::new();

    // Re-verify Git invariants right before the destructive call. Conditions
    // on disk could have changed between preflight and create.
    let inside_work_tree = git_is_inside_work_tree(source)
        .map_err(|e| CommandError::Internal(format!("git rev-parse failed: {e}")))?;
    if !inside_work_tree {
        return Err(CommandError::InvalidInput(
            "source is not a Git working tree".into(),
        ));
    }

    let cleanliness = git_is_clean(source);
    if let Ok(false) = cleanliness {
        return Err(CommandError::InvalidInput(
            "Git working tree is dirty — commit or stash changes before creating the workspace".into(),
        ));
    }

    if git_branch_exists(source, branch_name).unwrap_or(false) {
        return Err(CommandError::InvalidInput(format!(
            "branch already exists: {branch_name}"
        )));
    }

    if workspace.exists() {
        return Err(CommandError::InvalidInput(
            "workspace path already exists".into(),
        ));
    }

    // Ensure the parent of the workspace path exists so `git worktree add`
    // can create the leaf directory itself. Never recurse into / overwrite.
    if let Some(parent) = workspace.parent() {
        if !parent.exists() {
            std::fs::create_dir_all(parent).map_err(|e| {
                CommandError::Internal(format!(
                    "failed to create workspace parent {parent:?}: {e}"
                ))
            })?;
        }
    }

    let workspace_str = workspace.to_string_lossy().to_string();
    let args: [&str; 5] = ["worktree", "add", "-b", branch_name, &workspace_str];
    let pretty = format!("git worktree add -b {branch_name} {workspace_str}");

    let exec = run_git_command(source, &args);
    let log = WorkspaceCommandLogRaw {
        command: pretty.clone(),
        status: if exec.success {
            "passed".into()
        } else {
            "failed".into()
        },
        stdout: cap_string(&exec.stdout),
        stderr: cap_string(&exec.stderr),
    };
    command_logs.push(log);

    if !exec.success {
        return Err(CommandError::Internal(format!(
            "git worktree add failed: {}",
            exec.stderr.trim()
        )));
    }

    let id = format!(
        "workspace:{}:{}",
        sanitise_for_id(&workspace.to_string_lossy()),
        current_timestamp_label()
    );

    Ok(WorkspaceCreationResultRaw {
        id,
        source_path: source.to_string_lossy().to_string(),
        workspace_path: workspace.to_string_lossy().to_string(),
        strategy: "git-worktree".into(),
        branch_name: Some(branch_name.to_string()),
        created_at: current_iso_timestamp(),
        command_logs,
    })
}

// ---------------------------------------------------------------------------
// Path validation helpers
// ---------------------------------------------------------------------------

fn canonicalise_directory(input: &str) -> CommandResult<PathBuf> {
    if input.trim().is_empty() {
        return Err(CommandError::InvalidInput("path is empty".into()));
    }
    if input.contains('\0') {
        return Err(CommandError::InvalidInput("path contains NUL byte".into()));
    }
    let raw = PathBuf::from(input);
    let canonical = std::fs::canonicalize(&raw)
        .map_err(|e| CommandError::InvalidInput(format!("path not accessible: {e}")))?;
    let stat = std::fs::metadata(&canonical)
        .map_err(|e| CommandError::InvalidInput(format!("cannot stat path: {e}")))?;
    if !stat.is_dir() {
        return Err(CommandError::InvalidInput(
            "path is not a directory".into(),
        ));
    }
    Ok(canonical)
}

/// Validate the workspace path. The path must NOT exist (otherwise we would
/// risk overwriting). We canonicalise the parent directory and reject any
/// candidate that lives inside the source path.
fn validate_workspace_path(input: &str, source: &Path) -> CommandResult<PathBuf> {
    if input.trim().is_empty() {
        return Err(CommandError::InvalidInput(
            "workspace path is empty".into(),
        ));
    }
    if input.contains('\0') {
        return Err(CommandError::InvalidInput(
            "workspace path contains NUL byte".into(),
        ));
    }
    let candidate = PathBuf::from(input);
    if !candidate.is_absolute() {
        return Err(CommandError::InvalidInput(
            "workspace path must be absolute".into(),
        ));
    }
    if candidate.exists() {
        return Err(CommandError::InvalidInput(
            "workspace path already exists".into(),
        ));
    }

    // Resolve the parent so we can compare canonical paths even though the
    // workspace leaf itself does not exist yet.
    let parent = candidate.parent().ok_or_else(|| {
        CommandError::InvalidInput("workspace path has no parent directory".into())
    })?;
    let parent_canonical = std::fs::canonicalize(parent).map_err(|e| {
        CommandError::InvalidInput(format!("workspace parent not accessible: {e}"))
    })?;
    let leaf = candidate
        .file_name()
        .ok_or_else(|| CommandError::InvalidInput("workspace path has no leaf name".into()))?;
    let canonical_candidate = parent_canonical.join(leaf);

    if path_starts_with(&canonical_candidate, source) {
        return Err(CommandError::PathNotAllowed(
            "workspace path lives inside the source project".into(),
        ));
    }
    Ok(canonical_candidate)
}

// ---------------------------------------------------------------------------
// Session artifact writer (Phase R5 — workspace handoff)
// ---------------------------------------------------------------------------

/// Allowlist of session artifact file names the UI is permitted to write
/// into a created workspace. Keeps the bridge command honest — it never
/// accepts a free-form path.
const SAFE_SESSION_ARTIFACT_NAMES: &[&str] = &[
    "workspace.json",
    "plan-snapshot.json",
];

/// Folder (relative to the workspace root) where session artifacts live.
const SESSION_ARTIFACT_DIR: &str = ".migration-orchestrator/session";

/// Write small JSON session artifacts inside an existing workspace.
///
/// Phase R5 Step 9 requires the workspace screen to persist a plan
/// snapshot + workspace metadata file alongside the migration worktree.
/// We expose a tightly-scoped command rather than a generic file writer
/// so the UI cannot accidentally write outside the workspace path.
///
/// Safety guarantees:
/// * `workspace_path` is canonicalised + must already exist as a dir.
/// * Each artifact name is checked against
///   [`SAFE_SESSION_ARTIFACT_NAMES`]; anything else is rejected.
/// * Artifacts are written under
///   `<workspace_path>/.migration-orchestrator/session/`. The folder is
///   created if missing. Existing files are overwritten in place.
/// * The artifact contents are limited to 1 MiB each; oversized payloads
///   are rejected so a runaway plan cannot fill the disk.
#[tauri::command(rename_all = "camelCase")]
pub async fn workspace_write_session_artifact(
    workspace_path: String,
    artifacts: Vec<WorkspaceSessionArtifactInput>,
) -> CommandResult<WorkspaceArtifactWriteResultRaw> {
    let workspace = canonicalise_directory(&workspace_path)?;
    if artifacts.is_empty() {
        return Err(CommandError::InvalidInput(
            "no session artifacts supplied".into(),
        ));
    }
    if artifacts.len() > SAFE_SESSION_ARTIFACT_NAMES.len() {
        return Err(CommandError::InvalidInput(
            "too many session artifacts in a single call".into(),
        ));
    }

    for artifact in &artifacts {
        validate_artifact_name(&artifact.name)?;
        if artifact.contents.len() > 1024 * 1024 {
            return Err(CommandError::InvalidInput(format!(
                "session artifact {} exceeds 1 MiB cap",
                artifact.name
            )));
        }
    }

    let workspace_for_task = workspace.clone();
    let artifacts_for_task = artifacts;
    let result = tokio::task::spawn_blocking(move || {
        write_session_artifacts(&workspace_for_task, &artifacts_for_task)
    })
    .await
    .map_err(|e| CommandError::Internal(format!("artifact task failed: {e}")))??;

    Ok(result)
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceSessionArtifactInput {
    pub name: String,
    pub contents: String,
}

fn validate_artifact_name(name: &str) -> CommandResult<()> {
    if !SAFE_SESSION_ARTIFACT_NAMES.contains(&name) {
        return Err(CommandError::InvalidInput(format!(
            "artifact name not allowed: {name}"
        )));
    }
    Ok(())
}

fn write_session_artifacts(
    workspace: &Path,
    artifacts: &[WorkspaceSessionArtifactInput],
) -> CommandResult<WorkspaceArtifactWriteResultRaw> {
    let session_dir = workspace.join(SESSION_ARTIFACT_DIR);
    std::fs::create_dir_all(&session_dir).map_err(|e| {
        CommandError::Internal(format!(
            "failed to create session artifact dir {session_dir:?}: {e}"
        ))
    })?;

    let mut entries: Vec<WorkspaceArtifactEntryRaw> = Vec::new();
    for artifact in artifacts {
        let path = session_dir.join(&artifact.name);
        // Defensive: the artifact name is allowlisted but `Path::join`
        // could in theory be tricked by a relative escape if the list
        // grew. Compare canonical parents to be sure.
        if let Some(parent) = path.parent() {
            if parent != session_dir.as_path() {
                return Err(CommandError::PathNotAllowed(format!(
                    "artifact path escaped session dir: {path:?}"
                )));
            }
        }
        std::fs::write(&path, artifact.contents.as_bytes()).map_err(|e| {
            CommandError::Internal(format!(
                "failed to write session artifact {path:?}: {e}"
            ))
        })?;
        entries.push(WorkspaceArtifactEntryRaw {
            relative_path: format!("{SESSION_ARTIFACT_DIR}/{}", artifact.name),
            absolute_path: path.to_string_lossy().to_string(),
            bytes_written: artifact.contents.len() as u64,
        });
    }

    Ok(WorkspaceArtifactWriteResultRaw {
        workspace_path: workspace.to_string_lossy().to_string(),
        artifacts: entries,
    })
}

fn path_starts_with(candidate: &Path, root: &Path) -> bool {
    candidate.starts_with(root)
}

// ---------------------------------------------------------------------------
// Git helpers
// ---------------------------------------------------------------------------

struct CommandOutcome {
    success: bool,
    stdout: String,
    stderr: String,
}

fn detect_git_available() -> bool {
    Command::new("git")
        .arg("--version")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

fn run_git_command(cwd: &Path, args: &[&str]) -> CommandOutcome {
    match Command::new("git").args(args).current_dir(cwd).output() {
        Ok(out) => CommandOutcome {
            success: out.status.success(),
            stdout: String::from_utf8_lossy(&out.stdout).to_string(),
            stderr: String::from_utf8_lossy(&out.stderr).to_string(),
        },
        Err(e) => CommandOutcome {
            success: false,
            stdout: String::new(),
            stderr: format!("failed to spawn git: {e}"),
        },
    }
}

fn git_is_inside_work_tree(cwd: &Path) -> Result<bool, String> {
    let out = run_git_command(cwd, &["rev-parse", "--is-inside-work-tree"]);
    if !out.success {
        return Ok(false);
    }
    Ok(out.stdout.trim() == "true")
}

fn git_current_branch(cwd: &Path) -> Result<Option<String>, String> {
    let out = run_git_command(cwd, &["rev-parse", "--abbrev-ref", "HEAD"]);
    if !out.success {
        return Ok(None);
    }
    let trimmed = out.stdout.trim().to_string();
    if trimmed.is_empty() || trimmed == "HEAD" {
        return Ok(None);
    }
    Ok(Some(trimmed))
}

fn git_is_clean(cwd: &Path) -> Result<bool, String> {
    let out = run_git_command(cwd, &["status", "--porcelain"]);
    if !out.success {
        return Err(out.stderr);
    }
    Ok(out.stdout.trim().is_empty())
}

fn git_branch_exists(cwd: &Path, branch: &str) -> Result<bool, String> {
    if !is_valid_branch_name(branch) {
        return Ok(false);
    }
    let out = run_git_command(cwd, &["branch", "--list", branch]);
    if !out.success {
        return Err(out.stderr);
    }
    Ok(!out.stdout.trim().is_empty())
}

// ---------------------------------------------------------------------------
// Misc helpers
// ---------------------------------------------------------------------------

fn cap_string(s: &str) -> Option<String> {
    if s.is_empty() {
        return None;
    }
    if s.len() <= COMMAND_OUTPUT_CAP {
        return Some(s.to_string());
    }
    let head = &s[..COMMAND_OUTPUT_CAP];
    Some(format!(
        "{head}\n... [output truncated at {COMMAND_OUTPUT_CAP} bytes]"
    ))
}

fn sanitise_for_branch(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    let mut prev_dash = false;
    for ch in input.chars() {
        let mapped = match ch {
            'A'..='Z' => ch.to_ascii_lowercase(),
            'a'..='z' | '0'..='9' => ch,
            _ => '-',
        };
        if mapped == '-' {
            if !prev_dash && !out.is_empty() {
                out.push('-');
                prev_dash = true;
            }
        } else {
            out.push(mapped);
            prev_dash = false;
        }
    }
    while out.ends_with('-') {
        out.pop();
    }
    if out.is_empty() {
        out.push_str("project");
    }
    if out.len() > 64 {
        out.truncate(64);
        while out.ends_with('-') {
            out.pop();
        }
    }
    out
}

fn sanitise_for_id(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    for ch in input.chars() {
        match ch {
            'A'..='Z' | 'a'..='z' | '0'..='9' | '-' | '_' => out.push(ch),
            _ => out.push('-'),
        }
    }
    if out.len() > 80 {
        out.truncate(80);
    }
    out
}

fn propose_workspace_path(source: &Path, project_name: &str, timestamp: &str) -> PathBuf {
    let parent = source
        .parent()
        .map(|p| p.to_path_buf())
        .unwrap_or_else(|| PathBuf::from("."));
    let safe = sanitise_for_branch(project_name);
    let leaf = format!("{safe}-migration-workspace-{timestamp}");
    parent.join(leaf)
}

fn current_timestamp_label() -> String {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    now.to_string()
}

fn current_iso_timestamp() -> String {
    // Tiny RFC3339-ish formatter that does not pull in chrono. We round to
    // seconds and emit UTC. Format: "2026-05-30T12:34:56Z".
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);
    format_unix_seconds_utc(secs)
}

fn format_unix_seconds_utc(secs: i64) -> String {
    // Days since 1970-01-01.
    let days = secs.div_euclid(86_400);
    let time = secs.rem_euclid(86_400);
    let hour = (time / 3600) as u32;
    let minute = ((time % 3600) / 60) as u32;
    let second = (time % 60) as u32;

    let (year, month, day) = civil_from_days(days);
    format!("{year:04}-{month:02}-{day:02}T{hour:02}:{minute:02}:{second:02}Z")
}

/// Howard Hinnant's algorithm for civil-from-days.
/// Reference: <https://howardhinnant.github.io/date_algorithms.html>
fn civil_from_days(z: i64) -> (i32, u32, u32) {
    let z = z + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = (z - era * 146_097) as u32;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let y = yoe as i64 + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = if m <= 2 { y + 1 } else { y };
    (year as i32, m, d)
}

/// Tiny non-crypto suffix derived from process state. Good enough to break
/// branch-name collisions; not used for security.
fn short_random_suffix() -> String {
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.subsec_nanos())
        .unwrap_or(0);
    let started = Instant::now().elapsed().as_nanos() as u32;
    let mixed = nanos ^ started;
    format!("{:x}", mixed & 0xFFFF)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU64, Ordering};

    fn make_temp_workspace(label: &str) -> PathBuf {
        static COUNTER: AtomicU64 = AtomicU64::new(0);
        let n = COUNTER.fetch_add(1, Ordering::SeqCst);
        let pid = std::process::id();
        let dir = std::env::temp_dir().join(format!(
            "migrate-pilot-workspace-{label}-{pid}-{n}-{ts}",
            ts = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_nanos())
                .unwrap_or(0)
        ));
        std::fs::create_dir_all(&dir).expect("create temp dir");
        std::fs::canonicalize(&dir).expect("canonicalize temp dir")
    }

    #[test]
    fn branch_name_validates_safe_inputs() {
        assert!(is_valid_branch_name("migration/my-project-react-modernization-1"));
        assert!(is_valid_branch_name("feature/foo_bar"));
    }

    #[test]
    fn branch_name_rejects_unsafe_inputs() {
        assert!(!is_valid_branch_name(""));
        assert!(!is_valid_branch_name("../escape"));
        assert!(!is_valid_branch_name("with spaces"));
        assert!(!is_valid_branch_name("/leading"));
        assert!(!is_valid_branch_name("trailing/"));
        assert!(!is_valid_branch_name("a..b"));
        assert!(!is_valid_branch_name("UPPER"));
        assert!(!is_valid_branch_name("rm$injection"));
    }

    #[test]
    fn branch_sanitiser_lowercases_and_collapses() {
        assert_eq!(sanitise_for_branch("My Project!"), "my-project");
        assert_eq!(sanitise_for_branch("---__hello__---"), "hello");
        assert_eq!(sanitise_for_branch(""), "project");
    }

    #[test]
    fn iso_timestamp_round_trips_known_values() {
        assert_eq!(format_unix_seconds_utc(0), "1970-01-01T00:00:00Z");
        assert_eq!(format_unix_seconds_utc(1_700_000_000), "2023-11-14T22:13:20Z");
    }

    #[test]
    fn artifact_name_validator_allows_known_files() {
        assert!(validate_artifact_name("workspace.json").is_ok());
        assert!(validate_artifact_name("plan-snapshot.json").is_ok());
    }

    #[test]
    fn artifact_name_validator_rejects_unknown_files() {
        assert!(validate_artifact_name("").is_err());
        assert!(validate_artifact_name("../escape.json").is_err());
        assert!(validate_artifact_name("execute.sh").is_err());
        assert!(validate_artifact_name("Workspace.json").is_err());
    }

    #[test]
    fn write_session_artifacts_persists_files_inside_workspace() {
        let temp = make_temp_workspace("artifacts");
        let inputs = vec![
            WorkspaceSessionArtifactInput {
                name: "workspace.json".into(),
                contents: "{\"workspacePath\":\"x\"}".into(),
            },
            WorkspaceSessionArtifactInput {
                name: "plan-snapshot.json".into(),
                contents: "{\"planId\":\"y\"}".into(),
            },
        ];

        let result = write_session_artifacts(&temp, &inputs).expect("write ok");
        assert_eq!(result.artifacts.len(), 2);

        let session_dir = temp.join(SESSION_ARTIFACT_DIR);
        assert!(session_dir.exists());
        assert!(session_dir.join("workspace.json").exists());
        assert!(session_dir.join("plan-snapshot.json").exists());
    }
}
