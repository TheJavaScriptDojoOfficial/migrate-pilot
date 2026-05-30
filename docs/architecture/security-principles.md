# Security Principles

Migrate Pilot is **safe by default**. The following rules are non-negotiable for V1.

## 1. The original project is read-only

- The orchestrator may **read** the selected project path.
- The orchestrator must **never write** to it.
- All edits happen in a derived Git worktree.

## 2. AI executes only inside the workspace

- AI providers receive the **workspace path** as their working directory.
- Providers must refuse to write outside that directory.
- Providers must not delete files unless the step explicitly authorises it.

## 3. Commands exposed to the UI are allowlisted

- The Tauri layer exposes a fixed set of commands defined in
  `apps/desktop/src-tauri/src/lib.rs` (`invoke_handler!`).
- Each command validates its inputs and resolves paths via
  `security::path::resolve_within`.
- The UI **cannot** pass arbitrary shell commands. There is no eval, no shell
  exec, no dynamic command lookup.

## 4. Path validation

- All paths normalised via canonicalisation.
- Symlink escapes are rejected.
- Path traversal (`..`) is rejected.
- Paths must remain under one of the approved roots:
  - The selected project (read-only).
  - The migration workspace (read/write).
  - The local app data directory.

## 5. Secret hygiene

The scanner and prompt builder must exclude the following files from any AI
prompt or log forwarded to a provider:

- `.env`
- `.env.local`
- `.env.production`
- `.env.development`
- `*.pem`
- `*.key`
- `*.p12`
- `*.crt`
- `id_rsa`, `id_ed25519`
- `secrets.*`
- `credentials.*`

Logs and prompts are also passed through a redaction step for inline
key/value secrets before being persisted as artifacts.

## 6. Human approval gates

Approval is required before:

1. Creating a migration workspace.
2. Committing an executed step.
3. Rolling back an existing commit.

No step is auto-committed. No failed step advances the session.

## 7. No cloud, no telemetry, no login

- V1 has no backend.
- V1 has no telemetry.
- V1 requires no account or login.
- All state lives on the user's machine.
