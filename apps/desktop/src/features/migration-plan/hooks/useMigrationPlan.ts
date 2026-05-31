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
 *
 * R5 Step 15 — Session persistence.
 *   - The generated `MigrationPlanStepV2` plan + status + approval +
 *     `scanReportId` are persisted to `localStorage` via the zustand
 *     `persist` middleware (mirroring `useProjectScannerStore`). This
 *     keeps the plan alive across normal app navigation _and_ app
 *     reloads within the same session, without introducing a separate
 *     plan store.
 *   - Transient `generating` status is normalised back to `idle` on
 *     write so a mid-generation reload never resurrects a stuck
 *     "Generating" screen. Errors are still persisted so a failed
 *     plan keeps surfacing its message until the user regenerates.
 *   - On rehydration, the persisted plan is funnelled through
 *     {@link normalizePlanForStoreCompatibility} so plans written by
 *     older R5 step builds get brought forward to the V2 contract
 *     without crashing the UI.
 *   - Stale-plan invalidation stays in `clearPlanIfScanChanges`: the
 *     `MigrationPlanScreen` effect calls it on every mount with the
 *     scanner's current report id, so any rehydrated plan whose
 *     `scanReportId` no longer matches the current scan report is
 *     dropped immediately (forcing a regenerate). Without a scan
 *     report present, the rehydrated plan is also dropped.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import type { ScanReport } from '@features/scanner';
import { useWorkflowProgressStore } from '@shared/hooks/useWorkflowProgress';

import { generateMigrationPlan } from '../services/migrationPlanGenerator';
import { resolvePlanApprovalGate } from '../services/migrationPlanApprovalService';
import {
  hydrateReact19ScanReportV2,
  resolveReact19PlanGenerationGate,
} from '@features/react19-migration';
import type {
  MigrationPlan,
  MigrationPlanError,
  MigrationPlanState,
  MigrationPlanStatus,
  MigrationPlanStepV2,
} from '../types/migrationPlan.types';
import {
  canMigrationPlanStepRunInExecution,
  getMigrationPlanStepCanonicalPhaseOrder,
  resolveMigrationPlanStepRollbackStrategy,
  resolveMigrationPlanStepRunRequirements,
} from '../types/migrationPlan.types';

const WORKFLOW_STEP_ID = 'plan';

/**
 * `localStorage` key used by the zustand `persist` middleware (R5 Step 15).
 *
 * Keep the version suffix in sync with the persisted shape: bumping it is
 * how we force-evict plans whose schema changed in a way that
 * {@link normalizePlanForStoreCompatibility} cannot patch up.
 */
const PLAN_STORAGE_KEY = 'migrate-pilot-migration-plan-v1';

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

export const useMigrationPlanStore = create<Store>()(
  persist(
    (set, get) => ({
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

        // R5 Step 11: Plan V2 may only be generated from a fully-hydrated
        // React 19 Report V2 context. For older persisted reports we rebuild
        // the derived pieces (risk engine, readiness report) on the fly; if
        // an irreducible prerequisite (e.g. compatibility report, migration
        // context) is missing, refuse to fall back to any legacy generic
        // plan and surface the blocker to the user instead.
        const hydration = hydrateReact19ScanReportV2(scanReport);
        if (!hydration.ok) {
          set({
            status: 'blocked',
            plan: undefined,
            approved: false,
            scanReportId: scanReport.id,
            error: {
              kind: 'plan-blocked',
              message: hydration.reason,
            },
          });
          useWorkflowProgressStore.getState().markStepIncomplete(WORKFLOW_STEP_ID);
          return;
        }
        const hydratedScanReport = hydration.scanReport;

        set({
          status: 'generating',
          approved: false,
          error: undefined,
        });

        let plan: MigrationPlan;
        try {
          plan = normalizePlanForStoreCompatibility(
            generateMigrationPlan(hydratedScanReport),
          );
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

        // R5 Step 16 — Defensive approval gate.
        //
        // The UI already disables the button when the gate refuses
        // approval, but a quiet re-check here protects the workflow
        // from any caller that bypasses the UI. The store does not
        // have direct access to the live ScanReport (and therefore
        // the shared generation gate), so we synthesise a passing
        // gate input — the plan was only persisted as `ready` after
        // the gate already passed during generation, so trusting the
        // plan-level state here is safe.
        const approvalGate = resolvePlanApprovalGate({
          plan,
          planStatus: status,
          planGenerationGate: { canGeneratePlan: true, reasons: [] },
        });
        if (!approvalGate.canApprove) {
          // Surface the first blocker so the UI shows *why* approval
          // didn't take effect even if a programmatic caller hit it.
          const reason =
            approvalGate.reasons[0]?.message ??
            'Plan approval rules were not satisfied.';
          set({
            error: { kind: 'plan-blocked', message: reason },
          });
          return;
        }

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
    }),
    {
      name: PLAN_STORAGE_KEY,
      /**
       * Persist only the data fields, never the action functions. Convert
       * the transient `generating` status back to `idle` on the way into
       * storage so a mid-generation reload does not resurrect a stuck
       * "Generating" UI on next boot. All other statuses (including
       * `error` + its message) are preserved as-is so the user sees the
       * same diagnostic after reload and can decide what to do.
       */
      partialize: (state) => ({
        status: state.status === 'generating' ? 'idle' : state.status,
        plan: state.plan,
        error: state.error,
        approved: state.approved,
        scanReportId: state.scanReportId,
      }),
      /**
       * Merge the rehydrated state on top of the fresh store template
       * (which provides the action functions), and re-run the V2
       * forward-compat normaliser on any rehydrated plan so plans
       * persisted by older R5 step builds get brought up to the
       * current `MigrationPlanStepV2` contract before the UI/execution
       * layer ever sees them.
       *
       * Stale-plan invalidation (i.e. the persisted plan was generated
       * from a different scan report than the one currently active)
       * intentionally stays in `clearPlanIfScanChanges`, which runs
       * from the `MigrationPlanScreen` effect on every mount — that
       * keeps the rehydration path side-effect-free and avoids
       * pulling the scanner store into this module-level callback.
       */
      merge: (persistedState, currentState) => {
        const persisted = (persistedState ?? {}) as Partial<MigrationPlanStoreState>;
        const merged: Store = { ...currentState, ...persisted };
        return {
          ...merged,
          status:
            merged.status === 'generating'
              ? 'idle'
              : merged.status,
          plan:
            merged.plan !== undefined
              ? normalizePlanForStoreCompatibility(merged.plan)
              : undefined,
        };
      },
    },
  ),
);

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

/**
 * Forward-compatibility shim for plan steps generated before R5.
 *
 * Older persisted plans may be missing the now-required V2 contract
 * fields (`canonicalPhaseOrder`, `expectedChangedFiles`,
 * `expectedCommands`, `validationCommands`, `sourceIssueCodes`,
 * `expectedChangeScope`, `requiresHumanReview`, `canRunInExecution`,
 * the run-requirement booleans, and `rollbackStrategy`). Newly
 * generated plans set them explicitly; this normaliser fills in
 * deterministic defaults for anything older without overwriting
 * fields that are already populated.
 */
function normalizePlanForStoreCompatibility(plan: MigrationPlan): MigrationPlan {
  const normalizedSteps = plan.steps.map((step) =>
    normalizePlanStepForStoreCompatibility(step),
  );
  return {
    ...plan,
    steps: normalizedSteps,
  };
}

function normalizePlanStepForStoreCompatibility(
  step: MigrationPlanStepV2,
): MigrationPlanStepV2 {
  const runRequirements = resolveMigrationPlanStepRunRequirements(step.executionType);
  // We treat the input as Partial because older persisted plans (R4
  // and earlier) may be missing fields the V2 contract now requires.
  // Casting once keeps the rest of the function strict.
  const partial = step as Partial<MigrationPlanStepV2> & MigrationPlanStepV2;

  const requiresWorkspace = partial.requiresWorkspace ?? runRequirements.requiresWorkspace;
  const requiresApprovalBeforeRun =
    partial.requiresApprovalBeforeRun ?? runRequirements.requiresApprovalBeforeRun;
  const requiresValidationAfterRun =
    partial.requiresValidationAfterRun ?? runRequirements.requiresValidationAfterRun;
  const rollbackStrategy =
    partial.rollbackStrategy ??
    resolveMigrationPlanStepRollbackStrategy(step.executionType);

  const canonicalPhaseOrder =
    typeof partial.canonicalPhaseOrder === 'number'
      ? partial.canonicalPhaseOrder
      : getMigrationPlanStepCanonicalPhaseOrder(step.phase);

  const expectedChangedFiles = partial.expectedChangedFiles ?? [];
  const expectedCommands = partial.expectedCommands ?? [];
  const validationCommands = partial.validationCommands ?? [];

  const sourceIssueCodes = partial.sourceIssueCodes ?? step.issueCodes ?? [];
  const expectedChangeScope = partial.expectedChangeScope ?? [];
  const requiresHumanReview =
    typeof partial.requiresHumanReview === 'boolean'
      ? partial.requiresHumanReview
      : requiresApprovalBeforeRun;
  const canRunInExecution =
    typeof partial.canRunInExecution === 'boolean'
      ? partial.canRunInExecution
      : canMigrationPlanStepRunInExecution(step);

  return {
    ...step,
    canonicalPhaseOrder,
    requiresWorkspace,
    requiresApprovalBeforeRun,
    requiresValidationAfterRun,
    rollbackStrategy,
    expectedChangedFiles,
    expectedCommands,
    validationCommands,
    sourceIssueCodes,
    expectedChangeScope,
    requiresHumanReview,
    canRunInExecution,
  };
}
