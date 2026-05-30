# Folder Structure

```
migrate-pilot/
  apps/
    desktop/
      src/
        app/                       # App bootstrap (main.tsx, AppShell, styles)
        routes/                    # React Router definitions
        components/                # Cross-feature page-level components
        features/                  # One folder per workflow screen
          project-selection/
          scanner/
          report/
          migration-plan/
          workspace/
          execution/
          diff-review/
          summary/
        shared/
          ui/                      # Reusable presentational components
          hooks/                   # Cross-feature React hooks (stores live here)
          utils/                   # Pure helpers (cn, commands, format, assert)
          types/                   # Domain models (Project, Session, Step, ...)
          constants/               # App constants + enums (states, routes, workflow)
          config/                  # Runtime config (read once at startup)
      src-tauri/
        src/
          commands/                # Allowlisted Tauri commands (one file per group)
          security/                # Path validation, secret redaction
          events/                  # Stable event channel names for streaming
          process/                 # Orchestrator + validation subprocess lifecycle
          filesystem/              # Path resolvers for app data + artifacts
          main.rs                  # Thin entry; calls lib::run()
          lib.rs                   # Module wiring + invoke_handler registration
        capabilities/              # Tauri capability files
        tauri.conf.json
        Cargo.toml

  orchestrator/
    orchestrator/
      core/                        # SessionManager, WorkflowEngine, EventBus
      scanner/                     # Project / dependency / risk scanners
      git/                         # GitManager, WorktreeManager, BranchManager, RollbackManager
      ai/                          # AIProvider contract + OpenCode adapter, prompt builder, cost tracker
      planner/                     # Migration plan generator + step builder
      validation/                  # Command detector + validation runner
      state/                       # SQLite handle + dataclass models
      artifacts/                   # Log / diff / artifact writers
    pyproject.toml

  docs/
    architecture/                  # This folder
    product/                       # Scope + limitations
    prompts/                       # AI prompt guidelines

  tests/
    scanner/
    git/
    workflow/
    validation/
```

## Why this layout

- **Feature folders** keep UI changes localised. Each workflow screen owns
  its components, hooks, and tests.
- **`shared/`** holds anything used by more than one feature. The split
  between `ui/`, `hooks/`, `utils/`, `types/`, `constants/`, and `config/`
  prevents the catch-all "common" folder anti-pattern.
- **Tauri layer** mirrors that separation in Rust modules: commands are
  small and grouped; security and filesystem helpers are isolated so they
  can be audited as a unit.
- **Orchestrator** lives in its own top-level package with its own
  `pyproject.toml`. It can be developed, tested, and packaged independently
  of the desktop shell.
- **Docs and tests** are kept top-level so they apply across packages.

## State / artifact layout on disk

Per `~/.legacy-modernizer/`:

```
~/.legacy-modernizer/
  app.db
  sessions/
    session-001/
      scan-report.json
      migration-plan.json
      execution-events.ndjson
      steps/
        step-001/
          prompt.md
          ai-response.md
          changed-files.json
          patch.diff
          validation-log.txt
          validation-result.json
```

The migration workspace itself lives outside this tree:

```
~/LegacyModernizer/workspaces/{project-name}/{session-id}/
```
