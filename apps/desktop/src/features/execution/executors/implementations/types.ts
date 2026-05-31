/**
 * Shared types for the Phase R6 Step 3 deterministic executors.
 *
 * Each executor in this folder declares its own `params` shape via the
 * `ExecutorRunInput.params` field (which is typed as
 * `Readonly<Record<string, unknown>>`). The interfaces below are the
 * canonical, planner-facing shapes the executors expect to find inside
 * that bag once the planner has resolved the V2 contract for a step.
 *
 * Why these live next to the implementations (not in
 * `migration-plan/types/`):
 *   The planner currently emits the legacy `package-json-dependency-update`
 *   shape (`{ remove: [...], add: [...] }`) for the Rust executor. The
 *   richer V2 shapes below describe what the new V2 executors WILL
 *   accept once the planner is updated to thread the executor framework.
 *   Keeping them here makes the executor-side contract self-contained
 *   and lets the planner adopt them incrementally without coupling.
 *
 * Architectural rules
 * -------------------
 * - Pure types. No React, no Zustand, no IPC imports.
 * - Every shape is read-only — executors must never mutate their
 *   `params` bag.
 * - The `dependencyType` / `action` / etc. unions are kept narrow so a
 *   typo in a planner-emitted action is caught at parse time, not at
 *   the IPC boundary.
 */
import type { WorkspacePackageManager } from '@features/workspace';

/* -------------------------------------------------------------------------- */
/* Package dependency executor (3.2)                                          */
/* -------------------------------------------------------------------------- */

/**
 * Action verbs the generic package-dependency executor recognises.
 *
 *   `add`     Install a previously missing package.
 *   `remove`  Uninstall a package without a replacement.
 *   `upgrade` Bump a declared package to the supplied `targetVersion`.
 *   `replace` Remove the source package and install
 *             `targetPackageName` in the same dependency section.
 */
export type PackageDependencyActionKind = 'add' | 'remove' | 'upgrade' | 'replace';

/**
 * `dependencies` / `devDependencies` are the only sections the
 * deterministic executor will touch. `optionalDependencies` and
 * `peerDependencies` are intentionally excluded — Migrate Pilot v1
 * does not infer peer ranges automatically.
 */
export type PackageDependencyType = 'dependencies' | 'devDependencies';

/**
 * One declarative dependency change resolved from the approved plan
 * step. The executor maps an ordered list of these onto the Rust
 * `package-json-dependency-update` add/remove primitives so the
 * surrounding plan stays declarative.
 */
export interface PackageDependencyAction {
  readonly action: PackageDependencyActionKind;
  readonly packageName: string;
  readonly targetPackageName?: string;
  readonly targetVersion?: string;
  readonly dependencyType: PackageDependencyType;
}

/**
 * `params` schema the `package-dependency-update` executor expects.
 *
 * Optional `packageManager` lets the executor warn when the workspace
 * state declares a different manager from what the action expects
 * (e.g. mixing yarn-only flags into an npm workspace). It is not used
 * to drive package.json edits — those are package-manager agnostic.
 */
export interface PackageDependencyExecutorParams {
  readonly dependencyActions: readonly PackageDependencyAction[];
  readonly packageManager?: WorkspacePackageManager;
}

/* -------------------------------------------------------------------------- */
/* Baseline validation executor (3.1)                                         */
/* -------------------------------------------------------------------------- */

/**
 * `params` schema the `baseline-validation` executor expects.
 *
 * The planner is responsible for picking the right command list per
 * step (build/test/lint/typecheck) from
 * `MigrationPlanStepV2.validationCommands`. The executor never invents
 * commands — if the list is empty, the step is `blocked`.
 */
export interface BaselineValidationExecutorParams {
  readonly validationCommands: readonly string[];
  readonly packageManager?: WorkspacePackageManager;
}

/* -------------------------------------------------------------------------- */
/* React root API codemod executor (3.3)                                      */
/* -------------------------------------------------------------------------- */

/**
 * `params` schema the `react-root-api-codemod` executor expects.
 *
 * `entryFiles` is the planner-detected list of probable application
 * entry files (e.g. `src/index.tsx`). The executor only operates on
 * files in this list — if it is empty the step is reported as
 * `manual-only`.
 */
export interface ReactRootApiCodemodExecutorParams {
  readonly entryFiles?: readonly string[];
}

/* -------------------------------------------------------------------------- */
/* JSX transform preparation executor (3.5)                                   */
/* -------------------------------------------------------------------------- */

/**
 * Build setups the JSX transform executor knows how to reason about.
 *
 * `custom` is the escape hatch for project layouts that mix toolchains
 * (e.g. a custom Babel preset on top of Vite) — the executor refuses
 * to touch configuration in that case and surfaces manual guidance.
 */
export type JsxTransformBuildSetup =
  | 'babel'
  | 'react-scripts'
  | 'vite'
  | 'typescript'
  | 'custom'
  | 'unknown';

/**
 * `params` schema the `jsx-transform-preparation` executor expects.
 */
export interface JsxTransformPreparationExecutorParams {
  readonly buildSetup?: JsxTransformBuildSetup;
  readonly configFiles?: readonly string[];
}

/* -------------------------------------------------------------------------- */
/* AI-Assisted Bounded executor (4.1)                                         */
/* -------------------------------------------------------------------------- */

/**
 * Single bounded file the AI-assisted executor is allowed to look at.
 *
 *   `path`     Workspace-relative path the AI may read or rewrite.
 *              The executor itself enforces that the resolved absolute
 *              path lives under the workspace root — paths that point
 *              outside the workspace are rejected at param-validation
 *              time, not at AI-runtime.
 *   `excerpt`  Optional pre-extracted snippet the planner attached to
 *              the file (so the executor can pass minimal context to
 *              the AI runner without re-reading the file). Keeps the
 *              prompt small and reviewable.
 *   `reason`   Optional human-readable hint the planner used to pick
 *              this file (e.g. "contains ReactDOM.render call"). Used
 *              verbatim in the captured logs / manual review notes.
 */
export interface AiAssistedBoundedRelevantFile {
  readonly path: string;
  readonly excerpt?: string;
  readonly reason?: string;
}

/**
 * `params` schema the `ai-assisted-bounded` executor expects.
 *
 * The bag is deliberately narrow — the executor will refuse to run
 * when `relevantFiles` is empty so the AI can never receive a
 * whole-codebase prompt. `validationCommands` (when present) are
 * emitted into the captured run so the screen can recommend exactly
 * what to re-run after the AI lands its edits; the executor itself
 * does not spawn validation.
 *
 * `additionalContext` is a free-form string the planner can use to
 * tell the AI runner about adjacent constraints (e.g. "prefer hooks",
 * "do not introduce new dependencies") without inventing a new
 * params field per concern.
 *
 * `maxRelevantFiles` is the hard cap the executor enforces on the
 * bounded file list. When the planner emits more files than the cap
 * allows, the executor refuses to run rather than silently truncating
 * — the user must rescope the step.
 */
export interface AiAssistedBoundedExecutorParams {
  readonly relevantFiles: readonly AiAssistedBoundedRelevantFile[];
  readonly validationCommands?: readonly string[];
  readonly additionalContext?: string;
  readonly maxRelevantFiles?: number;
}

/* -------------------------------------------------------------------------- */
/* Manual Instruction executor (4.2)                                          */
/* -------------------------------------------------------------------------- */

/**
 * One ordered instruction the manual executor surfaces to the user.
 *
 *   `description` Required, human-readable action the user must
 *                 perform. The executor never edits files itself.
 *   `file`        Optional workspace-relative file pointer to focus
 *                 the user's attention.
 *   `command`     Optional shell command suggested for this
 *                 instruction (e.g. an `npm install` invocation the
 *                 user runs manually after reading the rationale).
 *   `references`  Optional documentation links / scan issue codes
 *                 the user can consult for more context.
 */
export interface ManualInstructionStep {
  readonly description: string;
  readonly file?: string;
  readonly command?: string;
  readonly references?: readonly string[];
}

/**
 * `params` schema the `manual-instruction` executor expects.
 *
 * The executor exists so plan steps that intentionally require human
 * judgement still flow through the V2 dispatcher — the run captures
 * the documented instructions, reference links, and (optional)
 * post-step validation hints in a normalised
 * {@link ExecutionStepRun}. No files are modified; the captured run
 * acts as a checklist the user is expected to follow outside Migrate
 * Pilot.
 *
 * `summary` is shown as the first `info` log so the captured run has
 * a single-line headline. `instructions` is the ordered checklist.
 * `validationRecommendation` (when present) is logged as a
 * `success` line so the screen can suggest what to re-run after the
 * user finishes the manual work.
 */
export interface ManualInstructionExecutorParams {
  readonly summary?: string;
  readonly instructions: readonly ManualInstructionStep[];
  readonly validationRecommendation?: string;
  readonly references?: readonly string[];
}
