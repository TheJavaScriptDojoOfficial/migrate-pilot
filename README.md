# Migrate Pilot

> Local-first AI-human orchestration tool for safely migrating old React projects to modern React + TypeScript.

**Core principle:** _AI executes. Human approves. Git protects._

Migrate Pilot scans an existing React codebase, generates a step-by-step migration plan, creates an isolated Git worktree workspace, executes one migration step at a time, surfaces diffs and validation results for human approval, and commits only after a human says yes. The original project is never touched.

---

## V1 Scope

- **Supported source projects:** React 16 / 17, JS or JSX, CRA / Vite / Webpack, npm / yarn / pnpm, basic Router + Redux/Context.
- **Migration direction:** JavaScript -> TypeScript, JSX -> TSX, gradual typing, deprecated lifecycle fixes.
- **Runtime model:** local-first desktop app. No login, no cloud backend, no telemetry.
- **Safety model:** Git worktree workspace + per-step validation + rollback.

See [`docs/product/v1-scope.md`](docs/product/v1-scope.md) and [`docs/product/v1-limitations.md`](docs/product/v1-limitations.md).

---

## Architecture (V1)

```
React + Vite + TypeScript UI
        v
Tauri secure command layer
        v
Local orchestration engine (Python sidecar)
        v
Git worktree workspace
        v
AI provider adapter (OpenCode CLI)
        v
Validation runner
        v
SQLite state + file artifacts
```

See [`docs/architecture/folder-structure.md`](docs/architecture/folder-structure.md) for the full layout and rationale.

---

## Repository Layout

```
migrate-pilot/
  apps/
    desktop/              # React + Vite + TypeScript + Tauri desktop app
      src/                # UI (routes, features, shared components)
      src-tauri/          # Rust command layer (secure IPC bridge)
  orchestrator/           # Python orchestration engine (sidecar)
    core/                 # Session manager, workflow engine, event bus
    scanner/              # Project / dependency / risk scanners
    git/                  # Worktree, branch, rollback managers
    ai/                   # Provider adapters, prompt builder, cost tracker
    planner/              # Migration plan generator, step builder
    validation/           # Command detector, validation runner
    state/                # SQLite + models
    artifacts/            # Log / diff / artifact writers
  docs/                   # Product + architecture + prompts
  tests/                  # Test placeholders
```

---

## Getting Started (development)

> V1 is **not** yet shippable. This repository currently contains the production-grade scaffold. Business logic will be filled in incrementally.

### Prerequisites

- Node.js >= 20
- npm >= 10 (or pnpm / yarn)
- Rust (stable) + Tauri prerequisites for your OS: <https://tauri.app/start/prerequisites/>
- Python >= 3.11 (for the orchestrator sidecar)

### Install

```bash
# install JS deps for the desktop app
npm install --workspaces

# install Python deps for the orchestrator (optional during scaffold phase)
cd orchestrator && pip install -e .[dev] && cd ..
```

### Run the desktop app (Vite dev only, no Tauri)

```bash
npm run dev -w @migrate-pilot/desktop
```

### Run the desktop app via Tauri

```bash
npm run tauri:dev -w @migrate-pilot/desktop
```

---

## Safety Guarantees

1. The originally selected project is **never** modified by Migrate Pilot. Reads only.
2. All AI-driven edits happen **only** inside a Git worktree workspace.
3. Commands exposed to the UI are **allowlisted**. Arbitrary shell execution is blocked.
4. Sensitive files (`.env*`, keys, secrets) are excluded from AI context by default.
5. Every step requires human approval before commit. Rollback is always available.

See [`docs/architecture/security-principles.md`](docs/architecture/security-principles.md).

---

## License

TBD.
