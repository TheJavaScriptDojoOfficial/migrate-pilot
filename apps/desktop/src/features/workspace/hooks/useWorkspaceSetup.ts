/**
 * Workspace setup store (Milestone 5).
 *
 * Owns the workspace state machine and synchronises completion into the
 * cross-feature workflow store so the next step (Execute Migration)
 * becomes reachable.
 *
 * Why a dedicated store rather than `useSessionStore`?
 *   - Keeps the workspace-in-progress state machine + preflight payload
 *     out of the small session store. The session store only needs to
 *     know whether a workspace exists.
 *   - Resets cleanly when the upstream plan changes.
 *
 * Cross-store contract:
 *   - On successful workspace creation, the workflow step `workspace`
 *     is marked completed. `deriveWorkflowStatuses` then automatically
 *     promotes `execute` to the next reachable step.
 *   - When the upstream plan id changes, `clearIfPlanChanges` wipes any
 *     stale workspace state so the user is forced to re-run preflight.
 */
import { create } from 'zustand';

import { useWorkflowProgressStore } from '@shared/hooks/useWorkflowProgress';

import {
  WorkspaceServiceError,
  createWorkspace as createWorkspaceImpl,
  runWorkspacePreflight,
} from '../services/workspaceService';
import type {
  WorkspaceCreationResult,
  WorkspaceError,
  WorkspacePreflight,
  WorkspaceSetupState,
  WorkspaceStatus,
} from '../types/workspace.types';

const WORKFLOW_STEP_ID = 'workspace';

/* -------------------------------------------------------------------------- */
/* Store shape                                                                */
/* -------------------------------------------------------------------------- */

export interface PreflightInput {
  readonly sourcePath: string;
  readonly projectName: string;
  readonly planId: string;
}

export interface CreateInput {
  readonly sourcePath: string;
  readonly workspacePath: string;
  readonly branchName: string;
  readonly strategy: 'git-worktree' | 'copy';
}

interface WorkspaceSetupActions {
  /** Mark the screen blocked because no plan is approved. */
  markBlocked: () => void;
  /** Move out of the blocked state once a plan is approved. */
  markUnblocked: (planId: string) => void;
  /** Run the safe, read-only preflight against the source project. */
  runPreflight: (input: PreflightInput) => Promise<void>;
  /** Create the workspace with the user-confirmed parameters. */
  createWorkspace: (input: CreateInput) => Promise<void>;
  /** Reset everything; drops the workspace workflow completion. */
  resetWorkspace: () => void;
  /** Drop everything if the upstream plan id changed. */
  clearIfPlanChanges: (currentPlanId: string | undefined) => void;
}

interface WorkspaceSetupStoreState {
  readonly status: WorkspaceStatus;
  readonly preflight: WorkspacePreflight | undefined;
  readonly result: WorkspaceCreationResult | undefined;
  readonly error: WorkspaceError | undefined;
  readonly planId: string | undefined;
}

type Store = WorkspaceSetupStoreState & WorkspaceSetupActions;

const INITIAL_STATE: WorkspaceSetupStoreState = {
  status: 'blocked',
  preflight: undefined,
  result: undefined,
  error: undefined,
  planId: undefined,
};

/* -------------------------------------------------------------------------- */
/* Store                                                                      */
/* -------------------------------------------------------------------------- */

export const useWorkspaceSetupStore = create<Store>((set, get) => ({
  ...INITIAL_STATE,

  markBlocked: () => {
    const { status } = get();
    // Don't disturb an in-flight or completed workspace just because a
    // selector snapshot returned `false` momentarily.
    if (status === 'creating' || status === 'created') return;
    set({ ...INITIAL_STATE });
    useWorkflowProgressStore.getState().markStepIncomplete(WORKFLOW_STEP_ID);
  },

  markUnblocked: (planId) => {
    const current = get();
    if (current.planId !== planId) {
      set({ ...INITIAL_STATE, status: 'idle', planId });
      useWorkflowProgressStore.getState().markStepIncomplete(WORKFLOW_STEP_ID);
      return;
    }
    if (current.status === 'blocked') {
      set({ ...current, status: 'idle' });
    }
  },

  runPreflight: async (input) => {
    set({
      status: 'checking',
      error: undefined,
      planId: input.planId,
    });

    let preflight: WorkspacePreflight;
    try {
      preflight = await runWorkspacePreflight({
        sourcePath: input.sourcePath,
        projectName: input.projectName,
      });
    } catch (err) {
      set({
        status: 'failed',
        error: errorFromThrown(err, 'preflight-failed'),
      });
      useWorkflowProgressStore.getState().markStepIncomplete(WORKFLOW_STEP_ID);
      return;
    }

    set({
      status: 'ready',
      preflight,
      error: undefined,
    });
    // Preflight alone never marks the step complete.
    useWorkflowProgressStore.getState().markStepIncomplete(WORKFLOW_STEP_ID);
  },

  createWorkspace: async (input) => {
    const { preflight, status } = get();
    if (preflight === undefined) {
      set({
        status: 'failed',
        error: {
          kind: 'preflight-failed',
          message: 'Run preflight before creating the workspace.',
        },
      });
      return;
    }
    if (preflight.blockers.length > 0) {
      set({
        status: 'failed',
        error: {
          kind: 'preflight-blocked',
          message:
            'Workspace creation is blocked. Resolve the listed blockers and retry preflight.',
        },
      });
      return;
    }
    if (input.strategy === 'copy' && !preflight.fallbackAvailable) {
      set({
        status: 'failed',
        error: {
          kind: 'invalid-input',
          message: 'Copy fallback is not enabled in V1.',
        },
      });
      return;
    }
    if (status === 'creating') return;

    set({ status: 'creating', error: undefined });

    let result: WorkspaceCreationResult;
    try {
      result = await createWorkspaceImpl({
        sourcePath: input.sourcePath,
        workspacePath: input.workspacePath,
        branchName: input.branchName,
        strategy: input.strategy,
      });
    } catch (err) {
      set({
        status: 'failed',
        error: errorFromThrown(err, 'creation-failed'),
      });
      useWorkflowProgressStore.getState().markStepIncomplete(WORKFLOW_STEP_ID);
      return;
    }

    set({
      status: 'created',
      result,
      error: undefined,
    });
    useWorkflowProgressStore.getState().markStepCompleted(WORKFLOW_STEP_ID);
  },

  resetWorkspace: () => {
    set({ ...INITIAL_STATE, status: 'idle' });
    useWorkflowProgressStore.getState().markStepIncomplete(WORKFLOW_STEP_ID);
  },

  clearIfPlanChanges: (currentPlanId) => {
    const { planId } = get();
    if (currentPlanId === undefined) {
      // Plan was reset upstream — block the screen entirely.
      set({ ...INITIAL_STATE });
      useWorkflowProgressStore.getState().markStepIncomplete(WORKFLOW_STEP_ID);
      return;
    }
    if (planId !== undefined && planId !== currentPlanId) {
      set({ ...INITIAL_STATE, status: 'idle', planId: currentPlanId });
      useWorkflowProgressStore.getState().markStepIncomplete(WORKFLOW_STEP_ID);
    }
  },
}));

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function errorFromThrown(
  err: unknown,
  fallbackKind: WorkspaceError['kind'],
): WorkspaceError {
  if (err instanceof WorkspaceServiceError) {
    const kind: WorkspaceError['kind'] =
      err.kind === 'tauri-unavailable'
        ? 'tauri-unavailable'
        : err.kind === 'invalid-input'
          ? 'invalid-input'
          : err.kind === 'preflight-failed'
            ? 'preflight-failed'
            : 'creation-failed';
    return {
      kind,
      message: err.message,
      ...(err.detail !== undefined ? { detail: err.detail } : {}),
    };
  }
  return {
    kind: fallbackKind,
    message: err instanceof Error ? err.message : String(err),
  };
}

/* -------------------------------------------------------------------------- */
/* Selectors                                                                  */
/* -------------------------------------------------------------------------- */

export const selectWorkspaceStatus = (s: WorkspaceSetupStoreState): WorkspaceStatus =>
  s.status;
export const selectWorkspacePreflight = (
  s: WorkspaceSetupStoreState,
): WorkspacePreflight | undefined => s.preflight;
export const selectWorkspaceResult = (
  s: WorkspaceSetupStoreState,
): WorkspaceCreationResult | undefined => s.result;
export const selectWorkspaceError = (
  s: WorkspaceSetupStoreState,
): WorkspaceError | undefined => s.error;

export function selectHasWorkspace(s: WorkspaceSetupStoreState): boolean {
  return s.status === 'created' && s.result !== undefined;
}

/* Re-export the public state contract so external callers can type check. */
export type { WorkspaceSetupState };
