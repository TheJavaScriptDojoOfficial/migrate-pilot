/**
 * Execution engine store (Milestone 6).
 *
 * Owns the execution state machine, capability cache, per-step status,
 * captured runs, and engine-level errors. Synchronises completion of one
 * supported scripted execution into the cross-feature workflow store so
 * the next step (Diff Review) becomes reachable in the next milestone.
 *
 * Why a dedicated store rather than `useSessionStore`?
 *   - Keeps the per-step execution state machine, log buffers, and
 *     changed-file lists out of the small session store.
 *   - Resets cleanly when the upstream plan id or workspace path changes.
 *
 * Cross-store contract:
 *   - On the first successful supported execution, the workflow step
 *     `execute` is marked completed. `deriveWorkflowStatuses` then
 *     automatically promotes `diff` to the next reachable step.
 *   - When the upstream plan id or workspace path changes,
 *     `clearIfPlanOrWorkspaceChanges` wipes any stale execution state so
 *     the user is forced to re-evaluate capability before re-running.
 */
import { create } from 'zustand';

import { useWorkflowProgressStore } from '@shared/hooks/useWorkflowProgress';

import {
  isPotentiallyExecutable,
  localExecutionPreCapability,
  NODE_SASS_PLAN_STEP_ID,
} from '../services/executionCapabilityService';
import {
  ExecutionServiceError,
  checkExecutionCapability,
  runExecutionStep,
} from '../services/executionService';
import type {
  ExecutionCapability,
  ExecutionEngineState,
  ExecutionError,
  ExecutionStepRun,
  ExecutionStepStatus,
} from '../types/execution.types';

const WORKFLOW_STEP_ID = 'execute';

/* -------------------------------------------------------------------------- */
/* Store shape                                                                */
/* -------------------------------------------------------------------------- */

export interface InitializeInput {
  readonly planId: string;
  readonly workspacePath: string;
  readonly sourcePath: string;
  readonly branchName?: string;
  /** Plan steps the user can choose from. */
  readonly planSteps: readonly { id: string; title: string }[];
}

interface ExecutionEngineActions {
  /**
   * Bind the store to the current approved plan + created workspace.
   *
   * Idempotent: if the plan id and workspace path have not changed the
   * existing capability cache, runs, and step statuses are preserved.
   */
  initializeFromPlanAndWorkspace: (input: InitializeInput) => void;
  /** Mark the engine blocked because plan or workspace are missing. */
  markBlocked: () => void;
  /** Highlight a plan step in the UI. Does not run anything. */
  selectStep: (planStepId: string) => void;
  /** Probe executor capability for a plan step. Updates `capabilities`. */
  checkCapability: (planStepId: string, stepTitle: string) => Promise<void>;
  /** Run the currently selected step using the scripted executor. */
  runSelectedStep: () => Promise<void>;
  /** Re-run a specific step. Used by the failure-state retry button. */
  retryStep: (planStepId: string, stepTitle: string) => Promise<void>;
  /** Reset the entire engine state. Drops the workflow completion. */
  resetExecution: () => void;
  /** Drop everything if the upstream plan or workspace changed. */
  clearIfPlanOrWorkspaceChanges: (
    currentPlanId: string | undefined,
    currentWorkspacePath: string | undefined,
  ) => void;
}

/**
 * Internal store shape. Uses `T | undefined` instead of `?:` so we can
 * explicitly clear values via `set({ x: undefined })` without tripping
 * `exactOptionalPropertyTypes`. The public {@link ExecutionEngineState}
 * mirrors the same fields with optional markers for external consumers.
 */
interface ExecutionEngineStoreState {
  readonly status: ExecutionEngineState['status'];
  readonly planId: string | undefined;
  readonly workspacePath: string | undefined;
  readonly branchName: string | undefined;
  readonly sourcePath: string | undefined;
  readonly selectedPlanStepId: string | undefined;
  readonly capabilities: Readonly<Record<string, ExecutionCapability>>;
  readonly stepStatuses: Readonly<Record<string, ExecutionStepStatus>>;
  readonly runs: Readonly<Record<string, ExecutionStepRun>>;
  readonly latestRun: ExecutionStepRun | undefined;
  readonly error: ExecutionError | undefined;
}

type Store = ExecutionEngineStoreState & ExecutionEngineActions;

const INITIAL_STATE: ExecutionEngineStoreState = {
  status: 'blocked',
  planId: undefined,
  workspacePath: undefined,
  branchName: undefined,
  sourcePath: undefined,
  selectedPlanStepId: undefined,
  capabilities: {},
  stepStatuses: {},
  runs: {},
  latestRun: undefined,
  error: undefined,
};

/* -------------------------------------------------------------------------- */
/* Store                                                                      */
/* -------------------------------------------------------------------------- */

export const useExecutionEngineStore = create<Store>((set, get) => ({
  ...INITIAL_STATE,

  initializeFromPlanAndWorkspace: (input) => {
    const current = get();
    const sameSession =
      current.planId === input.planId &&
      current.workspacePath === input.workspacePath;

    // Pre-classify every plan step so the UI can render unsupported
    // badges immediately. Steps that *might* be executable get a "verify
    // against the workspace" pre-capability; the IPC check upgrades it.
    const nextCapabilities: Record<string, ExecutionCapability> = sameSession
      ? { ...current.capabilities }
      : {};
    const nextStepStatuses: Record<string, ExecutionStepStatus> = sameSession
      ? { ...current.stepStatuses }
      : {};

    for (const planStep of input.planSteps) {
      if (!sameSession || nextCapabilities[planStep.id] === undefined) {
        nextCapabilities[planStep.id] = localExecutionPreCapability(planStep);
      }
      if (!sameSession || nextStepStatuses[planStep.id] === undefined) {
        nextStepStatuses[planStep.id] = isPotentiallyExecutable(planStep)
          ? 'pending'
          : 'unsupported';
      }
    }

    const nextRuns = sameSession ? current.runs : {};
    const nextSelected = sameSession
      ? current.selectedPlanStepId
      : pickInitialSelection(input.planSteps);

    const nextStatus: ExecutionEngineState['status'] = sameSession
      ? deriveStatus(current, nextSelected, nextStepStatuses)
      : 'idle';

    set({
      status: nextStatus,
      planId: input.planId,
      workspacePath: input.workspacePath,
      sourcePath: input.sourcePath,
      branchName: input.branchName,
      capabilities: nextCapabilities,
      stepStatuses: nextStepStatuses,
      runs: nextRuns,
      latestRun: sameSession ? current.latestRun : undefined,
      error: sameSession ? current.error : undefined,
      selectedPlanStepId: nextSelected,
    });
  },

  markBlocked: () => {
    const { status } = get();
    if (status === 'running') return;
    set({ ...INITIAL_STATE });
    useWorkflowProgressStore.getState().markStepIncomplete(WORKFLOW_STEP_ID);
  },

  selectStep: (planStepId) => {
    const current = get();
    if (current.status === 'running') return;
    const stepStatus = current.stepStatuses[planStepId];
    if (stepStatus === undefined) return;
    set({
      selectedPlanStepId: planStepId,
      status: deriveStatus(current, planStepId, current.stepStatuses),
      error: undefined,
    });
  },

  checkCapability: async (planStepId, stepTitle) => {
    const current = get();
    if (current.workspacePath === undefined || current.sourcePath === undefined) {
      return;
    }
    if (current.status === 'running') return;

    let capability: ExecutionCapability;
    try {
      capability = await checkExecutionCapability({
        workspacePath: current.workspacePath,
        sourcePath: current.sourcePath,
        planStepId,
        stepTitle,
      });
    } catch (err) {
      const error = errorFromThrown(err);
      const fallback: ExecutionCapability = {
        planStepId,
        executable: false,
        reason: error.message,
      };
      set({
        capabilities: { ...current.capabilities, [planStepId]: fallback },
        error,
      });
      return;
    }

    const nextStepStatuses: Record<string, ExecutionStepStatus> = {
      ...current.stepStatuses,
    };
    const previous = nextStepStatuses[planStepId];
    // Never overwrite a terminal run status with the capability probe.
    if (previous !== 'completed' && previous !== 'failed' && previous !== 'running') {
      nextStepStatuses[planStepId] = capability.executable ? 'pending' : 'unsupported';
    }

    set({
      capabilities: { ...current.capabilities, [planStepId]: capability },
      stepStatuses: nextStepStatuses,
      status: deriveStatus(current, current.selectedPlanStepId, nextStepStatuses),
      error: undefined,
    });
  },

  runSelectedStep: async () => {
    const current = get();
    const planStepId = current.selectedPlanStepId;
    if (planStepId === undefined) return;
    const capability = current.capabilities[planStepId];
    if (capability === undefined) return;
    if (planStepId !== NODE_SASS_PLAN_STEP_ID) return;
    if (
      current.planId === undefined ||
      current.workspacePath === undefined ||
      current.sourcePath === undefined
    ) {
      return;
    }
    if (current.status === 'running') return;
    if (!capability.executable) return;

    await executeStepInternal(set, get, planStepId, capabilityStepTitle(capability));
  },

  retryStep: async (planStepId, stepTitle) => {
    const current = get();
    if (current.status === 'running') return;
    if (
      current.planId === undefined ||
      current.workspacePath === undefined ||
      current.sourcePath === undefined
    ) {
      return;
    }
    set({ selectedPlanStepId: planStepId });
    await executeStepInternal(set, get, planStepId, stepTitle);
  },

  resetExecution: () => {
    set({ ...INITIAL_STATE });
    useWorkflowProgressStore.getState().markStepIncomplete(WORKFLOW_STEP_ID);
  },

  clearIfPlanOrWorkspaceChanges: (currentPlanId, currentWorkspacePath) => {
    const current = get();
    if (currentPlanId === undefined || currentWorkspacePath === undefined) {
      if (current.status !== 'blocked') {
        set({ ...INITIAL_STATE });
        useWorkflowProgressStore.getState().markStepIncomplete(WORKFLOW_STEP_ID);
      }
      return;
    }
    if (
      current.planId !== undefined &&
      (current.planId !== currentPlanId ||
        current.workspacePath !== currentWorkspacePath)
    ) {
      set({ ...INITIAL_STATE });
      useWorkflowProgressStore.getState().markStepIncomplete(WORKFLOW_STEP_ID);
    }
  },
}));

/* -------------------------------------------------------------------------- */
/* Internal helpers                                                           */
/* -------------------------------------------------------------------------- */

async function executeStepInternal(
  set: (
    partial:
      | Partial<ExecutionEngineStoreState>
      | ((s: ExecutionEngineStoreState) => Partial<ExecutionEngineStoreState>),
  ) => void,
  get: () => ExecutionEngineStoreState,
  planStepId: string,
  stepTitle: string,
): Promise<void> {
  const current = get();
  if (
    current.planId === undefined ||
    current.workspacePath === undefined ||
    current.sourcePath === undefined
  ) {
    return;
  }

  set({
    status: 'running',
    selectedPlanStepId: planStepId,
    stepStatuses: { ...current.stepStatuses, [planStepId]: 'running' },
    error: undefined,
  });

  let run: ExecutionStepRun;
  try {
    run = await runExecutionStep({
      workspacePath: current.workspacePath,
      sourcePath: current.sourcePath,
      planId: current.planId,
      planStepId,
      stepTitle,
    });
  } catch (err) {
    const error = errorFromThrown(err);
    const after = get();
    const failedRun: ExecutionStepRun = {
      id: `run:${planStepId}:${Date.now()}`,
      planId: after.planId ?? '',
      planStepId,
      stepTitle,
      workspacePath: after.workspacePath ?? '',
      status: 'failed',
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      executor: 'scripted',
      changedFiles: [],
      logs: [
        {
          timestamp: new Date().toISOString(),
          level: 'error',
          message: error.message,
          ...(error.detail !== undefined ? { detail: error.detail } : {}),
        },
      ],
      error,
    };
    set({
      status: 'failed',
      stepStatuses: { ...after.stepStatuses, [planStepId]: 'failed' },
      runs: { ...after.runs, [planStepId]: failedRun },
      latestRun: failedRun,
      error,
    });
    useWorkflowProgressStore.getState().markStepIncomplete(WORKFLOW_STEP_ID);
    return;
  }

  const after = get();
  const status: ExecutionEngineState['status'] =
    run.status === 'failed' ? 'failed' : 'completed';
  const stepStatus: ExecutionStepStatus =
    run.status === 'failed' ? 'failed' : 'completed';

  set({
    status,
    stepStatuses: { ...after.stepStatuses, [planStepId]: stepStatus },
    runs: { ...after.runs, [planStepId]: run },
    latestRun: run,
    error: run.error,
  });

  if (status === 'completed') {
    useWorkflowProgressStore.getState().markStepCompleted(WORKFLOW_STEP_ID);
  } else {
    useWorkflowProgressStore.getState().markStepIncomplete(WORKFLOW_STEP_ID);
  }
}

function pickInitialSelection(
  planSteps: readonly { id: string; title: string }[],
): string | undefined {
  const supported = planSteps.find((s) => isPotentiallyExecutable(s));
  if (supported !== undefined) return supported.id;
  return planSteps[0]?.id;
}

function deriveStatus(
  current: Pick<ExecutionEngineStoreState, 'status'>,
  selectedId: string | undefined,
  stepStatuses: Readonly<Record<string, ExecutionStepStatus>>,
): ExecutionEngineState['status'] {
  if (current.status === 'running') return 'running';
  if (selectedId === undefined) return 'idle';
  const stepStatus = stepStatuses[selectedId];
  if (stepStatus === 'completed') return 'completed';
  if (stepStatus === 'failed') return 'failed';
  if (stepStatus === 'pending') return 'ready';
  return 'idle';
}

function capabilityStepTitle(capability: ExecutionCapability): string {
  if (capability.planStepId === NODE_SASS_PLAN_STEP_ID) {
    return 'Replace node-sass with sass';
  }
  return capability.planStepId;
}

function errorFromThrown(err: unknown): ExecutionError {
  if (err instanceof ExecutionServiceError) {
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

export const selectExecutionStatus = (s: ExecutionEngineStoreState) => s.status;
export const selectSelectedStepId = (s: ExecutionEngineStoreState) =>
  s.selectedPlanStepId;
export const selectCapabilities = (s: ExecutionEngineStoreState) => s.capabilities;
export const selectStepStatuses = (s: ExecutionEngineStoreState) => s.stepStatuses;
export const selectRuns = (s: ExecutionEngineStoreState) => s.runs;
export const selectLatestRun = (s: ExecutionEngineStoreState) => s.latestRun;
export const selectExecutionError = (s: ExecutionEngineStoreState) => s.error;
export const selectExecutionPlanId = (s: ExecutionEngineStoreState) => s.planId;
export const selectExecutionWorkspacePath = (s: ExecutionEngineStoreState) =>
  s.workspacePath;
export const selectExecutionBranchName = (s: ExecutionEngineStoreState) =>
  s.branchName;

export function selectStepStatus(
  s: ExecutionEngineStoreState,
  planStepId: string | undefined,
): ExecutionStepStatus {
  if (planStepId === undefined) return 'pending';
  return s.stepStatuses[planStepId] ?? 'pending';
}

export function selectCapabilityFor(
  s: ExecutionEngineStoreState,
  planStepId: string | undefined,
): ExecutionCapability | undefined {
  if (planStepId === undefined) return undefined;
  return s.capabilities[planStepId];
}

export function selectRunFor(
  s: ExecutionEngineStoreState,
  planStepId: string | undefined,
): ExecutionStepRun | undefined {
  if (planStepId === undefined) return undefined;
  return s.runs[planStepId];
}

/* Re-export the public state contract so external callers can type check. */
export type { ExecutionEngineState };
