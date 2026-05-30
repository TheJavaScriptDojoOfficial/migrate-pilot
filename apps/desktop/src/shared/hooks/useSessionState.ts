import { create } from 'zustand';

import type { MigrationSession } from '@shared/types/migrationSession';
import type { Project } from '@shared/types/project';
import { SessionState } from '@shared/constants/sessionStates';

/**
 * Session store - tracks the currently active migration session metadata.
 *
 * Rules:
 * - Keep this small. No logs, no diffs, no AI responses.
 * - Only references and identifiers. Heavy data is fetched on demand via
 *   command bridge or artifact reads.
 * - Reset between sessions; never accumulate across runs.
 */
interface SessionStoreState {
  project: Project | undefined;
  session: MigrationSession | undefined;
  currentStepId: string | undefined;
}

interface SessionStoreActions {
  setProject: (project: Project | undefined) => void;
  setSession: (session: MigrationSession | undefined) => void;
  setCurrentStepId: (stepId: string | undefined) => void;
  reset: () => void;
}

const INITIAL_STATE: SessionStoreState = {
  project: undefined,
  session: undefined,
  currentStepId: undefined,
};

export const useSessionStore = create<SessionStoreState & SessionStoreActions>((set) => ({
  ...INITIAL_STATE,
  setProject: (project) => set({ project }),
  setSession: (session) => set({ session }),
  setCurrentStepId: (currentStepId) => set({ currentStepId }),
  reset: () => set({ ...INITIAL_STATE }),
}));

/** Convenience selector - true if the session is in a terminal state. */
export function selectSessionIsTerminal(
  state: SessionStoreState & SessionStoreActions,
): boolean {
  return (
    state.session?.state === SessionState.COMPLETED ||
    state.session?.state === SessionState.CANCELLED
  );
}
