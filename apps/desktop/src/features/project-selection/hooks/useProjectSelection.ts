import { create } from 'zustand';

import type { Project } from '@shared/types/project';
import { useSessionStore } from '@shared/hooks/useSessionState';
import { useWorkflowProgressStore } from '@shared/hooks/useWorkflowProgress';
import { WORKFLOW_STEP_BY_ID } from '@shared/constants/workflow';

import {
  pickProjectFolder,
  readProjectMetadata,
  ProjectMetadataReadError,
} from '../services/projectMetadataService';
import {
  INITIAL_PROJECT_SELECTION_STATE,
  buildErrorState,
  validateProjectRead,
} from '../services/projectValidationService';
import type {
  ProjectMetadata,
  ProjectSelectionState,
  ProjectValidationIssue,
} from '../types/projectSelection.types';

/**
 * Zustand store dedicated to the project-selection workflow step.
 *
 * Why a dedicated store rather than `useSessionStore`?
 *   - Keeps the noisy in-progress state machine (`selecting` /
 *     `validating` / issues list) out of the small session store.
 *   - The session store only ever sees a vetted `Project` snapshot.
 *   - Resets cleanly when the user picks a different folder.
 *
 * Cross-store contract:
 *   - On a successful validation, the store also calls
 *     `useSessionStore.setProject(...)` so the title bar / sidebar reflect
 *     the active project. The translation from `ProjectMetadata` →
 *     `Project` happens in `metadataToProject` below.
 *   - When the user resets, both stores are cleared.
 */

interface ProjectSelectionStoreActions {
  /** Open the folder picker, then read + validate. */
  selectFolder: () => Promise<void>;
  /** Re-validate the currently selected path (if any). */
  refresh: () => Promise<void>;
  /** Discard any selected project + reset both stores. */
  reset: () => void;
}

type Store = ProjectSelectionState & ProjectSelectionStoreActions;

export const useProjectSelectionStore = create<Store>((set, get) => ({
  ...INITIAL_PROJECT_SELECTION_STATE,

  selectFolder: async () => {
    set({ status: 'selecting', issues: [] });

    let pickedPath: string | null;
    try {
      pickedPath = await pickProjectFolder();
    } catch (err) {
      set(stateFromReadError(err));
      return;
    }

    if (pickedPath == null) {
      // User cancelled the picker. Reset to the previous quiet state, but
      // keep any prior valid metadata so cancel ≠ destructive.
      const prior = get().metadata;
      set({
        status: prior ? 'valid' : 'idle',
        ...(prior ? { metadata: prior } : {}),
        issues: [],
      });
      return;
    }

    await runValidation(pickedPath, set);
  },

  refresh: async () => {
    const { metadata } = get();
    if (!metadata) return;
    await runValidation(metadata.path, set);
  },

  reset: () => {
    set({ ...INITIAL_PROJECT_SELECTION_STATE });
    useSessionStore.getState().setProject(undefined);
    useWorkflowProgressStore.getState().markStepIncomplete('project');
  },
}));

// ---------------------------------------------------------------------------
// internal helpers
// ---------------------------------------------------------------------------

async function runValidation(
  path: string,
  set: (partial: Partial<Store>) => void,
): Promise<void> {
  set({ status: 'validating', issues: [] });

  let next: ProjectSelectionState;
  try {
    const read = await readProjectMetadata(path);
    next = validateProjectRead(read);
  } catch (err) {
    next = stateFromReadError(err);
  }

  set({
    status: next.status,
    issues: next.issues,
    ...(next.metadata !== undefined ? { metadata: next.metadata } : {}),
  });

  syncSessionStore(next);
}

/**
 * Translate any thrown error from the read pipeline into a
 * `ProjectSelectionState`. Keeps render code branch-free at the call site.
 */
function stateFromReadError(err: unknown): ProjectSelectionState {
  if (err instanceof ProjectMetadataReadError) {
    if (err.kind === 'tauri-unavailable') {
      const issue: ProjectValidationIssue = {
        type: 'error',
        code: 'PICKER_UNAVAILABLE',
        title: 'Folder picker unavailable',
        description: err.message,
      };
      return buildErrorState(issue);
    }
    const issue: ProjectValidationIssue = {
      type: 'error',
      code: 'METADATA_READ_FAILED',
      title:
        err.kind === 'invalid-path'
          ? 'Selected folder could not be read'
          : 'Project metadata read failed',
      description: err.message,
    };
    return buildErrorState(issue);
  }
  const issue: ProjectValidationIssue = {
    type: 'error',
    code: 'METADATA_READ_FAILED',
    title: 'Unexpected error',
    description: err instanceof Error ? err.message : String(err),
  };
  return buildErrorState(issue);
}

/**
 * Mirror the validated metadata into the cross-feature stores so the title
 * bar, workflow sidebar, and downstream screens stay in sync.
 */
function syncSessionStore(state: ProjectSelectionState): void {
  const { setProject } = useSessionStore.getState();
  const { markStepCompleted, markStepIncomplete } = useWorkflowProgressStore.getState();

  if (state.status === 'valid' && state.metadata) {
    setProject(metadataToProject(state.metadata));
    if (WORKFLOW_STEP_BY_ID.project) {
      markStepCompleted('project');
    }
    return;
  }

  // Any non-valid state means the project is no longer "ready". Keep the
  // session store cleared so other screens remain locked.
  setProject(undefined);
  markStepIncomplete('project');
}

/**
 * Derive the small cross-feature `Project` snapshot from the rich Milestone
 * 2 metadata. Fields not yet known (remote URL, base branch beyond what we
 * detected) are left undefined for later milestones to populate.
 */
function metadataToProject(metadata: ProjectMetadata): Project {
  const id = `local:${metadata.path}`;
  const now = new Date().toISOString();
  return {
    id,
    name: metadata.name,
    path: metadata.path,
    registeredAt: now,
    lastOpenedAt: now,
    ...(metadata.currentBranch !== undefined ? { baseBranch: metadata.currentBranch } : {}),
  };
}
