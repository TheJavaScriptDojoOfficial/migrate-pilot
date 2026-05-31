/**
 * Public barrel for the execution feature.
 *
 * External code should depend on the screen component, the store hook
 * (for reading the engine status, selected step, runs, etc.), and the
 * types — never on the service or component internals.
 */
import { registerBundledExecutors } from './executors/implementations';

/* Register every bundled V2 executor on import:
 *   - Phase R6 Step 3 deterministic executors.
 *   - Phase R6 Step 4 bounded / manual executors
 *     (`ai-assisted-bounded`, `manual-instruction`).
 * The helper is idempotent so repeated imports / HMR cycles are
 * safe — see `executors/implementations/index.ts`. */
registerBundledExecutors();

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
export { canRunSelectedStep } from './services/runStepEnablementService';
export type {
  CanRunSelectedStepInput,
  ExecutorRegistryAdapter,
  RunStepEnablement,
  RunStepGuidance,
  RunStepGuidanceKind,
} from './services/runStepEnablementService';
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
export type {
  ExecutionResult,
  ExecutorContext,
  ExecutorDefinition,
  ExecutorRunInput,
} from './types/executor.types';

/* -------------------------------------------------------------------------- */
/* Executor Registry V2 — registry + resolver + context builder (R6 Step 2)  */
/* -------------------------------------------------------------------------- */

export {
  clearExecutorRegistry,
  getExecutorByKey,
  isExecutorRegistered,
  listRegisteredExecutors,
  registerExecutor,
  unregisterExecutor,
} from './executors/executorRegistry';
export {
  findCandidateExecutorsForStep,
  matchesExecutorAxes,
  resolveExecutorForStep,
} from './executors/executorCapabilityService';
export type { ResolverStepInput } from './executors/executorCapabilityService';
export {
  buildExecutorContext,
  summarizeStepResolution,
  summarizeStepResolutionWithFallback,
} from './executors/executorContextService';
export type { BuildExecutorContextInput } from './executors/executorContextService';
export type {
  ExecutorResolutionResult,
  ExecutorResolutionSummary,
} from './executors/executor.types';

/* -------------------------------------------------------------------------- */
/* Executor Registry V2 — bundled executors (R6 Steps 3 + 4)                  */
/* -------------------------------------------------------------------------- */

export {
  AI_ASSISTED_BOUNDED_EXECUTOR_KEY,
  AI_ASSISTED_BOUNDED_PROMPT_CONTRACT,
  BASELINE_VALIDATION_EXECUTOR_KEY,
  BOUNDED_EXECUTORS,
  BUNDLED_EXECUTORS,
  DEFAULT_MAX_RELEVANT_FILES,
  DETERMINISTIC_EXECUTORS,
  JSX_TRANSFORM_PREPARATION_EXECUTOR_KEY,
  MANUAL_INSTRUCTION_EXECUTOR_KEY,
  PACKAGE_DEPENDENCY_UPDATE_EXECUTOR_KEY,
  REACT_DEPRECATED_API_FIX_EXECUTOR_KEY,
  REACT_ROOT_API_CODEMOD_EXECUTOR_KEY,
  aiAssistedBoundedExecutor,
  baselineValidationExecutor,
  jsxTransformPreparationExecutor,
  manualInstructionExecutor,
  packageDependencyExecutor,
  reactDeprecatedApiFixExecutor,
  reactRootApiCodemodExecutor,
  registerBoundedExecutors,
  registerBundledExecutors,
  registerDeterministicExecutors,
} from './executors/implementations';
export type {
  AiAssistedBoundedExecutorParams,
  AiAssistedBoundedRelevantFile,
  BaselineValidationExecutorParams,
  JsxTransformBuildSetup,
  JsxTransformPreparationExecutorParams,
  ManualInstructionExecutorParams,
  ManualInstructionStep,
  PackageDependencyAction,
  PackageDependencyActionKind,
  PackageDependencyExecutorParams,
  PackageDependencyType,
  ReactRootApiCodemodExecutorParams,
} from './executors/implementations';
