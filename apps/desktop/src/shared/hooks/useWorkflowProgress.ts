import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { create } from 'zustand';

import {
  WORKFLOW_STEPS,
  deriveWorkflowStatuses,
  type WorkflowStepDescriptor,
  type WorkflowStepStatus,
} from '@shared/constants/workflow';

/**
 * Workflow progress store — tracks which workflow steps the user has
 * "completed" in the current session.
 *
 * Milestone 1 contract:
 *   - No real orchestrator yet, so completion is mocked. The store is
 *     wired so future milestones can transition steps to `completed`
 *     simply by calling `markStepCompleted` from a service layer.
 *   - Holds only ids. No diff, log, or session payload data.
 *   - Resets via `reset()` between sessions to avoid stale UI state.
 */
interface WorkflowProgressStoreState {
  readonly completedStepIds: ReadonlySet<string>;
}

interface WorkflowProgressStoreActions {
  markStepCompleted: (stepId: string) => void;
  markStepIncomplete: (stepId: string) => void;
  reset: () => void;
}

export const useWorkflowProgressStore = create<
  WorkflowProgressStoreState & WorkflowProgressStoreActions
>((set, get) => ({
  completedStepIds: new Set<string>(),
  markStepCompleted: (stepId) => {
    const next = new Set(get().completedStepIds);
    next.add(stepId);
    set({ completedStepIds: next });
  },
  markStepIncomplete: (stepId) => {
    const next = new Set(get().completedStepIds);
    next.delete(stepId);
    set({ completedStepIds: next });
  },
  reset: () => set({ completedStepIds: new Set<string>() }),
}));

export interface WorkflowStepView {
  readonly step: WorkflowStepDescriptor;
  readonly status: WorkflowStepStatus;
  readonly index: number;
}

/**
 * Resolve every workflow step alongside its current visual status given
 * the active route and mocked completion progress.
 *
 * The returned tuple is memoised against the inputs that actually change
 * (route path and completion set identity) so sidebar renders stay cheap.
 */
export function useWorkflowSteps(): {
  readonly steps: readonly WorkflowStepView[];
  readonly activeStep: WorkflowStepView | undefined;
} {
  const { pathname } = useLocation();
  const completedStepIds = useWorkflowProgressStore((s) => s.completedStepIds);

  return useMemo(() => {
    const statuses = deriveWorkflowStatuses(pathname, completedStepIds);
    const steps: WorkflowStepView[] = WORKFLOW_STEPS.map((step, index) => ({
      step,
      index,
      status: statuses[index] ?? 'locked',
    }));
    const activeStep = steps.find((s) => s.status === 'active');
    return { steps, activeStep };
  }, [pathname, completedStepIds]);
}
