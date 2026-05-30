# Migrate Pilot V1 - Scope

## Goal

Migrate Pilot V1 is a **local-first AI-human orchestration tool** that helps engineers **migrate React 16, React 17, and React 18 projects to React 19**, one safe step at a time.

- **Source:** React 16, React 17, React 18.
- **Target:** React 19.
- **Method:** staged migration, safe Git worktree workspace, human-reviewed diffs, validation gates.

V1 does **not** attempt a fully automatic rewrite. It reduces manual React 19 migration effort by:

- Running a React 19 compatibility scan on the existing project (read-only).
- Detecting React 19 migration risks and the source React major (16 / 17 / 18).
- Generating a React-major-aware, phase-based React 19 migration plan.
- Creating an isolated Git worktree workspace.
- Executing one React 19 migration step at a time via an AI provider or a scripted executor.
- Showing diffs and validation results before approval.
- Allowing rollback when a step fails.

**Core principle:** _AI executes. Human approves. Git protects._

## Supported Source Projects

- React 16, React 17, and React 18 projects.
- JavaScript / JSX or TypeScript / TSX source.
- CRA, Vite, or Webpack-based builds.
- npm, yarn, or pnpm.
- Single frontend repository (no monorepos).
- Basic React Router usage.
- Class components, functional components, and PropTypes.
- Basic Redux or Context state management.

## React 19 Migration Tracks

Each supported source major maps to a dedicated migration track:

- `react-16-to-19` — React 16 → React 18 bridge → React 19.
- `react-17-to-19` — React 17 → React 18 bridge → React 19.
- `react-18-to-19` — React 18 → React 19 directly.

## React 19 Migration Phases

- **preflight** — environment + version checks.
- **tooling** — build tool, TypeScript, ESLint, test runner upgrades.
- **react-18-bridge** — `createRoot`, new JSX transform (React 16/17 sources only).
- **api-compatibility** — `ReactDOM.render`, `findDOMNode`, string refs, legacy context, deprecated lifecycles, `propTypes` / `defaultProps`.
- **jsx-transform** — `tsconfig` / Babel / Vite alignment for React 19.
- **react-19-upgrade** — upgrade `react`, `react-dom`, and types to React 19.
- **source-modernization** — small, safe modernization patterns (hooks, ref-as-prop).
- **validation** — lint, typecheck, tests, build.
- **final-review** — generate the React 19 migration summary.

## Runtime Model

- Desktop app (Tauri shell, React + Vite + TypeScript UI).
- Python orchestrator sidecar.
- SQLite for state, files for artifacts (logs, diffs, prompts).
- One AI provider in V1: OpenCode CLI. Manual prompt export as fallback.

## Safety Model

- Original project is read-only.
- All AI edits happen inside a Git worktree.
- Per-step validation + commit + rollback.
- Sensitive files (`.env*`, keys) excluded from AI prompts.
- Commands exposed to the UI are allowlisted; arbitrary shell execution is blocked.

## Success Criteria

V1 ships if it can:

- Run the React 19 compatibility scan on a real React 16, React 17, or React 18 project safely.
- Produce a useful React 19 readiness report and React 19 migration plan (track + phases).
- Create a workspace, execute small React 19 steps, and validate them.
- Surface diffs and validation results for human approval.
- Roll back failed steps and never touch the original repo.
- Persist full session history and produce a React 19 migration summary.
