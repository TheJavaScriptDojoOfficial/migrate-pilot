/**
 * Executor Registry V2 — bundled executor registration entry point.
 *
 * Registers every executor implementation shipped under
 * `executors/implementations/` in two clearly separated groups:
 *
 *   1. Deterministic executors (Phase R6 Step 3)
 *      Safe, scoped, file-changing executors backed by deterministic
 *      logic (validation capture, package.json edits, codemod plans,
 *      JSX-transform alignment).
 *
 *        - `baseline-validation`
 *        - `package-dependency-update`
 *        - `react-root-api-codemod`
 *        - `react-deprecated-api-fix`
 *        - `jsx-transform-preparation`
 *
 *   2. Bounded / manual executors (Phase R6 Step 4)
 *      Executors for steps where deterministic execution is unsafe.
 *      Both are registered in the V2 registry so the dispatcher can
 *      treat them like any other executor, while their `run` keeps
 *      the AI tightly scoped or surfaces a human-only checklist.
 *
 *        - `ai-assisted-bounded`   — bounded AI prompt; never
 *                                    auto-commits; workspace-only;
 *                                    captured run records the exact
 *                                    prompt contract and the bounded
 *                                    file list.
 *        - `manual-instruction`    — instructions-only executor for
 *                                    steps that must be performed by
 *                                    the human author.
 *
 * Why a single registration helper:
 *   - Tests and HMR can call {@link registerBundledExecutors} once
 *     to seed the V2 registry without reaching into individual
 *     files.
 *   - Resolver tiebreakers depend on insertion order; this file
 *     pins the canonical order in one place.
 *   - The bundled list (and the deterministic / bounded
 *     sub-lists) are exported so developer-mode UI / unit tests can
 *     enumerate executors without going through the registry.
 *
 * Architectural rules
 * -------------------
 * - No React, no Zustand, no IPC reads. The registration helpers are
 *   pure functions over the executor registry.
 * - The helpers are idempotent — re-registering an executor with the
 *   same key replaces the prior definition (HMR / test resets stay
 *   safe).
 */
import { registerExecutor } from '../executorRegistry';
import type { ExecutorDefinition } from '../executor.types';

import {
  AI_ASSISTED_BOUNDED_EXECUTOR_KEY,
  AI_ASSISTED_BOUNDED_PROMPT_CONTRACT,
  DEFAULT_MAX_RELEVANT_FILES,
  aiAssistedBoundedExecutor,
} from './aiAssistedBoundedExecutor';
import {
  BASELINE_VALIDATION_EXECUTOR_KEY,
  baselineValidationExecutor,
} from './baselineValidationExecutor';
import {
  JSX_TRANSFORM_PREPARATION_EXECUTOR_KEY,
  jsxTransformPreparationExecutor,
} from './jsxTransformPreparationExecutor';
import {
  MANUAL_INSTRUCTION_EXECUTOR_KEY,
  manualInstructionExecutor,
} from './manualInstructionExecutor';
import {
  PACKAGE_DEPENDENCY_UPDATE_EXECUTOR_KEY,
  packageDependencyExecutor,
} from './packageDependencyExecutor';
import {
  REACT_DEPRECATED_API_FIX_EXECUTOR_KEY,
  reactDeprecatedApiFixExecutor,
} from './reactDeprecatedApiFixExecutor';
import {
  REACT_ROOT_API_CODEMOD_EXECUTOR_KEY,
  reactRootApiCodemodExecutor,
} from './reactRootApiCodemodExecutor';

/* -------------------------------------------------------------------------- */
/* Public re-exports                                                          */
/* -------------------------------------------------------------------------- */

export {
  AI_ASSISTED_BOUNDED_EXECUTOR_KEY,
  AI_ASSISTED_BOUNDED_PROMPT_CONTRACT,
  BASELINE_VALIDATION_EXECUTOR_KEY,
  DEFAULT_MAX_RELEVANT_FILES,
  JSX_TRANSFORM_PREPARATION_EXECUTOR_KEY,
  MANUAL_INSTRUCTION_EXECUTOR_KEY,
  PACKAGE_DEPENDENCY_UPDATE_EXECUTOR_KEY,
  REACT_DEPRECATED_API_FIX_EXECUTOR_KEY,
  REACT_ROOT_API_CODEMOD_EXECUTOR_KEY,
  aiAssistedBoundedExecutor,
  baselineValidationExecutor,
  jsxTransformPreparationExecutor,
  manualInstructionExecutor,
  packageDependencyExecutor,
  reactDeprecatedApiFixExecutor,
  reactRootApiCodemodExecutor,
};

export type {
  AiAssistedBoundedExecutorParams,
  AiAssistedBoundedRelevantFile,
  BaselineValidationExecutorParams,
  JsxTransformBuildSetup,
  JsxTransformPreparationExecutorParams,
  ManualInstructionExecutorParams,
  ManualInstructionStep,
  PackageDependencyAction,
  PackageDependencyActionKind,
  PackageDependencyExecutorParams,
  PackageDependencyType,
  ReactRootApiCodemodExecutorParams,
} from './types';

/* -------------------------------------------------------------------------- */
/* Registration                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Ordered list of every deterministic executor delivered by Phase R6
 * Step 3. Exposed for tests and developer-mode UI that want to
 * enumerate the deterministic bundle without going through the
 * registry.
 *
 * Order mirrors the typical Phase R6 plan execution order
 * (validation → dependency → codemod → deprecated API → JSX
 * transform). The resolver picks the first match for a step, and
 * since each deterministic executor declares non-overlapping
 * `supportedIssueCodes` / `supportedPhases`, order is informational
 * rather than a tiebreaker.
 */
export const DETERMINISTIC_EXECUTORS: readonly ExecutorDefinition[] = [
  baselineValidationExecutor,
  packageDependencyExecutor,
  reactRootApiCodemodExecutor,
  reactDeprecatedApiFixExecutor,
  jsxTransformPreparationExecutor,
];

/**
 * Ordered list of the bounded / manual executors delivered by Phase
 * R6 Step 4.
 *
 * These executors are intentionally selected ONLY by explicit
 * `step.executorKey` — their `supportedPhases` / `supportedTracks`
 * / `supportedIssueCodes` are all empty, so axis-matching is a
 * no-op. The order below is therefore informational: registering
 * `manual-instruction` before `ai-assisted-bounded` mirrors the
 * "prefer manual over AI when ambiguous" policy, but the resolver
 * never falls through to either of them without an explicit
 * `executorKey` on the step.
 */
export const BOUNDED_EXECUTORS: readonly ExecutorDefinition[] = [
  manualInstructionExecutor,
  aiAssistedBoundedExecutor,
];

/**
 * Every executor implementation bundled with the V2 framework.
 * Deterministic executors come first so axis-resolved matches always
 * prefer them; the bounded / manual executors are registered after
 * and are only ever selected via an explicit `step.executorKey`.
 */
export const BUNDLED_EXECUTORS: readonly ExecutorDefinition[] = [
  ...DETERMINISTIC_EXECUTORS,
  ...BOUNDED_EXECUTORS,
];

/**
 * Register every deterministic executor in the V2 registry.
 * Idempotent by design: callers can invoke this on every app boot /
 * HMR refresh without worrying about duplicate-key errors.
 */
export function registerDeterministicExecutors(): void {
  for (const executor of DETERMINISTIC_EXECUTORS) {
    registerExecutor(executor);
  }
}

/**
 * Register the Phase R6 Step 4 bounded / manual executors in the V2
 * registry. Idempotent for the same reasons as
 * {@link registerDeterministicExecutors}.
 */
export function registerBoundedExecutors(): void {
  for (const executor of BOUNDED_EXECUTORS) {
    registerExecutor(executor);
  }
}

/**
 * Register every bundled executor (deterministic + bounded / manual)
 * in the V2 registry. This is the entry point feature code (e.g. the
 * execution barrel) should call on import — the per-group helpers
 * stay exposed for tests that want to seed a narrower subset.
 */
export function registerBundledExecutors(): void {
  for (const executor of BUNDLED_EXECUTORS) {
    registerExecutor(executor);
  }
}
