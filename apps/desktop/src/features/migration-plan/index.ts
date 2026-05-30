/**
 * Public barrel for the migration-plan feature.
 *
 * External code should depend on the screen component, the store hook
 * (for reading the plan or its status), and the types — never on the
 * service or component internals.
 */
export { MigrationPlanScreen } from './MigrationPlanScreen';
export {
  useMigrationPlanStore,
  selectPlan,
  selectPlanError,
  selectPlanStatus,
  selectIsPlanApproved,
  selectHasDraftPlan,
} from './hooks/useMigrationPlan';
export { generateMigrationPlan } from './services/migrationPlanGenerator';
export {
  resolveAllValidationCommands,
  resolveValidationCommand,
  pickValidationCommands,
} from './services/migrationPlanValidationService';
export {
  estimatePlanRisk,
  countApprovalGates,
  countRequiredSteps,
} from './services/migrationPlanRiskService';
export type {
  MigrationPlan,
  MigrationPlanComplexity,
  MigrationPlanError,
  MigrationPlanErrorKind,
  MigrationPlanGeneratorInput,
  MigrationPlanLifecycle,
  MigrationPlanState,
  MigrationPlanStatus,
  MigrationPlanStrategy,
  MigrationPlanSummary,
  MigrationStep,
  MigrationStepCategory,
  MigrationStepRisk,
  MigrationStepStatus,
} from './types/migrationPlan.types';
export type {
  ValidationCommandKind,
  ValidationCommandPlan,
} from './services/migrationPlanValidationService';
