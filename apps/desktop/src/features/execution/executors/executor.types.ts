/**
 * Executor Registry V2 — types for the registry/resolver layer
 * (Phase R6 Step 2).
 *
 * This file is the public type contract for the `executors/` module.
 * It re-exports the Step 1 executor-implementation contracts
 * ({@link ExecutorContext}, {@link ExecutorDefinition},
 * {@link ExecutorRunInput}, {@link ExecutionResult}) and adds the
 * resolver-specific result shapes Step 2 introduces.
 *
 * Why a thin re-export module:
 *   - Callers of the registry only need to import from `executors/`
 *     (one module surface) instead of mixing imports between
 *     `types/executor.types.ts` (Step 1 contracts) and
 *     `executors/executorRegistry.ts` (Step 2 runtime).
 *   - Keeps the Step 1 contracts as the single source of truth — this
 *     file does NOT redefine them.
 *
 * Architectural rules
 * -------------------
 * - Pure types. No React, no Zustand, no IPC imports.
 * - The resolver MUST always return a populated `capability` — even
 *   on the "no match" path — so the UI never has to invent copy.
 * - When the resolver finds a matching executor, it ALSO returns the
 *   matched key and the executor reference itself so callers can
 *   dispatch (`executor.run(input)`) without a second registry lookup.
 */
import type { ExecutorAvailability } from '@features/migration-plan';

import type {
  ExecutionResult,
  ExecutorContext,
  ExecutorDefinition,
  ExecutorRunInput,
} from '../types/executor.types';

/* Re-export the Step 1 contracts so `executors/*` is a self-contained
 * import target. Consumers should prefer
 * `import { ... } from '@features/execution/executors/executor.types'`
 * over reaching into `../types/executor.types`. */
export type {
  ExecutionResult,
  ExecutorContext,
  ExecutorDefinition,
  ExecutorRunInput,
};

/* -------------------------------------------------------------------------- */
/* Resolver result                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Result of resolving an executor for a plan step.
 *
 * Field semantics:
 *
 *   `executorKey`  Populated whenever the resolver could attribute a
 *                  key to the step — either the step's own declared
 *                  key (even if the lookup failed) or the key of the
 *                  matched executor. Useful to surface in the UI even
 *                  when no executor reference is available.
 *
 *   `executor`     Populated only when a registered executor was
 *                  selected. Callers that intend to dispatch should
 *                  guard on `executor !== undefined`.
 *
 *   `capability`   Always populated. Mirrors the
 *                  {@link ExecutorAvailability} produced by the
 *                  executor's `canRun(context)` probe, or — when no
 *                  executor matched — a synthesized `future-support`
 *                  availability that explains why dispatch is not
 *                  possible yet.
 */
export interface ExecutorResolutionResult {
  readonly executorKey?: string;
  readonly executor?: ExecutorDefinition;
  readonly capability: ExecutorAvailability;
}

/* -------------------------------------------------------------------------- */
/* Screen-facing summary                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Flat, screen-facing summary of a plan step's executor resolution.
 *
 * Used by the execution screen to render the per-step capability card
 * without leaking the executor reference into the presentation layer.
 * Every field maps to a row the screen surfaces (phase, track, issue
 * codes, executor key, capability status, capability reason) so the
 * card never has to recompute these values from the raw resolution.
 *
 * `executorKey` is optional because a step may have no declared key
 * and no axis-match — the screen still wants to show the rest of the
 * summary in that case.
 */
export interface ExecutorResolutionSummary {
  readonly planStepId: string;
  readonly phase: ExecutorContext['phase'];
  readonly track: ExecutorContext['track'];
  readonly issueCodes: readonly string[];
  readonly executorKey?: string;
  readonly executorLabel?: string;
  readonly capabilityStatus: ExecutorAvailability['status'];
  readonly capabilityReason?: string;
  readonly capabilityWarnings?: readonly string[];
}
