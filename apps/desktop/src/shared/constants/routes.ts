/**
 * Centralised route paths. Update here when adding new screens so links
 * never drift from the router definition.
 *
 * Workflow paths are ordered exactly as the user moves through the V1
 * migration journey. Non-workflow surfaces (e.g. `/settings`) live below
 * so it is obvious which paths belong to the sidebar workflow.
 */
export const ROUTES = {
  // Workflow journey (mirrors WORKFLOW_STEPS in constants/workflow.ts).
  projectSelection: '/project',
  scanner: '/scan',
  scanReport: '/scan/report',
  migrationPlan: '/plan',
  workspace: '/workspace',
  execution: '/execute',
  diffReview: '/diff',
  summary: '/summary',

  // Non-workflow surfaces (Activity Rail entries).
  settings: '/settings',
} as const;

export type RouteKey = keyof typeof ROUTES;
export type RoutePath = (typeof ROUTES)[RouteKey];
