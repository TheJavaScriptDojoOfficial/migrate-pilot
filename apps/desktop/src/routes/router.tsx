import { createBrowserRouter, Navigate } from 'react-router-dom';

import { AppShell } from '@app/AppShell';
import { ROUTES } from '@shared/constants/routes';

import { ProjectSelectionScreen } from '@features/project-selection/ProjectSelectionScreen';
import { ScannerScreen } from '@features/scanner/ScannerScreen';
import { ScanReportScreen } from '@features/report/ScanReportScreen';
import { MigrationPlanScreen } from '@features/migration-plan/MigrationPlanScreen';
import { WorkspaceScreen } from '@features/workspace/WorkspaceScreen';
import { ExecutionScreen } from '@features/execution';
import { DiffReviewScreen } from '@features/diff-review';
import { MigrationSummaryScreen } from '@features/summary/MigrationSummaryScreen';
import { SettingsScreen } from '@features/settings/SettingsScreen';

import { NotFoundScreen } from '@routes/NotFoundScreen';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to={ROUTES.projectSelection} replace /> },
      { path: ROUTES.projectSelection, element: <ProjectSelectionScreen /> },
      { path: ROUTES.scanner, element: <ScannerScreen /> },
      { path: ROUTES.scanReport, element: <ScanReportScreen /> },
      { path: ROUTES.migrationPlan, element: <MigrationPlanScreen /> },
      { path: ROUTES.workspace, element: <WorkspaceScreen /> },
      { path: ROUTES.execution, element: <ExecutionScreen /> },
      { path: ROUTES.diffReview, element: <DiffReviewScreen /> },
      { path: ROUTES.summary, element: <MigrationSummaryScreen /> },
      { path: ROUTES.settings, element: <SettingsScreen /> },
      { path: '*', element: <NotFoundScreen /> },
    ],
  },
]);
