/**
 * Shared helpers for building {@link ExecutionResult} values from the
 * Phase R6 Step 3 deterministic executors.
 *
 * Every executor in this folder produces logs and returns a normalised
 * {@link ExecutionResult}. Centralising the result-shaping here keeps
 * each executor focused on its own domain logic (validation commands,
 * dependency actions, codemods, …) and guarantees that:
 *
 *   - Every run id is unique and traceable.
 *   - `startedAt` / `completedAt` are ISO-8601 strings the UI can sort.
 *   - Each result carries at least one log entry — even "no-op" runs
 *     explain themselves so the user is never left wondering what the
 *     executor decided.
 *   - `mode` matches the executor's declared `executionType` so the
 *     downstream UI / persistence layers stay consistent.
 *
 * Architectural rules
 * -------------------
 * - Pure data shaping. No fs, no IPC, no React imports.
 * - The helpers MUST be called from inside `executor.run(input)` — the
 *   `runId` / `startedAt` carried on the result mirror the same fields
 *   on `ExecutorRunInput` exactly.
 * - `buildFailedRunFromError` synthesises an `ExecutionError` with a
 *   stable `code` prefix per executor so failure telemetry is
 *   filterable without parsing free-form strings.
 */
import type { MigrationStepExecutionMode } from '@features/migration-plan';

import type {
  ExecutionChangedFile,
  ExecutionError,
  ExecutionLogEntry,
  ExecutionStepRun,
} from '../../types/execution.types';
import type { ExecutorRunInput } from '../executor.types';

/* -------------------------------------------------------------------------- */
/* Logging helpers                                                            */
/* -------------------------------------------------------------------------- */

export type LogLevel = ExecutionLogEntry['level'];

/**
 * Build a single log entry. The timestamp defaults to `now()` so callers
 * can simply `logs.push(buildLog('info', '…'))` without juggling a
 * date.
 */
export function buildLog(
  level: LogLevel,
  message: string,
  detail?: string,
): ExecutionLogEntry {
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(detail !== undefined && detail.length > 0 ? { detail } : {}),
  };
}

/* -------------------------------------------------------------------------- */
/* Result builders                                                            */
/* -------------------------------------------------------------------------- */

export interface BuildSuccessRunInput {
  readonly input: ExecutorRunInput;
  readonly logs: readonly ExecutionLogEntry[];
  readonly changedFiles?: readonly ExecutionChangedFile[];
  /**
   * Set to `true` when the executor finished cleanly but the user
   * still has to manually verify the outcome before the step is
   * truly done (manual-instruction checklist runs, AI-assisted
   * bounded edits that need a diff review, …). Surfaced on the
   * captured {@link ExecutionStepRun} so the UI can render a
   * distinct "Manual verification required" banner.
   */
  readonly requiresManualVerification?: boolean;
}

/**
 * Build a `status: 'completed'` {@link ExecutionStepRun} from the
 * supplied logs + changed files. Use this when the executor ran to
 * completion — even no-op runs that produced explanatory logs count as
 * `completed` (the executor decided there was nothing to do).
 */
export function buildCompletedRun(input: BuildSuccessRunInput): ExecutionStepRun {
  return {
    id: input.input.runId,
    planId: input.input.planId,
    planStepId: input.input.planStepId,
    stepTitle: input.input.stepTitle,
    workspacePath: input.input.workspacePath,
    status: 'completed',
    startedAt: input.input.startedAt,
    completedAt: new Date().toISOString(),
    executorKey: input.input.executorKey,
    mode: input.input.mode,
    changedFiles: input.changedFiles ?? [],
    logs: input.logs,
    ...(input.requiresManualVerification === true
      ? { requiresManualVerification: true }
      : {}),
  };
}

export interface BuildFailedRunInput {
  readonly input: ExecutorRunInput;
  readonly logs: readonly ExecutionLogEntry[];
  readonly error: ExecutionError;
  readonly changedFiles?: readonly ExecutionChangedFile[];
  /**
   * Set to `true` when the failure itself reflects an executor that
   * intentionally refuses to auto-run and is asking the user to
   * follow the manual fallback in the logs. Rare — most failures
   * leave the flag unset and rely on the standard "Failed" banner.
   */
  readonly requiresManualVerification?: boolean;
}

/**
 * Build a `status: 'failed'` {@link ExecutionStepRun} carrying the
 * supplied error + logs. Used when the executor could not proceed
 * (e.g. unsupported deterministic transformation, invalid params).
 */
export function buildFailedRun(input: BuildFailedRunInput): ExecutionStepRun {
  return {
    id: input.input.runId,
    planId: input.input.planId,
    planStepId: input.input.planStepId,
    stepTitle: input.input.stepTitle,
    workspacePath: input.input.workspacePath,
    status: 'failed',
    startedAt: input.input.startedAt,
    completedAt: new Date().toISOString(),
    executorKey: input.input.executorKey,
    mode: input.input.mode,
    changedFiles: input.changedFiles ?? [],
    logs: input.logs,
    error: input.error,
    ...(input.requiresManualVerification === true
      ? { requiresManualVerification: true }
      : {}),
  };
}

/**
 * Build a synthetic `failed` run from a thrown error.
 *
 * Centralised so each executor's `try/catch` collapses into a single
 * `buildFailedRunFromError(input, logs, err, codePrefix)` call.
 */
export function buildFailedRunFromError(
  input: ExecutorRunInput,
  logs: readonly ExecutionLogEntry[],
  err: unknown,
  codePrefix: string,
): ExecutionStepRun {
  const message = err instanceof Error ? err.message : String(err);
  return buildFailedRun({
    input,
    logs: [...logs, buildLog('error', message)],
    error: {
      code: `${codePrefix}:unhandled`,
      message,
    },
  });
}

/* -------------------------------------------------------------------------- */
/* Mode coercion                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Coerce a {@link MigrationStepExecutionMode} into the same union the
 * captured run uses. Exposed for executors that want to construct a
 * synthesised run *without* delegating to {@link buildCompletedRun}
 * (e.g. when wrapping the result of an IPC call that already produced
 * its own run id).
 */
export function coerceRunMode(
  mode: MigrationStepExecutionMode,
): ExecutionStepRun['mode'] {
  return mode;
}
