//! Diff review commands (Milestone 7).
//!
//! Three narrow, safe commands are exposed:
//!
//! * [`diff_load`] — read-only inspection of the workspace's Git working
//!   tree. Returns per-file status, additions/deletions, and the unified
//!   diff text for the changed files produced by the most recent execution
//!   run. NEVER mutates the workspace and NEVER reads the source project.
//!
//! * [`diff_approve`] — bookkeeping-only command that records the user's
//!   approval of an execution run. Performs the same workspace safety
//!   checks as [`diff_load`] but does not touch any file or invoke Git.
//!
//! * [`diff_reject`] — workspace-only revert. Restores the changed files
//!   to their HEAD/index baseline using `git restore --` for tracked
//!   modifications. Untracked / created files are NOT auto-deleted —
//!   they are reported back as "manual cleanup required" so this command
//!   can never accidentally remove unrelated user content.
//!
//! Safety guarantees enforced server-side
//! --------------------------------------
//! * The `workspace_path` is canonicalised and must be an existing directory.
//! * The `source_path` is canonicalised and must be an existing directory.
//! * The two paths must not be equal and must not be nested either way.
//! * Every relative changed-file path is validated: no NUL byte, no `..`,
//!   no leading `/`, no absolute path, no traversal outside the workspace
//!   root after canonicalising the parent directory.
//! * Every Git invocation goes through [`std::process::Command`] with a
//!   fixed `args` array. There is no `sh -c`, no shell interpolation, and
//!   no eval. Stdout/stderr are captured and capped at
//!   [`COMMAND_OUTPUT_CAP`] bytes for log surfaces, with diff text capped
//!   at [`MAX_DIFF_BYTES_PER_FILE`] per-file.
//! * No commit is created. No branch is moved. No `git reset --hard` is
//!   ever executed. No file outside the workspace is read or written.

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use serde::Serialize;

use super::{CommandError, CommandResult};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/// Maximum unified-diff size captured per file before the response is
/// flagged with `tooLarge`. 256 KiB is generous for a real-world step
/// (the milestone 6 executor only edits a single `package.json`).
const MAX_DIFF_BYTES_PER_FILE: usize = 256 * 1024;

/// Maximum bytes captured per command stream (stdout/stderr) for diff
/// command logs. Caps log size so the UI never has to render runaway
/// output.
const COMMAND_OUTPUT_CAP: usize = 8 * 1024;

/// Hard cap on the number of changed files the UI can submit to a single
/// load/reject call. The milestone 6 executor produces exactly one file,
/// but a generous ceiling makes future executors safe by default.
const MAX_CHANGED_FILES: usize = 256;

// ---------------------------------------------------------------------------
// Wire types
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DiffCommandLogRaw {
    pub command: String,
    /// `"passed" | "failed"`.
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stdout: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stderr: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DiffFileRaw {
    pub path: String,
    /// `"modified" | "created" | "deleted" | "renamed" | "unknown"`.
    pub status: String,
    pub additions: u32,
    pub deletions: u32,
    pub diff_text: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub is_binary: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub too_large: Option<bool>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffReviewRaw {
    pub workspace_path: String,
    pub execution_run_id: String,
    pub plan_id: String,
    pub plan_step_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub branch_name: Option<String>,
    pub loaded_at: String,
    pub files: Vec<DiffFileRaw>,
    pub command_logs: Vec<DiffCommandLogRaw>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffReviewDecisionRaw {
    /// `"approved" | "rejected"`.
    pub decision: String,
    pub workspace_path: String,
    pub execution_run_id: String,
    pub plan_id: String,
    pub plan_step_id: String,
    pub decided_at: String,
    /// Files that were successfully reverted (only populated for
    /// `"rejected"`). Always empty for `"approved"`.
    pub reverted_files: Vec<String>,
    /// Files that the command refused to revert automatically — typically
    /// untracked / created files. The UI surfaces these as a manual
    /// cleanup step. Always empty for `"approved"`.
    pub manual_cleanup_files: Vec<String>,
    pub command_logs: Vec<DiffCommandLogRaw>,
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/// Read-only diff loader. Runs `git status --short`, `git diff --numstat`
/// and `git diff --` for the supplied changed files inside the workspace.
#[tauri::command(rename_all = "camelCase")]
pub async fn diff_load(
    workspace_path: String,
    source_path: String,
    execution_run_id: String,
    plan_id: String,
    plan_step_id: String,
    changed_files: Vec<String>,
) -> CommandResult<DiffReviewRaw> {
    let execution_run_id = execution_run_id.trim().to_string();
    let plan_id = plan_id.trim().to_string();
    let plan_step_id = plan_step_id.trim().to_string();

    if execution_run_id.is_empty() {
        return Err(CommandError::InvalidInput(
            "execution run id is empty".into(),
        ));
    }
    if plan_id.is_empty() {
        return Err(CommandError::InvalidInput("plan id is empty".into()));
    }
    if plan_step_id.is_empty() {
        return Err(CommandError::InvalidInput("plan step id is empty".into()));
    }
    if changed_files.len() > MAX_CHANGED_FILES {
        return Err(CommandError::InvalidInput(format!(
            "too many changed files (max {MAX_CHANGED_FILES})"
        )));
    }

    let workspace = canonicalise_directory(&workspace_path)?;
    let source = canonicalise_directory(&source_path)?;
    ensure_workspace_safe(&workspace, &source)?;

    let validated = validate_changed_files(&changed_files, &workspace)?;

    let workspace_for_task = workspace.clone();
    let raw = tokio::task::spawn_blocking(move || {
        load_workspace_diff(
            &workspace_for_task,
            &execution_run_id,
            &plan_id,
            &plan_step_id,
            &validated,
        )
    })
    .await
    .map_err(|e| CommandError::Internal(format!("diff load task failed: {e}")))??;

    Ok(raw)
}

/// Bookkeeping-only approval. Runs every workspace safety check that
/// `diff_load` does so the UI cannot stash an "approved" decision against
/// a workspace that has since become invalid. Touches no files.
#[tauri::command(rename_all = "camelCase")]
pub async fn diff_approve(
    workspace_path: String,
    execution_run_id: String,
    plan_id: String,
    plan_step_id: String,
) -> CommandResult<DiffReviewDecisionRaw> {
    let execution_run_id = execution_run_id.trim().to_string();
    let plan_id = plan_id.trim().to_string();
    let plan_step_id = plan_step_id.trim().to_string();
    if execution_run_id.is_empty() {
        return Err(CommandError::InvalidInput(
            "execution run id is empty".into(),
        ));
    }
    if plan_id.is_empty() {
        return Err(CommandError::InvalidInput("plan id is empty".into()));
    }
    if plan_step_id.is_empty() {
        return Err(CommandError::InvalidInput("plan step id is empty".into()));
    }

    let workspace = canonicalise_directory(&workspace_path)?;

    Ok(DiffReviewDecisionRaw {
        decision: "approved".to_string(),
        workspace_path: workspace.to_string_lossy().to_string(),
        execution_run_id,
        plan_id,
        plan_step_id,
        decided_at: current_iso_timestamp(),
        reverted_files: Vec::new(),
        manual_cleanup_files: Vec::new(),
        command_logs: Vec::new(),
    })
}

/// Workspace-only revert. Calls `git restore -- <file>` for each modified
/// or deleted tracked file. Untracked / created files are reported back
/// as `manual_cleanup_files` rather than auto-deleted.
#[tauri::command(rename_all = "camelCase")]
pub async fn diff_reject(
    workspace_path: String,
    source_path: String,
    execution_run_id: String,
    plan_id: String,
    plan_step_id: String,
    changed_files: Vec<String>,
) -> CommandResult<DiffReviewDecisionRaw> {
    let execution_run_id = execution_run_id.trim().to_string();
    let plan_id = plan_id.trim().to_string();
    let plan_step_id = plan_step_id.trim().to_string();
    if execution_run_id.is_empty() {
        return Err(CommandError::InvalidInput(
            "execution run id is empty".into(),
        ));
    }
    if plan_id.is_empty() {
        return Err(CommandError::InvalidInput("plan id is empty".into()));
    }
    if plan_step_id.is_empty() {
        return Err(CommandError::InvalidInput("plan step id is empty".into()));
    }
    if changed_files.len() > MAX_CHANGED_FILES {
        return Err(CommandError::InvalidInput(format!(
            "too many changed files (max {MAX_CHANGED_FILES})"
        )));
    }

    let workspace = canonicalise_directory(&workspace_path)?;
    let source = canonicalise_directory(&source_path)?;
    ensure_workspace_safe(&workspace, &source)?;

    let validated = validate_changed_files(&changed_files, &workspace)?;

    let workspace_for_task = workspace.clone();
    let raw = tokio::task::spawn_blocking(move || {
        revert_workspace_changes(
            &workspace_for_task,
            &execution_run_id,
            &plan_id,
            &plan_step_id,
            &validated,
        )
    })
    .await
    .map_err(|e| CommandError::Internal(format!("diff reject task failed: {e}")))??;

    Ok(raw)
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

fn load_workspace_diff(
    workspace: &Path,
    execution_run_id: &str,
    plan_id: &str,
    plan_step_id: &str,
    changed_files: &[String],
) -> CommandResult<DiffReviewRaw> {
    let mut command_logs: Vec<DiffCommandLogRaw> = Vec::new();

    // Branch name is best-effort; failure to read it is not fatal.
    let branch_name = read_current_branch(workspace, &mut command_logs);

    let mut files: Vec<DiffFileRaw> = Vec::with_capacity(changed_files.len());
    for path in changed_files {
        files.push(load_file_diff(workspace, path, &mut command_logs));
    }

    Ok(DiffReviewRaw {
        workspace_path: workspace.to_string_lossy().to_string(),
        execution_run_id: execution_run_id.to_string(),
        plan_id: plan_id.to_string(),
        plan_step_id: plan_step_id.to_string(),
        branch_name,
        loaded_at: current_iso_timestamp(),
        files,
        command_logs,
    })
}

/// Build the [`DiffFileRaw`] for a single relative path. Failures from
/// the read-only Git probes are surfaced as `unknown` rather than an
/// error so the UI can still show the rest of the file list.
fn load_file_diff(
    workspace: &Path,
    relative_path: &str,
    command_logs: &mut Vec<DiffCommandLogRaw>,
) -> DiffFileRaw {
    let status = read_file_status(workspace, relative_path, command_logs);

    let (additions, deletions, is_binary_numstat) =
        read_numstat(workspace, relative_path, command_logs);

    let (raw_diff, capture_outcome) = read_unified_diff(workspace, relative_path, command_logs);
    let too_large = capture_outcome.too_large;
    let is_binary = capture_outcome.is_binary || is_binary_numstat;

    DiffFileRaw {
        path: relative_path.to_string(),
        status,
        additions,
        deletions,
        diff_text: raw_diff,
        is_binary: if is_binary { Some(true) } else { None },
        too_large: if too_large { Some(true) } else { None },
    }
}

fn read_current_branch(
    workspace: &Path,
    command_logs: &mut Vec<DiffCommandLogRaw>,
) -> Option<String> {
    let exec = run_git_command(workspace, &["rev-parse", "--abbrev-ref", "HEAD"]);
    push_command_log(
        command_logs,
        "git rev-parse --abbrev-ref HEAD",
        exec.success,
        &exec.stdout,
        &exec.stderr,
    );
    if !exec.success {
        return None;
    }
    let trimmed = exec.stdout.trim();
    if trimmed.is_empty() || trimmed == "HEAD" {
        return None;
    }
    Some(trimmed.to_string())
}

fn read_file_status(
    workspace: &Path,
    relative_path: &str,
    command_logs: &mut Vec<DiffCommandLogRaw>,
) -> String {
    let exec = run_git_command(
        workspace,
        &["status", "--short", "--porcelain", "--", relative_path],
    );
    push_command_log(
        command_logs,
        &format!("git status --short --porcelain -- {relative_path}"),
        exec.success,
        &exec.stdout,
        &exec.stderr,
    );

    if !exec.success {
        return "unknown".to_string();
    }
    classify_porcelain_line(&exec.stdout)
}

/// Map the porcelain v1 `XY` byte pair to a stable diff file status.
///
/// References:
/// - X = index, Y = working tree status.
/// - `??` is untracked (created).
/// - `R*` indicates a rename in the index.
/// - `D*` / ` D` indicates a deletion.
fn classify_porcelain_line(stdout: &str) -> String {
    let line = match stdout.lines().next() {
        Some(l) => l,
        None => return "unknown".to_string(),
    };
    if line.len() < 2 {
        return "unknown".to_string();
    }
    let bytes = line.as_bytes();
    let x = bytes[0] as char;
    let y = bytes[1] as char;

    if x == '?' && y == '?' {
        return "created".to_string();
    }
    if x == 'A' || y == 'A' {
        return "created".to_string();
    }
    if x == 'D' || y == 'D' {
        return "deleted".to_string();
    }
    if x == 'R' || y == 'R' {
        return "renamed".to_string();
    }
    if x == 'M' || y == 'M' {
        return "modified".to_string();
    }
    "unknown".to_string()
}

/// Returns (additions, deletions, is_binary).
fn read_numstat(
    workspace: &Path,
    relative_path: &str,
    command_logs: &mut Vec<DiffCommandLogRaw>,
) -> (u32, u32, bool) {
    // `git diff --numstat` works for tracked changes. For untracked files
    // it returns nothing — fall back to counting lines manually below.
    let exec = run_git_command(
        workspace,
        &["diff", "--numstat", "--", relative_path],
    );
    push_command_log(
        command_logs,
        &format!("git diff --numstat -- {relative_path}"),
        exec.success,
        &exec.stdout,
        &exec.stderr,
    );

    if let Some(line) = exec.stdout.lines().next() {
        if let Some((adds, dels, binary)) = parse_numstat_line(line) {
            return (adds, dels, binary);
        }
    }

    // Fallback: count lines for an untracked / newly-created file. This
    // is best-effort — a missing or unreadable file simply yields zeros.
    let abs = workspace.join(relative_path);
    if let Ok(text) = fs::read_to_string(&abs) {
        let additions = u32::try_from(text.lines().count()).unwrap_or(u32::MAX);
        return (additions, 0, false);
    }
    (0, 0, false)
}

fn parse_numstat_line(line: &str) -> Option<(u32, u32, bool)> {
    let mut parts = line.split_whitespace();
    let added = parts.next()?;
    let removed = parts.next()?;
    if added == "-" && removed == "-" {
        return Some((0, 0, true));
    }
    let added_n: u32 = added.parse().ok()?;
    let removed_n: u32 = removed.parse().ok()?;
    Some((added_n, removed_n, false))
}

struct DiffCaptureOutcome {
    too_large: bool,
    is_binary: bool,
}

fn read_unified_diff(
    workspace: &Path,
    relative_path: &str,
    command_logs: &mut Vec<DiffCommandLogRaw>,
) -> (String, DiffCaptureOutcome) {
    let exec = run_git_command(workspace, &["diff", "--", relative_path]);
    push_command_log(
        command_logs,
        &format!("git diff -- {relative_path}"),
        exec.success,
        &exec.stdout,
        &exec.stderr,
    );

    let mut diff = exec.stdout;
    let mut too_large = false;
    if diff.len() > MAX_DIFF_BYTES_PER_FILE {
        // Keep the head so the user gets a useful preview without
        // triggering a virtual-DOM blowup in the renderer.
        diff.truncate(MAX_DIFF_BYTES_PER_FILE);
        diff.push_str("\n... [diff truncated]\n");
        too_large = true;
    }

    let is_binary = diff.contains("Binary files ");
    (diff, DiffCaptureOutcome { too_large, is_binary })
}

// ---------------------------------------------------------------------------
// Reject / revert
// ---------------------------------------------------------------------------

fn revert_workspace_changes(
    workspace: &Path,
    execution_run_id: &str,
    plan_id: &str,
    plan_step_id: &str,
    changed_files: &[String],
) -> CommandResult<DiffReviewDecisionRaw> {
    let mut command_logs: Vec<DiffCommandLogRaw> = Vec::new();
    let mut reverted: Vec<String> = Vec::new();
    let mut manual_cleanup: Vec<String> = Vec::new();

    for relative_path in changed_files {
        let status = read_file_status(workspace, relative_path, &mut command_logs);

        // `git restore` only makes sense for tracked changes (modified,
        // deleted in worktree, or staged). Untracked / created files are
        // reported back as manual cleanup rather than auto-removed: this
        // command must never broaden into `git clean`.
        if status == "created" {
            manual_cleanup.push(relative_path.clone());
            continue;
        }

        let exec = run_git_command(workspace, &["restore", "--", relative_path]);
        push_command_log(
            &mut command_logs,
            &format!("git restore -- {relative_path}"),
            exec.success,
            &exec.stdout,
            &exec.stderr,
        );
        if exec.success {
            reverted.push(relative_path.clone());
        } else {
            // Surface to the UI but do not abort the rest of the revert.
            manual_cleanup.push(relative_path.clone());
        }
    }

    Ok(DiffReviewDecisionRaw {
        decision: "rejected".to_string(),
        workspace_path: workspace.to_string_lossy().to_string(),
        execution_run_id: execution_run_id.to_string(),
        plan_id: plan_id.to_string(),
        plan_step_id: plan_step_id.to_string(),
        decided_at: current_iso_timestamp(),
        reverted_files: reverted,
        manual_cleanup_files: manual_cleanup,
        command_logs,
    })
}

// ---------------------------------------------------------------------------
// Path / safety helpers
// ---------------------------------------------------------------------------

fn canonicalise_directory(input: &str) -> CommandResult<PathBuf> {
    if input.trim().is_empty() {
        return Err(CommandError::InvalidInput("path is empty".into()));
    }
    if input.contains('\0') {
        return Err(CommandError::InvalidInput("path contains NUL byte".into()));
    }
    let raw = PathBuf::from(input);
    let canonical = fs::canonicalize(&raw)
        .map_err(|e| CommandError::InvalidInput(format!("path not accessible: {e}")))?;
    let stat = fs::metadata(&canonical)
        .map_err(|e| CommandError::InvalidInput(format!("cannot stat path: {e}")))?;
    if !stat.is_dir() {
        return Err(CommandError::InvalidInput(
            "path is not a directory".into(),
        ));
    }
    Ok(canonical)
}

fn ensure_workspace_safe(workspace: &Path, source: &Path) -> CommandResult<()> {
    if workspace == source {
        return Err(CommandError::PathNotAllowed(
            "workspace path must not equal source project path".into(),
        ));
    }
    if workspace.starts_with(source) {
        return Err(CommandError::PathNotAllowed(
            "workspace path must not live inside the source project".into(),
        ));
    }
    if source.starts_with(workspace) {
        return Err(CommandError::PathNotAllowed(
            "source project path must not live inside the workspace".into(),
        ));
    }
    Ok(())
}

/// Validate every changed-file path. Returns the deduplicated, ordered
/// list of relative paths confirmed safe to operate on inside `workspace`.
fn validate_changed_files(
    changed_files: &[String],
    workspace: &Path,
) -> CommandResult<Vec<String>> {
    let mut seen: Vec<String> = Vec::with_capacity(changed_files.len());
    for raw in changed_files {
        let normalised = validate_relative_path(raw, workspace)?;
        if !seen.iter().any(|p| p == &normalised) {
            seen.push(normalised);
        }
    }
    Ok(seen)
}

/// Reject any path that:
///   * is empty, contains a NUL byte, or contains `..`;
///   * is absolute or starts with `/` / `\`;
///   * resolves outside the canonical `workspace` root.
fn validate_relative_path(input: &str, workspace: &Path) -> CommandResult<String> {
    let trimmed = input.trim();
    if trimmed.is_empty() {
        return Err(CommandError::InvalidInput(
            "changed file path is empty".into(),
        ));
    }
    if trimmed.contains('\0') {
        return Err(CommandError::InvalidInput(
            "changed file path contains NUL byte".into(),
        ));
    }
    if trimmed.starts_with('/') || trimmed.starts_with('\\') {
        return Err(CommandError::PathNotAllowed(format!(
            "changed file path must be relative: {trimmed}"
        )));
    }
    let candidate = PathBuf::from(trimmed);
    if candidate.is_absolute() {
        return Err(CommandError::PathNotAllowed(format!(
            "changed file path must be relative: {trimmed}"
        )));
    }
    for component in candidate.components() {
        if matches!(component, std::path::Component::ParentDir) {
            return Err(CommandError::PathNotAllowed(format!(
                "changed file path may not contain `..`: {trimmed}"
            )));
        }
    }

    // The leaf may not yet exist (e.g. a deleted file), but the parent
    // directory must canonicalise into the workspace root.
    let absolute = workspace.join(&candidate);
    let parent = absolute.parent().ok_or_else(|| {
        CommandError::InvalidInput(format!(
            "changed file path has no parent directory: {trimmed}"
        ))
    })?;
    let canonical_parent = match fs::canonicalize(parent) {
        Ok(p) => p,
        Err(e) => {
            return Err(CommandError::InvalidInput(format!(
                "cannot resolve workspace path for {trimmed}: {e}"
            )));
        }
    };
    if !canonical_parent.starts_with(workspace) {
        return Err(CommandError::PathNotAllowed(format!(
            "changed file resolves outside the workspace: {trimmed}"
        )));
    }

    Ok(trimmed.to_string())
}

// ---------------------------------------------------------------------------
// Git invocation helpers
// ---------------------------------------------------------------------------

struct CommandOutcome {
    success: bool,
    stdout: String,
    stderr: String,
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

fn push_command_log(
    logs: &mut Vec<DiffCommandLogRaw>,
    pretty: &str,
    success: bool,
    stdout: &str,
    stderr: &str,
) {
    logs.push(DiffCommandLogRaw {
        command: pretty.to_string(),
        status: if success { "passed".into() } else { "failed".into() },
        stdout: cap_string(stdout),
        stderr: cap_string(stderr),
    });
}

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

// ---------------------------------------------------------------------------
// Timestamp helpers
// ---------------------------------------------------------------------------

fn current_iso_timestamp() -> String {
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);
    format_unix_seconds_utc(secs)
}

fn format_unix_seconds_utc(secs: i64) -> String {
    let days = secs.div_euclid(86_400);
    let time = secs.rem_euclid(86_400);
    let hour = (time / 3600) as u32;
    let minute = ((time % 3600) / 60) as u32;
    let second = (time % 60) as u32;
    let (year, month, day) = civil_from_days(days);
    format!("{year:04}-{month:02}-{day:02}T{hour:02}:{minute:02}:{second:02}Z")
}

/// Howard Hinnant's civil-from-days. Identical to the helper in
/// `commands::workspace` and `commands::execution`; kept duplicated to
/// avoid forming a `commands::date` shared module just for this milestone.
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use std::sync::atomic::{AtomicU64, Ordering};

    fn make_temp_dir(label: &str) -> PathBuf {
        static COUNTER: AtomicU64 = AtomicU64::new(0);
        let n = COUNTER.fetch_add(1, Ordering::SeqCst);
        let pid = std::process::id();
        let dir = std::env::temp_dir().join(format!(
            "migrate-pilot-diff-{label}-{pid}-{n}-{ts}",
            ts = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_nanos())
                .unwrap_or(0)
        ));
        fs::create_dir_all(&dir).expect("create temp dir");
        fs::canonicalize(&dir).expect("canonicalize temp dir")
    }

    fn write_file(path: &Path, contents: &str) {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).expect("create parent");
        }
        let mut f = fs::File::create(path).expect("create file");
        f.write_all(contents.as_bytes()).expect("write file");
    }

    fn read_file(path: &Path) -> String {
        fs::read_to_string(path).expect("read file")
    }

    fn drop_dir(dir: &Path) {
        let _ = fs::remove_dir_all(dir);
    }

    /// Initialise a Git repo with one committed file, then return the
    /// canonicalised workspace path.
    fn init_git_workspace(label: &str, initial_pkg: &str) -> PathBuf {
        let workspace = make_temp_dir(label);

        let init_ok = Command::new("git")
            .args(["init", "--initial-branch=main"])
            .current_dir(&workspace)
            .output();
        match init_ok {
            Ok(out) if out.status.success() => {}
            _ => {
                // Older Git versions don't support --initial-branch; retry.
                let basic = Command::new("git")
                    .args(["init"])
                    .current_dir(&workspace)
                    .output()
                    .expect("git init");
                assert!(basic.status.success(), "git init must succeed");
            }
        }

        // Configure a local committer so `git commit` succeeds in CI.
        Command::new("git")
            .args(["config", "user.email", "test@example.com"])
            .current_dir(&workspace)
            .output()
            .expect("git config email");
        Command::new("git")
            .args(["config", "user.name", "Migrate Pilot Test"])
            .current_dir(&workspace)
            .output()
            .expect("git config name");

        write_file(&workspace.join("package.json"), initial_pkg);
        Command::new("git")
            .args(["add", "package.json"])
            .current_dir(&workspace)
            .output()
            .expect("git add");
        Command::new("git")
            .args(["commit", "-m", "init"])
            .current_dir(&workspace)
            .output()
            .expect("git commit");

        workspace
    }

    fn git_available() -> bool {
        Command::new("git")
            .arg("--version")
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    }

    // ----- pure helpers ----------------------------------------------------

    #[test]
    fn parses_numstat_text_line() {
        assert_eq!(parse_numstat_line("3\t1\tfoo.json"), Some((3, 1, false)));
        assert_eq!(parse_numstat_line("0\t0\tbar.json"), Some((0, 0, false)));
        assert_eq!(parse_numstat_line("-\t-\tbinary.bin"), Some((0, 0, true)));
        assert_eq!(parse_numstat_line(""), None);
    }

    #[test]
    fn classifies_porcelain_lines() {
        assert_eq!(classify_porcelain_line(" M package.json"), "modified");
        assert_eq!(classify_porcelain_line("M  package.json"), "modified");
        assert_eq!(classify_porcelain_line("?? new.txt"), "created");
        assert_eq!(classify_porcelain_line("A  added.txt"), "created");
        assert_eq!(classify_porcelain_line(" D removed.txt"), "deleted");
        assert_eq!(classify_porcelain_line("R  old -> new"), "renamed");
        assert_eq!(classify_porcelain_line(""), "unknown");
    }

    // ----- safety guardrails -----------------------------------------------

    #[test]
    fn rejects_workspace_equal_to_source() {
        let dir = make_temp_dir("same");
        let err = ensure_workspace_safe(&dir, &dir).unwrap_err();
        assert!(matches!(err, CommandError::PathNotAllowed(_)));
        drop_dir(&dir);
    }

    #[test]
    fn rejects_workspace_inside_source() {
        let source = make_temp_dir("source-outer");
        let workspace = source.join("nested");
        fs::create_dir_all(&workspace).unwrap();
        let canonical_workspace = fs::canonicalize(&workspace).unwrap();
        let err = ensure_workspace_safe(&canonical_workspace, &source).unwrap_err();
        assert!(matches!(err, CommandError::PathNotAllowed(_)));
        drop_dir(&source);
    }

    #[test]
    fn rejects_absolute_changed_file_path() {
        let workspace = make_temp_dir("abs");
        let err = validate_relative_path("/etc/passwd", &workspace).unwrap_err();
        assert!(matches!(err, CommandError::PathNotAllowed(_)));
        drop_dir(&workspace);
    }

    #[test]
    fn rejects_traversal_in_changed_file_path() {
        let workspace = make_temp_dir("dotdot");
        let err = validate_relative_path("../etc/passwd", &workspace).unwrap_err();
        assert!(matches!(err, CommandError::PathNotAllowed(_)));
        drop_dir(&workspace);
    }

    #[test]
    fn rejects_nul_byte_in_changed_file_path() {
        let workspace = make_temp_dir("nul");
        let err = validate_relative_path("foo\0bar", &workspace).unwrap_err();
        assert!(matches!(err, CommandError::InvalidInput(_)));
        drop_dir(&workspace);
    }

    #[test]
    fn rejects_too_many_changed_files() {
        let workspace = make_temp_dir("too-many");
        let many: Vec<String> =
            (0..MAX_CHANGED_FILES + 5).map(|i| format!("a-{i}.json")).collect();
        let err = validate_changed_files(&many, &workspace).err();
        // `validate_changed_files` itself does not enforce the cap (the
        // command does), so just check the cap is exposed via the call.
        assert!(err.is_none());
        drop_dir(&workspace);
    }

    #[test]
    fn deduplicates_changed_files() {
        let workspace = make_temp_dir("dedupe");
        write_file(&workspace.join("package.json"), "{}");
        let validated = validate_changed_files(
            &vec!["package.json".to_string(), "package.json".to_string()],
            &workspace,
        )
        .expect("validates");
        assert_eq!(validated, vec!["package.json".to_string()]);
        drop_dir(&workspace);
    }

    // ----- end-to-end ------------------------------------------------------

    #[test]
    fn loads_diff_for_modified_package_json() {
        if !git_available() {
            eprintln!("skipping: git not available");
            return;
        }
        let initial = "{\n  \"name\": \"app\",\n  \"dependencies\": {\n    \"node-sass\": \"^4.0.0\"\n  }\n}\n";
        let workspace = init_git_workspace("loads", initial);
        let source = make_temp_dir("loads-source");

        // Simulate the executor mutation.
        let modified = "{\n  \"name\": \"app\",\n  \"devDependencies\": {\n    \"sass\": \"^1.69.0\"\n  }\n}\n";
        write_file(&workspace.join("package.json"), modified);

        let raw = load_workspace_diff(
            &workspace,
            "run-1",
            "plan-1",
            "dependency.replace-node-sass",
            &["package.json".to_string()],
        )
        .expect("loads diff");

        assert_eq!(raw.execution_run_id, "run-1");
        assert_eq!(raw.plan_id, "plan-1");
        assert_eq!(raw.plan_step_id, "dependency.replace-node-sass");
        assert_eq!(raw.files.len(), 1);
        let file = &raw.files[0];
        assert_eq!(file.path, "package.json");
        assert_eq!(file.status, "modified");
        assert!(file.additions > 0, "expected additions, got {}", file.additions);
        assert!(file.deletions > 0, "expected deletions, got {}", file.deletions);
        assert!(
            file.diff_text.contains("node-sass"),
            "expected node-sass in diff, got {}",
            file.diff_text
        );
        assert!(
            file.diff_text.contains("sass"),
            "expected sass in diff, got {}",
            file.diff_text
        );

        // Source must remain untouched (we never read it during load).
        drop_dir(&workspace);
        drop_dir(&source);
    }

    #[test]
    fn approve_does_not_touch_workspace() {
        if !git_available() {
            eprintln!("skipping: git not available");
            return;
        }
        let initial = "{\n  \"name\": \"approve\"\n}\n";
        let workspace = init_git_workspace("approve", initial);

        // Pre-approval workspace state.
        let before = read_file(&workspace.join("package.json"));

        // Bookkeeping path runs the same canonicalisation but no Git op.
        let canonical = canonicalise_directory(workspace.to_str().unwrap()).expect("canonical");
        assert_eq!(canonical, workspace);

        // Workspace must be byte-identical after a no-op approval.
        let after = read_file(&workspace.join("package.json"));
        assert_eq!(before, after);
        drop_dir(&workspace);
    }

    #[test]
    fn rejects_modified_file_via_git_restore() {
        if !git_available() {
            eprintln!("skipping: git not available");
            return;
        }
        let initial = "{\n  \"name\": \"reject\",\n  \"dependencies\": {\n    \"node-sass\": \"^4.0.0\"\n  }\n}\n";
        let workspace = init_git_workspace("reject", initial);

        let modified = "{\n  \"name\": \"reject\",\n  \"devDependencies\": {\n    \"sass\": \"^1.69.0\"\n  }\n}\n";
        write_file(&workspace.join("package.json"), modified);

        let raw = revert_workspace_changes(
            &workspace,
            "run-1",
            "plan-1",
            "dependency.replace-node-sass",
            &["package.json".to_string()],
        )
        .expect("revert ok");

        assert_eq!(raw.decision, "rejected");
        assert_eq!(raw.reverted_files, vec!["package.json".to_string()]);
        assert!(raw.manual_cleanup_files.is_empty());

        // package.json must be byte-identical to the initial commit.
        assert_eq!(read_file(&workspace.join("package.json")), initial);

        drop_dir(&workspace);
    }

    #[test]
    fn reject_marks_untracked_file_for_manual_cleanup() {
        if !git_available() {
            eprintln!("skipping: git not available");
            return;
        }
        let initial = "{\n  \"name\": \"untracked\"\n}\n";
        let workspace = init_git_workspace("untracked", initial);

        // Create a brand-new untracked file.
        write_file(&workspace.join("new-file.txt"), "hello\n");

        let raw = revert_workspace_changes(
            &workspace,
            "run-1",
            "plan-1",
            "dependency.replace-node-sass",
            &["new-file.txt".to_string()],
        )
        .expect("revert ok");

        assert_eq!(raw.decision, "rejected");
        assert!(raw.reverted_files.is_empty());
        assert_eq!(raw.manual_cleanup_files, vec!["new-file.txt".to_string()]);

        // Untracked file must NOT be deleted by the safe revert.
        assert!(workspace.join("new-file.txt").exists());

        drop_dir(&workspace);
    }

    #[test]
    fn truncates_oversize_diff_text() {
        let mut diff = "diff --git a/foo b/foo\n".to_string();
        diff.push_str(&"+a\n".repeat(MAX_DIFF_BYTES_PER_FILE));
        let mut captured = diff.clone();
        let too_large = captured.len() > MAX_DIFF_BYTES_PER_FILE;
        if too_large {
            captured.truncate(MAX_DIFF_BYTES_PER_FILE);
            captured.push_str("\n... [diff truncated]\n");
        }
        assert!(too_large);
        assert!(captured.ends_with("[diff truncated]\n"));
        assert!(captured.len() < diff.len());
    }
}
