/**
 * Executor Registry V2 — registry core (Phase R6 Step 2).
 *
 * Central registry that maps plan steps to executors by
 * (phase, track, issue codes) — and, when explicitly set, by
 * `step.executorKey`. The registry is intentionally execution-time:
 * executors are added at module-init time by their feature modules
 * (see future Phase R6 steps), NOT by hardcoding plan-step ids.
 *
 * Relationship to the legacy registry
 * -----------------------------------
 * `services/executorRegistry.ts` (the legacy V1 registry) is a
 * STATIC table of declared executor keys with `supported` flags. It
 * is consumed by the V1 capability classifier (still wired into the
 * execution screen) and the IPC layer.
 *
 * The V2 registry in this file is DYNAMIC and holds executor
 * IMPLEMENTATIONS that satisfy {@link ExecutorDefinition}. Once Phase
 * R6 lands its remaining steps, the V1 registry will be deprecated
 * in favour of this V2 one.
 *
 * Architectural rules
 * -------------------
 * - Pure data + lookups. No React, no IPC, no fs.
 * - Registrations are keyed by `ExecutorDefinition.key`. Re-registering
 *   an existing key replaces the prior definition (HMR / test resets
 *   stay idempotent without throwing).
 * - The registry is intentionally an in-memory module-level Map.
 *   Persistence is out of scope — executor selection is purely a
 *   runtime concern.
 */
import type { ExecutorDefinition } from './executor.types';

/* -------------------------------------------------------------------------- */
/* Module-level state                                                         */
/* -------------------------------------------------------------------------- */

const REGISTRY = new Map<string, ExecutorDefinition>();

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Register an executor implementation. Re-registering an existing key
 * replaces the prior definition — this keeps HMR and test setup
 * idempotent.
 *
 * @throws {Error} if `executor.key` is empty. The key is the single
 * stable identifier executors are looked up by; an empty key would
 * silently shadow other entries in the lookup map.
 */
export function registerExecutor(executor: ExecutorDefinition): void {
  if (executor.key.length === 0) {
    throw new Error(
      'registerExecutor: ExecutorDefinition.key must be a non-empty string.',
    );
  }
  REGISTRY.set(executor.key, executor);
}

/**
 * Look up an executor by key.
 *
 * Returns `undefined` for keys that have never been registered.
 * Treat an `undefined` return as `future-support` in the resolver —
 * the key is declared by the planner but no implementation has been
 * shipped yet.
 */
export function getExecutorByKey(
  key: string | undefined,
): ExecutorDefinition | undefined {
  if (key === undefined || key.length === 0) return undefined;
  return REGISTRY.get(key);
}

/**
 * Snapshot of all currently registered executors, in insertion order.
 *
 * Insertion order is the resolver's tiebreaker when multiple
 * executors match a step on (phase, track, issueCodes) — the FIRST
 * registered match wins. Keeping the order stable is therefore part
 * of the registry's contract.
 *
 * The returned array is a snapshot — mutating it does not affect the
 * underlying registry.
 */
export function listRegisteredExecutors(): readonly ExecutorDefinition[] {
  return Array.from(REGISTRY.values());
}

/**
 * Remove a previously registered executor. Returns `true` if an entry
 * was removed, `false` if no entry was registered under that key.
 *
 * Primarily intended for tests and HMR; production code should not
 * unregister executors mid-session.
 */
export function unregisterExecutor(key: string): boolean {
  return REGISTRY.delete(key);
}

/**
 * Clear every registered executor. Intended for tests and HMR resets.
 */
export function clearExecutorRegistry(): void {
  REGISTRY.clear();
}

/**
 * True iff an executor is registered under the given key. Convenience
 * wrapper around {@link getExecutorByKey} for predicates.
 */
export function isExecutorRegistered(key: string | undefined): boolean {
  return getExecutorByKey(key) !== undefined;
}
