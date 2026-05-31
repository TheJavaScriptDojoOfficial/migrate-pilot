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
  buildReact19MigrationPlanV2,
  resolveReact19PlanTrack,
  buildReact19PlanStepsFromRiskEngine,
  groupRiskRecommendationsIntoPlanSteps,
  buildReact19ValidationStrategy,
  summarizeReact19PlanPhases,
} from './services/react19MigrationPlanV2';
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
export { resolvePlanQualityStatus } from './services/migrationPlanQualityService';
export {
  resolvePlanApprovalGate,
  isWorkspaceCreationPlanStep,
} from './services/migrationPlanApprovalService';
export {
  deriveExecutorAvailability,
  isFileChangingPlanStepExecutionType,
  isManualOnlyPlanStepExecutionType,
  isValidationOnlyPlanStepExecutionType,
  mapMigrationPlanStepExecutionTypeToMode,
  resolveMigrationPlanStepExecutorAvailability,
} from './types/migrationPlan.types';
export type {
  PlanApprovalGate,
  PlanApprovalGateInput,
  PlanApprovalGateReason,
  PlanApprovalGateReasonCode,
  PlanApprovalGenerationGateInput,
} from './services/migrationPlanApprovalService';
export type {
  ExecutorAvailability,
  ExecutorAvailabilityStatus,
  ExecutorExecutionType,
  MigrationPlan,
  MigrationPlanError,
  MigrationPlanErrorKind,
  MigrationPlanGeneratorInput,
  MigrationPlanState,
  MigrationPlanStatus,
  MigrationPlanStepV2,
  MigrationPlanStepV2Capability,
  MigrationPlanStepV2ExecutionType,
  MigrationPlanStepV2Risk,
  MigrationPlanStepV2RollbackStrategy,
  MigrationPlanStepV2Status,
  PlanQualityStatus,
  PlanQualityStatusLevel,
  React19MigrationPlanV2,
  React19PlanPhaseSummary,
  React19PlanStep,
  React19PlanStepExecutionType,
  React19PlanStepStatus,
  React19ValidationStrategy,
  MigrationStep,
  MigrationStepCategory,
  MigrationStepExecution,
  MigrationStepExecutionMode,
  MigrationStepRisk,
  MigrationStepStatus,
} from './types/migrationPlan.types';
export type {
  ValidationCommandKind,
  ValidationCommandPlan,
} from './services/migrationPlanValidationService';
