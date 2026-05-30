/**
 * Diff review store (Milestone 7).
 *
 * Owns the diff review state machine, loaded diff snapshot, the user's
 * approve/reject decision, and any captured Git command logs.
 * Synchronises completion of an approval into the cross-feature workflow
 * store so the next step (Validation) becomes reachable.
 *
 * Why a dedicated store rather than `useSessionStore`?
 *   - Keeps potentially-large diff text and per-file logs out of the small
 *     session store.
 *   - Resets cleanly when the upstream execution run, plan id, or
 *     workspace path changes.
 *
 * Cross-store contract:
 *   - On a successful `approveDiff`, the workflow step `diff` is marked
 *     completed. `deriveWorkflowStatuses` then automatically promotes
 *     Validation to the next reachable step.
 *   - On `rejectDiff`, the workflow step `diff` is marked incomplete and
 *     the upstream `execute` step is also marked incomplete so the user
 *     is forced to re-run execution before reviewing again.
 *   - When the upstream execution run id changes,
 *     `clearIfExecutionChanges` wipes any stale diff state so the user
 *     can never approve a diff against a stale run.
 */
import { create } from 'zustand';

import { useWorkflowProgressStore } from '@shared/hooks/useWorkflowProgress';

import {
  DiffReviewServiceError,
  approveDiffReview,
  loadDiffReview,
  rejectDiffReview,
} from '../services/diffReviewService';
import type {
  DiffReviewDecision,
  DiffReviewError,
  DiffReviewSession,
  DiffReviewState,
  DiffReviewStatus,
} from '../types/diffReview.types';

const WORKFLOW_STEP_ID_DIFF = 'diff';
const WORKFLOW_STEP_ID_EXECUTE = 'execute';

/* -------------------------------------------------------------------------- */
/* Store shape                                                                */
/* -------------------------------------------------------------------------- */

export interface InitializeFromExecutionInput {
  readonly executionRunId: string;
  readonly planId: string;
  readonly planStepId: string;
  readonly stepTitle: string;
  readonly workspacePath: string;
  readonly sourcePath: string;
  readonly branchName?: string;
  readonly changedFiles: readonly string[];
}

interface DiffReviewActions {
  /**
   * Bind the store to the latest successful execution run. Idempotent:
   * if the same execution run is already loaded, the existing diff is
   * preserved and the screen stays on its current state.
   */
  initializeFromExecution: (input: InitializeFromExecutionInput) => void;
  /** Mark the screen blocked because prerequisites are missing. */
  markBlocked: () => void;
  /** Run `diff_load` and capture the result. */
  loadDiff: () => Promise<void>;
  /** Highlight a single file in the changed-files list. */
  selectFile: (filePath: string) => void;
  /** Run `diff_approve` and mark the workflow step complete on success. */
  approveDiff: (reason?: string) => Promise<void>;
  /** Run `diff_reject` and capture reverted-files / manual-cleanup lists. */
  rejectDiff: (reason?: string) => Promise<void>;
  /** Drop the entire review state and clear workflow completion. */
  resetReview: () => void;
  /** Drop everything if the upstream execution run / plan / workspace changed. */
  clearIfExecutionChanges: (
    currentExecutionRunId: string | undefined,
    currentPlanId: string | undefined,
    currentWorkspacePath: string | undefined,
  ) => void;
}

interface DiffReviewStoreState {
  readonly status: DiffReviewStatus;
  readonly session: DiffReviewSession | undefined;
  readonly error: DiffReviewError | undefined;
  readonly planId: string | undefined;
  readonly workspacePath: string | undefined;
  readonly executionRunId: string | undefined;
  /**
   * Local pending session metadata captured from the executor run. Held
   * separately from `session` so we can keep "what step are we reviewing"
   * even before the diff has been loaded.
   */
  readonly pending: PendingDiffReviewBinding | undefined;
}

interface PendingDiffReviewBinding {
  readonly executionRunId: string;
  readonly planId: string;
  readonly planStepId: string;
  readonly stepTitle: string;
  readonly workspacePath: string;
  readonly sourcePath: string;
  readonly branchName?: string;
  readonly changedFiles: readonly string[];
}

type Store = DiffReviewStoreState & DiffReviewActions;

const INITIAL_STATE: DiffReviewStoreState = {
  status: 'blocked',
  session: undefined,
  error: undefined,
  planId: undefined,
  workspacePath: undefined,
  executionRunId: undefined,
  pending: undefined,
};

/* -------------------------------------------------------------------------- */
/* Store                                                                      */
/* -------------------------------------------------------------------------- */

export const useDiffReviewStore = create<Store>((set, get) => ({
  ...INITIAL_STATE,

  initializeFromExecution: (input) => {
    const current = get();
    const sameRun =
      current.executionRunId === input.executionRunId &&
      current.planId === input.planId &&
      current.workspacePath === input.workspacePath;

    if (sameRun) {
      // Preserve the existing session/decision; just refresh the pending
      // metadata in case the changedFiles array was updated upstream.
      set({
        pending: buildPending(input),
        error: undefined,
      });
      return;
    }

    // Fresh execution run — reset everything and move to idle so the
    // screen can trigger a load.
    useWorkflowProgressStore.getState().markStepIncomplete(WORKFLOW_STEP_ID_DIFF);
    set({
      ...INITIAL_STATE,
      status: 'idle',
      planId: input.planId,
      workspacePath: input.workspacePath,
      executionRunId: input.executionRunId,
      pending: buildPending(input),
    });
  },

  markBlocked: () => {
    const { status } = get();
    if (status === 'loading' || status === 'approving' || status === 'rejecting') {
      return;
    }
    if (status === 'blocked') return;
    set({ ...INITIAL_STATE });
    useWorkflowProgressStore.getState().markStepIncomplete(WORKFLOW_STEP_ID_DIFF);
  },

  loadDiff: async () => {
    const current = get();
    if (current.pending === undefined) return;
    if (
      current.status === 'loading' ||
      current.status === 'approving' ||
      current.status === 'rejecting'
    ) {
      return;
    }

    set({ status: 'loading', error: undefined });

    let session: DiffReviewSession;
    try {
      session = await loadDiffReview({
        workspacePath: current.pending.workspacePath,
        sourcePath: current.pending.sourcePath,
        executionRunId: current.pending.executionRunId,
        planId: current.pending.planId,
        planStepId: current.pending.planStepId,
        stepTitle: current.pending.stepTitle,
        changedFiles: current.pending.changedFiles,
      });
    } catch (err) {
      set({
        status: 'failed',
        error: errorFromThrown(err),
      });
      return;
    }

    // Honour the run binding even if the user re-binds while the load is
    // in flight (we don't want a stale response to clobber a newer run).
    const after = get();
    if (after.pending?.executionRunId !== current.pending.executionRunId) {
      return;
    }

    const branchName =
      session.branchName ?? current.pending.branchName ?? undefined;
    const enriched: DiffReviewSession = {
      ...session,
      ...(branchName !== undefined ? { branchName } : {}),
      ...(current.pending.stepTitle !== undefined
        ? { stepTitle: current.pending.stepTitle }
        : {}),
    };

    set({
      status: 'ready',
      session: enriched,
      error: undefined,
    });
  },

  selectFile: (filePath) => {
    const current = get();
    if (current.session === undefined) return;
    const exists = current.session.files.some((f) => f.path === filePath);
    if (!exists) return;
    set({
      session: { ...current.session, selectedFilePath: filePath },
    });
  },

  approveDiff: async (reason) => {
    const current = get();
    if (current.session === undefined || current.pending === undefined) return;
    if (current.status === 'approved') return;
    if (current.status !== 'ready' && current.status !== 'failed') return;

    set({ status: 'approving', error: undefined });

    let decision: DiffReviewDecision;
    try {
      decision = await approveDiffReview({
        workspacePath: current.pending.workspacePath,
        executionRunId: current.pending.executionRunId,
        planId: current.pending.planId,
        planStepId: current.pending.planStepId,
      });
    } catch (err) {
      set({
        status: 'failed',
        error: errorFromThrown(err),
      });
      return;
    }

    const after = get();
    if (after.session === undefined || after.pending === undefined) return;
    if (after.pending.executionRunId !== current.pending.executionRunId) return;

    const enriched: DiffReviewDecision = {
      ...decision,
      ...(reason !== undefined ? { reason } : {}),
    };

    set({
      status: 'approved',
      session: {
        ...after.session,
        status: 'approved',
        decision: enriched,
        decidedAt: enriched.decidedAt,
      },
      error: undefined,
    });
    useWorkflowProgressStore.getState().markStepCompleted(WORKFLOW_STEP_ID_DIFF);
  },

  rejectDiff: async (reason) => {
    const current = get();
    if (current.session === undefined || current.pending === undefined) return;
    if (current.status === 'approved' || current.status === 'rejected') return;
    if (current.status !== 'ready' && current.status !== 'failed') return;

    set({ status: 'rejecting', error: undefined });

    let decision: DiffReviewDecision;
    try {
      decision = await rejectDiffReview({
        workspacePath: current.pending.workspacePath,
        sourcePath: current.pending.sourcePath,
        executionRunId: current.pending.executionRunId,
        planId: current.pending.planId,
        planStepId: current.pending.planStepId,
        changedFiles: current.pending.changedFiles,
      });
    } catch (err) {
      set({
        status: 'failed',
        error: errorFromThrown(err),
      });
      return;
    }

    const after = get();
    if (after.session === undefined || after.pending === undefined) return;
    if (after.pending.executionRunId !== current.pending.executionRunId) return;

    const enriched: DiffReviewDecision = {
      ...decision,
      ...(reason !== undefined ? { reason } : {}),
    };

    set({
      status: 'rejected',
      session: {
        ...after.session,
        status: 'rejected',
        decision: enriched,
        decidedAt: enriched.decidedAt,
      },
      error: undefined,
    });
    // Rejection: do NOT mark Diff Review complete. Also drop the upstream
    // `execute` completion so the user is forced to re-run before reviewing
    // again.
    const wf = useWorkflowProgressStore.getState();
    wf.markStepIncomplete(WORKFLOW_STEP_ID_DIFF);
    wf.markStepIncomplete(WORKFLOW_STEP_ID_EXECUTE);
  },

  resetReview: () => {
    set({ ...INITIAL_STATE });
    useWorkflowProgressStore.getState().markStepIncomplete(WORKFLOW_STEP_ID_DIFF);
  },

  clearIfExecutionChanges: (
    currentExecutionRunId,
    currentPlanId,
    currentWorkspacePath,
  ) => {
    const current = get();
    if (
      currentExecutionRunId === undefined ||
      currentPlanId === undefined ||
      currentWorkspacePath === undefined
    ) {
      if (current.status !== 'blocked') {
        set({ ...INITIAL_STATE });
        useWorkflowProgressStore.getState().markStepIncomplete(WORKFLOW_STEP_ID_DIFF);
      }
      return;
    }
    if (
      current.executionRunId !== undefined &&
      (current.executionRunId !== currentExecutionRunId ||
        current.planId !== currentPlanId ||
        current.workspacePath !== currentWorkspacePath)
    ) {
      set({ ...INITIAL_STATE });
      useWorkflowProgressStore.getState().markStepIncomplete(WORKFLOW_STEP_ID_DIFF);
    }
  },
}));

/* -------------------------------------------------------------------------- */
/* Internal helpers                                                           */
/* -------------------------------------------------------------------------- */

function buildPending(
  input: InitializeFromExecutionInput,
): PendingDiffReviewBinding {
  return {
    executionRunId: input.executionRunId,
    planId: input.planId,
    planStepId: input.planStepId,
    stepTitle: input.stepTitle,
    workspacePath: input.workspacePath,
    sourcePath: input.sourcePath,
    ...(input.branchName !== undefined ? { branchName: input.branchName } : {}),
    changedFiles: [...input.changedFiles],
  };
}

function errorFromThrown(err: unknown): DiffReviewError {
  if (err instanceof DiffReviewServiceError) {
    return {
      code: err.kind,
      message: err.message,
      ...(err.detail !== undefined ? { detail: err.detail } : {}),
    };
  }
  return {
    code: 'unknown',
    message: err instanceof Error ? err.message : String(err),
  };
}

/* -------------------------------------------------------------------------- */
/* Selectors                                                                  */
/* -------------------------------------------------------------------------- */

export const selectDiffReviewStatus = (s: DiffReviewStoreState): DiffReviewStatus =>
  s.status;
export const selectDiffReviewSession = (s: DiffReviewStoreState): DiffReviewSession | undefined =>
  s.session;
export const selectDiffReviewError = (s: DiffReviewStoreState): DiffReviewError | undefined =>
  s.error;
export const selectDiffReviewPending = (
  s: DiffReviewStoreState,
): PendingDiffReviewBinding | undefined => s.pending;
export const selectDiffReviewExecutionRunId = (
  s: DiffReviewStoreState,
): string | undefined => s.executionRunId;

export function selectSelectedDiffFile(s: DiffReviewStoreState) {
  if (s.session === undefined) return undefined;
  const path = s.session.selectedFilePath;
  if (path === undefined) return undefined;
  return s.session.files.find((f) => f.path === path);
}

/* Re-export the public state contract so external callers can type check. */
export type { DiffReviewState };
