/**
 * Run-step enablement resolver (Phase R6 Step 5).
 *
 * Single source of truth for "can the user click Run on the currently
 * selected plan step right now?". The execution screen consults this
 * resolver instead of stitching together its own ad-hoc booleans, so
 * the Run button is NEVER silently disabled — every blocked state is
 * traced back to an exact, user-facing reason.
 *
 * Resolution contract
 * -------------------
 *
 * `canRunSelectedStep` walks the following checks in order. The first
 * failing check produces the `reasons` array and short-circuits the
 * remaining checks so the UI surfaces the most actionable blocker:
 *
 *   1. Plan is approved.
 *   2. Workspace exists.
 *   3. Workspace path is valid (delegated to
 *      {@link validateWorkspaceState}).
 *   4. A step is selected.
 *   5. The selected step is not already completed.
 *   6. No other step is currently running.
 *   7. Every preceding step in the plan is either completed or
 *      explicitly skipped (manual-only steps are skipped implicitly so
 *      they never block downstream automation).
 *   8. The selected step declares a non-empty `executorKey`
 *      (manual-only steps short-circuit here with a `manual-only`
 *      guidance result instead of a hard error).
 *   9. The executor is registered in the V2 registry.
 *  10. The executor's `canRun(context)` probe reports an `available`
 *      capability — anything else is mapped to a precise reason
 *      (`unavailable`, `blocked`, `manual-only`, `future-support`).
 *
 * Result shape
 * ------------
 *
 *   - `enabled` is the boolean the Run button consumes.
 *   - `reasons` is always populated when `enabled === false` — never
 *     empty. The UI may render the first reason verbatim and surface
 *     the rest as supporting detail.
 *   - `guidance` is set for the two "intentionally not runnable" cases
 *     so the screen can render alternative copy (manual checklist /
 *     future-support explanation) instead of pretending the step is
 *     about to run.
 *   - `resolution` is the underlying V2 resolver result when a probe
 *     was actually performed (executor matched + canRun invoked) so
 *     callers can reuse the matched executor reference without doing
 *     a second registry lookup.
 *
 * Architectural rules
 * -------------------
 * - Pure logic. No React, no Zustand, no IPC reads.
 * - Always returns a typed {@link RunStepEnablement}; the resolver
 *   NEVER throws, so callers don't need defensive try/catch around it.
 * - The executor registry is injected (default: the V2 in-memory
 *   registry) so the resolver is trivially testable in isolation.
 */
import {
  isManualOnlyPlanStepExecutionType,
  type ExecutorAvailability,
  type MigrationPlan,
  type MigrationPlanStepV2,
} from '@features/migration-plan';
import {
  validateWorkspaceState,
  type WorkspaceState,
} from '@features/workspace';

import { buildExecutorContext } from '../executors/executorContextService';
import {
  getExecutorByKey as defaultGetExecutorByKey,
  isExecutorRegistered as defaultIsExecutorRegistered,
} from '../executors/executorRegistry';
import type {
  ExecutorContext,
  ExecutorDefinition,
  ExecutorResolutionResult,
} from '../executors/executor.types';

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Pluggable executor-registry surface the resolver depends on.
 *
 * Production callers pass the V2 registry implementation; tests can
 * pass an in-memory stub without touching the module-level registry
 * (and without races between parallel test cases).
 */
export interface ExecutorRegistryAdapter {
  readonly getExecutorByKey: (key: string | undefined) => ExecutorDefinition | undefined;
  readonly isExecutorRegistered?: (key: string | undefined) => boolean;
}

/**
 * Result kind for {@link RunStepEnablement.guidance}.
 *
 *   `manual-only`     The step is intentionally manual — the screen
 *                     should render the checklist / instructions
 *                     surface instead of an executable Run flow.
 *   `future-support`  The executor is declared on the step but not
 *                     supported in this build (either unregistered or
 *                     the matched executor reported `future-support`).
 */
export type RunStepGuidanceKind = 'manual-only' | 'future-support';

export interface RunStepGuidance {
  readonly kind: RunStepGuidanceKind;
  readonly message: string;
}

/**
 * Resolver result consumed by the execution screen and tests.
 *
 * `reasons` is intentionally typed as `readonly string[]` (not
 * `string | undefined`) so the screen never has to special-case the
 * "no reason at all" path — when `enabled === true`, `reasons` is the
 * empty array.
 */
export interface RunStepEnablement {
  readonly enabled: boolean;
  readonly reasons: readonly string[];
  readonly guidance?: RunStepGuidance;
  readonly resolution?: ExecutorResolutionResult;
}

/**
 * Input for {@link canRunSelectedStep}.
 *
 * `completedSteps` / `skippedSteps` are `ReadonlySet<string>` so the
 * resolver does O(1) membership checks without re-importing array
 * helpers. The screen builds them from the execution engine's per-step
 * status map (`completed`/`skipped`).
 */
export interface CanRunSelectedStepInput {
  readonly approvedPlan: MigrationPlan | undefined;
  readonly isPlanApproved: boolean;
  readonly workspaceState: WorkspaceState | undefined;
  readonly selectedStep: MigrationPlanStepV2 | undefined;
  readonly executorRegistry?: ExecutorRegistryAdapter;
  readonly runningStepId?: string;
  readonly completedSteps: ReadonlySet<string>;
  readonly skippedSteps: ReadonlySet<string>;
}

/* -------------------------------------------------------------------------- */
/* Resolver                                                                   */
/* -------------------------------------------------------------------------- */

const DEFAULT_REGISTRY: ExecutorRegistryAdapter = {
  getExecutorByKey: defaultGetExecutorByKey,
  isExecutorRegistered: defaultIsExecutorRegistered,
};

export function canRunSelectedStep(
  input: CanRunSelectedStepInput,
): RunStepEnablement {
  const registry = input.executorRegistry ?? DEFAULT_REGISTRY;

  // 1. Plan approved.
  if (!input.isPlanApproved || input.approvedPlan === undefined) {
    return disabled(
      'Run step disabled because the migration plan has not been approved yet.',
    );
  }

  // 2. Workspace exists.
  if (input.workspaceState === undefined) {
    return disabled(
      'Run step disabled because no migration workspace has been created yet.',
    );
  }

  // 3. Workspace path is valid.
  const workspaceValidation = validateWorkspaceState(
    input.workspaceState,
    input.approvedPlan.id,
  );
  if (!workspaceValidation.valid) {
    const detail =
      workspaceValidation.reasons.length > 0
        ? ` (${workspaceValidation.reasons.join('; ')})`
        : '';
    return disabled(
      `Run step disabled because the migration workspace is not valid${detail}.`,
    );
  }

  // 4. A step is selected.
  if (input.selectedStep === undefined) {
    return disabled(
      'Run step disabled because no plan step is currently selected.',
    );
  }
  const step = input.selectedStep;

  // 5. Selected step is not already completed.
  if (input.completedSteps.has(step.id)) {
    return disabled(
      `Run step disabled because "${step.title}" is already completed. Reset the step to re-run it.`,
    );
  }

  // 6. No other step is currently running.
  if (
    input.runningStepId !== undefined &&
    input.runningStepId !== step.id
  ) {
    return disabled(
      `Run step disabled because another step is currently running (${input.runningStepId}). Wait for it to finish or reset execution first.`,
    );
  }

  // 7. Required previous steps are completed or skipped.
  const blocker = findBlockingPriorStep(
    input.approvedPlan.steps,
    step,
    input.completedSteps,
    input.skippedSteps,
  );
  if (blocker !== undefined) {
    return disabled(
      `Run step disabled because the required previous "${blocker.title}" step is not completed.`,
    );
  }

  // 8. Selected step has a valid executor key.
  const declaredKey = step.executorKey;
  if (declaredKey === undefined || declaredKey.trim().length === 0) {
    if (isManualOnlyPlanStepExecutionType(step.executionType)) {
      const message =
        'This step is intentionally manual. Migrate Pilot will not edit any files — work through the planner-provided guidance and mark the step complete when you are done.';
      return {
        enabled: false,
        reasons: ['Run step disabled because this step is manual-only.'],
        guidance: { kind: 'manual-only', message },
      };
    }
    return disabled(
      `Run step disabled because the selected step does not declare an executor key (executionType: ${step.executionType}).`,
    );
  }

  // 9. Executor is registered.
  const executor = registry.getExecutorByKey(declaredKey);
  if (executor === undefined) {
    const message = `Executor "${declaredKey}" is not registered yet. It is declared on the plan step but no implementation ships in this build.`;
    return {
      enabled: false,
      reasons: [
        `Run step disabled because executor ${declaredKey} is not registered yet.`,
      ],
      guidance: { kind: 'future-support', message },
    };
  }

  // 10. Executor capability is available — probe the matched executor
  //     directly via the injected registry so callers (production +
  //     tests) get consistent behaviour regardless of which registry
  //     instance is wired in.
  const context = buildExecutorContext({
    step,
    planId: input.approvedPlan.id,
    workspacePath: input.workspaceState.workspacePath,
    sourcePath: input.workspaceState.originalProjectPath,
    resolvedExecutorKey: executor.key,
  });
  const capability = probeCanRun(executor, context);
  const resolution: ExecutorResolutionResult = {
    executorKey: executor.key,
    executor,
    capability,
  };

  switch (capability.status) {
    case 'available':
      return { enabled: true, reasons: [], resolution };
    case 'manual-only': {
      const reasonCopy =
        capability.reason ??
        'This step is intentionally manual. Migrate Pilot will not edit any files.';
      return {
        enabled: false,
        reasons: ['Run step disabled because this step is manual-only.'],
        guidance: { kind: 'manual-only', message: reasonCopy },
        resolution,
      };
    }
    case 'future-support': {
      const reasonCopy =
        capability.reason ??
        `Executor "${executor.key}" is declared but not supported in this build yet.`;
      return {
        enabled: false,
        reasons: [
          `Run step disabled because executor ${executor.key} is not registered yet.`,
        ],
        guidance: { kind: 'future-support', message: reasonCopy },
        resolution,
      };
    }
    case 'blocked':
      return {
        enabled: false,
        reasons: [
          `Run step disabled because ${capability.reason ?? 'a hard precondition is blocking this step.'}`,
        ],
        resolution,
      };
    case 'unavailable':
      return {
        enabled: false,
        reasons: [
          `Run step disabled because ${
            capability.reason ??
            `executor "${executor.key}" is not available against the current workspace right now.`
          }`,
        ],
        resolution,
      };
  }
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Find the first plan step that comes before `selected` (in the
 * canonical plan order) that has neither completed nor been skipped.
 *
 * Manual-only steps are treated as "implicitly skipped" so they never
 * block downstream automation — they require human action that is
 * tracked outside the execution engine, and we don't want a forgotten
 * manual step to permanently lock the rest of the plan.
 *
 * The comparison uses `MigrationPlanStepV2.order`; falls back to
 * positional index for plans whose `order` is non-monotonic.
 */
function findBlockingPriorStep(
  allSteps: readonly MigrationPlanStepV2[],
  selected: MigrationPlanStepV2,
  completedSteps: ReadonlySet<string>,
  skippedSteps: ReadonlySet<string>,
): MigrationPlanStepV2 | undefined {
  const selectedIndex = allSteps.findIndex((s) => s.id === selected.id);
  if (selectedIndex < 0) return undefined;

  for (let i = 0; i < selectedIndex; i += 1) {
    const prior = allSteps[i] as MigrationPlanStepV2;
    if (prior.id === selected.id) continue;
    if (completedSteps.has(prior.id)) continue;
    if (skippedSteps.has(prior.id)) continue;
    // Manual-only steps act as implicit checkpoints, not hard blockers.
    if (isManualOnlyPlanStepExecutionType(prior.executionType)) continue;
    return prior;
  }
  return undefined;
}

function disabled(reason: string): RunStepEnablement {
  return { enabled: false, reasons: [reason] };
}

/**
 * Invoke `executor.canRun(context)` defensively. Mirrors the same
 * "synchronous throw → unavailable" contract the V2 resolver uses so
 * the enablement layer stays consistent with the rest of the executor
 * framework even when callers inject a stub executor.
 */
function probeCanRun(
  executor: ExecutorDefinition,
  context: ExecutorContext,
): ExecutorAvailability {
  try {
    return executor.canRun(context);
  } catch (err) {
    return {
      status: 'unavailable',
      reason: `Executor "${executor.key}" threw while probing availability: ${
        err instanceof Error ? err.message : String(err)
      }`,
    };
  }
}
