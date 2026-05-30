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
  NODE_SASS_PLAN_STEP_ID,
} from './services/executionCapabilityService';
export {
  ExecutionServiceError,
  checkExecutionCapability,
  parseCapability,
  parseStepRun,
  runExecutionStep,
} from './services/executionService';
export type {
  ExecutionCapability,
  ExecutionChangeType,
  ExecutionChangedFile,
  ExecutionEngineState,
  ExecutionError,
  ExecutionExecutorType,
  ExecutionLogEntry,
  ExecutionLogLevel,
  ExecutionStatus,
  ExecutionStepRun,
  ExecutionStepStatus,
} from './types/execution.types';
