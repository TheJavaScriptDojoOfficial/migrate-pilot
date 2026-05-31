import type { ScanReport } from '@features/scanner';
import {
  REACT_19_CANONICAL_PHASE_ORDER,
  getReactMigrationPhaseOrder,
  type ReactMigrationPhase,
  type ReactMigrationTrack,
} from '@features/react19-migration';

export type MigrationPlanStatus =
  | 'idle'
  | 'generating'
  | 'ready'
  | 'blocked'
  | 'error'
  | 'approved';

export type React19PlanStepStatus = MigrationPlanStepV2Status;
export type MigrationStepStatus = MigrationPlanStepV2Status;

export type MigrationPlanStepV2Risk = 'low' | 'medium' | 'high';
export type MigrationPlanStepV2Status =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'blocked';
export type MigrationPlanStepV2ExecutionType =
  | 'scripted'
  | 'codemod'
  | 'ai-assisted'
  | 'manual'
  | 'validation-only';
export type MigrationPlanStepV2Capability =
  | 'available'
  | 'not-yet-supported'
  | 'manual-only'
  | 'blocked';
export type MigrationPlanStepV2RollbackStrategy =
  | 'git-revert'
  | 'discard-worktree-changes'
  | 'manual';

/* -------------------------------------------------------------------------- */
/* Executor Registry V2 — plan-step facing metadata                           */
/* -------------------------------------------------------------------------- */

/**
 * Coarse status emitted by an executor's `canRun(context)` probe and
 * persisted on a plan step as `executorAvailability.status`.
 *
 *   `available`       Executor is registered, supported, and can run
 *                     against the current workspace right now.
 *   `unavailable`     Executor is registered but cannot run right now
 *                     (missing workspace prerequisite, wrong package
 *                     manager, missing params, etc.). The `reason`
 *                     explains what is missing.
 *   `manual-only`     Step is intentionally manual — Migrate Pilot will
 *                     never dispatch anything for it; the user reviews
 *                     and accepts.
 *   `future-support`  Executor key is declared but the underlying
 *                     implementation is not shipped in this build yet.
 *                     The UI surfaces an honest "not available yet"
 *                     badge.
 *   `blocked`         Step is blocked by a hard precondition (e.g.
 *                     validation-only step with no commands attached,
 *                     mismatched React majors, …) and the planner
 *                     refuses to dispatch it until the blocker is
 *                     resolved.
 *
 * This union is intentionally richer than the legacy
 * {@link MigrationPlanStepV2Capability} enum so the V2 executor
 * framework can distinguish "not implemented yet" from "implemented but
 * not currently runnable" — two cases the UI needs different copy for.
 */
export type ExecutorAvailabilityStatus =
  | 'available'
  | 'unavailable'
  | 'manual-only'
  | 'future-support'
  | 'blocked';

/**
 * Structured availability descriptor produced by an executor's
 * `canRun(context)` probe and persisted on a plan step.
 *
 * Why a struct (and not just a status enum):
 *   - The UI needs the `reason` verbatim so users are never left
 *     wondering why a Run button is greyed out.
 *   - `warnings` lets executors surface non-blocking concerns that the
 *     UI can show alongside an `available` step (e.g. "lockfile will be
 *     regenerated").
 *
 * Invariants:
 *   - `reason` is required when `status !== 'available'`. Callers that
 *     persist availability MUST populate it; the helper
 *     `deriveExecutorAvailability` enforces this by default.
 *   - `warnings`, when present, MUST be non-empty.
 */
export interface ExecutorAvailability {
  readonly status: ExecutorAvailabilityStatus;
  readonly reason?: string;
  readonly warnings?: readonly string[];
}

/**
 * Canonical executor-execution-type union for the Executor Registry V2.
 *
 * The planner already classifies steps by the same five-way taxonomy
 * via {@link MigrationPlanStepV2ExecutionType}; this alias gives the
 * V2 executor contract a stable, executor-facing name without
 * duplicating the literal union.
 */
export type ExecutorExecutionType = MigrationPlanStepV2ExecutionType;

export interface MigrationPlanStepRunRequirements {
  readonly requiresWorkspace: boolean;
  readonly requiresApprovalBeforeRun: boolean;
  readonly requiresValidationAfterRun: boolean;
}

export function isValidationOnlyPlanStepExecutionType(
  executionType: MigrationPlanStepV2ExecutionType,
): boolean {
  return executionType === 'validation-only';
}

export function isManualOnlyPlanStepExecutionType(
  executionType: MigrationPlanStepV2ExecutionType,
): boolean {
  return executionType === 'manual';
}

export function isFileChangingPlanStepExecutionType(
  executionType: MigrationPlanStepV2ExecutionType,
): boolean {
  return (
    executionType === 'scripted' ||
    executionType === 'codemod' ||
    executionType === 'ai-assisted'
  );
}

/**
 * Canonical rollback policy for planner/execution contract V2.
 *
 * Current execution architecture does not create per-step commits, so all
 * file-changing automated steps should default to discarding workspace
 * changes. Manual/validation-only steps remain `manual`.
 */
export function resolveMigrationPlanStepRollbackStrategy(
  executionType: MigrationPlanStepV2ExecutionType,
): MigrationPlanStepV2RollbackStrategy {
  if (isFileChangingPlanStepExecutionType(executionType)) {
    return 'discard-worktree-changes';
  }
  return 'manual';
}

/**
 * Canonical step run requirements (R5 Step 7).
 *
 * - File-changing steps require workspace + approval + post-run validation.
 * - Validation-only steps require workspace but no approval or post-run
 *   validation gate.
 * - Manual-only steps require explicit approval, but do not require command
 *   execution and therefore do not force workspace/validation gates.
 */
export function resolveMigrationPlanStepRunRequirements(
  executionType: MigrationPlanStepV2ExecutionType,
): MigrationPlanStepRunRequirements {
  if (isValidationOnlyPlanStepExecutionType(executionType)) {
    return {
      requiresWorkspace: true,
      requiresApprovalBeforeRun: false,
      requiresValidationAfterRun: false,
    };
  }
  if (isManualOnlyPlanStepExecutionType(executionType)) {
    return {
      requiresWorkspace: false,
      requiresApprovalBeforeRun: true,
      requiresValidationAfterRun: false,
    };
  }
  return {
    requiresWorkspace: true,
    requiresApprovalBeforeRun: true,
    requiresValidationAfterRun: true,
  };
}

/**
 * Planner/Executor contract V2 — Phase R5.
 *
 * The canonical step contract is execution-aware, phase-aware,
 * track-aware, validation-aware, approval-aware, and ready for the
 * future execution engine. Every plan step the planner emits MUST
 * fully populate this shape — the optional fields are limited to
 * cases where there is no meaningful value (e.g. `executorKey` on a
 * pure-manual step, `blockedReason` when the step is `available`).
 *
 * R5 hardening (vs. the transitional R4 shape):
 *   - Adds `canonicalPhaseOrder` so consumers can sort by phase
 *     without re-importing the canonical phase order table.
 *   - Promotes the previously "transitional" fields
 *     (`sourceIssueCodes`, `expectedChangeScope`,
 *     `requiresHumanReview`, `canRunInExecution`) to required, since
 *     the planner has always set them and the UI/execution layer is
 *     downstream-of-them.
 *   - Promotes `expectedChangedFiles`, `expectedCommands`, and
 *     `validationCommands` to required (default `[]`) so consumers
 *     never have to write `?? []`.
 */
export interface MigrationPlanStepV2 {
  readonly id: string;
  readonly order: number;
  readonly phase: ReactMigrationPhase;
  /**
   * Index of `phase` in the canonical React 19 phase order
   * (`REACT_19_CANONICAL_PHASE_ORDER`). Stored on the step so the UI,
   * execution engine, and persistence layer can sort plan steps
   * without re-importing the phase table.
   */
  readonly canonicalPhaseOrder: number;
  readonly track: ReactMigrationTrack;

  readonly title: string;
  readonly description: string;
  readonly reason: string;

  readonly risk: MigrationPlanStepV2Risk;
  readonly status: MigrationPlanStepV2Status;

  readonly issueCodes: readonly string[];

  readonly executionType: MigrationPlanStepV2ExecutionType;
  readonly executorKey?: string;
  readonly capability: MigrationPlanStepV2Capability;
  /**
   * Required when capability is `not-yet-supported`, `manual-only`, or
   * `blocked`; omitted for `available` steps.
   */
  readonly blockedReason?: string;

  readonly requiresWorkspace: boolean;
  readonly requiresApprovalBeforeRun: boolean;
  readonly requiresValidationAfterRun: boolean;

  /** Files the step is expected to touch; `[]` when none / unknown. */
  readonly expectedChangedFiles: readonly string[];
  /** Shell commands the executor will run (e.g. install); `[]` when none. */
  readonly expectedCommands: readonly string[];
  /** Validation commands to run after the step; `[]` when none. */
  readonly validationCommands: readonly string[];

  readonly rollbackStrategy: MigrationPlanStepV2RollbackStrategy;

  /**
   * Backward-compatible execution metadata for the current execution engine.
   * Planner V2 owns `executionType`/`executorKey`; this field is derived.
   */
  readonly execution?: MigrationStepExecution;

  /**
   * Source issue codes that motivated the step (risk-engine items,
   * scanner issue codes, or planner fallback codes). Always set —
   * `[]` for steps that exist as plan scaffolding (e.g. baseline
   * validation, final review).
   */
  readonly sourceIssueCodes: readonly string[];
  /**
   * Human-readable summary of the kinds of files/configuration this
   * step is expected to change. Used by the UI; never `undefined`.
   */
  readonly expectedChangeScope: readonly string[];
  /**
   * True when this step requires explicit human review before it can
   * be considered complete (regardless of whether an executor exists).
   */
  readonly requiresHumanReview: boolean;
  /**
   * True when the step is currently dispatchable by the execution
   * engine (capability === 'available' AND status === 'pending').
   */
  readonly canRunInExecution: boolean;

  /* ------------------------------------------------------------------ */
  /* Executor Registry V2 metadata (Phase R6 Step 1)                    */
  /* ------------------------------------------------------------------ */

  /**
   * Structured availability descriptor produced by an executor's
   * `canRun(context)` probe. The richer V2 shape complements (and is
   * intended to eventually supersede) the legacy `capability` enum:
   * UI consumers can read `executorAvailability` when present, falling
   * back to `deriveExecutorAvailability(step)` for older persisted
   * plans where this field is not populated yet.
   *
   * Optional so existing persisted plans (and steps emitted by older
   * planner builds) continue to satisfy the type.
   */
  readonly executorAvailability?: ExecutorAvailability;

  /**
   * True when this step requires explicit user verification AFTER the
   * executor runs (e.g. a codemod that needs eyes-on review even when
   * it completes cleanly). Distinct from `requiresHumanReview`, which
   * gates pre-run approval. Optional so steps that have no post-run
   * gate can omit it.
   */
  readonly requiresManualVerification?: boolean;
}

export type React19PlanStepExecutionType = MigrationPlanStepV2ExecutionType;

export type MigrationStepExecutionMode =
  | 'scripted'
  | 'ai'
  | 'manual'
  | 'validation';

export interface MigrationStepExecution {
  readonly mode: MigrationStepExecutionMode;
  readonly executorKey?: string;
  readonly params?: Readonly<Record<string, unknown>>;
}

export type MigrationStepRisk = MigrationPlanStepV2Risk;
export type MigrationStepCategory =
  | 'preflight'
  | 'validation'
  | 'bridge'
  | 'dependency'
  | 'tooling'
  | 'typescript'
  | 'api'
  | 'routing'
  | 'testing';

/** @deprecated Use `MigrationPlanStepV2`. */
export type React19PlanStep = MigrationPlanStepV2;

export type MigrationStep = React19PlanStep;

export interface React19ValidationStrategy {
  readonly baselineCommands: readonly string[];
  readonly perStepCommands: readonly string[];
  readonly finalCommands: readonly string[];
  readonly missingCommands: readonly string[];
}

export interface React19PlanPhaseSummary {
  readonly totalSteps: number;
  readonly highestRisk: MigrationPlanStepV2Risk;
  readonly executionTypes: readonly React19PlanStepExecutionType[];
}

export interface React19MigrationPlanV2 {
  readonly id: string;
  readonly version: 'react19-plan-v2';
  readonly scanReportId: string;
  readonly projectPath: string;
  readonly title: string;
  readonly summaryText: string;
  readonly sourceReactVersion: string;
  readonly targetReactVersion: '19';
  readonly sourceMajor: 16 | 17 | 18;
  readonly track: ReactMigrationTrack;
  readonly strategy: 'react-19-foundation-first';
  readonly generatedAt: string;
  readonly approvedAt?: string;
  readonly status: 'draft' | 'approved';
  readonly canExecute: boolean;
  readonly blockedReasons: readonly string[];
  readonly prerequisites: readonly string[];
  readonly steps: readonly React19PlanStep[];
  readonly skippedPhases: readonly {
    phase: ReactMigrationPhase;
    reason: string;
  }[];
  readonly phaseSummary: Readonly<Record<ReactMigrationPhase, React19PlanPhaseSummary>>;
  readonly validationStrategy: React19ValidationStrategy;
  readonly highestRisk: MigrationPlanStepV2Risk;
  readonly summary: {
    readonly title: string;
    readonly description: string;
    readonly totalSteps: number;
    readonly estimatedRisk: MigrationPlanStepV2Risk;
    readonly estimatedComplexity: 'small' | 'medium' | 'large';
    readonly approvalGates: number;
    readonly requiredSteps: number;
  };
  readonly blockers: readonly string[];
  readonly warnings: readonly string[];
  readonly assumptions: readonly string[];
  readonly recommendations: readonly string[];
}

export type MigrationPlan = React19MigrationPlanV2;

/**
 * Plan Quality Status (R5 Step 14).
 *
 * Aggregates the per-step V2 contract metadata into a single
 * plan-level health summary that the UI can render at a glance.
 *
 * Status rules (resolved by `resolvePlanQualityStatus`):
 *   - `blocked` if any required plan context is invalid (plan-level
 *     `blockedReasons`, `MigrationPlanStatus === 'blocked'`) or any
 *     required step is blocked (`capability === 'blocked'` or
 *     `status === 'blocked'`).
 *   - `needs-review` if manual or non-validation-only unsupported
 *     steps exist, or if any executable step is missing an executor
 *     key, or if any step that requires validation has no validation
 *     commands attached.
 *   - `good` if every step is either available-executable or
 *     validation-only and no blockers or contract holes exist.
 *
 * The numeric counters are reported honestly even when they don't
 * match the status (e.g. `blocked` still surfaces `manualSteps`), so
 * the UI can render the full mix alongside the status badge.
 */
export type PlanQualityStatusLevel = 'good' | 'needs-review' | 'blocked';

export interface PlanQualityStatus {
  readonly status: PlanQualityStatusLevel;
  readonly executableSteps: number;
  readonly manualSteps: number;
  readonly unsupportedSteps: number;
  readonly blockedSteps: number;
  readonly missingExecutorKeys: number;
  readonly missingValidationCommands: number;
  readonly notes: readonly string[];
}

export type MigrationPlanErrorKind =
  | 'no-scan-report'
  | 'scan-incomplete'
  | 'generator-failed'
  | 'plan-blocked';

export interface MigrationPlanError {
  readonly kind: MigrationPlanErrorKind;
  readonly message: string;
}

export interface MigrationPlanGeneratorInput {
  readonly scanReport: ScanReport;
}

export interface MigrationPlanState {
  readonly status: MigrationPlanStatus;
  readonly plan?: MigrationPlan;
  readonly error?: MigrationPlanError;
  readonly approved: boolean;
  readonly scanReportId?: string;
}

export function requiresBlockedReasonForCapability(
  capability: MigrationPlanStepV2Capability,
): boolean {
  return capability !== 'available';
}

export function isExecutableMigrationPlanStep(step: MigrationPlanStepV2): boolean {
  if (step.status !== 'pending') return false;
  return step.capability === 'available';
}

/**
 * Canonical phase order index for a plan step.
 *
 * Re-exports the React 19 canonical phase order table on the
 * planner-facing contract so callers in `migration-plan` and
 * `execution` can sort steps without depending on the
 * `react19-migration` feature directly.
 */
export function getMigrationPlanStepCanonicalPhaseOrder(
  phase: ReactMigrationPhase,
): number {
  const order = getReactMigrationPhaseOrder(phase);
  // Defensive: any unknown phase is treated as "after every known phase"
  // so it never silently jumps to the front of the plan.
  return order >= 0 ? order : REACT_19_CANONICAL_PHASE_ORDER.length;
}

/**
 * Stable comparator for plan steps that prefers canonical phase order,
 * then the step's own `order`, then `id` as a tiebreaker.
 */
export function compareMigrationPlanStepsByCanonicalOrder(
  a: MigrationPlanStepV2,
  b: MigrationPlanStepV2,
): number {
  const phaseDelta = a.canonicalPhaseOrder - b.canonicalPhaseOrder;
  if (phaseDelta !== 0) return phaseDelta;
  const orderDelta = a.order - b.order;
  if (orderDelta !== 0) return orderDelta;
  return a.id.localeCompare(b.id);
}

/**
 * Map a planner execution type to the execution-engine's coarse mode.
 *
 * Planner V2 owns the richer `executionType` taxonomy (scripted,
 * codemod, ai-assisted, manual, validation-only). The execution engine
 * still consumes the older `MigrationStepExecutionMode` (scripted, ai,
 * manual, validation). Centralising the mapping here keeps both
 * contracts aligned without leaking either side's internals.
 */
export function mapMigrationPlanStepExecutionTypeToMode(
  executionType: MigrationPlanStepV2ExecutionType,
): MigrationStepExecutionMode {
  switch (executionType) {
    case 'scripted':
    case 'codemod':
      return 'scripted';
    case 'ai-assisted':
      return 'ai';
    case 'manual':
      return 'manual';
    case 'validation-only':
      return 'validation';
  }
}

/**
 * Predicate for "this step can be dispatched by the execution engine
 * right now". Centralised so the planner, store-compat normaliser,
 * and execution screen all agree on the meaning of "executable".
 */
export function canMigrationPlanStepRunInExecution(
  step: Pick<MigrationPlanStepV2, 'status' | 'capability'>,
): boolean {
  if (step.status !== 'pending') return false;
  return step.capability === 'available';
}

/* -------------------------------------------------------------------------- */
/* Executor Availability adapters (Phase R6 Step 1)                           */
/* -------------------------------------------------------------------------- */

/**
 * Maps the legacy {@link MigrationPlanStepV2Capability} enum onto the
 * richer {@link ExecutorAvailabilityStatus} taxonomy.
 *
 * The mapping is intentionally conservative — `not-yet-supported` is
 * collapsed to `future-support` so the UI surfaces an honest
 * "not available in this build yet" message rather than implying the
 * executor exists but is currently blocked.
 */
function mapCapabilityToAvailabilityStatus(
  capability: MigrationPlanStepV2Capability,
): ExecutorAvailabilityStatus {
  switch (capability) {
    case 'available':
      return 'available';
    case 'manual-only':
      return 'manual-only';
    case 'blocked':
      return 'blocked';
    case 'not-yet-supported':
      return 'future-support';
  }
}

/**
 * Derive an {@link ExecutorAvailability} from a step's legacy capability
 * fields. Used as a back-compat shim so consumers of the V2 contract
 * can always read a structured availability, even when a persisted
 * plan was emitted before `executorAvailability` was populated.
 *
 * The derivation is purely a re-shape of existing data — no inference,
 * no executor-registry lookup — so it is safe to call from anywhere.
 */
export function deriveExecutorAvailability(
  step: Pick<
    MigrationPlanStepV2,
    'capability' | 'blockedReason' | 'executionType' | 'executorKey'
  >,
): ExecutorAvailability {
  const status = mapCapabilityToAvailabilityStatus(step.capability);
  if (status === 'available') {
    return { status };
  }
  const reason =
    step.blockedReason !== undefined && step.blockedReason.trim().length > 0
      ? step.blockedReason
      : defaultAvailabilityReason(status, step.executionType, step.executorKey);
  return { status, reason };
}

/**
 * Resolve the executor availability for a plan step, preferring the
 * persisted V2 field when present and falling back to a derivation
 * from the legacy `capability` + `blockedReason` otherwise.
 *
 * This is the function call execution-time code should make — never
 * read `step.executorAvailability` directly when you also want
 * back-compat with older plans.
 */
export function resolveMigrationPlanStepExecutorAvailability(
  step: Pick<
    MigrationPlanStepV2,
    | 'capability'
    | 'blockedReason'
    | 'executionType'
    | 'executorKey'
    | 'executorAvailability'
  >,
): ExecutorAvailability {
  if (step.executorAvailability !== undefined) {
    return step.executorAvailability;
  }
  return deriveExecutorAvailability(step);
}

function defaultAvailabilityReason(
  status: Exclude<ExecutorAvailabilityStatus, 'available'>,
  executionType: MigrationPlanStepV2ExecutionType,
  executorKey: string | undefined,
): string {
  switch (status) {
    case 'manual-only':
      return 'This step requires human judgement and cannot be safely automated by Migrate Pilot yet.';
    case 'blocked':
      return 'A hard precondition is blocking this step. Resolve the blocker before running it.';
    case 'future-support':
      if (executorKey === undefined) {
        return `No executor is mapped for this ${executionType} step yet, so automatic execution is not available.`;
      }
      return `Executor "${executorKey}" is declared but not supported in this build yet.`;
    case 'unavailable':
      return 'The executor is registered but cannot run against the current workspace right now.';
  }
}
