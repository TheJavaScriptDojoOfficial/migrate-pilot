//! Project selection + scanner commands.
//!
//! Milestone 2 + 3 contract
//! ------------------------
//! These commands are intentionally narrow and **read-only**. They never
//! mutate the user-selected path. They never spawn a shell. They never run
//! `npm`/`git` binaries — any "git branch" detection works by parsing the
//! plain-text `.git/HEAD` file.
//!
//! Four commands are exposed:
//!
//! * [`project_pick_folder`] - opens a native folder picker; returns the
//!   chosen path or `None` if the user cancelled.
//! * [`project_read_metadata`] - inspects the chosen path and returns the
//!   raw signals the UI needs (package.json contents, lockfile presence,
//!   tsconfig presence, .git presence, current branch).
//! * [`project_scan`] - Milestone 3 scanner. Walks the project tree with
//!   strict limits, returning raw file counts plus heuristic indicators
//!   (class components, deprecated lifecycle methods, ReactDOM.render, …).
//!   Heavy folders (`node_modules`, `dist`, `build`, `coverage`, `.git`,
//!   `.next`, `out`, `target`) are skipped.
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

// ---------------------------------------------------------------------------
// Milestone 3: read-only project scanner.
// ---------------------------------------------------------------------------

/// Hard limits enforced by [`project_scan`]. Kept conservative on purpose —
/// the scanner runs synchronously on the Tauri command runtime and must
/// never freeze the UI on a pathological repo.
const SCAN_MAX_FILES: u32 = 5_000;
const SCAN_MAX_FILE_BYTES: u64 = 524_288; // 512 KB per file for content scan
const SCAN_MAX_DIR_DEPTH: u32 = 16;

/// Top-level (and nested) directory names that are always skipped during
/// the source walk. Kept lowercase; matched case-insensitively against
/// `OsStr::to_string_lossy().to_ascii_lowercase()`.
const SKIP_DIRS: &[&str] = &[
    "node_modules",
    "dist",
    "build",
    "coverage",
    ".git",
    ".next",
    "out",
    "target",
    ".cache",
    ".turbo",
    ".parcel-cache",
    ".vite",
    ".svelte-kit",
    ".idea",
    ".vscode",
];

/// File extensions that are *counted* and (where useful) *content-scanned*.
/// Anything outside this set is ignored entirely so we never read binary
/// blobs or large media assets.
fn is_scannable_extension(ext: &str) -> ScannableKind {
    match ext {
        "js" => ScannableKind::Js,
        "jsx" => ScannableKind::Jsx,
        "ts" => ScannableKind::Ts,
        "tsx" => ScannableKind::Tsx,
        "css" => ScannableKind::Style,
        "scss" => ScannableKind::Style,
        "sass" => ScannableKind::Style,
        "json" => ScannableKind::Json,
        _ => ScannableKind::Skip,
    }
}

#[derive(Debug, Clone, Copy)]
enum ScannableKind {
    Js,
    Jsx,
    Ts,
    Tsx,
    Style,
    Json,
    Skip,
}

impl ScannableKind {
    /// Whether this file type should be *content-scanned* for React
    /// indicators (class components, deprecated lifecycle methods, …).
    const fn scan_content(self) -> bool {
        matches!(
            self,
            ScannableKind::Js | ScannableKind::Jsx | ScannableKind::Ts | ScannableKind::Tsx
        )
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeprecatedLifecycleUsage {
    pub method: String,
    pub file_count: u32,
    pub example_file: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanLimits {
    pub max_files: u32,
    pub max_file_bytes: u64,
    pub files_skipped_too_large: u32,
    /// Set to true when the walker hit `max_files` and stopped early.
    pub truncated: bool,
}

#[derive(Debug, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SourceScanRaw {
    pub total_files_scanned: u32,
    pub js_files: u32,
    pub jsx_files: u32,
    pub ts_files: u32,
    pub tsx_files: u32,
    pub style_files: u32,
    pub json_files: u32,
    /// Number of files containing at least one `class … extends (React.)?Component`
    /// or `extends (React.)?PureComponent` indicator.
    pub class_component_indicators: u32,
    /// One row per deprecated lifecycle method that was detected at least
    /// once. Methods that did not match are omitted (kept compact).
    pub deprecated_lifecycle_indicators: Vec<DeprecatedLifecycleUsage>,
    /// Number of files containing `ReactDOM.render(` or `import("react-dom").render(`.
    pub react_dom_render_usages: u32,
    /// Number of files containing legacy context API indicators (`childContextTypes`,
    /// `getChildContext`, `contextTypes`).
    pub legacy_context_indicators: u32,
    /// Number of files containing router usage indicators (`react-router` /
    /// `react-router-dom` imports OR top-level `<BrowserRouter` / `<Router`).
    pub router_usage_indicators: u32,
    /// Top-level entries actually walked.
    pub scanned_directories: Vec<String>,
    /// Top-level entries skipped (node_modules, dist, …).
    pub skipped_directories: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectScanRaw {
    /// Canonical absolute path of the inspected folder.
    pub path: String,
    pub folder_name: String,
    pub package_json_text: Option<String>,
    pub lock_files: LockFilePresence,
    pub tsconfig_present: bool,
    pub is_git_repository: bool,
    pub current_branch: Option<String>,
    /// Best-effort ".git is clean" answer. `None` indicates we could not
    /// determine cleanliness without spawning `git` — kept as `unknown` in
    /// the UI rather than risking a wrong "clean" claim.
    pub git_clean: Option<bool>,
    pub source: SourceScanRaw,
    pub limits: ScanLimits,
    /// Wall-clock duration of the scan in milliseconds.
    pub duration_ms: u64,
}

/// Run a deterministic, read-only scan of the selected project.
///
/// Safety + scope rules
/// --------------------
/// * The path is canonicalised and must be a directory.
/// * No file is opened for *writing*. No process is spawned.
/// * `node_modules`, `dist`, `build`, `coverage`, `.git`, `.next`, `out`,
///   `target` (and a handful of other build / cache folders) are skipped.
/// * Only `.js / .jsx / .ts / .tsx / .css / .scss / .sass / .json` files
///   are counted. Only the JS/TS family is content-scanned.
/// * Hard limits on file count, per-file bytes, and recursion depth.
#[tauri::command]
pub async fn project_scan(path: String) -> CommandResult<ProjectScanRaw> {
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

    // Move blocking IO off the async runtime so the UI thread stays
    // responsive even for large repos.
    let scan_root = canonical.clone();
    let scan = tokio::task::spawn_blocking(move || run_scan(&scan_root))
        .await
        .map_err(|e| CommandError::Internal(format!("scan task failed: {e}")))??;

    Ok(scan)
}

/// Synchronous scanner body. Pure logic + filesystem reads; no `await`.
fn run_scan(canonical: &Path) -> CommandResult<ProjectScanRaw> {
    let started = std::time::Instant::now();

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
        detect_current_branch(canonical, &git_path)
    } else {
        None
    };

    // Git cleanliness intentionally not implemented in Milestone 3 — we
    // would need to either parse the index ourselves or spawn `git status`
    // (which violates the no-shell rule). Returning `None` keeps the UI
    // honest and avoids a false "clean" claim.
    let git_clean: Option<bool> = None;

    let mut walker = ScanWalker::new(canonical.to_path_buf());
    walker.walk(canonical);

    let limits = ScanLimits {
        max_files: SCAN_MAX_FILES,
        max_file_bytes: SCAN_MAX_FILE_BYTES,
        files_skipped_too_large: walker.files_skipped_too_large,
        truncated: walker.truncated,
    };

    let source = walker.into_report();

    Ok(ProjectScanRaw {
        path: canonical.to_string_lossy().to_string(),
        folder_name,
        package_json_text,
        lock_files,
        tsconfig_present,
        is_git_repository,
        current_branch,
        git_clean,
        source,
        limits,
        duration_ms: started.elapsed().as_millis() as u64,
    })
}

// ---------------------------------------------------------------------------
// Walker
// ---------------------------------------------------------------------------

/// All deprecated lifecycle method names we surface. Matched as plain
/// substrings against the file contents — heuristic detection only, never
/// a full AST parse. False positives in comments are acceptable for the
/// readiness report; the user makes the final call.
const DEPRECATED_LIFECYCLE_METHODS: &[&str] = &[
    "componentWillMount",
    "componentWillReceiveProps",
    "componentWillUpdate",
    "UNSAFE_componentWillMount",
    "UNSAFE_componentWillReceiveProps",
    "UNSAFE_componentWillUpdate",
];

const LEGACY_CONTEXT_PATTERNS: &[&str] = &[
    "childContextTypes",
    "getChildContext",
    "contextTypes",
];

const ROUTER_PATTERNS: &[&str] = &[
    "from 'react-router-dom'",
    "from \"react-router-dom\"",
    "from 'react-router'",
    "from \"react-router\"",
    "<BrowserRouter",
    "<HashRouter",
    "<MemoryRouter",
];

const CLASS_COMPONENT_PATTERNS: &[&str] = &[
    "extends Component",
    "extends React.Component",
    "extends PureComponent",
    "extends React.PureComponent",
];

const REACT_DOM_RENDER_PATTERNS: &[&str] = &[
    "ReactDOM.render(",
    "reactDom.render(",
];

struct ScanWalker {
    root: PathBuf,
    total_files_scanned: u32,
    js_files: u32,
    jsx_files: u32,
    ts_files: u32,
    tsx_files: u32,
    style_files: u32,
    json_files: u32,
    class_component_indicators: u32,
    react_dom_render_usages: u32,
    legacy_context_indicators: u32,
    router_usage_indicators: u32,
    /// Per-method counts + first example file for each deprecated lifecycle method.
    lifecycle_counts: [(u32, Option<String>); DEPRECATED_LIFECYCLE_METHODS.len()],
    scanned_directories: Vec<String>,
    skipped_directories: Vec<String>,
    files_skipped_too_large: u32,
    truncated: bool,
}

impl ScanWalker {
    fn new(root: PathBuf) -> Self {
        Self {
            root,
            total_files_scanned: 0,
            js_files: 0,
            jsx_files: 0,
            ts_files: 0,
            tsx_files: 0,
            style_files: 0,
            json_files: 0,
            class_component_indicators: 0,
            react_dom_render_usages: 0,
            legacy_context_indicators: 0,
            router_usage_indicators: 0,
            lifecycle_counts: std::array::from_fn(|_| (0, None)),
            scanned_directories: Vec::new(),
            skipped_directories: Vec::new(),
            files_skipped_too_large: 0,
            truncated: false,
        }
    }

    fn walk(&mut self, root: &Path) {
        // Walk root's direct entries first so we can populate
        // `scanned_directories` / `skipped_directories` cleanly.
        let entries = match fs::read_dir(root) {
            Ok(it) => it,
            Err(_) => return,
        };

        for entry in entries.flatten() {
            let path = entry.path();
            let name = entry.file_name().to_string_lossy().to_string();

            let file_type = match entry.file_type() {
                Ok(ft) => ft,
                Err(_) => continue,
            };

            if file_type.is_dir() {
                if should_skip_dir(&name) {
                    self.skipped_directories.push(name);
                    continue;
                }
                self.scanned_directories.push(name.clone());
                self.walk_dir(&path, 1);
                if self.truncated {
                    return;
                }
            } else if file_type.is_file() {
                self.handle_file(&path);
                if self.truncated {
                    return;
                }
            }
        }
    }

    fn walk_dir(&mut self, dir: &Path, depth: u32) {
        if depth > SCAN_MAX_DIR_DEPTH {
            return;
        }
        if self.truncated {
            return;
        }

        let entries = match fs::read_dir(dir) {
            Ok(it) => it,
            Err(_) => return,
        };

        for entry in entries.flatten() {
            let path = entry.path();
            let file_type = match entry.file_type() {
                Ok(ft) => ft,
                Err(_) => continue,
            };

            if file_type.is_dir() {
                let name = entry.file_name().to_string_lossy().to_string();
                if should_skip_dir(&name) {
                    continue;
                }
                self.walk_dir(&path, depth + 1);
                if self.truncated {
                    return;
                }
            } else if file_type.is_file() {
                self.handle_file(&path);
                if self.truncated {
                    return;
                }
            }
        }
    }

    fn handle_file(&mut self, file: &Path) {
        if self.total_files_scanned >= SCAN_MAX_FILES {
            self.truncated = true;
            return;
        }

        let ext = match file.extension().and_then(|e| e.to_str()) {
            Some(e) => e.to_ascii_lowercase(),
            None => return,
        };
        let kind = is_scannable_extension(&ext);
        if matches!(kind, ScannableKind::Skip) {
            return;
        }

        // Bump per-extension counters even if we won't open the file.
        match kind {
            ScannableKind::Js => self.js_files += 1,
            ScannableKind::Jsx => self.jsx_files += 1,
            ScannableKind::Ts => self.ts_files += 1,
            ScannableKind::Tsx => self.tsx_files += 1,
            ScannableKind::Style => self.style_files += 1,
            ScannableKind::Json => self.json_files += 1,
            ScannableKind::Skip => return,
        }
        self.total_files_scanned += 1;

        if !kind.scan_content() {
            return;
        }

        // Content scan with the per-file size cap.
        let stat = match fs::metadata(file) {
            Ok(m) => m,
            Err(_) => return,
        };
        if stat.len() > SCAN_MAX_FILE_BYTES {
            self.files_skipped_too_large += 1;
            return;
        }
        let text = match fs::read_to_string(file) {
            Ok(t) => t,
            Err(_) => return,
        };

        let rel = file
            .strip_prefix(&self.root)
            .unwrap_or(file)
            .to_string_lossy()
            .to_string();

        if CLASS_COMPONENT_PATTERNS.iter().any(|p| text.contains(p)) {
            self.class_component_indicators += 1;
        }
        if REACT_DOM_RENDER_PATTERNS.iter().any(|p| text.contains(p)) {
            self.react_dom_render_usages += 1;
        }
        if LEGACY_CONTEXT_PATTERNS.iter().any(|p| text.contains(p)) {
            self.legacy_context_indicators += 1;
        }
        if ROUTER_PATTERNS.iter().any(|p| text.contains(p)) {
            self.router_usage_indicators += 1;
        }

        for (i, method) in DEPRECATED_LIFECYCLE_METHODS.iter().enumerate() {
            if text.contains(method) {
                let entry = &mut self.lifecycle_counts[i];
                entry.0 += 1;
                if entry.1.is_none() {
                    entry.1 = Some(rel.clone());
                }
            }
        }
    }

    fn into_report(self) -> SourceScanRaw {
        let mut deprecated: Vec<DeprecatedLifecycleUsage> = Vec::new();
        for (i, method) in DEPRECATED_LIFECYCLE_METHODS.iter().enumerate() {
            let (count, example) = &self.lifecycle_counts[i];
            if *count > 0 {
                deprecated.push(DeprecatedLifecycleUsage {
                    method: (*method).to_string(),
                    file_count: *count,
                    example_file: example.clone(),
                });
            }
        }

        SourceScanRaw {
            total_files_scanned: self.total_files_scanned,
            js_files: self.js_files,
            jsx_files: self.jsx_files,
            ts_files: self.ts_files,
            tsx_files: self.tsx_files,
            style_files: self.style_files,
            json_files: self.json_files,
            class_component_indicators: self.class_component_indicators,
            deprecated_lifecycle_indicators: deprecated,
            react_dom_render_usages: self.react_dom_render_usages,
            legacy_context_indicators: self.legacy_context_indicators,
            router_usage_indicators: self.router_usage_indicators,
            scanned_directories: self.scanned_directories,
            skipped_directories: self.skipped_directories,
        }
    }
}

fn should_skip_dir(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    SKIP_DIRS.iter().any(|d| *d == lower)
}
