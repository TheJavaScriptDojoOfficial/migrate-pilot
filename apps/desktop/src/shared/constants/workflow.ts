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
}

export const WORKFLOW_STEPS: readonly WorkflowStepDescriptor[] = [
  {
    id: 'project',
    label: 'Select project',
    shortLabel: '1. Project',
    path: ROUTES.projectSelection,
    description: 'Choose the source React project to scan.',
  },
  {
    id: 'scan',
    label: 'Scan progress',
    shortLabel: '2. Scan',
    path: ROUTES.scanner,
    description: 'Inspect the codebase for migration signals.',
  },
  {
    id: 'report',
    label: 'Scan report',
    shortLabel: '3. Report',
    path: ROUTES.scanReport,
    description: 'Review detected risks and project metadata.',
  },
  {
    id: 'plan',
    label: 'Migration plan',
    shortLabel: '4. Plan',
    path: ROUTES.migrationPlan,
    description: 'Review and approve the generated step plan.',
  },
  {
    id: 'workspace',
    label: 'Workspace',
    shortLabel: '5. Workspace',
    path: ROUTES.workspace,
    description: 'Confirm Git worktree workspace creation.',
  },
  {
    id: 'execute',
    label: 'Execution',
    shortLabel: '6. Execute',
    path: ROUTES.execution,
    description: 'Run one step at a time with streamed output.',
  },
  {
    id: 'diff',
    label: 'Diff review',
    shortLabel: '7. Diff',
    path: ROUTES.diffReview,
    description: 'Review AI-produced diffs before commit.',
  },
  {
    id: 'summary',
    label: 'Summary',
    shortLabel: '8. Summary',
    path: ROUTES.summary,
    description: 'Final migration summary.',
  },
];
