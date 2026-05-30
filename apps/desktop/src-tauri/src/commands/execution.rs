//! Migration execution commands (Milestone 6).
//!
//! Two narrow, safe commands are exposed:
//!
//! * [`execution_check_capability`] — read-only inspection that decides
//!   whether a given migration plan step can be executed by the scripted
//!   executor inside the user-confirmed workspace. It NEVER mutates the
//!   workspace and NEVER touches the source project.
//!
//! * [`execution_run_step`] — runs the scripted executor for a supported
//!   plan step. In Milestone 6 the only supported executor is the
//!   `node-sass → sass` swap, performed exclusively against
//!   `workspace/package.json`.
//!
//! Safety guarantees enforced server-side
//! --------------------------------------
//! * The `workspace_path` is canonicalised and must be an existing directory.
//! * The `source_path` is canonicalised and must be an existing directory.
//! * The two paths must not be equal and must not be nested either way.
//! * Any file written must live under the canonical workspace root. The
//!   workspace `package.json` is the only file Milestone 6 ever writes.
//! * `package.json` size is capped at 1 MB. Invalid JSON is rejected with a
//!   clear error.
//! * No shell command is ever spawned. No package manager is ever invoked.
//!   No lock file is touched. No commit is created. No AI provider is
//!   contacted.
//!
//! Logging
//! -------
//! Every successful run emits a structured log trail (see
//! [`ExecutionLogEntryRaw`]) so the UI can render an audit-quality timeline
//! without re-deriving anything client-side.

use std::fs;
use std::path::{Path, PathBuf};

use serde::Serialize;
use serde_json::Value;

use super::{CommandError, CommandResult};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/// Hard cap on `package.json` size. A 1 MB ceiling is generous for a real-
/// world manifest and protects the executor from a pathological file.
const MAX_PACKAGE_JSON_BYTES: u64 = 1_048_576;

/// Plan step id emitted by the JS migration plan generator for the
/// node-sass replacement step. Kept in sync with `STEP_IDS.nodeSass` in
/// `migrationPlanGenerator.ts` — the executor refuses any other step id.
const NODE_SASS_PLAN_STEP_ID: &str = "dependency.replace-node-sass";

/// Suggested `sass` semver constraint used when adding the dependency.
/// Mirrors the value documented in the milestone spec.
const SUGGESTED_SASS_VERSION: &str = "^1.69.0";

/// Sections of `package.json` we inspect / mutate.
const DEP_SECTIONS: &[&str] = &[
    "dependencies",
    "devDependencies",
    "optionalDependencies",
];

// ---------------------------------------------------------------------------
// Wire types
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ExecutionCapabilityRaw {
    pub plan_step_id: String,
    pub executable: bool,
    /// Always `"scripted"` when `executable` is `true`. `None` otherwise.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub executor_type: Option<String>,
    pub reason: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ExecutionLogEntryRaw {
    pub timestamp: String,
    /// `"info" | "warning" | "error" | "success"`.
    pub level: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ExecutionChangedFileRaw {
    pub path: String,
    /// `"modified" | "created" | "deleted"`.
    pub change_type: String,
    pub summary: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ExecutionErrorRaw {
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecutionStepRunRaw {
    pub id: String,
    pub plan_id: String,
    pub plan_step_id: String,
    pub step_title: String,
    pub workspace_path: String,
    /// `"running" | "completed" | "failed"`. Milestone 6 returns either
    /// `"completed"` (success) or surfaces failure as a typed
    /// [`CommandError`] — the `"running"` variant is reserved for future
    /// streamed runs.
    pub status: String,
    pub started_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub completed_at: Option<String>,
    /// Always `"scripted"` in Milestone 6.
    pub executor: String,
    pub changed_files: Vec<ExecutionChangedFileRaw>,
    pub logs: Vec<ExecutionLogEntryRaw>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<ExecutionErrorRaw>,
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/// Read-only capability probe for a plan step.
///
/// Returns a structured answer so the UI can render the reason verbatim
/// instead of branching on string contents. Workspace safety is verified
/// even though no mutation happens — the same checks the executor runs
/// before any write.
#[tauri::command(rename_all = "camelCase")]
pub async fn execution_check_capability(
    workspace_path: String,
    source_path: String,
    plan_step_id: String,
    step_title: String,
) -> CommandResult<ExecutionCapabilityRaw> {
    let plan_step_id = plan_step_id.trim().to_string();
    let _ = step_title; // Kept on the wire for parity with run_step + future executors.
    if plan_step_id.is_empty() {
        return Err(CommandError::InvalidInput("plan step id is empty".into()));
    }

    if plan_step_id != NODE_SASS_PLAN_STEP_ID {
        return Ok(ExecutionCapabilityRaw {
            plan_step_id,
            executable: false,
            executor_type: None,
            reason: "Executor not available for this step yet".into(),
        });
    }

    let workspace = match canonicalise_directory(&workspace_path) {
        Ok(p) => p,
        Err(e) => {
            return Ok(ExecutionCapabilityRaw {
                plan_step_id,
                executable: false,
                executor_type: None,
                reason: format!("Workspace path is not accessible: {}", e),
            });
        }
    };
    let source = match canonicalise_directory(&source_path) {
        Ok(p) => p,
        Err(e) => {
            return Ok(ExecutionCapabilityRaw {
                plan_step_id,
                executable: false,
                executor_type: None,
                reason: format!("Source path is not accessible: {}", e),
            });
        }
    };

    if let Err(e) = ensure_workspace_safe(&workspace, &source) {
        return Ok(ExecutionCapabilityRaw {
            plan_step_id,
            executable: false,
            executor_type: None,
            reason: e.to_string(),
        });
    }

    let package_json_path = workspace.join("package.json");
    let text = match read_capped_text(&package_json_path) {
        Ok(Some(t)) => t,
        Ok(None) => {
            return Ok(ExecutionCapabilityRaw {
                plan_step_id,
                executable: false,
                executor_type: None,
                reason: "workspace/package.json was not found.".into(),
            });
        }
        Err(e) => {
            return Ok(ExecutionCapabilityRaw {
                plan_step_id,
                executable: false,
                executor_type: None,
                reason: e.to_string(),
            });
        }
    };

    let parsed: Value = match serde_json::from_str(&text) {
        Ok(v) => v,
        Err(_) => {
            return Ok(ExecutionCapabilityRaw {
                plan_step_id,
                executable: false,
                executor_type: None,
                reason: "workspace/package.json is not valid JSON.".into(),
            });
        }
    };

    if !package_json_has_node_sass(&parsed) {
        return Ok(ExecutionCapabilityRaw {
            plan_step_id,
            executable: false,
            executor_type: None,
            reason:
                "node-sass was not found in workspace package.json, so this step could not run."
                    .into(),
        });
    }

    Ok(ExecutionCapabilityRaw {
        plan_step_id,
        executable: true,
        executor_type: Some("scripted".into()),
        reason:
            "node-sass was detected in workspace package.json. The scripted executor will replace it with sass."
                .into(),
    })
}

/// Run the scripted executor for a single plan step.
///
/// In Milestone 6 only the node-sass replacement step is supported. Any
/// other plan step id is rejected with a typed [`CommandError::NotImplemented`].
/// The executor performs the mutation off the async runtime so a slow disk
/// cannot freeze the UI thread.
#[tauri::command(rename_all = "camelCase")]
pub async fn execution_run_step(
    workspace_path: String,
    source_path: String,
    plan_id: String,
    plan_step_id: String,
    step_title: String,
) -> CommandResult<ExecutionStepRunRaw> {
    let plan_step_id = plan_step_id.trim().to_string();
    let plan_id = plan_id.trim().to_string();
    let step_title = step_title.trim().to_string();

    if plan_id.is_empty() {
        return Err(CommandError::InvalidInput("plan id is empty".into()));
    }
    if plan_step_id.is_empty() {
        return Err(CommandError::InvalidInput("plan step id is empty".into()));
    }
    if plan_step_id != NODE_SASS_PLAN_STEP_ID {
        return Err(CommandError::NotImplemented(
            "Executor not available for this step yet".into(),
        ));
    }

    let workspace_input = workspace_path;
    let source_input = source_path;
    let plan_id_task = plan_id;
    let plan_step_id_task = plan_step_id;
    let step_title_task = step_title;

    let raw = tokio::task::spawn_blocking(move || {
        run_node_sass_replacement(
            &workspace_input,
            &source_input,
            &plan_id_task,
            &plan_step_id_task,
            &step_title_task,
        )
    })
    .await
    .map_err(|e| CommandError::Internal(format!("execution task failed: {e}")))??;

    Ok(raw)
}

// ---------------------------------------------------------------------------
// Scripted executor: node-sass → sass
// ---------------------------------------------------------------------------

fn run_node_sass_replacement(
    workspace_input: &str,
    source_input: &str,
    plan_id: &str,
    plan_step_id: &str,
    step_title: &str,
) -> CommandResult<ExecutionStepRunRaw> {
    let started_at = current_iso_timestamp();
    let mut logs: Vec<ExecutionLogEntryRaw> = Vec::new();

    push_log(&mut logs, "info", "Started execution", None);

    let workspace = canonicalise_directory(workspace_input)?;
    let source = canonicalise_directory(source_input)?;
    ensure_workspace_safe(&workspace, &source)?;
    push_log(
        &mut logs,
        "success",
        "Verified workspace safety",
        Some(&format!(
            "workspace = {}\nsource = {}",
            workspace.display(),
            source.display()
        )),
    );

    let package_json_path = workspace.join("package.json");
    if !path_lives_inside(&package_json_path, &workspace) {
        return Err(CommandError::PathNotAllowed(
            "package.json is not inside the workspace path".into(),
        ));
    }

    let text = match read_capped_text(&package_json_path)? {
        Some(t) => t,
        None => {
            return Err(CommandError::InvalidInput(
                "workspace/package.json was not found.".into(),
            ));
        }
    };
    push_log(
        &mut logs,
        "info",
        "Read package.json",
        Some(&format!(
            "Read {} bytes from {}",
            text.len(),
            package_json_path.display()
        )),
    );

    let mut parsed: Value = serde_json::from_str(&text)
        .map_err(|e| CommandError::InvalidInput(format!("invalid package.json: {e}")))?;

    let removed_from = remove_node_sass(&mut parsed);
    if removed_from.is_empty() {
        return Err(CommandError::InvalidInput(
            "node-sass was not found in workspace package.json, so this step could not run."
                .into(),
        ));
    }
    push_log(
        &mut logs,
        "info",
        "Detected node-sass",
        Some(&format!(
            "node-sass present in: {}",
            removed_from.join(", ")
        )),
    );
    push_log(
        &mut logs,
        "success",
        "Removed node-sass",
        Some(&format!("Removed from: {}", removed_from.join(", "))),
    );

    let added_sass = ensure_sass_in_dev_dependencies(&mut parsed);
    if added_sass {
        push_log(
            &mut logs,
            "success",
            "Added sass",
            Some(&format!(
                "Added sass {SUGGESTED_SASS_VERSION} to devDependencies"
            )),
        );
    } else {
        push_log(
            &mut logs,
            "info",
            "sass already present",
            Some("sass is already declared in package.json. No change applied."),
        );
    }

    // Pretty-print with 2-space indent. The `preserve_order` feature on
    // serde_json keeps insertion order, so unrelated fields are written
    // back in the same order they were read.
    let mut serialized = serde_json::to_string_pretty(&parsed).map_err(|e| {
        CommandError::Internal(format!("failed to serialise package.json: {e}"))
    })?;
    if text.ends_with('\n') && !serialized.ends_with('\n') {
        serialized.push('\n');
    }

    fs::write(&package_json_path, serialized.as_bytes())
        .map_err(|e| CommandError::Internal(format!("failed to write package.json: {e}")))?;

    push_log(
        &mut logs,
        "success",
        "Wrote package.json",
        Some(&format!(
            "Wrote {} bytes to {}",
            serialized.len(),
            package_json_path.display()
        )),
    );

    let changed_files = vec![ExecutionChangedFileRaw {
        path: "package.json".into(),
        change_type: "modified".into(),
        summary: build_change_summary(&removed_from, added_sass),
    }];

    push_log(&mut logs, "success", "Completed execution", None);
    let completed_at = current_iso_timestamp();

    Ok(ExecutionStepRunRaw {
        id: format!(
            "run:{plan_step_id}:{ts}",
            plan_step_id = plan_step_id,
            ts = current_timestamp_label()
        ),
        plan_id: plan_id.to_string(),
        plan_step_id: plan_step_id.to_string(),
        step_title: step_title.to_string(),
        workspace_path: workspace.to_string_lossy().to_string(),
        status: "completed".to_string(),
        started_at,
        completed_at: Some(completed_at),
        executor: "scripted".to_string(),
        changed_files,
        logs,
        error: None,
    })
}

// ---------------------------------------------------------------------------
// package.json helpers
// ---------------------------------------------------------------------------

fn package_json_has_node_sass(value: &Value) -> bool {
    let Some(map) = value.as_object() else {
        return false;
    };
    for section in DEP_SECTIONS {
        if let Some(Value::Object(deps)) = map.get(*section) {
            if deps.contains_key("node-sass") {
                return true;
            }
        }
    }
    false
}

/// Remove `node-sass` from every dependency section it appears in.
/// Returns the list of section names it was removed from (in canonical
/// order). Sections that became empty are kept as `{}` so we never alter
/// the schema beyond the explicit removal.
fn remove_node_sass(value: &mut Value) -> Vec<String> {
    let mut removed: Vec<String> = Vec::new();
    let Some(map) = value.as_object_mut() else {
        return removed;
    };
    for section in DEP_SECTIONS {
        if let Some(Value::Object(deps)) = map.get_mut(*section) {
            if deps.remove("node-sass").is_some() {
                removed.push((*section).to_string());
            }
        }
    }
    removed
}

/// Add `sass` to `devDependencies` unless it is already declared in any of
/// the dependency sections. Returns `true` if a write occurred.
fn ensure_sass_in_dev_dependencies(value: &mut Value) -> bool {
    let Some(map) = value.as_object_mut() else {
        return false;
    };
    for section in DEP_SECTIONS {
        if let Some(Value::Object(deps)) = map.get(*section) {
            if deps.contains_key("sass") {
                return false;
            }
        }
    }
    let entry = map
        .entry("devDependencies".to_string())
        .or_insert_with(|| Value::Object(serde_json::Map::new()));
    if let Value::Object(deps) = entry {
        deps.insert(
            "sass".to_string(),
            Value::String(SUGGESTED_SASS_VERSION.to_string()),
        );
        true
    } else {
        false
    }
}

fn build_change_summary(removed_from: &[String], added_sass: bool) -> String {
    let removed_label = if removed_from.is_empty() {
        "package.json".to_string()
    } else {
        removed_from.join(", ")
    };
    if added_sass {
        format!(
            "Removed node-sass from {removed_label} and added sass {SUGGESTED_SASS_VERSION} to devDependencies."
        )
    } else {
        format!("Removed node-sass from {removed_label}. sass was already declared.")
    }
}

// ---------------------------------------------------------------------------
// Path / safety helpers
// ---------------------------------------------------------------------------

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

/// Returns true when `candidate` resolves to the same canonical directory
/// as `root` or a descendant of it. The candidate's parent must already
/// exist so we can canonicalise it (the leaf may be a file).
fn path_lives_inside(candidate: &Path, root: &Path) -> bool {
    let parent = match candidate.parent() {
        Some(p) => p,
        None => return false,
    };
    let canonical_parent = match fs::canonicalize(parent) {
        Ok(p) => p,
        Err(_) => return false,
    };
    canonical_parent.starts_with(root)
}

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

fn read_capped_text(path: &Path) -> CommandResult<Option<String>> {
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

// ---------------------------------------------------------------------------
// Logging + timestamp helpers
// ---------------------------------------------------------------------------

fn push_log(
    logs: &mut Vec<ExecutionLogEntryRaw>,
    level: &str,
    message: &str,
    detail: Option<&str>,
) {
    logs.push(ExecutionLogEntryRaw {
        timestamp: current_iso_timestamp(),
        level: level.to_string(),
        message: message.to_string(),
        detail: detail.map(|s| s.to_string()),
    });
}

fn current_iso_timestamp() -> String {
    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);
    format_unix_seconds_utc(secs)
}

fn current_timestamp_label() -> String {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs().to_string())
        .unwrap_or_else(|_| "0".into())
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

/// Howard Hinnant's algorithm for civil-from-days. Identical to the helper
/// in `commands::workspace`; kept duplicated to avoid forming a
/// `commands::date` shared module just for this milestone.
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
    use serde_json::json;
    use std::io::Write;
    use std::sync::atomic::{AtomicU64, Ordering};

    /// Make a fresh, isolated temporary directory under the system temp
    /// root. Avoids pulling in a `tempfile` dependency just for the tests.
    fn make_temp_dir(label: &str) -> PathBuf {
        static COUNTER: AtomicU64 = AtomicU64::new(0);
        let n = COUNTER.fetch_add(1, Ordering::SeqCst);
        let pid = std::process::id();
        let dir = std::env::temp_dir().join(format!(
            "migrate-pilot-execution-{label}-{pid}-{n}-{ts}",
            ts = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_nanos())
                .unwrap_or(0)
        ));
        fs::create_dir_all(&dir).expect("create temp dir");
        fs::canonicalize(&dir).expect("canonicalize temp dir")
    }

    fn write_file(path: &Path, contents: &str) {
        let mut f = fs::File::create(path).expect("create file");
        f.write_all(contents.as_bytes()).expect("write file");
    }

    fn read_file(path: &Path) -> String {
        fs::read_to_string(path).expect("read file")
    }

    fn drop_dir(dir: &Path) {
        let _ = fs::remove_dir_all(dir);
    }

    // ----- pure helpers ----------------------------------------------------

    #[test]
    fn detects_node_sass_in_each_section() {
        for section in ["dependencies", "devDependencies", "optionalDependencies"] {
            let v = json!({ section: { "node-sass": "^4.0.0" } });
            assert!(package_json_has_node_sass(&v), "section: {section}");
        }
    }

    #[test]
    fn ignores_node_sass_in_unrelated_sections() {
        let v = json!({
            "peerDependencies": { "node-sass": "^4.0.0" },
            "name": "x",
        });
        assert!(!package_json_has_node_sass(&v));
    }

    #[test]
    fn removes_node_sass_from_all_sections_present() {
        let mut v = json!({
            "dependencies": { "node-sass": "^4.0.0", "react": "18.0.0" },
            "devDependencies": { "node-sass": "^4.0.0" },
            "optionalDependencies": { "other": "1.0.0" },
        });
        let removed = remove_node_sass(&mut v);
        assert_eq!(removed, vec!["dependencies".to_string(), "devDependencies".to_string()]);
        let deps = v.get("dependencies").and_then(|d| d.as_object()).unwrap();
        assert!(!deps.contains_key("node-sass"));
        assert!(deps.contains_key("react"));
        let dev = v.get("devDependencies").and_then(|d| d.as_object()).unwrap();
        assert!(dev.is_empty());
    }

    #[test]
    fn ensure_sass_skips_when_already_declared() {
        let mut v = json!({ "dependencies": { "sass": "^1.50.0" } });
        let added = ensure_sass_in_dev_dependencies(&mut v);
        assert!(!added);
        let deps = v.get("dependencies").and_then(|d| d.as_object()).unwrap();
        assert_eq!(deps.get("sass").unwrap().as_str(), Some("^1.50.0"));
    }

    #[test]
    fn ensure_sass_creates_dev_dependencies_when_missing() {
        let mut v = json!({ "name": "x" });
        let added = ensure_sass_in_dev_dependencies(&mut v);
        assert!(added);
        let dev = v.get("devDependencies").and_then(|d| d.as_object()).unwrap();
        assert_eq!(dev.get("sass").unwrap().as_str(), Some(SUGGESTED_SASS_VERSION));
    }

    // ----- safety guardrails -----------------------------------------------

    #[test]
    fn rejects_workspace_equal_to_source() {
        let dir = make_temp_dir("equal");
        let err = ensure_workspace_safe(&dir, &dir).unwrap_err();
        match err {
            CommandError::PathNotAllowed(_) => (),
            other => panic!("unexpected error: {other:?}"),
        }
        drop_dir(&dir);
    }

    #[test]
    fn rejects_workspace_inside_source() {
        let source = make_temp_dir("source-outer");
        let workspace = source.join("nested");
        fs::create_dir_all(&workspace).unwrap();
        let canonical_workspace = fs::canonicalize(&workspace).unwrap();
        let err = ensure_workspace_safe(&canonical_workspace, &source).unwrap_err();
        match err {
            CommandError::PathNotAllowed(_) => (),
            other => panic!("unexpected error: {other:?}"),
        }
        drop_dir(&source);
    }

    #[test]
    fn allows_disjoint_workspace_and_source() {
        let source = make_temp_dir("safe-source");
        let workspace = make_temp_dir("safe-workspace");
        ensure_workspace_safe(&workspace, &source).expect("disjoint paths");
        drop_dir(&source);
        drop_dir(&workspace);
    }

    // ----- end-to-end node-sass replacement -------------------------------

    #[test]
    fn replaces_node_sass_writes_only_workspace_package_json() {
        let source = make_temp_dir("e2e-source");
        let workspace = make_temp_dir("e2e-workspace");
        // Source must have its own untouched package.json.
        let source_pkg = source.join("package.json");
        let source_pkg_text = "{\n  \"name\": \"original\",\n  \"dependencies\": {\n    \"node-sass\": \"^4.0.0\"\n  }\n}\n";
        write_file(&source_pkg, source_pkg_text);

        // Workspace package.json contains node-sass.
        let workspace_pkg = workspace.join("package.json");
        let workspace_pkg_text = "{\n  \"name\": \"my-app\",\n  \"version\": \"1.2.3\",\n  \"scripts\": {\n    \"build\": \"react-scripts build\"\n  },\n  \"dependencies\": {\n    \"react\": \"^18.0.0\",\n    \"node-sass\": \"^4.0.0\"\n  },\n  \"devDependencies\": {\n    \"node-sass\": \"^4.0.0\"\n  }\n}\n";
        write_file(&workspace_pkg, workspace_pkg_text);

        let raw = run_node_sass_replacement(
            workspace.to_str().unwrap(),
            source.to_str().unwrap(),
            "plan-1",
            NODE_SASS_PLAN_STEP_ID,
            "Replace node-sass with sass",
        )
        .expect("execution succeeded");

        assert_eq!(raw.status, "completed");
        assert_eq!(raw.executor, "scripted");
        assert_eq!(raw.plan_step_id, NODE_SASS_PLAN_STEP_ID);
        assert_eq!(raw.changed_files.len(), 1);
        assert_eq!(raw.changed_files[0].path, "package.json");
        assert_eq!(raw.changed_files[0].change_type, "modified");

        // Source package.json must be untouched.
        assert_eq!(read_file(&source_pkg), source_pkg_text);

        // Workspace package.json must reflect the swap.
        let updated = read_file(&workspace_pkg);
        let parsed: Value = serde_json::from_str(&updated).expect("valid json");
        let dependencies = parsed.get("dependencies").and_then(|v| v.as_object()).unwrap();
        assert!(!dependencies.contains_key("node-sass"));
        assert!(dependencies.contains_key("react"));
        let dev = parsed
            .get("devDependencies")
            .and_then(|v| v.as_object())
            .unwrap();
        assert!(!dev.contains_key("node-sass"));
        assert_eq!(dev.get("sass").unwrap().as_str(), Some(SUGGESTED_SASS_VERSION));
        assert_eq!(parsed.get("name").unwrap().as_str(), Some("my-app"));
        assert_eq!(parsed.get("version").unwrap().as_str(), Some("1.2.3"));
        assert!(parsed.get("scripts").is_some(), "scripts preserved");

        // Trailing newline preserved.
        assert!(updated.ends_with('\n'));

        // Logs are present and ordered correctly.
        let messages: Vec<&str> = raw.logs.iter().map(|l| l.message.as_str()).collect();
        assert!(messages.iter().any(|m| *m == "Started execution"));
        assert!(messages.iter().any(|m| *m == "Verified workspace safety"));
        assert!(messages.iter().any(|m| *m == "Read package.json"));
        assert!(messages.iter().any(|m| *m == "Detected node-sass"));
        assert!(messages.iter().any(|m| *m == "Removed node-sass"));
        assert!(messages.iter().any(|m| *m == "Added sass"));
        assert!(messages.iter().any(|m| *m == "Wrote package.json"));
        assert!(messages.iter().any(|m| *m == "Completed execution"));

        drop_dir(&source);
        drop_dir(&workspace);
    }

    #[test]
    fn fails_safely_when_node_sass_is_absent() {
        let source = make_temp_dir("absent-source");
        let workspace = make_temp_dir("absent-workspace");
        let workspace_pkg = workspace.join("package.json");
        let original = "{\n  \"name\": \"clean-app\",\n  \"dependencies\": { \"react\": \"^18.0.0\" }\n}\n";
        write_file(&workspace_pkg, original);

        let err = run_node_sass_replacement(
            workspace.to_str().unwrap(),
            source.to_str().unwrap(),
            "plan-1",
            NODE_SASS_PLAN_STEP_ID,
            "Replace node-sass with sass",
        )
        .unwrap_err();

        match err {
            CommandError::InvalidInput(msg) => {
                assert!(msg.contains("node-sass was not found"), "got: {msg}");
            }
            other => panic!("unexpected error: {other:?}"),
        }

        // package.json must remain byte-identical.
        assert_eq!(read_file(&workspace_pkg), original);

        drop_dir(&source);
        drop_dir(&workspace);
    }

    #[test]
    fn rejects_invalid_json_safely() {
        let source = make_temp_dir("badjson-source");
        let workspace = make_temp_dir("badjson-workspace");
        let workspace_pkg = workspace.join("package.json");
        let original = "{ this is not json";
        write_file(&workspace_pkg, original);

        let err = run_node_sass_replacement(
            workspace.to_str().unwrap(),
            source.to_str().unwrap(),
            "plan-1",
            NODE_SASS_PLAN_STEP_ID,
            "Replace node-sass with sass",
        )
        .unwrap_err();

        match err {
            CommandError::InvalidInput(msg) => {
                assert!(
                    msg.contains("invalid package.json"),
                    "expected invalid package.json error, got: {msg}"
                );
            }
            other => panic!("unexpected error: {other:?}"),
        }

        // No write should have happened.
        assert_eq!(read_file(&workspace_pkg), original);

        drop_dir(&source);
        drop_dir(&workspace);
    }

    #[test]
    fn rejects_when_workspace_equals_source() {
        let same = make_temp_dir("same");
        let workspace_pkg = same.join("package.json");
        write_file(
            &workspace_pkg,
            "{\n  \"dependencies\": { \"node-sass\": \"^4.0.0\" }\n}\n",
        );

        let err = run_node_sass_replacement(
            same.to_str().unwrap(),
            same.to_str().unwrap(),
            "plan-1",
            NODE_SASS_PLAN_STEP_ID,
            "Replace node-sass with sass",
        )
        .unwrap_err();

        match err {
            CommandError::PathNotAllowed(_) => (),
            other => panic!("unexpected error: {other:?}"),
        }

        drop_dir(&same);
    }

    // ----- preserves unrelated fields -------------------------------------

    #[test]
    fn preserves_unrelated_fields_and_field_order() {
        let source = make_temp_dir("preserve-source");
        let workspace = make_temp_dir("preserve-workspace");
        let workspace_pkg = workspace.join("package.json");
        let original = "{\n  \"name\": \"x\",\n  \"author\": \"someone\",\n  \"scripts\": {\n    \"build\": \"vite build\",\n    \"test\": \"vitest\"\n  },\n  \"dependencies\": {\n    \"node-sass\": \"^4.0.0\"\n  }\n}\n";
        write_file(&workspace_pkg, original);

        run_node_sass_replacement(
            workspace.to_str().unwrap(),
            source.to_str().unwrap(),
            "plan-1",
            NODE_SASS_PLAN_STEP_ID,
            "Replace node-sass with sass",
        )
        .expect("execution succeeded");

        let updated = read_file(&workspace_pkg);
        // `name` should still appear before `author` (preserve_order feature).
        let name_idx = updated.find("\"name\"").unwrap();
        let author_idx = updated.find("\"author\"").unwrap();
        let scripts_idx = updated.find("\"scripts\"").unwrap();
        assert!(name_idx < author_idx);
        assert!(author_idx < scripts_idx);
        assert!(updated.contains("\"build\""));
        assert!(updated.contains("\"vitest\""));
        assert!(updated.contains("\"sass\""));

        drop_dir(&source);
        drop_dir(&workspace);
    }
}
