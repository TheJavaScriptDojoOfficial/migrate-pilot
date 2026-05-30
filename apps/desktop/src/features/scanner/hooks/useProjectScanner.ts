/**
 * Project scanner store.
 *
 * Owns the scanner state machine (`idle | scanning | completed | failed`)
 * and synchronises completion into the cross-feature workflow store so
 * the next step (Migration Plan) becomes reachable.
 *
 * R2 step 5 — the completed scan report (including the React 19 readiness
 * view model) is persisted to `localStorage` so the Step 3 report screen
 * and plan-generation gate survive an app reload within the same session.
 *
 * Why a dedicated store rather than `useSessionStore`?
 *   - Keeps the scan-in-progress state machine + error payload out of the
 *     small session store. The session store only needs to know whether
 *     a vetted scan exists (via `hasReport`).
 *   - Resets cleanly when the user picks a different project.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { useSessionStore } from '@shared/hooks/useSessionState';
import { useWorkflowProgressStore } from '@shared/hooks/useWorkflowProgress';
import {
  buildReact19ReadinessReportViewModel,
  resolveReact19PlanGenerationGate,
} from '@features/react19-migration';

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

const SCANNER_STORAGE_KEY = 'migrate-pilot-scanner-v1';

export const useProjectScannerStore = create<Store>()(
  persist(
    (set) => ({
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
    }),
    {
      name: SCANNER_STORAGE_KEY,
      partialize: (state) => ({
        status: state.status === 'scanning' ? 'idle' : state.status,
        report: state.report,
        startedAt: state.startedAt,
      }),
    },
  ),
);

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
 * Resolve the React 19 readiness report view model from the active scan
 * report. Rebuilds on the fly for older persisted reports that predate
 * step 5.
 */
export function selectReact19ReadinessReport(
  s: ScannerStoreState,
): ReturnType<typeof buildReact19ReadinessReportViewModel> | undefined {
  if (s.report === undefined || s.status !== 'completed') return undefined;
  return (
    s.report.react19ReadinessReport ??
    buildReact19ReadinessReportViewModel({ scanReport: s.report })
  );
}

/**
 * True when the scanner has completed at least one successful pass for the
 * currently selected project.
 */
export function selectScanIsReadyForPlan(s: ScannerStoreState): boolean {
  return s.status === 'completed' && s.report !== undefined;
}

/**
 * True when plan generation is allowed for the current scan report.
 */
export function selectCanGenerateMigrationPlan(s: ScannerStoreState): boolean {
  if (s.status !== 'completed' || s.report === undefined) return false;
  return resolveReact19PlanGenerationGate(s.report).canGeneratePlan;
}
