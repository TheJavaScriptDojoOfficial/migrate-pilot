/**
 * Executor Registry V2 — capability resolver (Phase R6 Step 2).
 *
 * Decides WHICH registered executor should run a given plan step and
 * produces the {@link ExecutorAvailability} the UI surfaces. The
 * resolver NEVER dispatches; it only matches the step against the
 * registry, probes `canRun(context)` on the chosen executor, and
 * returns a typed {@link ExecutorResolutionResult}.
 *
 * Resolution order (matches Phase R6 Step 2 spec):
 *
 *   1. If `step.executorKey` is set, look it up directly.
 *        - Found    → return that executor + its `canRun(context)`.
 *        - Missing  → return `future-support` with the declared key
 *                     surfaced so the UI can explain "this key is
 *                     declared on the step but no implementation is
 *                     registered yet".
 *
 *   2. Otherwise scan the registry for executors matching:
 *        - phase        (executor.supportedPhases empty == any phase)
 *        - track        (executor.supportedTracks empty == any track)
 *        - issue codes  (executor.supportedIssueCodes empty == any
 *                        code; otherwise at least one of the step's
 *                        `issueCodes` must be in the executor's list)
 *
 *      The FIRST registered executor that satisfies all three axes
 *      wins (see `listRegisteredExecutors` for tiebreaker semantics).
 *
 *   3. No match → return `future-support` with a reason that names
 *      the (phase, track) tuple, so the UI can explain that the
 *      combination is unsupported in this build rather than silently
 *      disabling execution.
 *
 * Architectural rules
 * -------------------
 * - Pure logic. The resolver is synchronous; `canRun(context)` is
 *   contracted by Step 1 to be synchronous too.
 * - The resolver catches synchronous throws from `canRun` and maps
 *   them to `status: 'unavailable'`, matching the Step 1 contract.
 * - The resolver MUST always populate `capability` on the result.
 *   Callers should treat the resolver's `capability` as the source of
 *   truth for "can this step run right now" — never recompute.
 */
import type { ExecutorAvailability } from '@features/migration-plan';

import type { MigrationPlanStepV2 } from '@features/migration-plan';

import type {
  ExecutorContext,
  ExecutorDefinition,
  ExecutorResolutionResult,
} from './executor.types';
import {
  getExecutorByKey,
  listRegisteredExecutors,
} from './executorRegistry';

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Step-shaped input accepted by the resolver. Intentionally a subset
 * of {@link MigrationPlanStepV2} so the resolver can be invoked from
 * older plan shapes (and tests) without forcing every consumer to
 * populate the full V2 contract.
 */
export interface ResolverStepInput {
  readonly id?: string;
  readonly phase: MigrationPlanStepV2['phase'];
  readonly track: MigrationPlanStepV2['track'];
  readonly issueCodes: readonly string[];
  readonly executorKey?: string;
}

/**
 * Resolve which executor (if any) should run for a plan step.
 *
 * @see ExecutorResolutionResult for field semantics.
 */
export function resolveExecutorForStep(
  step: ResolverStepInput,
  context: ExecutorContext,
): ExecutorResolutionResult {
  // 1. Explicit executor key on the step wins.
  if (step.executorKey !== undefined && step.executorKey.length > 0) {
    const executor = getExecutorByKey(step.executorKey);
    if (executor === undefined) {
      return {
        executorKey: step.executorKey,
        capability: {
          status: 'future-support',
          reason: `Executor "${step.executorKey}" is declared on this step but no implementation is registered in this build yet.`,
        },
      };
    }
    return dispatchCanRun(executor, context);
  }

  // 2. Match by (phase, track, at least one issue code).
  const matches = listRegisteredExecutors().filter((exec) =>
    matchesExecutorAxes(exec, step),
  );
  if (matches.length === 0) {
    return {
      capability: {
        status: 'future-support',
        reason: buildNoMatchReason(step),
      },
    };
  }

  // First registered match wins. Insertion order is part of the
  // registry's contract — see `listRegisteredExecutors`.
  const executor = matches[0] as ExecutorDefinition;
  return dispatchCanRun(executor, context);
}

/**
 * Axis-matching predicate exported for unit tests and the screen
 * (the screen uses it to render "candidate executor" hints in
 * developer mode).
 *
 * An executor matches a step iff ALL three axes match:
 *   - `supportedPhases` is empty OR contains `step.phase`.
 *   - `supportedTracks` is empty OR contains `step.track`.
 *   - `supportedIssueCodes` is empty OR shares at least one entry
 *     with `step.issueCodes`.
 *
 * Empty arrays mean "no constraint on this axis" — see the Step 1
 * executor contract for the rationale.
 */
export function matchesExecutorAxes(
  executor: ExecutorDefinition,
  step: ResolverStepInput,
): boolean {
  if (
    executor.supportedPhases.length > 0 &&
    !executor.supportedPhases.includes(step.phase)
  ) {
    return false;
  }
  if (
    executor.supportedTracks.length > 0 &&
    !executor.supportedTracks.includes(step.track)
  ) {
    return false;
  }
  if (executor.supportedIssueCodes.length > 0) {
    const hasOverlap = step.issueCodes.some((code) =>
      executor.supportedIssueCodes.includes(code),
    );
    if (!hasOverlap) return false;
  }
  return true;
}

/**
 * Find every registered executor that matches a step's
 * (phase, track, issueCodes). Useful for tests and developer-mode UI
 * that wants to surface alternatives — production code should call
 * {@link resolveExecutorForStep} instead, which picks the first
 * match and probes `canRun`.
 */
export function findCandidateExecutorsForStep(
  step: ResolverStepInput,
): readonly ExecutorDefinition[] {
  return listRegisteredExecutors().filter((exec) =>
    matchesExecutorAxes(exec, step),
  );
}

/* -------------------------------------------------------------------------- */
/* Internal helpers                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Invoke `canRun(context)` defensively and shape the result into an
 * {@link ExecutorResolutionResult}. Synchronous throws are translated
 * into `status: 'unavailable'` per the Step 1 contract, so the
 * resolver's return is always well-formed.
 *
 * The context passed to `canRun` is patched to set `executorKey` to
 * the matched executor's key. Callers may have built the context with
 * a placeholder (empty string) before resolution; this keeps the
 * `canRun` probe self-consistent regardless of how the caller seeded
 * the context.
 */
function dispatchCanRun(
  executor: ExecutorDefinition,
  context: ExecutorContext,
): ExecutorResolutionResult {
  const contextForProbe: ExecutorContext =
    context.executorKey === executor.key
      ? context
      : { ...context, executorKey: executor.key };

  let capability: ExecutorAvailability;
  try {
    capability = executor.canRun(contextForProbe);
  } catch (err) {
    capability = {
      status: 'unavailable',
      reason: `Executor "${executor.key}" threw while probing availability: ${
        err instanceof Error ? err.message : String(err)
      }`,
    };
  }

  return {
    executorKey: executor.key,
    executor,
    capability,
  };
}

/**
 * Human-readable "no executor for this (phase, track) tuple" reason.
 *
 * Mirrors the wording called out by the Phase R6 Step 2 acceptance
 * criteria so the screen can use the resolver's reason verbatim
 * instead of inventing copy.
 */
function buildNoMatchReason(step: ResolverStepInput): string {
  const codeHint =
    step.issueCodes.length > 0
      ? ` for issue codes [${step.issueCodes.join(', ')}]`
      : '';
  return `No registered executor supports this phase/track/issue combination yet (phase: ${step.phase}, track: ${step.track}${codeHint}).`;
}
