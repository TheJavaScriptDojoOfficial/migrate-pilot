/**
 * Centralised route paths. Update here when adding new screens so links
 * never drift from the router definition.
 */
export const ROUTES = {
  projectSelection: '/project',
  scanner: '/scan',
  scanReport: '/scan/report',
  migrationPlan: '/plan',
  workspace: '/workspace',
  execution: '/execute',
  diffReview: '/diff',
  summary: '/summary',
} as const;

export type RouteKey = keyof typeof ROUTES;
export type RoutePath = (typeof ROUTES)[RouteKey];
