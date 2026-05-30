/**
 * Migration plan store (Milestone 4).
 *
 * Owns the plan state machine and synchronises approval into the workflow
 * progress store so the next step (Workspace Confirmation) becomes
 * reachable.
 *
 * Why a dedicated store rather than `useSessionStore`?
 *   - Keeps the plan-in-progress state machine (`idle | generating | …`)
 *     and the rich `MigrationPlan` artifact out of the small cross-feature
 *     session store.
 *   - Lets us reset cleanly when the upstream ScanReport changes.
 *
 * Cross-store contract:
 *   - On successful approval, the workflow step `plan` is marked completed.
 *     `deriveWorkflowStatuses` then automatically promotes `workspace` to
 *     the next reachable step.
 *   - When the upstream ScanReport id changes, `clearPlanIfScanChanges`
 *     wipes the plan + drops the workflow completion so the user is forced
 *     to re-approve a fresh plan.
 */
import { create } from 'zustand';

import type { ScanReport } from '@features/scanner';
import { useWorkflowProgressStore } from '@shared/hooks/useWorkflowProgress';

import { generateMigrationPlan } from '../services/migrationPlanGenerator';
import { resolveReact19PlanGenerationGate } from '@features/react19-migration';
import type {
  MigrationPlan,
  MigrationPlanError,
  MigrationPlanState,
  MigrationPlanStatus,
} from '../types/migrationPlan.types';

const WORKFLOW_STEP_ID = 'plan';

/* -------------------------------------------------------------------------- */
/* Store shape                                                                */
/* -------------------------------------------------------------------------- */

interface MigrationPlanStoreActions {
  /** Run the deterministic generator against a completed ScanReport. */
  generatePlan: (scanReport: ScanReport) => Promise<void>;
  /** Mark the current draft plan as approved. No-op if no draft exists. */
  approvePlan: () => void;
  /** Discard the plan and reset to idle. Drops the workflow completion. */
  resetPlan: () => void;
  /**
   * Wipe the plan if it was generated from a different ScanReport than the
   * one currently active. Intended to be called from a top-level effect
   * watching the scanner store's report id.
   */
  clearPlanIfScanChanges: (currentScanReportId: string | undefined) => void;
}

/**
 * Internal store shape. Uses `T | undefined` instead of `?:` so we can
 * explicitly clear values via `set({ plan: undefined })` without tripping
 * `exactOptionalPropertyTypes`. The public {@link MigrationPlanState}
 * mirrors the same fields.
 */
interface MigrationPlanStoreState {
  readonly status: MigrationPlanStatus;
  readonly plan: MigrationPlan | undefined;
  readonly error: MigrationPlanError | undefined;
  readonly approved: boolean;
  readonly scanReportId: string | undefined;
}

type Store = MigrationPlanStoreState & MigrationPlanStoreActions;

const INITIAL_STATE: MigrationPlanStoreState = {
  status: 'idle',
  plan: undefined,
  error: undefined,
  approved: false,
  scanReportId: undefined,
};

/* -------------------------------------------------------------------------- */
/* Store                                                                      */
/* -------------------------------------------------------------------------- */

export const useMigrationPlanStore = create<Store>((set, get) => ({
  ...INITIAL_STATE,

  generatePlan: async (scanReport) => {
    const planGate = resolveReact19PlanGenerationGate(scanReport);
    if (!planGate.canGeneratePlan) {
      set({
        status: 'blocked',
        plan: undefined,
        approved: false,
        scanReportId: scanReport.id,
        error: {
          kind: 'plan-blocked',
          message: planGate.reasons[0] ?? planGate.explanation,
        },
      });
      useWorkflowProgressStore.getState().markStepIncomplete(WORKFLOW_STEP_ID);
      return;
    }

    set({
      status: 'generating',
      approved: false,
      error: undefined,
    });

    let plan: MigrationPlan;
    try {
      plan = generateMigrationPlan(scanReport);
    } catch (err) {
      set({
        status: 'error',
        plan: undefined,
        approved: false,
        scanReportId: scanReport.id,
        error: {
          kind: 'generator-failed',
          message: err instanceof Error ? err.message : String(err),
        },
      });
      // The plan step is not considered complete while we are in failed state.
      useWorkflowProgressStore.getState().markStepIncomplete(WORKFLOW_STEP_ID);
      return;
    }

    const hasBlockingStep = plan.steps.some(
      (step) => step.capability === 'blocked' || step.status === 'blocked',
    );
    const isBlocked = plan.blockedReasons.length > 0 || hasBlockingStep;

    set({
      status: isBlocked ? 'blocked' : 'ready',
      plan,
      approved: false,
      error: undefined,
      scanReportId: scanReport.id,
    });
    // Generation alone does NOT complete the workflow step — the user must
    // explicitly approve. Keep the workflow step incomplete.
    useWorkflowProgressStore.getState().markStepIncomplete(WORKFLOW_STEP_ID);
  },

  approvePlan: () => {
    const { plan, status } = get();
    if (plan === undefined) return;
    if (status !== 'ready') return;

    const approvedAt = new Date().toISOString();
    const approvedPlan: MigrationPlan = {
      ...plan,
      status: 'approved',
      approvedAt,
    };

    set({
      status: 'approved',
      plan: approvedPlan,
      approved: true,
      error: undefined,
    });
    useWorkflowProgressStore.getState().markStepCompleted(WORKFLOW_STEP_ID);
  },

  resetPlan: () => {
    set({ ...INITIAL_STATE });
    useWorkflowProgressStore.getState().markStepIncomplete(WORKFLOW_STEP_ID);
  },

  clearPlanIfScanChanges: (currentScanReportId) => {
    const { scanReportId, status } = get();
    if (status === 'idle' && scanReportId === undefined) return;

    // Scanner was reset to "no report" — drop the plan entirely.
    if (currentScanReportId === undefined) {
      set({ ...INITIAL_STATE });
      useWorkflowProgressStore.getState().markStepIncomplete(WORKFLOW_STEP_ID);
      return;
    }

    if (scanReportId !== undefined && currentScanReportId !== scanReportId) {
      set({ ...INITIAL_STATE });
      useWorkflowProgressStore.getState().markStepIncomplete(WORKFLOW_STEP_ID);
    }
  },
}));

/* -------------------------------------------------------------------------- */
/* Selectors                                                                  */
/* -------------------------------------------------------------------------- */

export const selectPlanStatus = (s: MigrationPlanStoreState): MigrationPlanStatus =>
  s.status;
export const selectPlan = (s: MigrationPlanStoreState): MigrationPlan | undefined =>
  s.plan;
export const selectPlanError = (
  s: MigrationPlanStoreState,
): MigrationPlanError | undefined => s.error;

/** True when the plan has been explicitly approved by the user. */
export function selectIsPlanApproved(s: MigrationPlanStoreState): boolean {
  return s.status === 'approved' && s.approved;
}

/** True when a draft plan is available and awaiting approval. */
export function selectHasDraftPlan(s: MigrationPlanStoreState): boolean {
  return s.status === 'ready' && s.plan !== undefined;
}

/* -------------------------------------------------------------------------- */
/* Public state contract (for downstream features)                            */
/* -------------------------------------------------------------------------- */

export type { MigrationPlanState };
