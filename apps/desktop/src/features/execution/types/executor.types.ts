/**
 * Executor Registry V2 — executor-side contracts (Phase R6 Step 1).
 *
 * These types describe the contract every executor implementation MUST
 * satisfy. They are deliberately decoupled from any specific executor
 * (no scripted/codemod/AI specifics leak in) so the registry can host
 * a heterogeneous set of executors behind one uniform interface.
 *
 * Why these live in `execution/types/` (and not `migration-plan/types/`):
 *   The plan-step facing metadata (`ExecutorAvailability`,
 *   `ExecutorAvailabilityStatus`) lives in `migration-plan/types/`
 *   because it is persisted on plan steps. The executor IMPLEMENTATION
 *   contracts (`ExecutorContext`, `ExecutorRunInput`, `ExecutorDefinition`)
 *   live here because they describe what code in the execution feature
 *   must implement. Splitting them keeps `migration-plan` free of any
 *   knowledge about how the execution engine dispatches.
 *
 * Architectural rules
 * -------------------
 * - Pure types. No React, no Zustand, no IPC imports.
 * - Executor implementations MUST be selectable from the registry by
 *   (phase, track, issueCodes, executorKey, executionType) — never by
 *   hardcoding a plan-step id.
 * - `canRun(context)` is the single contract the execution engine
 *   probes to decide whether to surface a Run button. Implementations
 *   MUST return a structured {@link ExecutorAvailability}; a thrown
 *   error is treated as `status: 'unavailable'`.
 * - `run(input)` is the dispatched operation. It MUST resolve with a
 *   captured {@link ExecutionResult} on both success and failure; a
 *   rejected promise is treated as a synthesized `failed` result by
 *   the engine.
 */
import type {
  ExecutorAvailability,
  ExecutorExecutionType,
  MigrationStepExecutionMode,
} from '@features/migration-plan';
import type {
  ReactMigrationPhase,
  ReactMigrationTrack,
} from '@features/react19-migration';

import type { ExecutionStepRun } from './execution.types';

/* -------------------------------------------------------------------------- */
/* Run result                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Captured outcome of a single executor.run() call.
 *
 * Aliased to {@link ExecutionStepRun} so the V2 contract and the
 * existing engine-state shape stay in lockstep. If the captured-run
 * shape ever needs to diverge from what the engine stores, this
 * alias becomes a dedicated interface — until then the alias keeps
 * the two contracts trivially consistent.
 */
export type ExecutionResult = ExecutionStepRun;

/* -------------------------------------------------------------------------- */
/* Executor context (input to canRun)                                         */
/* -------------------------------------------------------------------------- */

/**
 * Context passed to {@link ExecutorDefinition.canRun}.
 *
 * Carries everything an executor needs to decide whether it can run
 * against the current workspace WITHOUT touching the workspace itself.
 * Implementations should treat this as read-only.
 *
 * `params` is the planner-resolved parameter bag (e.g. the package
 * list for a `package-json-dependency-update` step). Executors decide
 * whether their `canRun` requires `params !== undefined`.
 */
export interface ExecutorContext {
  readonly workspacePath: string;
  readonly sourcePath: string;
  readonly planId: string;
  readonly planStepId: string;
  readonly stepTitle: string;

  readonly phase: ReactMigrationPhase;
  readonly track: ReactMigrationTrack;
  /**
   * Issue codes the planner attached to the step. Kept as opaque
   * strings (not narrowed to the scanner's `ScanIssueCode` enum) so
   * planner fallback codes and forward-compatible codes the scanner
   * does not enumerate yet still flow through the executor pipeline
   * without a lossy cast.
   */
  readonly issueCodes: readonly string[];

  readonly executorKey: string;
  readonly executionType: ExecutorExecutionType;
  readonly mode: MigrationStepExecutionMode;

  readonly params?: Readonly<Record<string, unknown>>;
}

/* -------------------------------------------------------------------------- */
/* Executor run input                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Input passed to {@link ExecutorDefinition.run}.
 *
 * A superset of {@link ExecutorContext} that adds dispatch-time data
 * the engine wants the executor to echo back on the result (run id,
 * started-at timestamp).
 */
export interface ExecutorRunInput extends ExecutorContext {
  /** Stable id minted by the engine for this run attempt. */
  readonly runId: string;
  /** ISO timestamp when the engine started dispatching this run. */
  readonly startedAt: string;
}

/* -------------------------------------------------------------------------- */
/* Executor definition                                                        */
/* -------------------------------------------------------------------------- */

/**
 * The V2 executor contract. Every executor registered in the V2 registry
 * MUST satisfy this shape.
 *
 * The `supportedPhases` / `supportedTracks` / `supportedIssueCodes`
 * arrays are the registry's selection metadata — they replace the
 * hardcoded "if step.id === X" dispatch the legacy executor wiring
 * relies on. An empty array on any of the three matchers means "no
 * constraint on this axis" (i.e. the executor is eligible regardless
 * of that axis's value).
 *
 * `executionType` is the canonical category the executor satisfies and
 * is used to keep plan-step `executionType` and registered-executor
 * `executionType` in sync.
 */
export interface ExecutorDefinition {
  /** Stable, kebab-case key referenced by plan steps. */
  readonly key: string;
  /** Short human label for the executable badge and tooltips. */
  readonly label: string;

  readonly supportedPhases: readonly ReactMigrationPhase[];
  readonly supportedTracks: readonly ReactMigrationTrack[];
  /**
   * Issue codes this executor opts into. Strings (not narrowed to the
   * scanner's `ScanIssueCode` enum) for the same forward-compatibility
   * reason as `ExecutorContext.issueCodes`.
   */
  readonly supportedIssueCodes: readonly string[];

  readonly executionType: ExecutorExecutionType;

  /**
   * Probe — given a plan-step context, decide whether this executor
   * can run right now. Implementations MUST return synchronously: the
   * probe is meant to be cheap (no IPC, no fs reads beyond what the
   * engine already has cached) so the UI can render badges without
   * blocking.
   */
  canRun(context: ExecutorContext): ExecutorAvailability;

  /**
   * Dispatch — perform the executor's work against the workspace.
   * Implementations MUST resolve with a captured {@link ExecutionResult}
   * (`status: 'completed' | 'failed'`) on success/failure. A rejected
   * promise is synthesized into a `failed` result by the engine.
   */
  run(input: ExecutorRunInput): Promise<ExecutionResult>;
}
