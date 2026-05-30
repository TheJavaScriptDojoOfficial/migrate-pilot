# Migrate Pilot V1 - Scope

## Goal

Migrate Pilot V1 is a **local-first AI-human orchestration tool** that helps engineers migrate **old React projects** to **modern React + TypeScript**, one safe step at a time.

V1 does **not** attempt a fully automatic rewrite. It reduces manual migration effort by:

- Scanning the existing React project (read-only).
- Detecting migration risks.
- Generating a step-by-step migration plan.
- Creating an isolated Git worktree workspace.
- Executing one migration step at a time via an AI provider.
- Showing diffs and validation results before approval.
- Allowing rollback when a step fails.

**Core principle:** _AI executes. Human approves. Git protects._

## Supported Source Projects

- React 16 and React 17.
- JavaScript / JSX (no TypeScript required as input).
- CRA, Vite, or Webpack-based builds.
- npm, yarn, or pnpm.
- Single frontend repository (no monorepos).
- Basic React Router usage.
- Class components, functional components, and PropTypes.
- Basic Redux or Context state management.

## Migration Direction

- JavaScript -> TypeScript.
- JSX -> TSX.
- Add TypeScript configuration.
- Gradual typing of utilities and components.
- Fix deprecated lifecycle methods where possible.
- Modernise selected React patterns where the change is small and safe.
- Run validation after every step.

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

- Scan a real React 16/17 JS project safely.
- Produce a useful migration report and plan.
- Create a workspace, execute small steps, and validate them.
- Surface diffs and validation results for human approval.
- Roll back failed steps and never touch the original repo.
- Persist full session history and produce a final summary.
