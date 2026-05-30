//! Migration execution commands (generic execution framework).
//!
//! Two narrow, safe commands are exposed:
//!
//! * [`execution_check_capability`] — read-only inspection that decides
//!   whether a given migration plan step can be executed by the
//!   registered safe executor declared in its `MigrationStepExecution`
//!   metadata. It NEVER mutates the workspace and NEVER touches the
//!   source project.
//!
//! * [`execution_run_step`] — runs the scripted executor declared by the
//!   plan step's `executorKey`. The execution layer NEVER inspects the
//!   plan step id to decide what to do — dispatch is purely on
//!   `executorKey`.
//!
//! Today only one executor ships end-to-end:
//!
//!   * `package-json-dependency-update` — generic add/remove of packages
//!     across the standard dependency sections of `workspace/package.json`.
//!     Used by the `dependency.replace-node-sass` plan step but reusable
//!     for any future package add/remove migration.
//!
//! Future executor keys (declared in the JS executor registry, NOT
//! implemented here yet):
//!
//!   * `tsconfig-update`
//!   * `file-create-or-update`
//!   * `codemod-react-class-to-function`
//!   * `react-router-modernization`
//!   * `ai-source-transform`
//!   * `manual-review`
//!
//! Safety guarantees enforced server-side
//! --------------------------------------
//! * The `workspace_path` is canonicalised and must be an existing directory.
//! * The `source_path` is canonicalised and must be an existing directory.
//! * The two paths must not be equal and must not be nested either way.
//! * Any file written must live under the canonical workspace root. Today
//!   the only writeable target is `workspace/package.json`.
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

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

use super::{CommandError, CommandResult};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/// Hard cap on `package.json` size.
const MAX_PACKAGE_JSON_BYTES: u64 = 1_048_576;

/// Sections of `package.json` we ever inspect / mutate. Anything outside
/// this list is preserved verbatim.
const DEP_SECTIONS: &[&str] = &[
    "dependencies",
    "devDependencies",
    "optionalDependencies",
];

/// Stable executor keys. Keep these in sync with the JS executor registry
/// in `apps/desktop/src/features/execution/services/executorRegistry.ts`.
const EXECUTOR_KEY_PACKAGE_JSON_DEPENDENCY_UPDATE: &str = "package-json-dependency-update";

/// Execution modes (mirrors `MigrationStepExecutionMode`).
const MODE_SCRIPTED: &str = "scripted";
const MODE_AI: &str = "ai";
const MODE_MANUAL: &str = "manual";
const MODE_VALIDATION: &str = "validation";

// ---------------------------------------------------------------------------
// Wire types
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ExecutionRequestRaw {
    /// `"scripted" | "ai" | "manual" | "validation"`.
    pub mode: String,
    #[serde(default)]
    pub executor_key: Option<String>,
    /// Free-form executor params; each executor validates its own schema.
    #[serde(default)]
    pub params: Option<Value>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ExecutionCapabilityRaw {
    pub plan_step_id: String,
    pub executable: bool,
    /// Coarse classification used by the UI.
    pub badge: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mode: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub executor_key: Option<String>,
    pub reason: String,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub missing_requirements: Vec<String>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ExecutionLogEntryRaw {
    pub timestamp: String,
    pub level: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ExecutionChangedFileRaw {
    pub path: String,
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
    pub status: String,
    pub started_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub completed_at: Option<String>,
    pub executor_key: String,
    pub mode: String,
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
/// The capability decision is purely a function of the `execution`
/// metadata declared on the step (mode + `executor_key` + params) plus
/// the workspace check appropriate for that executor. It NEVER inspects
/// `plan_step_id`.
#[tauri::command(rename_all = "camelCase")]
pub async fn execution_check_capability(
    workspace_path: String,
    source_path: String,
    plan_step_id: String,
    step_title: String,
    execution: ExecutionRequestRaw,
) -> CommandResult<ExecutionCapabilityRaw> {
    let plan_step_id = plan_step_id.trim().to_string();
    let _ = step_title;
    if plan_step_id.is_empty() {
        return Err(CommandError::InvalidInput("plan step id is empty".into()));
    }

    let mode = execution.mode.trim();
    let executor_key = execution
        .executor_key
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string());

    // Non-scripted modes can be answered without touching the workspace.
    match mode {
        MODE_MANUAL => {
            return Ok(ExecutionCapabilityRaw {
                plan_step_id,
                executable: false,
                badge: "manual".into(),
                mode: Some(MODE_MANUAL.into()),
                executor_key,
                reason: "This is a manual step. Migrate Pilot does not run anything for it; review and act on it yourself.".into(),
                missing_requirements: Vec::new(),
            });
        }
        MODE_VALIDATION => {
            return Ok(ExecutionCapabilityRaw {
                plan_step_id,
                executable: false,
                badge: "validation".into(),
                mode: Some(MODE_VALIDATION.into()),
                executor_key,
                reason: "This is a validation-only step. Validation execution is not implemented yet.".into(),
                missing_requirements: Vec::new(),
            });
        }
        MODE_AI => {
            return Ok(ExecutionCapabilityRaw {
                plan_step_id,
                executable: false,
                badge: "ai-not-available".into(),
                mode: Some(MODE_AI.into()),
                executor_key,
                reason: "AI executor not available yet.".into(),
                missing_requirements: Vec::new(),
            });
        }
        MODE_SCRIPTED => {}
        other => {
            return Ok(ExecutionCapabilityRaw {
                plan_step_id,
                executable: false,
                badge: "unsupported-executor".into(),
                mode: None,
                executor_key,
                reason: format!("Unknown execution mode \"{other}\"."),
                missing_requirements: Vec::new(),
            });
        }
    }

    // Scripted dispatch: only known executor keys are answerable.
    let key = match executor_key.as_deref() {
        Some(k) => k.to_string(),
        None => {
            return Ok(ExecutionCapabilityRaw {
                plan_step_id,
                executable: false,
                badge: "unsupported-executor".into(),
                mode: Some(MODE_SCRIPTED.into()),
                executor_key: None,
                reason: "This scripted step does not declare an executorKey.".into(),
                missing_requirements: Vec::new(),
            });
        }
    };

    if key.as_str() != EXECUTOR_KEY_PACKAGE_JSON_DEPENDENCY_UPDATE {
        return Ok(ExecutionCapabilityRaw {
            plan_step_id,
            executable: false,
            badge: "unsupported-executor".into(),
            mode: Some(MODE_SCRIPTED.into()),
            executor_key,
            reason: format!("Unsupported executor \"{key}\"."),
            missing_requirements: Vec::new(),
        });
    }

    // Workspace safety + executor-specific preflight.
    let workspace = match canonicalise_directory(&workspace_path) {
        Ok(p) => p,
        Err(e) => {
            return Ok(unsupported_workspace(
                plan_step_id,
                executor_key,
                format!("Workspace path is not accessible: {e}"),
            ));
        }
    };
    let source = match canonicalise_directory(&source_path) {
        Ok(p) => p,
        Err(e) => {
            return Ok(unsupported_workspace(
                plan_step_id,
                executor_key,
                format!("Source path is not accessible: {e}"),
            ));
        }
    };
    if let Err(e) = ensure_workspace_safe(&workspace, &source) {
        return Ok(unsupported_workspace(
            plan_step_id,
            executor_key,
            e.to_string(),
        ));
    }

    let params = execution.params.clone().unwrap_or(Value::Null);
    capability_for_package_json_dependency_update(plan_step_id, executor_key, &workspace, &params)
}

/// Run the executor declared by the plan step's execution metadata.
#[tauri::command(rename_all = "camelCase")]
pub async fn execution_run_step(
    workspace_path: String,
    source_path: String,
    plan_id: String,
    plan_step_id: String,
    step_title: String,
    execution: ExecutionRequestRaw,
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

    let mode = execution.mode.trim().to_string();
    if mode != MODE_SCRIPTED {
        return Err(CommandError::NotImplemented(format!(
            "Execution mode \"{mode}\" is not implemented yet."
        )));
    }

    let executor_key = execution
        .executor_key
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
        .ok_or_else(|| {
            CommandError::InvalidInput(
                "scripted execution requires an executorKey".into(),
            )
        })?;

    if executor_key != EXECUTOR_KEY_PACKAGE_JSON_DEPENDENCY_UPDATE {
        return Err(CommandError::NotImplemented(format!(
            "Unsupported executor \"{executor_key}\"."
        )));
    }

    let workspace_input = workspace_path;
    let source_input = source_path;
    let plan_id_task = plan_id;
    let plan_step_id_task = plan_step_id;
    let step_title_task = step_title;
    let executor_key_task = executor_key;
    let params_task = execution.params.clone();

    let raw = tokio::task::spawn_blocking(move || {
        run_package_json_dependency_update(
            &workspace_input,
            &source_input,
            &plan_id_task,
            &plan_step_id_task,
            &step_title_task,
            &executor_key_task,
            params_task.unwrap_or(Value::Null),
        )
    })
    .await
    .map_err(|e| CommandError::Internal(format!("execution task failed: {e}")))??;

    Ok(raw)
}

fn unsupported_workspace(
    plan_step_id: String,
    executor_key: Option<String>,
    reason: String,
) -> ExecutionCapabilityRaw {
    ExecutionCapabilityRaw {
        plan_step_id,
        executable: false,
        badge: "unsupported-executor".into(),
        mode: Some(MODE_SCRIPTED.into()),
        executor_key,
        reason,
        missing_requirements: Vec::new(),
    }
}

// ---------------------------------------------------------------------------
// Executor: package-json-dependency-update
// ---------------------------------------------------------------------------

/// Strongly-typed view over the params accepted by the package.json
/// dependency executor. Anything outside this schema is ignored — the
/// executor is intentionally narrow.
#[derive(Debug, Default)]
struct PackageJsonDependencyUpdateParams {
    remove: Vec<RemoveSpec>,
    add: Vec<AddSpec>,
}

#[derive(Debug)]
struct RemoveSpec {
    name: String,
    /// Sections to scan. Defaults to all dep sections when empty.
    from: Vec<String>,
}

#[derive(Debug)]
struct AddSpec {
    name: String,
    version: Option<String>,
    /// Target section. Defaults to `devDependencies` when missing.
    to: String,
    /// When true, do not add if a matching package already exists in any
    /// of the dependency sections.
    only_if_missing: bool,
}

fn parse_package_json_dependency_update_params(
    raw: &Value,
) -> Result<PackageJsonDependencyUpdateParams, String> {
    let mut params = PackageJsonDependencyUpdateParams::default();
    if raw.is_null() {
        return Ok(params);
    }
    let obj = raw
        .as_object()
        .ok_or_else(|| "params must be an object".to_string())?;

    if let Some(remove) = obj.get("remove") {
        let arr = remove
            .as_array()
            .ok_or_else(|| "params.remove must be an array".to_string())?;
        for entry in arr {
            let entry = entry
                .as_object()
                .ok_or_else(|| "params.remove[] must be an object".to_string())?;
            let name = entry
                .get("name")
                .and_then(|v| v.as_str())
                .ok_or_else(|| "params.remove[].name is required".to_string())?;
            if name.trim().is_empty() {
                return Err("params.remove[].name must be non-empty".into());
            }
            let mut from: Vec<String> = Vec::new();
            if let Some(from_val) = entry.get("from") {
                let from_arr = from_val
                    .as_array()
                    .ok_or_else(|| "params.remove[].from must be an array".to_string())?;
                for section in from_arr {
                    let s = section.as_str().ok_or_else(|| {
                        "params.remove[].from[] must be a string".to_string()
                    })?;
                    if !DEP_SECTIONS.contains(&s) {
                        return Err(format!(
                            "params.remove[].from contains unsupported section \"{s}\""
                        ));
                    }
                    from.push(s.to_string());
                }
            }
            params.remove.push(RemoveSpec {
                name: name.to_string(),
                from,
            });
        }
    }

    if let Some(add) = obj.get("add") {
        let arr = add
            .as_array()
            .ok_or_else(|| "params.add must be an array".to_string())?;
        for entry in arr {
            let entry = entry
                .as_object()
                .ok_or_else(|| "params.add[] must be an object".to_string())?;
            let name = entry
                .get("name")
                .and_then(|v| v.as_str())
                .ok_or_else(|| "params.add[].name is required".to_string())?;
            if name.trim().is_empty() {
                return Err("params.add[].name must be non-empty".into());
            }
            let version = entry
                .get("version")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            let to = entry
                .get("to")
                .and_then(|v| v.as_str())
                .unwrap_or("devDependencies");
            if !DEP_SECTIONS.contains(&to) {
                return Err(format!(
                    "params.add[].to is an unsupported section \"{to}\""
                ));
            }
            let only_if_missing = entry
                .get("onlyIfMissing")
                .and_then(|v| v.as_bool())
                .unwrap_or(false);
            params.add.push(AddSpec {
                name: name.to_string(),
                version,
                to: to.to_string(),
                only_if_missing,
            });
        }
    }

    if params.remove.is_empty() && params.add.is_empty() {
        return Err("params must declare at least one add or remove".into());
    }

    Ok(params)
}

fn capability_for_package_json_dependency_update(
    plan_step_id: String,
    executor_key: Option<String>,
    workspace: &Path,
    params_raw: &Value,
) -> CommandResult<ExecutionCapabilityRaw> {
    let params = match parse_package_json_dependency_update_params(params_raw) {
        Ok(p) => p,
        Err(msg) => {
            return Ok(ExecutionCapabilityRaw {
                plan_step_id,
                executable: false,
                badge: "unsupported-executor".into(),
                mode: Some(MODE_SCRIPTED.into()),
                executor_key,
                reason: format!("Invalid executor params: {msg}"),
                missing_requirements: Vec::new(),
            });
        }
    };

    let package_json_path = workspace.join("package.json");
    let text = match read_capped_text(&package_json_path) {
        Ok(Some(t)) => t,
        Ok(None) => {
            return Ok(ExecutionCapabilityRaw {
                plan_step_id,
                executable: false,
                badge: "unsupported-executor".into(),
                mode: Some(MODE_SCRIPTED.into()),
                executor_key,
                reason: "workspace/package.json was not found.".into(),
                missing_requirements: vec!["workspace/package.json".into()],
            });
        }
        Err(e) => {
            return Ok(ExecutionCapabilityRaw {
                plan_step_id,
                executable: false,
                badge: "unsupported-executor".into(),
                mode: Some(MODE_SCRIPTED.into()),
                executor_key,
                reason: e.to_string(),
                missing_requirements: Vec::new(),
            });
        }
    };

    let parsed: Value = match serde_json::from_str(&text) {
        Ok(v) => v,
        Err(_) => {
            return Ok(ExecutionCapabilityRaw {
                plan_step_id,
                executable: false,
                badge: "unsupported-executor".into(),
                mode: Some(MODE_SCRIPTED.into()),
                executor_key,
                reason: "workspace/package.json is not valid JSON.".into(),
                missing_requirements: Vec::new(),
            });
        }
    };

    let preview = preview_package_json_changes(&parsed, &params);
    if !preview.would_change_anything() {
        return Ok(ExecutionCapabilityRaw {
            plan_step_id,
            executable: false,
            badge: "unsupported-executor".into(),
            mode: Some(MODE_SCRIPTED.into()),
            executor_key,
            reason:
                "No applicable dependency changes were found in package.json."
                    .into(),
            missing_requirements: Vec::new(),
        });
    }

    Ok(ExecutionCapabilityRaw {
        plan_step_id,
        executable: true,
        badge: "executable".into(),
        mode: Some(MODE_SCRIPTED.into()),
        executor_key,
        reason: preview.summary_sentence(),
        missing_requirements: Vec::new(),
    })
}

/// Pure preview helper. Returns the set of removals + additions that
/// *would* apply if the executor ran against the current package.json.
struct PackageJsonChangePreview {
    removals: Vec<(String, String)>, // (package_name, section)
    adds: Vec<(String, String)>,     // (package_name, section)
}

impl PackageJsonChangePreview {
    fn would_change_anything(&self) -> bool {
        !self.removals.is_empty() || !self.adds.is_empty()
    }

    fn summary_sentence(&self) -> String {
        let mut parts: Vec<String> = Vec::new();
        if !self.removals.is_empty() {
            let names: Vec<&str> =
                self.removals.iter().map(|(n, _)| n.as_str()).collect();
            parts.push(format!("remove {}", names.join(", ")));
        }
        if !self.adds.is_empty() {
            let names: Vec<&str> = self.adds.iter().map(|(n, _)| n.as_str()).collect();
            parts.push(format!("add {}", names.join(", ")));
        }
        if parts.is_empty() {
            "no applicable changes".to_string()
        } else {
            format!("Will {} in workspace/package.json.", parts.join(" and "))
        }
    }
}

fn preview_package_json_changes(
    pkg: &Value,
    params: &PackageJsonDependencyUpdateParams,
) -> PackageJsonChangePreview {
    let mut preview = PackageJsonChangePreview {
        removals: Vec::new(),
        adds: Vec::new(),
    };

    if let Some(map) = pkg.as_object() {
        for spec in &params.remove {
            let sections: Vec<&str> = if spec.from.is_empty() {
                DEP_SECTIONS.to_vec()
            } else {
                spec.from.iter().map(String::as_str).collect()
            };
            for section in sections {
                if let Some(Value::Object(deps)) = map.get(section) {
                    if deps.contains_key(&spec.name) {
                        preview
                            .removals
                            .push((spec.name.clone(), section.to_string()));
                    }
                }
            }
        }

        for spec in &params.add {
            if spec.only_if_missing && package_already_present(map, &spec.name) {
                continue;
            }
            preview.adds.push((spec.name.clone(), spec.to.clone()));
        }
    }

    preview
}

fn package_already_present(map: &Map<String, Value>, name: &str) -> bool {
    for section in DEP_SECTIONS {
        if let Some(Value::Object(deps)) = map.get(*section) {
            if deps.contains_key(name) {
                return true;
            }
        }
    }
    false
}

fn run_package_json_dependency_update(
    workspace_input: &str,
    source_input: &str,
    plan_id: &str,
    plan_step_id: &str,
    step_title: &str,
    executor_key: &str,
    params_raw: Value,
) -> CommandResult<ExecutionStepRunRaw> {
    let started_at = current_iso_timestamp();
    let mut logs: Vec<ExecutionLogEntryRaw> = Vec::new();

    push_log(&mut logs, "info", "Started execution", None);

    let params = parse_package_json_dependency_update_params(&params_raw)
        .map_err(|msg| CommandError::InvalidInput(format!("invalid executor params: {msg}")))?;

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

    let mut removed_count: usize = 0;
    let mut added_count: usize = 0;
    let mut summaries: Vec<String> = Vec::new();

    apply_removals(&mut parsed, &params, &mut logs, &mut removed_count, &mut summaries);
    apply_additions(&mut parsed, &params, &mut logs, &mut added_count, &mut summaries);

    if removed_count == 0 && added_count == 0 {
        return Err(CommandError::InvalidInput(
            "No applicable dependency changes were found in package.json.".into(),
        ));
    }

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

    let summary = if summaries.is_empty() {
        "Updated workspace/package.json.".to_string()
    } else {
        summaries.join(" ")
    };

    let changed_files = vec![ExecutionChangedFileRaw {
        path: "package.json".into(),
        change_type: "modified".into(),
        summary,
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
        executor_key: executor_key.to_string(),
        mode: MODE_SCRIPTED.to_string(),
        changed_files,
        logs,
        error: None,
    })
}

fn apply_removals(
    pkg: &mut Value,
    params: &PackageJsonDependencyUpdateParams,
    logs: &mut Vec<ExecutionLogEntryRaw>,
    removed_count: &mut usize,
    summaries: &mut Vec<String>,
) {
    let Some(map) = pkg.as_object_mut() else {
        return;
    };
    for spec in &params.remove {
        let sections: Vec<&str> = if spec.from.is_empty() {
            DEP_SECTIONS.to_vec()
        } else {
            spec.from.iter().map(String::as_str).collect()
        };
        let mut sections_removed: Vec<String> = Vec::new();
        for section in sections {
            if let Some(Value::Object(deps)) = map.get_mut(section) {
                if deps.remove(&spec.name).is_some() {
                    sections_removed.push(section.to_string());
                }
            }
        }
        if sections_removed.is_empty() {
            push_log(
                logs,
                "warning",
                &format!("Skipped removal — \"{}\" not present", spec.name),
                None,
            );
        } else {
            *removed_count += sections_removed.len();
            push_log(
                logs,
                "success",
                &format!("Removed {}", spec.name),
                Some(&format!("Removed from: {}", sections_removed.join(", "))),
            );
            summaries.push(format!(
                "Removed {} from {}.",
                spec.name,
                sections_removed.join(", ")
            ));
        }
    }
}

fn apply_additions(
    pkg: &mut Value,
    params: &PackageJsonDependencyUpdateParams,
    logs: &mut Vec<ExecutionLogEntryRaw>,
    added_count: &mut usize,
    summaries: &mut Vec<String>,
) {
    let Some(map) = pkg.as_object_mut() else {
        return;
    };
    for spec in &params.add {
        if spec.only_if_missing && package_already_present(map, &spec.name) {
            push_log(
                logs,
                "info",
                &format!("Skipped add — \"{}\" already present", spec.name),
                None,
            );
            continue;
        }

        let entry = map
            .entry(spec.to.clone())
            .or_insert_with(|| Value::Object(Map::new()));
        let Value::Object(deps) = entry else {
            push_log(
                logs,
                "warning",
                &format!(
                    "Cannot add \"{}\" because section \"{}\" is not an object",
                    spec.name, spec.to
                ),
                None,
            );
            continue;
        };

        let version_value = match &spec.version {
            Some(v) => Value::String(v.clone()),
            None => Value::String("*".to_string()),
        };
        deps.insert(spec.name.clone(), version_value);
        *added_count += 1;
        push_log(
            logs,
            "success",
            &format!("Added {}", spec.name),
            Some(&format!(
                "Added {} {} to {}",
                spec.name,
                spec.version.as_deref().unwrap_or("*"),
                spec.to
            )),
        );
        summaries.push(format!(
            "Added {} {} to {}.",
            spec.name,
            spec.version.as_deref().unwrap_or("*"),
            spec.to
        ));
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

    /// Plan step id emitted by the JS plan generator for the node-sass
    /// replacement. Used in tests for parity with the canonical scenario,
    /// but the executor does not depend on it.
    const NODE_SASS_PLAN_STEP_ID: &str = "dependency.replace-node-sass";

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

    fn node_sass_replacement_params() -> Value {
        json!({
            "remove": [
                {
                    "name": "node-sass",
                    "from": ["dependencies", "devDependencies", "optionalDependencies"]
                }
            ],
            "add": [
                {
                    "name": "sass",
                    "version": "^1.69.0",
                    "to": "devDependencies",
                    "onlyIfMissing": true
                }
            ]
        })
    }

    // ----- params parser ---------------------------------------------------

    #[test]
    fn parser_accepts_canonical_node_sass_replacement_params() {
        let params = parse_package_json_dependency_update_params(
            &node_sass_replacement_params(),
        )
        .expect("params parse");
        assert_eq!(params.remove.len(), 1);
        assert_eq!(params.remove[0].name, "node-sass");
        assert_eq!(params.add.len(), 1);
        assert_eq!(params.add[0].name, "sass");
        assert_eq!(params.add[0].to, "devDependencies");
        assert!(params.add[0].only_if_missing);
        assert_eq!(params.add[0].version.as_deref(), Some("^1.69.0"));
    }

    #[test]
    fn parser_rejects_non_object_params() {
        let err = parse_package_json_dependency_update_params(&json!([]))
            .expect_err("array params rejected");
        assert!(err.contains("must be an object"));
    }

    #[test]
    fn parser_rejects_unsupported_section() {
        let raw = json!({
            "remove": [{ "name": "x", "from": ["peerDependencies"] }]
        });
        let err = parse_package_json_dependency_update_params(&raw)
            .expect_err("unsupported section");
        assert!(err.contains("unsupported section"));
    }

    #[test]
    fn parser_rejects_empty_changeset() {
        let err = parse_package_json_dependency_update_params(&json!({}))
            .expect_err("empty changeset");
        assert!(err.contains("at least one"));
    }

    // ----- generic executor: end-to-end ------------------------------------

    #[test]
    fn generic_executor_replaces_node_sass_with_sass() {
        let source = make_temp_dir("e2e-source");
        let workspace = make_temp_dir("e2e-workspace");
        let source_pkg = source.join("package.json");
        let source_pkg_text = "{\n  \"name\": \"original\",\n  \"dependencies\": {\n    \"node-sass\": \"^4.0.0\"\n  }\n}\n";
        write_file(&source_pkg, source_pkg_text);

        let workspace_pkg = workspace.join("package.json");
        let workspace_pkg_text = "{\n  \"name\": \"my-app\",\n  \"version\": \"1.2.3\",\n  \"scripts\": {\n    \"build\": \"react-scripts build\"\n  },\n  \"dependencies\": {\n    \"react\": \"^18.0.0\",\n    \"node-sass\": \"^4.0.0\"\n  },\n  \"devDependencies\": {\n    \"node-sass\": \"^4.0.0\"\n  }\n}\n";
        write_file(&workspace_pkg, workspace_pkg_text);

        let raw = run_package_json_dependency_update(
            workspace.to_str().unwrap(),
            source.to_str().unwrap(),
            "plan-1",
            NODE_SASS_PLAN_STEP_ID,
            "Replace node-sass with sass",
            EXECUTOR_KEY_PACKAGE_JSON_DEPENDENCY_UPDATE,
            node_sass_replacement_params(),
        )
        .expect("execution succeeded");

        assert_eq!(raw.status, "completed");
        assert_eq!(raw.executor_key, EXECUTOR_KEY_PACKAGE_JSON_DEPENDENCY_UPDATE);
        assert_eq!(raw.mode, MODE_SCRIPTED);
        assert_eq!(raw.plan_step_id, NODE_SASS_PLAN_STEP_ID);
        assert_eq!(raw.changed_files.len(), 1);
        assert_eq!(raw.changed_files[0].path, "package.json");
        assert_eq!(raw.changed_files[0].change_type, "modified");

        // Source package.json must be untouched.
        assert_eq!(read_file(&source_pkg), source_pkg_text);

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
        assert_eq!(dev.get("sass").unwrap().as_str(), Some("^1.69.0"));
        assert_eq!(parsed.get("name").unwrap().as_str(), Some("my-app"));
        assert_eq!(parsed.get("version").unwrap().as_str(), Some("1.2.3"));
        assert!(parsed.get("scripts").is_some(), "scripts preserved");
        assert!(updated.ends_with('\n'));

        drop_dir(&source);
        drop_dir(&workspace);
    }

    #[test]
    fn generic_executor_removes_from_dependencies_only_section() {
        let source = make_temp_dir("rm-deps-source");
        let workspace = make_temp_dir("rm-deps-workspace");
        let workspace_pkg = workspace.join("package.json");
        write_file(
            &workspace_pkg,
            "{\n  \"dependencies\": { \"node-sass\": \"^4.0.0\", \"react\": \"^18.0.0\" }\n}\n",
        );

        let params = json!({
            "remove": [{ "name": "node-sass", "from": ["dependencies"] }]
        });

        let raw = run_package_json_dependency_update(
            workspace.to_str().unwrap(),
            source.to_str().unwrap(),
            "plan-1",
            "step-rm-deps",
            "Remove node-sass",
            EXECUTOR_KEY_PACKAGE_JSON_DEPENDENCY_UPDATE,
            params,
        )
        .expect("execution succeeded");

        assert_eq!(raw.status, "completed");
        let parsed: Value = serde_json::from_str(&read_file(&workspace_pkg)).unwrap();
        let deps = parsed.get("dependencies").and_then(|v| v.as_object()).unwrap();
        assert!(!deps.contains_key("node-sass"));
        assert!(deps.contains_key("react"));

        drop_dir(&source);
        drop_dir(&workspace);
    }

    #[test]
    fn generic_executor_removes_from_dev_dependencies_only_section() {
        let source = make_temp_dir("rm-dev-source");
        let workspace = make_temp_dir("rm-dev-workspace");
        let workspace_pkg = workspace.join("package.json");
        write_file(
            &workspace_pkg,
            "{\n  \"devDependencies\": { \"old-pkg\": \"1.0.0\" }\n}\n",
        );

        let params = json!({
            "remove": [{ "name": "old-pkg", "from": ["devDependencies"] }]
        });

        run_package_json_dependency_update(
            workspace.to_str().unwrap(),
            source.to_str().unwrap(),
            "plan-1",
            "step-rm-dev",
            "Remove old-pkg",
            EXECUTOR_KEY_PACKAGE_JSON_DEPENDENCY_UPDATE,
            params,
        )
        .expect("execution succeeded");

        let parsed: Value = serde_json::from_str(&read_file(&workspace_pkg)).unwrap();
        let dev = parsed
            .get("devDependencies")
            .and_then(|v| v.as_object())
            .unwrap();
        assert!(!dev.contains_key("old-pkg"));

        drop_dir(&source);
        drop_dir(&workspace);
    }

    #[test]
    fn generic_executor_adds_to_dev_dependencies() {
        let source = make_temp_dir("add-dev-source");
        let workspace = make_temp_dir("add-dev-workspace");
        let workspace_pkg = workspace.join("package.json");
        write_file(
            &workspace_pkg,
            "{\n  \"name\": \"my-app\",\n  \"dependencies\": { \"node-sass\": \"^4.0.0\" }\n}\n",
        );

        let params = json!({
            "add": [
                {
                    "name": "@types/node",
                    "version": "^22.0.0",
                    "to": "devDependencies",
                    "onlyIfMissing": true
                }
            ]
        });

        run_package_json_dependency_update(
            workspace.to_str().unwrap(),
            source.to_str().unwrap(),
            "plan-1",
            "step-add",
            "Add @types/node",
            EXECUTOR_KEY_PACKAGE_JSON_DEPENDENCY_UPDATE,
            params,
        )
        .expect("execution succeeded");

        let parsed: Value = serde_json::from_str(&read_file(&workspace_pkg)).unwrap();
        let dev = parsed
            .get("devDependencies")
            .and_then(|v| v.as_object())
            .unwrap();
        assert_eq!(dev.get("@types/node").unwrap().as_str(), Some("^22.0.0"));
        // Existing node-sass must not be removed by an add.
        let deps = parsed.get("dependencies").and_then(|v| v.as_object()).unwrap();
        assert!(deps.contains_key("node-sass"));

        drop_dir(&source);
        drop_dir(&workspace);
    }

    #[test]
    fn generic_executor_does_not_duplicate_existing_package() {
        let source = make_temp_dir("dup-source");
        let workspace = make_temp_dir("dup-workspace");
        let workspace_pkg = workspace.join("package.json");
        write_file(
            &workspace_pkg,
            "{\n  \"dependencies\": { \"node-sass\": \"^4.0.0\", \"sass\": \"^1.50.0\" }\n}\n",
        );

        run_package_json_dependency_update(
            workspace.to_str().unwrap(),
            source.to_str().unwrap(),
            "plan-1",
            NODE_SASS_PLAN_STEP_ID,
            "Replace node-sass with sass",
            EXECUTOR_KEY_PACKAGE_JSON_DEPENDENCY_UPDATE,
            node_sass_replacement_params(),
        )
        .expect("execution succeeded");

        let parsed: Value = serde_json::from_str(&read_file(&workspace_pkg)).unwrap();
        let deps = parsed.get("dependencies").and_then(|v| v.as_object()).unwrap();
        assert!(!deps.contains_key("node-sass"));
        // Existing sass entry preserved verbatim, no duplicate added.
        assert_eq!(deps.get("sass").unwrap().as_str(), Some("^1.50.0"));
        let dev = parsed
            .get("devDependencies")
            .and_then(|v| v.as_object());
        if let Some(dev) = dev {
            assert!(!dev.contains_key("sass"), "sass not duplicated to devDependencies");
        }

        drop_dir(&source);
        drop_dir(&workspace);
    }

    #[test]
    fn generic_executor_warns_when_remove_target_missing() {
        let source = make_temp_dir("missing-rm-source");
        let workspace = make_temp_dir("missing-rm-workspace");
        let workspace_pkg = workspace.join("package.json");
        write_file(
            &workspace_pkg,
            "{\n  \"dependencies\": { \"react\": \"^18.0.0\" }\n}\n",
        );

        // Only a remove (which does not match) and no add → must fail with
        // the explicit no-applicable-changes message.
        let params = json!({
            "remove": [{ "name": "node-sass", "from": ["dependencies"] }]
        });
        let err = run_package_json_dependency_update(
            workspace.to_str().unwrap(),
            source.to_str().unwrap(),
            "plan-1",
            "step-rm",
            "Remove node-sass",
            EXECUTOR_KEY_PACKAGE_JSON_DEPENDENCY_UPDATE,
            params,
        )
        .unwrap_err();
        match err {
            CommandError::InvalidInput(msg) => {
                assert!(msg.contains("No applicable dependency changes"));
            }
            other => panic!("unexpected error: {other:?}"),
        }

        drop_dir(&source);
        drop_dir(&workspace);
    }

    #[test]
    fn generic_executor_rejects_invalid_json_safely() {
        let source = make_temp_dir("badjson-source");
        let workspace = make_temp_dir("badjson-workspace");
        let workspace_pkg = workspace.join("package.json");
        let original = "{ this is not json";
        write_file(&workspace_pkg, original);

        let err = run_package_json_dependency_update(
            workspace.to_str().unwrap(),
            source.to_str().unwrap(),
            "plan-1",
            NODE_SASS_PLAN_STEP_ID,
            "Replace node-sass with sass",
            EXECUTOR_KEY_PACKAGE_JSON_DEPENDENCY_UPDATE,
            node_sass_replacement_params(),
        )
        .unwrap_err();

        match err {
            CommandError::InvalidInput(msg) => {
                assert!(msg.contains("invalid package.json"), "got: {msg}");
            }
            other => panic!("unexpected error: {other:?}"),
        }

        // No write should have happened.
        assert_eq!(read_file(&workspace_pkg), original);

        drop_dir(&source);
        drop_dir(&workspace);
    }

    #[test]
    fn generic_executor_does_not_modify_source_project() {
        let source = make_temp_dir("readonly-source");
        let workspace = make_temp_dir("readonly-workspace");
        let source_pkg = source.join("package.json");
        let original = "{\n  \"dependencies\": { \"node-sass\": \"^4.0.0\" }\n}\n";
        write_file(&source_pkg, original);

        let workspace_pkg = workspace.join("package.json");
        let workspace_text = "{\n  \"dependencies\": { \"node-sass\": \"^4.0.0\" }\n}\n";
        write_file(&workspace_pkg, workspace_text);

        run_package_json_dependency_update(
            workspace.to_str().unwrap(),
            source.to_str().unwrap(),
            "plan-1",
            NODE_SASS_PLAN_STEP_ID,
            "Replace node-sass with sass",
            EXECUTOR_KEY_PACKAGE_JSON_DEPENDENCY_UPDATE,
            node_sass_replacement_params(),
        )
        .expect("execution succeeded");

        // The source package.json must remain byte-for-byte identical.
        assert_eq!(read_file(&source_pkg), original);

        drop_dir(&source);
        drop_dir(&workspace);
    }

    #[test]
    fn generic_executor_preserves_unrelated_fields_and_field_order() {
        let source = make_temp_dir("preserve-source");
        let workspace = make_temp_dir("preserve-workspace");
        let workspace_pkg = workspace.join("package.json");
        let original = "{\n  \"name\": \"x\",\n  \"author\": \"someone\",\n  \"scripts\": {\n    \"build\": \"vite build\",\n    \"test\": \"vitest\"\n  },\n  \"dependencies\": {\n    \"node-sass\": \"^4.0.0\"\n  }\n}\n";
        write_file(&workspace_pkg, original);

        run_package_json_dependency_update(
            workspace.to_str().unwrap(),
            source.to_str().unwrap(),
            "plan-1",
            NODE_SASS_PLAN_STEP_ID,
            "Replace node-sass with sass",
            EXECUTOR_KEY_PACKAGE_JSON_DEPENDENCY_UPDATE,
            node_sass_replacement_params(),
        )
        .expect("execution succeeded");

        let updated = read_file(&workspace_pkg);
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

    #[test]
    fn rejects_when_workspace_equals_source() {
        let same = make_temp_dir("same");
        let workspace_pkg = same.join("package.json");
        write_file(
            &workspace_pkg,
            "{\n  \"dependencies\": { \"node-sass\": \"^4.0.0\" }\n}\n",
        );

        let err = run_package_json_dependency_update(
            same.to_str().unwrap(),
            same.to_str().unwrap(),
            "plan-1",
            NODE_SASS_PLAN_STEP_ID,
            "Replace node-sass with sass",
            EXECUTOR_KEY_PACKAGE_JSON_DEPENDENCY_UPDATE,
            node_sass_replacement_params(),
        )
        .unwrap_err();

        match err {
            CommandError::PathNotAllowed(_) => (),
            other => panic!("unexpected error: {other:?}"),
        }

        drop_dir(&same);
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

    // ----- dispatcher ------------------------------------------------------

    #[tokio::test]
    async fn run_step_rejects_non_scripted_modes() {
        let source = make_temp_dir("ai-source");
        let workspace = make_temp_dir("ai-workspace");

        for mode in [MODE_AI, MODE_MANUAL, MODE_VALIDATION] {
            let err = execution_run_step(
                workspace.to_str().unwrap().into(),
                source.to_str().unwrap().into(),
                "plan-1".into(),
                "step-ai".into(),
                "AI step".into(),
                ExecutionRequestRaw {
                    mode: mode.into(),
                    executor_key: Some("ai-source-transform".into()),
                    params: None,
                },
            )
            .await
            .unwrap_err();
            match err {
                CommandError::NotImplemented(msg) => {
                    assert!(msg.contains("not implemented"));
                }
                other => panic!("unexpected error for mode {mode}: {other:?}"),
            }
        }

        drop_dir(&source);
        drop_dir(&workspace);
    }

    #[tokio::test]
    async fn run_step_rejects_unknown_executor_key() {
        let source = make_temp_dir("unknown-source");
        let workspace = make_temp_dir("unknown-workspace");

        let err = execution_run_step(
            workspace.to_str().unwrap().into(),
            source.to_str().unwrap().into(),
            "plan-1".into(),
            "step-mystery".into(),
            "Mystery".into(),
            ExecutionRequestRaw {
                mode: MODE_SCRIPTED.into(),
                executor_key: Some("does-not-exist".into()),
                params: None,
            },
        )
        .await
        .unwrap_err();
        match err {
            CommandError::NotImplemented(msg) => {
                assert!(msg.contains("Unsupported executor"));
            }
            other => panic!("unexpected error: {other:?}"),
        }

        drop_dir(&source);
        drop_dir(&workspace);
    }

    #[tokio::test]
    async fn run_step_rejects_missing_executor_key() {
        let source = make_temp_dir("nokey-source");
        let workspace = make_temp_dir("nokey-workspace");

        let err = execution_run_step(
            workspace.to_str().unwrap().into(),
            source.to_str().unwrap().into(),
            "plan-1".into(),
            "step-nokey".into(),
            "No key".into(),
            ExecutionRequestRaw {
                mode: MODE_SCRIPTED.into(),
                executor_key: None,
                params: None,
            },
        )
        .await
        .unwrap_err();
        match err {
            CommandError::InvalidInput(msg) => {
                assert!(msg.contains("executorKey"));
            }
            other => panic!("unexpected error: {other:?}"),
        }

        drop_dir(&source);
        drop_dir(&workspace);
    }

    // ----- capability ------------------------------------------------------

    #[tokio::test]
    async fn capability_marks_supported_scripted_executable_when_applicable() {
        let source = make_temp_dir("cap-ok-source");
        let workspace = make_temp_dir("cap-ok-workspace");
        write_file(
            &workspace.join("package.json"),
            "{\n  \"dependencies\": { \"node-sass\": \"^4.0.0\" }\n}\n",
        );

        let cap = execution_check_capability(
            workspace.to_str().unwrap().into(),
            source.to_str().unwrap().into(),
            NODE_SASS_PLAN_STEP_ID.into(),
            "Replace node-sass with sass".into(),
            ExecutionRequestRaw {
                mode: MODE_SCRIPTED.into(),
                executor_key: Some(
                    EXECUTOR_KEY_PACKAGE_JSON_DEPENDENCY_UPDATE.into(),
                ),
                params: Some(node_sass_replacement_params()),
            },
        )
        .await
        .expect("capability");

        assert!(cap.executable, "expected executable, got: {:?}", cap);
        assert_eq!(cap.badge, "executable");
        assert_eq!(cap.mode.as_deref(), Some(MODE_SCRIPTED));
        assert_eq!(
            cap.executor_key.as_deref(),
            Some(EXECUTOR_KEY_PACKAGE_JSON_DEPENDENCY_UPDATE)
        );

        drop_dir(&source);
        drop_dir(&workspace);
    }

    #[tokio::test]
    async fn capability_rejects_unknown_executor_key() {
        let source = make_temp_dir("cap-unknown-source");
        let workspace = make_temp_dir("cap-unknown-workspace");

        let cap = execution_check_capability(
            workspace.to_str().unwrap().into(),
            source.to_str().unwrap().into(),
            "step-mystery".into(),
            "Mystery".into(),
            ExecutionRequestRaw {
                mode: MODE_SCRIPTED.into(),
                executor_key: Some("does-not-exist".into()),
                params: None,
            },
        )
        .await
        .expect("capability");

        assert!(!cap.executable);
        assert_eq!(cap.badge, "unsupported-executor");
        assert!(cap.reason.contains("Unsupported executor"));

        drop_dir(&source);
        drop_dir(&workspace);
    }

    #[tokio::test]
    async fn capability_classifies_manual_step() {
        let source = make_temp_dir("cap-manual-source");
        let workspace = make_temp_dir("cap-manual-workspace");

        let cap = execution_check_capability(
            workspace.to_str().unwrap().into(),
            source.to_str().unwrap().into(),
            "step-manual".into(),
            "Manual".into(),
            ExecutionRequestRaw {
                mode: MODE_MANUAL.into(),
                executor_key: Some("manual-review".into()),
                params: None,
            },
        )
        .await
        .expect("capability");

        assert!(!cap.executable);
        assert_eq!(cap.badge, "manual");

        drop_dir(&source);
        drop_dir(&workspace);
    }

    #[tokio::test]
    async fn capability_classifies_ai_step_unavailable() {
        let source = make_temp_dir("cap-ai-source");
        let workspace = make_temp_dir("cap-ai-workspace");

        let cap = execution_check_capability(
            workspace.to_str().unwrap().into(),
            source.to_str().unwrap().into(),
            "step-ai".into(),
            "AI".into(),
            ExecutionRequestRaw {
                mode: MODE_AI.into(),
                executor_key: Some("ai-source-transform".into()),
                params: None,
            },
        )
        .await
        .expect("capability");

        assert!(!cap.executable);
        assert_eq!(cap.badge, "ai-not-available");

        drop_dir(&source);
        drop_dir(&workspace);
    }

    #[tokio::test]
    async fn capability_returns_no_applicable_changes_when_target_missing() {
        let source = make_temp_dir("cap-noop-source");
        let workspace = make_temp_dir("cap-noop-workspace");
        write_file(
            &workspace.join("package.json"),
            "{\n  \"dependencies\": { \"react\": \"^18.0.0\" }\n}\n",
        );

        let cap = execution_check_capability(
            workspace.to_str().unwrap().into(),
            source.to_str().unwrap().into(),
            NODE_SASS_PLAN_STEP_ID.into(),
            "Replace node-sass with sass".into(),
            ExecutionRequestRaw {
                mode: MODE_SCRIPTED.into(),
                executor_key: Some(
                    EXECUTOR_KEY_PACKAGE_JSON_DEPENDENCY_UPDATE.into(),
                ),
                params: Some(json!({
                    "remove": [{ "name": "node-sass", "from": ["dependencies"] }]
                })),
            },
        )
        .await
        .expect("capability");

        assert!(!cap.executable);
        assert!(cap.reason.contains("No applicable dependency changes"));

        drop_dir(&source);
        drop_dir(&workspace);
    }
}


