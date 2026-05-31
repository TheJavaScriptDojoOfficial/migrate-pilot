import type { ScanReport } from '@features/scanner';

import { buildReact19MigrationPlanV2 } from './react19MigrationPlanV2';

import type { MigrationPlan } from '../types/migrationPlan.types';

/**
 * Migration plan generator entry point.
 *
 * R5 Step 11 — Generate Plan From Report V2 Only.
 *
 * This function is intentionally a thin delegate to
 * {@link buildReact19MigrationPlanV2}. Every plan produced by Migrate
 * Pilot is a React 19 Plan V2 generated from the React 19 Report V2
 * surface on the scan report (migration context, support status,
 * compatibility report, risk engine, and readiness view model).
 *
 * The legacy generic modernization plan path no longer exists — callers
 * that hit a missing/invalid Report V2 input should hydrate the scan
 * report first via `hydrateReact19ScanReportV2` and refuse to generate
 * a plan when that fails, instead of falling back to a generic plan.
 */
export function generateMigrationPlan(scanReport: ScanReport): MigrationPlan {
  return buildReact19MigrationPlanV2(scanReport);
}
