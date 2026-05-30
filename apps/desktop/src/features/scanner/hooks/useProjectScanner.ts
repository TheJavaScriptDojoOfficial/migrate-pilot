/**
 * Project scanner store.
 *
 * Owns the scanner state machine (`idle | scanning | completed | failed`)
 * and synchronises completion into the cross-feature workflow store so
 * the next step (Migration Plan) becomes reachable.
 *
 * Why a dedicated store rather than `useSessionStore`?
 *   - Keeps the scan-in-progress state machine + error payload out of the
 *     small session store. The session store only needs to know whether
 *     a vetted scan exists (via `hasReport`).
 *   - Resets cleanly when the user picks a different project.
 */

import { create } from 'zustand';

import { useSessionStore } from '@shared/hooks/useSessionState';
import { useWorkflowProgressStore } from '@shared/hooks/useWorkflowProgress';

import {
  ScannerServiceError,
  runProjectScan,
} from '../services/scannerService';
import type {
  ScanError,
  ScanReport,
  ScannerState,
} from '../types/scanner.types';

interface ScannerStoreActions {
  /** Run the scanner against the currently selected project path. */
  scan: () => Promise<void>;
  /** Run the scanner explicitly against a path. */
  scanPath: (path: string) => Promise<void>;
  /** Clear the report + reset to idle. Marks the workflow step incomplete. */
  reset: () => void;
}

/**
 * Internal store shape. Uses `T | undefined` instead of `?:` so we can
 * explicitly clear values via `set({ report: undefined })` without
 * tripping over `exactOptionalPropertyTypes`. The public {@link ScannerState}
 * is the same shape and consumers can read it the same way.
 */
interface ScannerStoreState {
  readonly status: ScannerState['status'];
  readonly report: ScanReport | undefined;
  readonly error: ScanError | undefined;
  readonly startedAt: string | undefined;
}

type Store = ScannerStoreState & ScannerStoreActions;

const INITIAL_STATE: ScannerStoreState = {
  status: 'idle',
  report: undefined,
  error: undefined,
  startedAt: undefined,
};

export const useProjectScannerStore = create<Store>((set) => ({
  ...INITIAL_STATE,

  scan: async () => {
    const project = useSessionStore.getState().project;
    if (!project) {
      set({
        status: 'failed',
        error: {
          kind: 'no-project-selected',
          message:
            'No project is selected. Pick a React project on the previous step before scanning.',
        },
      });
      return;
    }
    await runScan(project.path, set);
  },

  scanPath: async (path) => {
    await runScan(path, set);
  },

  reset: () => {
    set({ ...INITIAL_STATE });
    useWorkflowProgressStore.getState().markStepIncomplete('scan');
  },
}));

/* -------------------------------------------------------------------------- */
/* internals                                                                  */
/* -------------------------------------------------------------------------- */

async function runScan(
  path: string,
  set: (partial: Partial<Store>) => void,
): Promise<void> {
  set({
    status: 'scanning',
    startedAt: new Date().toISOString(),
    error: undefined,
    report: undefined,
  });

  let report: ScanReport;
  try {
    report = await runProjectScan(path);
  } catch (err) {
    set({ status: 'failed', error: errorFromThrown(err) });
    useWorkflowProgressStore.getState().markStepIncomplete('scan');
    return;
  }

  set({ status: 'completed', report, error: undefined });
  useWorkflowProgressStore.getState().markStepCompleted('scan');
}

function errorFromThrown(err: unknown): ScanError {
  if (err instanceof ScannerServiceError) {
    return { kind: err.kind, message: err.message };
  }
  return {
    kind: 'ipc-error',
    message: err instanceof Error ? err.message : String(err),
  };
}

/* -------------------------------------------------------------------------- */
/* selectors                                                                  */
/* -------------------------------------------------------------------------- */

export const selectScanReport = (s: ScannerStoreState): ScanReport | undefined =>
  s.report;
export const selectScanStatus = (s: ScannerStoreState): ScannerState['status'] =>
  s.status;
export const selectScanError = (s: ScannerStoreState): ScanError | undefined =>
  s.error;

/**
 * True when the scanner has completed at least one successful pass for the
 * currently selected project.
 */
export function selectScanIsReadyForPlan(s: ScannerStoreState): boolean {
  return s.status === 'completed' && s.report !== undefined;
}
