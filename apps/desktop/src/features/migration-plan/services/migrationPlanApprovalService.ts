/**
 * Plan Approval Gate (Phase R5 Step 16).
 *
 * Centralises the rules that decide whether the migration plan is safe
 * to approve and move on to Step 05 Workspace. Both the Plan UI and
 * the migration-plan store consult this function so the button label,
 * the disabled-reason copy, and the imperative `approvePlan()` action
 * all agree on what counts as "approvable".
 *
 * Approval rules (in priority order):
 *
 *   1. Plan must exist (`plan !== undefined`).
 *   2. Plan must currently be in the `ready` state — `idle`,
 *      `generating`, `blocked`, `error`, and `approved` are not
 *      approvable.
 *   3. The shared React 19 plan-generation gate must pass — i.e. the
 *      scan report still satisfies the React 16/17/18 eligibility
 *      contract. We surface every gate reason verbatim so the user
 *      gets the same copy here as on the report screen.
 *   4. The {@link resolvePlanQualityStatus} verdict must not be
 *      `blocked`. `needs-review` is permitted (rule below), `good` is
 *      always allowed.
 *   5. Plan must have at least one step.
 *   6. Every step with `capability === 'available'` must have:
 *      execution type, executor key (non-empty string), capability
 *      (already validated), and a rollback strategy. Missing any of
 *      these means the executor will not be able to dispatch the step
 *      safely later and approval is refused.
 *   7. Every step with capability other than `available` must carry
 *      a non-empty `blockedReason` so the workspace/execution screens
 *      can explain why the step is not dispatchable.
 *   8. Plan must not include a workspace-creation executable step.
 *      Workspace creation is owned by Step 05; surfacing it as a plan
 *      step would re-introduce the legacy execution flow.
 *
 * If rules 1–5 and 7–8 are satisfied but the quality status is
 * `needs-review` (e.g. unsupported / manual steps that still need
 * human follow-up), approval is **allowed** but the gate marks the
 * plan as `needsReview` so the UI can communicate the caveat. Step 16
 * explicitly allows manual handling of not-yet-supported steps later
 * — the workspace/execution screens are responsible for refusing to
 * auto-run anything whose `capability !== 'available'`.
 *
 * The function is intentionally pure: no Zustand, no React, no IPC.
 * That keeps the rules easy to reason about and lets the store call
 * the same function defensively before approving.
 */
import type {
  MigrationPlan,
  MigrationPlanStatus,
  MigrationPlanStepV2,
  PlanQualityStatus,
} from '../types/migrationPlan.types';
import { resolvePlanQualityStatus } from './migrationPlanQualityService';

/**
 * Shared React 19 plan-generation gate shape — duplicated structurally
 * from `react19-migration` so this service has no upstream dependency
 * on that feature. Callers pass it in.
 */
export interface PlanApprovalGenerationGateInput {
  readonly canGeneratePlan: boolean;
  readonly reasons: readonly string[];
  readonly explanation?: string;
}

export interface PlanApprovalGateInput {
  readonly plan: MigrationPlan | undefined;
  readonly planStatus: MigrationPlanStatus;
  readonly planGenerationGate: PlanApprovalGenerationGateInput;
}

export interface PlanApprovalGateReason {
  readonly code: PlanApprovalGateReasonCode;
  readonly message: string;
}

export type PlanApprovalGateReasonCode =
  | 'no-plan'
  | 'plan-not-ready'
  | 'generation-gate-blocked'
  | 'quality-blocked'
  | 'no-steps'
  | 'executable-step-missing-executor-key'
  | 'executable-step-missing-rollback-strategy'
  | 'unsupported-step-missing-explanation'
  | 'workspace-creation-step-detected';

export interface PlanApprovalGate {
  readonly canApprove: boolean;
  /** Empty when `canApprove` is true. */
  readonly reasons: readonly PlanApprovalGateReason[];
  /**
   * True when approval is allowed but the underlying plan quality is
   * `needs-review` (manual / not-yet-supported steps remain).
   */
  readonly needsReview: boolean;
  /**
   * The plan quality status the gate consulted. Threaded back through
   * so callers can render it without re-running the resolver.
   */
  readonly quality: PlanQualityStatus | undefined;
}

/**
 * Heuristic detector for "workspace creation" plan steps. The current
 * planner never emits one (R5 Step 12 verification), but persisted
 * plans from earlier builds may still carry one — the approval gate
 * refuses to advance until it is removed.
 */
const WORKSPACE_STEP_ID_PATTERNS: readonly RegExp[] = [
  /^react19\.workspace\b/i,
  /\bcreate(-|_|\.)?safe(-|_|\.)?migration(-|_|\.)?workspace\b/i,
  /^workspace\.create\b/i,
];

const WORKSPACE_STEP_EXECUTOR_KEYS: ReadonlySet<string> = new Set([
  'workspace.create',
  'workspace-create',
  'create-safe-migration-workspace',
]);

export function isWorkspaceCreationPlanStep(step: MigrationPlanStepV2): boolean {
  if (WORKSPACE_STEP_EXECUTOR_KEYS.has(step.executorKey ?? '')) return true;
  return WORKSPACE_STEP_ID_PATTERNS.some((pattern) => pattern.test(step.id));
}

/**
 * Resolve the approval gate for a plan + status + shared generation
 * gate. Returns the verdict and the list of approval reasons (empty
 * when approval is allowed).
 */
export function resolvePlanApprovalGate(
  input: PlanApprovalGateInput,
): PlanApprovalGate {
  const { plan, planStatus, planGenerationGate } = input;
  const reasons: PlanApprovalGateReason[] = [];

  if (plan === undefined) {
    reasons.push({
      code: 'no-plan',
      message: 'Generate a React 19 migration plan before approving.',
    });
    return { canApprove: false, reasons, needsReview: false, quality: undefined };
  }

  if (planStatus !== 'ready') {
    reasons.push({
      code: 'plan-not-ready',
      message: planNotReadyMessage(planStatus),
    });
  }

  if (!planGenerationGate.canGeneratePlan) {
    const gateReason =
      planGenerationGate.reasons[0] ??
      planGenerationGate.explanation ??
      'React 19 eligibility gate blocks plan approval.';
    reasons.push({ code: 'generation-gate-blocked', message: gateReason });
  }

  const quality = resolvePlanQualityStatus(plan, planStatus);
  if (quality.status === 'blocked') {
    const qualityMessage =
      quality.notes[0] ??
      'Plan quality is blocked. Resolve plan-level blockers before approval.';
    reasons.push({ code: 'quality-blocked', message: qualityMessage });
  }

  if (plan.steps.length === 0) {
    reasons.push({
      code: 'no-steps',
      message:
        'Plan has no steps. Regenerate the plan after fixing scan inputs before approval.',
    });
  }

  for (const step of plan.steps) {
    if (isWorkspaceCreationPlanStep(step)) {
      reasons.push({
        code: 'workspace-creation-step-detected',
        message: `Plan still includes a workspace-creation step ("${step.title}"). Workspace setup is owned by Step 05 — regenerate the plan to remove it.`,
      });
    }

    if (step.capability === 'available') {
      if (!hasNonEmptyExecutorKey(step)) {
        reasons.push({
          code: 'executable-step-missing-executor-key',
          message: `Executable step "${step.title}" is missing an executor key. The execution engine cannot dispatch it safely.`,
        });
      }
      if (!hasRollbackStrategy(step)) {
        reasons.push({
          code: 'executable-step-missing-rollback-strategy',
          message: `Executable step "${step.title}" is missing a rollback strategy.`,
        });
      }
    } else if (!hasNonEmptyBlockedReason(step)) {
      reasons.push({
        code: 'unsupported-step-missing-explanation',
        message: `Non-executable step "${step.title}" is missing an explanation for why it cannot be run automatically.`,
      });
    }
  }

  return {
    canApprove: reasons.length === 0,
    reasons,
    needsReview:
      reasons.length === 0 && quality.status === 'needs-review',
    quality,
  };
}

/* -------------------------------------------------------------------------- */
/* internals                                                                  */
/* -------------------------------------------------------------------------- */

function planNotReadyMessage(planStatus: MigrationPlanStatus): string {
  switch (planStatus) {
    case 'idle':
      return 'Generate a React 19 migration plan before approving.';
    case 'generating':
      return 'Plan is still generating. Wait for generation to finish before approving.';
    case 'blocked':
      return 'Plan is blocked. Resolve blocked reasons and regenerate before approving.';
    case 'error':
      return 'Plan generation failed. Regenerate the plan before approving.';
    case 'approved':
      return 'Plan has already been approved.';
    case 'ready':
      return 'Plan is ready for approval.';
  }
}

function hasNonEmptyExecutorKey(step: MigrationPlanStepV2): boolean {
  const executorKey = step.executorKey;
  return typeof executorKey === 'string' && executorKey.trim().length > 0;
}

function hasRollbackStrategy(step: MigrationPlanStepV2): boolean {
  return (
    step.rollbackStrategy === 'git-revert' ||
    step.rollbackStrategy === 'discard-worktree-changes' ||
    step.rollbackStrategy === 'manual'
  );
}

function hasNonEmptyBlockedReason(step: MigrationPlanStepV2): boolean {
  const reason = step.blockedReason;
  return typeof reason === 'string' && reason.trim().length > 0;
}
