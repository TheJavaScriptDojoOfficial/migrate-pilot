/**
 * Executor Registry V2 — context builder (Phase R6 Step 2).
 *
 * Centralises the boilerplate of building an {@link ExecutorContext}
 * from a plan step plus workspace metadata. The resolver and any
 * caller dispatching an executor share the same context shape; this
 * service keeps the field-by-field mapping (phase, track, issue
 * codes, execution type, mode, params, …) in one place.
 *
 * Why this lives next to the registry:
 *   The context contract is owned by the executor framework. Putting
 *   the builder here keeps the planner-side fields (`step.executionType`,
 *   `step.execution`) and the executor-side fields (`mode`, `params`)
 *   adapted in one place — callers never have to know how to bridge
 *   between the planner's richer taxonomy and the execution engine's
 *   coarser one.
 *
 * Architectural rules
 * -------------------
 * - Pure data shaping. No IPC, no fs.
 * - Defaults are conservative: when the step has no execution
 *   metadata yet, the builder derives `mode` from `executionType` via
 *   {@link mapMigrationPlanStepExecutionTypeToMode}, and uses an
 *   empty `executorKey` to signal "no key declared yet". The resolver
 *   patches the executor key after it picks a match — see
 *   {@link resolveExecutorForStep}.
 */
import {
  mapMigrationPlanStepExecutionTypeToMode,
  resolveMigrationPlanStepExecutorAvailability,
  type MigrationPlanStepV2,
  type MigrationStepExecutionMode,
} from '@features/migration-plan';

import type {
  ExecutorContext,
  ExecutorDefinition,
  ExecutorResolutionResult,
  ExecutorResolutionSummary,
} from './executor.types';
import { getExecutorByKey } from './executorRegistry';

/* -------------------------------------------------------------------------- */
/* Context builder                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Input for {@link buildExecutorContext}.
 *
 * `resolvedExecutorKey` is provided by the resolver after it picks an
 * executor (so the dispatched context carries the matched key, not
 * the step's declared one). Callers that build a context BEFORE
 * resolution can omit this field — the resolver re-patches the key
 * before calling `canRun` / `run`.
 */
export interface BuildExecutorContextInput {
  readonly step: MigrationPlanStepV2;
  readonly planId: string;
  readonly workspacePath: string;
  readonly sourcePath: string;
  readonly resolvedExecutorKey?: string;
}

/**
 * Build a typed {@link ExecutorContext} from a plan step and the
 * surrounding workspace metadata.
 *
 * The returned context is safe to pass to both
 * `executor.canRun(context)` and (with the run-id/started-at fields
 * added) `executor.run(input)`.
 */
export function buildExecutorContext(
  input: BuildExecutorContextInput,
): ExecutorContext {
  const { step, planId, workspacePath, sourcePath } = input;

  const executorKey =
    input.resolvedExecutorKey ?? step.executorKey ?? '';

  const mode: MigrationStepExecutionMode =
    step.execution?.mode ??
    mapMigrationPlanStepExecutionTypeToMode(step.executionType);

  const params = step.execution?.params;

  return {
    workspacePath,
    sourcePath,
    planId,
    planStepId: step.id,
    stepTitle: step.title,
    phase: step.phase,
    track: step.track,
    issueCodes: step.issueCodes,
    executorKey,
    executionType: step.executionType,
    mode,
    ...(params !== undefined ? { params } : {}),
  };
}

/* -------------------------------------------------------------------------- */
/* Screen-facing summary                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Build the flat {@link ExecutorResolutionSummary} the execution
 * screen renders for a step.
 *
 * Resolution priority for `executorKey` / `executorLabel`:
 *   1. The resolver-matched executor (when present in `result`).
 *   2. The step's own declared `executorKey` (if any), looked up in
 *      the registry so the screen can render the executor's label
 *      even when the resolver returned `future-support` (e.g. the key
 *      is declared but no implementation is registered).
 *
 * The summary intentionally avoids exposing the {@link ExecutorDefinition}
 * reference itself — the screen should depend on this flat view, not
 * the executor's `canRun`/`run` callbacks.
 */
export function summarizeStepResolution(
  step: MigrationPlanStepV2,
  result: ExecutorResolutionResult,
): ExecutorResolutionSummary {
  const matchedExecutor: ExecutorDefinition | undefined =
    result.executor ?? getExecutorByKey(step.executorKey);

  const executorKey =
    result.executor?.key ?? result.executorKey ?? step.executorKey;

  const reason = result.capability.reason;
  const warnings = result.capability.warnings;

  return {
    planStepId: step.id,
    phase: step.phase,
    track: step.track,
    issueCodes: step.issueCodes,
    ...(executorKey !== undefined ? { executorKey } : {}),
    ...(matchedExecutor !== undefined
      ? { executorLabel: matchedExecutor.label }
      : {}),
    capabilityStatus: result.capability.status,
    ...(reason !== undefined ? { capabilityReason: reason } : {}),
    ...(warnings !== undefined && warnings.length > 0
      ? { capabilityWarnings: warnings }
      : {}),
  };
}

/**
 * Build a summary directly from a plan step, falling back to the
 * planner-time availability persisted on the step when no
 * {@link ExecutorResolutionResult} is available (e.g. the screen is
 * rendering a step before the resolver has run against the current
 * workspace).
 *
 * This is the helper the execution screen should use as its default
 * "what to render for this step" data source — it transparently uses
 * the resolver result when available, and the persisted availability
 * otherwise.
 */
export function summarizeStepResolutionWithFallback(
  step: MigrationPlanStepV2,
  result: ExecutorResolutionResult | undefined,
): ExecutorResolutionSummary {
  if (result !== undefined) {
    return summarizeStepResolution(step, result);
  }
  const fallback = resolveMigrationPlanStepExecutorAvailability(step);
  const matchedExecutor: ExecutorDefinition | undefined = getExecutorByKey(
    step.executorKey,
  );
  return {
    planStepId: step.id,
    phase: step.phase,
    track: step.track,
    issueCodes: step.issueCodes,
    ...(step.executorKey !== undefined ? { executorKey: step.executorKey } : {}),
    ...(matchedExecutor !== undefined
      ? { executorLabel: matchedExecutor.label }
      : {}),
    capabilityStatus: fallback.status,
    ...(fallback.reason !== undefined
      ? { capabilityReason: fallback.reason }
      : {}),
    ...(fallback.warnings !== undefined && fallback.warnings.length > 0
      ? { capabilityWarnings: fallback.warnings }
      : {}),
  };
}
