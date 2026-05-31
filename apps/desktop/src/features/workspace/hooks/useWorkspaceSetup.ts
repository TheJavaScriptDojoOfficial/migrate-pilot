/**
 * Workspace setup store (Milestone 5 + Phase R5).
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
 * Phase R5 — Session persistence:
 *   - The persisted `WorkspaceState` + plan snapshot survive navigation
 *     and app reload via the zustand `persist` middleware (mirroring
 *     the migration-plan store).
 *   - Transient `creating`/`checking` statuses are normalised back to
 *     `idle` on write so a mid-flight reload never resurrects a stuck
 *     "Creating workspace" UI on next boot.
 *   - Preflight is intentionally *not* persisted — it must be re-run
 *     to refresh the live signals before the next workspace creation.
 *
 * Cross-store contract:
 *   - On successful workspace creation, the workflow step `workspace`
 *     is marked completed. `deriveWorkflowStatuses` then automatically
 *     promotes `execute` to the next reachable step.
 *   - When the upstream plan id changes, `clearIfPlanChanges` wipes any
 *     stale workspace state so the user is forced to re-run preflight.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { useWorkflowProgressStore } from '@shared/hooks/useWorkflowProgress';

import type { React19MigrationPlanV2 } from '@features/migration-plan';

import {
  WorkspaceServiceError,
  createWorkspace as createWorkspaceImpl,
  runWorkspacePreflight,
  writeWorkspaceSessionArtifacts,
} from '../services/workspaceService';
import { validateWorkspaceState } from '../services/workspaceValidationService';
import type {
  CreateWorkspaceRequest,
  CreateWorkspaceResult,
  WorkspaceCreationResult,
  WorkspaceError,
  WorkspaceGitStatus,
  WorkspacePackageManager,
  WorkspacePlanSnapshot,
  WorkspacePreflight,
  WorkspaceSetupState,
  WorkspaceState,
  WorkspaceStatus,
  WorkspaceStrategy,
} from '../types/workspace.types';

const WORKFLOW_STEP_ID = 'workspace';

/**
 * `localStorage` key used by the zustand `persist` middleware (Phase R5).
 *
 * Keep the version suffix in sync with the persisted shape: bumping it
 * is how we force-evict workspaces whose schema changed in a way the
 * rehydration merge cannot patch up.
 */
const WORKSPACE_STORAGE_KEY = 'migrate-pilot-workspace-v1';

/* -------------------------------------------------------------------------- */
/* Store shape                                                                */
/* -------------------------------------------------------------------------- */

export interface PreflightInput {
  readonly sourcePath: string;
  readonly projectName: string;
  readonly planId: string;
}

/**
 * Inputs accepted by the {@link createWorkspace} action. Combines the
 * preflight outcome (proposed branch + path + strategy) with the Phase
 * R5 metadata required to build a {@link WorkspaceState} and persist a
 * plan snapshot.
 */
export interface CreateInput {
  readonly sourcePath: string;
  readonly workspacePath: string;
  readonly branchName: string;
  readonly strategy: WorkspaceStrategy;
  readonly planId: string;
  readonly planSnapshot: React19MigrationPlanV2;
  readonly packageManager?: WorkspacePackageManager;
  readonly gitStatus: WorkspaceGitStatus;
}

interface WorkspaceSetupActions {
  /** Mark the screen blocked because no plan is approved. */
  markBlocked: () => void;
  /** Move out of the blocked state once a plan is approved. */
  markUnblocked: (planId: string) => void;
  /** Run the safe, read-only preflight against the source project. */
  runPreflight: (input: PreflightInput) => Promise<void>;
  /** Create the workspace with the user-confirmed parameters. */
  createWorkspace: (input: CreateInput) => Promise<CreateWorkspaceResult>;
  /** Reset everything; drops the workspace workflow completion. */
  resetWorkspace: () => void;
  /** Drop everything if the upstream plan id changed. */
  clearIfPlanChanges: (currentPlanId: string | undefined) => void;
}

interface WorkspaceSetupStoreState {
  readonly status: WorkspaceStatus;
  readonly preflight: WorkspacePreflight | undefined;
  readonly result: WorkspaceCreationResult | undefined;
  /**
   * Phase R5 — persisted workspace metadata. The execution screen and
   * downstream features consume this rather than `result`.
   */
  readonly workspace: WorkspaceState | undefined;
  /**
   * Phase R5 — frozen plan snapshot tied to the current workspace. The
   * execution screen reads it for display and the on-disk artifact
   * writer serialises it to `plan-snapshot.json`.
   */
  readonly planSnapshot: WorkspacePlanSnapshot | undefined;
  readonly error: WorkspaceError | undefined;
  readonly planId: string | undefined;
}

type Store = WorkspaceSetupStoreState & WorkspaceSetupActions;

const INITIAL_STATE: WorkspaceSetupStoreState = {
  status: 'blocked',
  preflight: undefined,
  result: undefined,
  workspace: undefined,
  planSnapshot: undefined,
  error: undefined,
  planId: undefined,
};

/* -------------------------------------------------------------------------- */
/* Store                                                                      */
/* -------------------------------------------------------------------------- */

export const useWorkspaceSetupStore = create<Store>()(
  persist(
    (set, get) => ({
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
          const error: WorkspaceError = {
            kind: 'preflight-failed',
            message: 'Run preflight before creating the workspace.',
          };
          set({ status: 'failed', error });
          return { success: false, error: error.message };
        }
        if (preflight.blockers.length > 0) {
          const error: WorkspaceError = {
            kind: 'preflight-blocked',
            message:
              'Workspace creation is blocked. Resolve the listed blockers and retry preflight.',
          };
          set({ status: 'failed', error });
          return { success: false, error: error.message };
        }
        if (input.strategy === 'copy' && !preflight.fallbackAvailable) {
          const error: WorkspaceError = {
            kind: 'invalid-input',
            message: 'Copy fallback is not enabled in V1.',
          };
          set({ status: 'failed', error });
          return { success: false, error: error.message };
        }
        if (status === 'creating') {
          return {
            success: false,
            error: 'Workspace creation already in progress.',
          };
        }

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
          const error = errorFromThrown(err, 'creation-failed');
          set({ status: 'failed', error });
          useWorkflowProgressStore
            .getState()
            .markStepIncomplete(WORKFLOW_STEP_ID);
          return {
            success: false,
            error: error.message,
            ...(error.detail !== undefined ? { warnings: [error.detail] } : {}),
          };
        }

        // Build the persisted Phase R5 contracts.
        const branchName =
          typeof result.branchName === 'string' && result.branchName.length > 0
            ? result.branchName
            : input.branchName;

        const workspace: WorkspaceState = {
          originalProjectPath: result.sourcePath,
          workspacePath: result.workspacePath,
          branchName,
          strategy: result.strategy,
          createdAt: result.createdAt,
          gitStatus: input.gitStatus,
          ...(input.packageManager !== undefined
            ? { packageManager: input.packageManager }
            : {}),
          planId: input.planId,
        };

        const planSnapshot: WorkspacePlanSnapshot = {
          planId: input.planSnapshot.id,
          planVersion: input.planSnapshot.version,
          track: input.planSnapshot.track,
          title: input.planSnapshot.title,
          summaryText: input.planSnapshot.summaryText,
          sourceReactVersion: input.planSnapshot.sourceReactVersion,
          targetReactVersion: input.planSnapshot.targetReactVersion,
          ...(input.planSnapshot.approvedAt !== undefined
            ? { approvedAt: input.planSnapshot.approvedAt }
            : {}),
          steps: input.planSnapshot.steps,
          workspacePath: workspace.workspacePath,
          branchName: workspace.branchName,
          strategy: workspace.strategy,
          createdAt: workspace.createdAt,
        };

        // Best-effort artifact write. We do not fail workspace creation
        // if the artifact dump fails — the in-memory persisted store is
        // still the source of truth for execution.
        const warnings: string[] = [];
        try {
          await writeWorkspaceSessionArtifacts({ workspace, planSnapshot });
        } catch (err) {
          warnings.push(
            err instanceof Error
              ? `Failed to persist session artifact: ${err.message}`
              : `Failed to persist session artifact: ${String(err)}`,
          );
        }

        set({
          status: 'created',
          result,
          workspace,
          planSnapshot,
          error: undefined,
        });
        useWorkflowProgressStore.getState().markStepCompleted(WORKFLOW_STEP_ID);

        return {
          success: true,
          workspace,
          ...(warnings.length > 0 ? { warnings } : {}),
        };
      },

      resetWorkspace: () => {
        set({ ...INITIAL_STATE, status: 'idle' });
        useWorkflowProgressStore.getState().markStepIncomplete(WORKFLOW_STEP_ID);
      },

      clearIfPlanChanges: (currentPlanId) => {
        const { planId } = get();
        if (currentPlanId === undefined) {
          set({ ...INITIAL_STATE });
          useWorkflowProgressStore.getState().markStepIncomplete(WORKFLOW_STEP_ID);
          return;
        }
        if (planId !== undefined && planId !== currentPlanId) {
          set({ ...INITIAL_STATE, status: 'idle', planId: currentPlanId });
          useWorkflowProgressStore.getState().markStepIncomplete(WORKFLOW_STEP_ID);
        }
      },
    }),
    {
      name: WORKSPACE_STORAGE_KEY,
      /**
       * Persist only the durable state — `preflight` is intentionally
       * dropped because the live Git/path signals must be re-fetched
       * before the next workspace creation. Transient `creating` and
       * `checking` statuses are coerced back to `idle` so a mid-flight
       * reload does not resurrect a stuck loading screen.
       */
      partialize: (state) => ({
        status:
          state.status === 'creating' || state.status === 'checking'
            ? 'idle'
            : state.status,
        result: state.result,
        workspace: state.workspace,
        planSnapshot: state.planSnapshot,
        error: state.error,
        planId: state.planId,
      }),
      merge: (persistedState, currentState) => {
        const persisted = (persistedState ?? {}) as Partial<WorkspaceSetupStoreState>;
        const merged: Store = { ...currentState, ...persisted };
        return {
          ...merged,
          status:
            merged.status === 'creating' || merged.status === 'checking'
              ? 'idle'
              : merged.status,
        };
      },
    },
  ),
);

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

/** Phase R5 — persisted workspace metadata used by execution + diff review. */
export const selectWorkspaceState = (
  s: WorkspaceSetupStoreState,
): WorkspaceState | undefined => s.workspace;

/** Phase R5 — frozen plan snapshot persisted with the workspace. */
export const selectWorkspacePlanSnapshot = (
  s: WorkspaceSetupStoreState,
): WorkspacePlanSnapshot | undefined => s.planSnapshot;

/**
 * Phase R5 — convenience selector for execution-screen guards.
 *
 * Picks the canonical workspace path from the persisted
 * {@link WorkspaceState}. Returns `undefined` when no workspace has
 * been created yet (or the persisted workspace is invalid).
 */
export const selectWorkspacePath = (
  s: WorkspaceSetupStoreState,
): string | undefined =>
  s.workspace?.workspacePath !== undefined &&
  s.workspace.workspacePath.trim().length > 0
    ? s.workspace.workspacePath
    : undefined;

export function selectHasWorkspace(s: WorkspaceSetupStoreState): boolean {
  return s.status === 'created' && s.workspace !== undefined;
}

/**
 * Phase R5 — strict variant used by the execution guard.
 *
 * Returns `true` only when the persisted {@link WorkspaceState} passes
 * every state-level rule from
 * {@link validateWorkspaceState}. The execution screen still performs
 * an async filesystem check on top — but a `false` here is enough to
 * block dispatch immediately without any Tauri round-trip.
 */
export function selectHasValidWorkspace(s: WorkspaceSetupStoreState): boolean {
  if (!selectHasWorkspace(s)) return false;
  return validateWorkspaceState(s.workspace, s.planId).valid;
}

/* Re-export the public state contract so external callers can type check. */
export type { WorkspaceSetupState };
/* Re-export Phase R5 contracts via the hook module so consumers do not
 * have to depend on the types module directly. */
export type { CreateWorkspaceRequest, CreateWorkspaceResult };
