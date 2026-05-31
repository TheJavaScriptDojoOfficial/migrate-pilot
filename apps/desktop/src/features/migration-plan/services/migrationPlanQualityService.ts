/**
 * Plan Quality Service (Phase R5 Step 14).
 *
 * Aggregates the per-step V2 contract metadata into a single
 * `PlanQualityStatus`. The result is consumed by the Plan UI to show
 * an at-a-glance health summary: how many steps the executor can
 * actually run today, how many require human action, where contract
 * holes (missing executor keys, missing validation commands) exist,
 * and which plan-level blockers are still active.
 *
 * Architectural rules:
 *   - Pure function. No Zustand, IPC, or React.
 *   - Never builds a plan step itself; only inspects the already
 *     contract-V2-shaped steps.
 *   - Lives next to {@link migrationPlanStepContract.ts} so every
 *     consumer (planner, store, execution screen, plan UI) ends up
 *     with the same definition of "good" / "needs-review" / "blocked".
 */
import {
  isFileChangingPlanStepExecutionType,
  type MigrationPlan,
  type MigrationPlanStatus,
  type MigrationPlanStepV2,
  type PlanQualityStatus,
  type PlanQualityStatusLevel,
} from '../types/migrationPlan.types';

/**
 * Resolve the plan-level `PlanQualityStatus` from a built plan and the
 * current store-side `MigrationPlanStatus`.
 *
 * The store status is threaded through so plans whose generation was
 * refused outright (e.g. hydration failed, eligibility gate blocked
 * the report) still report `blocked` even when the in-memory plan
 * happens to have zero steps and zero `blockedReasons` — that case
 * should not be allowed to slip through as `good`.
 */
export function resolvePlanQualityStatus(
  plan: MigrationPlan,
  planStatus: MigrationPlanStatus,
): PlanQualityStatus {
  const counters = countPlanQualitySignals(plan.steps);
  const blockedReasons = plan.blockedReasons;
  const missingValidationStrategy = plan.validationStrategy.missingCommands;

  const status = resolvePlanQualityStatusLevel({
    planStatus,
    blockedReasons,
    counters,
  });
  const notes = buildPlanQualityNotes({
    plan,
    planStatus,
    counters,
    blockedReasons,
    missingValidationStrategy,
  });

  return {
    status,
    executableSteps: counters.executableSteps,
    manualSteps: counters.manualSteps,
    unsupportedSteps: counters.unsupportedSteps,
    blockedSteps: counters.blockedSteps,
    missingExecutorKeys: counters.missingExecutorKeys,
    missingValidationCommands: counters.missingValidationCommands,
    notes,
  };
}

/* -------------------------------------------------------------------------- */
/* internals                                                                  */
/* -------------------------------------------------------------------------- */

interface PlanQualityCounters {
  readonly totalSteps: number;
  readonly executableSteps: number;
  readonly manualSteps: number;
  readonly unsupportedSteps: number;
  readonly blockedSteps: number;
  readonly missingExecutorKeys: number;
  readonly missingValidationCommands: number;
  /**
   * `not-yet-supported` steps that are pure validation-only — these
   * are intentionally ignored when classifying the status as
   * `needs-review`, but kept here for note generation.
   */
  readonly validationOnlyAwaitingRunner: number;
}

function countPlanQualitySignals(
  steps: readonly MigrationPlanStepV2[],
): PlanQualityCounters {
  let executableSteps = 0;
  let manualSteps = 0;
  let unsupportedSteps = 0;
  let blockedSteps = 0;
  let missingExecutorKeys = 0;
  let missingValidationCommands = 0;
  let validationOnlyAwaitingRunner = 0;

  for (const step of steps) {
    if (step.capability === 'blocked' || step.status === 'blocked') {
      blockedSteps += 1;
    }
    if (step.capability === 'manual-only' || step.executionType === 'manual') {
      manualSteps += 1;
    }
    if (step.capability === 'not-yet-supported') {
      if (step.executionType === 'validation-only') {
        validationOnlyAwaitingRunner += 1;
      } else {
        unsupportedSteps += 1;
      }
    }
    if (step.canRunInExecution) {
      executableSteps += 1;
    }

    if (isFileChangingPlanStepExecutionType(step.executionType)) {
      const executorKey = step.executorKey;
      const hasExecutorKey =
        typeof executorKey === 'string' && executorKey.trim().length > 0;
      if (!hasExecutorKey) {
        missingExecutorKeys += 1;
      }
    }

    const needsValidation =
      step.requiresValidationAfterRun || step.executionType === 'validation-only';
    if (needsValidation && step.validationCommands.length === 0) {
      missingValidationCommands += 1;
    }
  }

  return {
    totalSteps: steps.length,
    executableSteps,
    manualSteps,
    unsupportedSteps,
    blockedSteps,
    missingExecutorKeys,
    missingValidationCommands,
    validationOnlyAwaitingRunner,
  };
}

function resolvePlanQualityStatusLevel(input: {
  readonly planStatus: MigrationPlanStatus;
  readonly blockedReasons: readonly string[];
  readonly counters: PlanQualityCounters;
}): PlanQualityStatusLevel {
  const { planStatus, blockedReasons, counters } = input;

  const planContextBlocked =
    planStatus === 'blocked' ||
    planStatus === 'error' ||
    blockedReasons.length > 0;
  if (planContextBlocked || counters.blockedSteps > 0) {
    return 'blocked';
  }

  const needsReview =
    counters.manualSteps > 0 ||
    counters.unsupportedSteps > 0 ||
    counters.missingExecutorKeys > 0 ||
    counters.missingValidationCommands > 0;
  if (needsReview) return 'needs-review';

  // `good` requires the planner to have actually produced steps. An
  // empty plan in `ready` state is suspicious — treat it as
  // needs-review so the UI nudges the user to investigate.
  if (counters.totalSteps === 0) return 'needs-review';

  return 'good';
}

function buildPlanQualityNotes(input: {
  readonly plan: MigrationPlan;
  readonly planStatus: MigrationPlanStatus;
  readonly counters: PlanQualityCounters;
  readonly blockedReasons: readonly string[];
  readonly missingValidationStrategy: readonly string[];
}): readonly string[] {
  const notes: string[] = [];
  const { counters, blockedReasons, missingValidationStrategy, planStatus, plan } =
    input;

  if (planStatus === 'blocked' || planStatus === 'error') {
    notes.push(
      planStatus === 'error'
        ? 'Plan generation failed. Regenerate the plan after fixing the underlying error.'
        : 'Plan generation is blocked. Resolve the blockers and regenerate the plan.',
    );
  }

  if (blockedReasons.length > 0) {
    const preview = blockedReasons[0];
    notes.push(
      blockedReasons.length === 1
        ? `Plan context is blocked: ${preview}`
        : `Plan context is blocked: ${preview} (+${blockedReasons.length - 1} more)`,
    );
  }

  if (counters.blockedSteps > 0) {
    notes.push(pluralize(counters.blockedSteps, 'step', 'steps') + ' marked blocked by the planner.');
  }
  if (counters.manualSteps > 0) {
    notes.push(
      `${pluralize(counters.manualSteps, 'step', 'steps')} require manual review and cannot be automated yet.`,
    );
  }
  if (counters.unsupportedSteps > 0) {
    notes.push(
      `${pluralize(counters.unsupportedSteps, 'step', 'steps')} are not yet supported by an executor.`,
    );
  }
  if (counters.missingExecutorKeys > 0) {
    notes.push(
      `${pluralize(counters.missingExecutorKeys, 'step', 'steps')} are missing an executor key.`,
    );
  }
  if (counters.missingValidationCommands > 0) {
    notes.push(
      `${pluralize(counters.missingValidationCommands, 'step', 'steps')} are missing validation commands.`,
    );
  }
  if (missingValidationStrategy.length > 0) {
    notes.push(
      `Validation strategy is missing project scripts: ${missingValidationStrategy.join(', ')}.`,
    );
  }
  if (counters.validationOnlyAwaitingRunner > 0) {
    notes.push(
      `${pluralize(
        counters.validationOnlyAwaitingRunner,
        'validation-only step',
        'validation-only steps',
      )} are waiting on the validation runner. This does not block plan quality on its own.`,
    );
  }

  if (
    notes.length === 0 &&
    counters.totalSteps > 0 &&
    counters.executableSteps === counters.totalSteps
  ) {
    notes.push('All steps are executable today with no contract holes detected.');
  } else if (
    notes.length === 0 &&
    counters.totalSteps > 0 &&
    counters.executableSteps > 0
  ) {
    notes.push(
      `${counters.executableSteps} of ${counters.totalSteps} steps are executable today; the remainder are validation-only.`,
    );
  } else if (notes.length === 0 && counters.totalSteps === 0) {
    notes.push('Plan contains no steps — investigate scan inputs before approval.');
  }

  // `plan` is intentionally available for future per-plan notes (e.g.
  // track-specific guidance) without requiring callers to reshape the
  // call signature.
  void plan;

  return notes;
}

function pluralize(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}
