/**
 * Executor registry — Milestone 6.5 (generic execution framework).
 *
 * Single source of truth for which generic executors exist, which mode
 * they belong to, and whether they are *currently* implemented end-to-end
 * (TS planner + Rust scripted executor + UI presentation).
 *
 * Architectural rules
 * -------------------
 * - The execution engine NEVER decides executability from a plan step id.
 *   It always goes through this registry, looking up the
 *   `MigrationStepExecution.executorKey` declared on the step.
 * - Adding a new executor is a 3-step change:
 *     1. Register an entry here with `supported: false` first.
 *     2. Implement the Rust dispatch + safety checks for it.
 *     3. Flip `supported: true` once the executor is reviewed.
 * - The registry is intentionally *static and small*. Do not add fake
 *   support — every entry must accurately reflect what ships today.
 *
 * Future-ready examples
 * ---------------------
 * The registry below already declares the future executor keys we plan
 * to add. They are marked `supported: false` so the UI surfaces an
 * honest "not available yet" badge instead of pretending they will run.
 */
import type { MigrationStepExecutionMode } from '@features/migration-plan';

/* -------------------------------------------------------------------------- */
/* Executor registry                                                          */
/* -------------------------------------------------------------------------- */

export interface ExecutorRegistryEntry {
  /** Stable, kebab-case identifier referenced by plan steps. */
  readonly key: string;
  /** Short human label rendered in the executable badge. */
  readonly label: string;
  /** Execution mode the executor satisfies. */
  readonly mode: MigrationStepExecutionMode;
  /** True when the Rust dispatch + safety checks ship today. */
  readonly supported: boolean;
  /** One-line description used in tooltips / capability cards. */
  readonly description: string;
}

/**
 * Registry keyed by `executorKey`. The keys are part of the wire contract
 * with Rust — keep them in sync with `EXECUTOR_KEY_*` constants in
 * `src-tauri/src/commands/execution.rs`.
 */
export const EXECUTOR_REGISTRY: Readonly<
  Record<string, ExecutorRegistryEntry>
> = Object.freeze({
  'package-json-dependency-update': {
    key: 'package-json-dependency-update',
    label: 'Package dependency update',
    mode: 'scripted',
    supported: true,
    description:
      'Generic executor that mutates workspace/package.json: removes packages from dependency sections and/or adds new packages with optional version constraints. Never modifies lock files, never runs install, never spawns shell commands.',
  },
  // The following entries are future-ready scaffolding. They MUST stay
  // `supported: false` until both the planner attaches their params and
  // the Rust executor is implemented and reviewed.
  'tsconfig-update': {
    key: 'tsconfig-update',
    label: 'tsconfig.json update',
    mode: 'scripted',
    supported: false,
    description:
      'Future executor: deterministic edits to tsconfig.json (compiler options, paths, include/exclude). Not implemented yet.',
  },
  'file-create-or-update': {
    key: 'file-create-or-update',
    label: 'File create or update',
    mode: 'scripted',
    supported: false,
    description:
      'Future executor: write a known-safe file template into the workspace (e.g. a default tsconfig). Not implemented yet.',
  },
  'codemod-react-class-to-function': {
    key: 'codemod-react-class-to-function',
    label: 'React class → function codemod',
    mode: 'scripted',
    supported: false,
    description:
      'Future executor: AST-level codemod that converts React class components to function components. Not implemented yet.',
  },
  'react-router-modernization': {
    key: 'react-router-modernization',
    label: 'React Router modernization',
    mode: 'scripted',
    supported: false,
    description:
      'Future executor: bulk migration helpers for react-router upgrades. Not implemented yet.',
  },
  'ai-source-transform': {
    key: 'ai-source-transform',
    label: 'AI source transform',
    mode: 'ai',
    supported: false,
    description:
      'Future executor: AI-assisted source transformation. Disabled by safety policy until the AI execution flow lands in a later milestone.',
  },
  'manual-review': {
    key: 'manual-review',
    label: 'Manual review',
    mode: 'manual',
    supported: false,
    description:
      'Manual reviewer-only step. Migrate Pilot does not run anything; the user inspects and accepts.',
  },
});

/* -------------------------------------------------------------------------- */
/* Lookup helpers                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Look up a registry entry by executor key. Returns `undefined` for keys
 * that have never been declared — those should always be surfaced as
 * "Unsupported executor" in the UI.
 */
export function getExecutorEntry(
  executorKey: string | undefined,
): ExecutorRegistryEntry | undefined {
  if (executorKey === undefined) return undefined;
  return EXECUTOR_REGISTRY[executorKey];
}

/** True iff the executor key is declared *and* shipped end-to-end today. */
export function isExecutorSupported(executorKey: string | undefined): boolean {
  const entry = getExecutorEntry(executorKey);
  return entry !== undefined && entry.supported;
}

/**
 * The list of executor keys that are supported in this build. Used by
 * the screen to render a short "currently supported" hint.
 */
export function listSupportedExecutorKeys(): readonly string[] {
  return Object.values(EXECUTOR_REGISTRY)
    .filter((e) => e.supported)
    .map((e) => e.key);
}
