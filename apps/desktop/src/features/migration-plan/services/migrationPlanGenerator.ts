import type { ScanReport } from '@features/scanner';

import { buildReact19MigrationPlanV2 } from './react19MigrationPlanV2';

import type { MigrationPlan } from '../types/migrationPlan.types';

/**
 * Backward-compatible wrapper.
 *
 * Milestone R4 upgrades plan generation to React 19 Planner V2 while keeping
 * existing imports stable.
 */
export function generateMigrationPlan(scanReport: ScanReport): MigrationPlan {
  return buildReact19MigrationPlanV2(scanReport);
}
