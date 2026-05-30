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

export const WORKFLOW_STEPS: readonly WorkflowStepDescriptor[] = [
  {
    id: 'project',
    label: 'Select project',
    shortLabel: '01 · Project',
    path: ROUTES.projectSelection,
    description: 'Choose the source React project to scan.',
    icon: 'folder',
  },
  {
    id: 'scan',
    label: 'Scan progress',
    shortLabel: '02 · Scan',
    path: ROUTES.scanner,
    description: 'Inspect the codebase for migration signals.',
    icon: 'scan',
  },
  {
    id: 'report',
    label: 'Scan report',
    shortLabel: '03 · Report',
    path: ROUTES.scanReport,
    description: 'Review detected risks and project metadata.',
    icon: 'report',
  },
  {
    id: 'plan',
    label: 'Migration plan',
    shortLabel: '04 · Plan',
    path: ROUTES.migrationPlan,
    description: 'Review and approve the generated step plan.',
    icon: 'plan',
  },
  {
    id: 'workspace',
    label: 'Workspace',
    shortLabel: '05 · Workspace',
    path: ROUTES.workspace,
    description: 'Confirm Git worktree workspace creation.',
    icon: 'workspace',
  },
  {
    id: 'execute',
    label: 'Execution',
    shortLabel: '06 · Execute',
    path: ROUTES.execution,
    description: 'Run one step at a time with streamed output.',
    icon: 'play',
  },
  {
    id: 'diff',
    label: 'Diff review',
    shortLabel: '07 · Diff',
    path: ROUTES.diffReview,
    description: 'Review AI-produced diffs before commit.',
    icon: 'diff',
  },
  {
    id: 'summary',
    label: 'Summary',
    shortLabel: '08 · Summary',
    path: ROUTES.summary,
    description: 'Final migration summary.',
    icon: 'check-circle',
  },
];
