/**
 * Public barrel for the execution feature.
 *
 * External code should depend on the screen component, the store hook
 * (for reading the engine status, selected step, runs, etc.), and the
 * types — never on the service or component internals.
 */
export { ExecutionScreen } from './ExecutionScreen';
export {
  useExecutionEngineStore,
  selectCapabilities,
  selectCapabilityFor,
  selectExecutionBranchName,
  selectExecutionError,
  selectExecutionPlanId,
  selectExecutionStatus,
  selectExecutionWorkspacePath,
  selectLatestRun,
  selectRunFor,
  selectRuns,
  selectSelectedStepId,
  selectStepStatus,
  selectStepStatuses,
} from './hooks/useExecutionEngine';
export {
  isPotentiallyExecutable,
  localExecutionPreCapability,
} from './services/executionCapabilityService';
export {
  EXECUTOR_REGISTRY,
  getExecutorEntry,
  isExecutorSupported,
  listSupportedExecutorKeys,
} from './services/executorRegistry';
export type { ExecutorRegistryEntry } from './services/executorRegistry';
export {
  ExecutionServiceError,
  checkExecutionCapability,
  parseCapability,
  parseStepRun,
  runExecutionStep,
} from './services/executionService';
export type {
  ExecutionCapability,
  ExecutionCapabilityBadge,
  ExecutionChangeType,
  ExecutionChangedFile,
  ExecutionEngineState,
  ExecutionError,
  ExecutionLogEntry,
  ExecutionLogLevel,
  ExecutionStatus,
  ExecutionStepRun,
  ExecutionStepStatus,
  MigrationStepExecution,
  MigrationStepExecutionMode,
} from './types/execution.types';
