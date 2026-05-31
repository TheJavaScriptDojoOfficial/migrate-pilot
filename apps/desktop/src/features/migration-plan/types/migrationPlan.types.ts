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
