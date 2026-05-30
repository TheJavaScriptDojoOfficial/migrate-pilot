import type { IconName } from '@shared/ui/Icon';

import { ROUTES, type RoutePath } from './routes';

/**
 * Top-level workflow steps shown in the WorkflowSidebar.
 * Order matches the V1 migration workflow described in
 * docs/architecture/folder-structure.md.
 */
export interface WorkflowStepDescriptor {
  readonly id: string;
  readonly label: string;
  readonly shortLabel: string;
  readonly path: RoutePath;
  readonly description: string;
  readonly icon: IconName;
}

/**
 * Per-step visual status in the WorkflowSidebar.
 *
 * - `completed` — step has been finished in this session (mocked in Milestone 1).
 * - `active`    — step that matches the currently visible route.
 * - `upcoming`  — the next reachable step in the flow.
 * - `locked`    — gated by a prior step the user has not yet completed.
 *
 * The status is derived (never stored on each step) so the descriptor table
 * stays declarative and easy to maintain.
 */
export type WorkflowStepStatus = 'completed' | 'active' | 'upcoming' | 'locked';

export const WORKFLOW_STEPS: readonly WorkflowStepDescriptor[] = [
  {
    id: 'project',
    label: 'Select project',
    shortLabel: '01 · Project',
    path: ROUTES.projectSelection,
    description: 'Choose the React 16/17/18 project to migrate to React 19.',
    icon: 'folder',
  },
  {
    id: 'scan',
    label: 'Scan',
    shortLabel: '02 · Scan',
    path: ROUTES.scanner,
    description: 'Run the React 19 compatibility scan on the selected project.',
    icon: 'scan',
  },
  {
    id: 'report',
    label: 'Scan report',
    shortLabel: '03 · Report',
    path: ROUTES.scanReport,
    description: 'Review React 19 readiness, detected risks, and project metadata.',
    icon: 'report',
  },
  {
    id: 'plan',
    label: 'Plan',
    shortLabel: '04 · Plan',
    path: ROUTES.migrationPlan,
    description: 'Review and approve the React 19 migration plan.',
    icon: 'plan',
  },
  {
    id: 'workspace',
    label: 'Workspace',
    shortLabel: '05 · Workspace',
    path: ROUTES.workspace,
    description: 'Confirm Git worktree workspace creation for the React 19 migration.',
    icon: 'workspace',
  },
  {
    id: 'execute',
    label: 'Execute',
    shortLabel: '06 · Execute',
    path: ROUTES.execution,
    description: 'Execute one React 19 migration step at a time with full logs.',
    icon: 'play',
  },
  {
    id: 'diff',
    label: 'Diff review',
    shortLabel: '07 · Diff',
    path: ROUTES.diffReview,
    description: 'Review the workspace diff before approving the React 19 step.',
    icon: 'diff',
  },
  {
    id: 'summary',
    label: 'Summary',
    shortLabel: '08 · Summary',
    path: ROUTES.summary,
    description: 'React 19 migration summary across all executed steps.',
    icon: 'check-circle',
  },
];

/** Stable id type for workflow step lookups. */
export type WorkflowStepId = (typeof WORKFLOW_STEPS)[number]['id'];

/** O(1) lookup map (built once at module load). */
export const WORKFLOW_STEP_BY_ID: Readonly<Record<string, WorkflowStepDescriptor>> =
  WORKFLOW_STEPS.reduce<Record<string, WorkflowStepDescriptor>>((acc, step) => {
    acc[step.id] = step;
    return acc;
  }, {});

/**
 * Derive the per-step status array for the WorkflowSidebar.
 *
 * Pure function so it is trivially testable and avoids tying derivation
 * to React render lifecycle. The mocked progression model is:
 *
 * - Steps whose id is in `completedStepIds` render as `completed`.
 * - The step whose path matches `activePath` renders as `active`.
 * - The first non-completed, non-active step renders as `upcoming` (ready
 *   for the user to start).
 * - All further steps render as `locked`.
 *
 * In Milestone 1 there is no real session state machine, so callers should
 * feed an empty `completedStepIds` set. The visual treatment for each
 * status still renders correctly — we just don't drive completion yet.
 */
export function deriveWorkflowStatuses(
  activePath: string,
  completedStepIds: ReadonlySet<string>,
): readonly WorkflowStepStatus[] {
  // Resolve "active" first so longer paths win over their prefixes
  // (e.g. /scan/report should activate `scanReport`, not `scanner`).
  // The matcher prefers exact equality, then the longest path prefix.
  const activeIndex = resolveActiveIndex(activePath);

  let upcomingClaimed = false;
  return WORKFLOW_STEPS.map((_, index): WorkflowStepStatus => {
    const step = WORKFLOW_STEPS[index];
    if (step && completedStepIds.has(step.id)) {
      return 'completed';
    }
    if (index === activeIndex) {
      return 'active';
    }
    if (!upcomingClaimed) {
      upcomingClaimed = true;
      return 'upcoming';
    }
    return 'locked';
  });
}

function resolveActiveIndex(activePath: string): number {
  let bestIndex = -1;
  let bestLength = -1;
  for (let i = 0; i < WORKFLOW_STEPS.length; i += 1) {
    const step = WORKFLOW_STEPS[i];
    if (!step) continue;
    if (activePath === step.path || activePath.startsWith(`${step.path}/`)) {
      if (step.path.length > bestLength) {
        bestLength = step.path.length;
        bestIndex = i;
      }
    }
  }
  return bestIndex;
}
