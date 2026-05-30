import type { ScanReport } from '@features/scanner';
import {
  REACT_19_CANONICAL_PHASE_ORDER,
  buildReact19RiskEngine,
  getReactMigrationPhaseOrder,
  mapRiskEnginePhaseToReactMigrationPhase,
  resolveReact19PlanGenerationGate,
  type React19MigrationRiskLevel,
  type React19RiskRecommendation,
  type React19RiskEngineResult,
  type ReactMigrationPhase,
  type ReactMigrationTrack,
} from '@features/react19-migration';

import type {
  MigrationPlan,
  MigrationPlanStepV2,
  MigrationPlanStepV2Capability,
  MigrationPlanStepV2ExecutionType,
  MigrationPlanStepV2Risk,
  React19MigrationPlanV2,
  React19PlanPhaseSummary,
  React19ValidationStrategy,
} from '../types/migrationPlan.types';
import {
  resolveMigrationPlanStepRollbackStrategy,
  resolveMigrationPlanStepRunRequirements,
} from '../types/migrationPlan.types';

const VALIDATION_SCRIPT_PRIORITY = ['build', 'test', 'lint', 'typecheck'] as const;
const SUPPORTED_SCRIPTED_EXECUTOR_KEYS = new Set<string>(['package-json-dependency-update']);
const VALIDATION_SCRIPT_ALIASES = {
  typecheck: ['typecheck', 'type-check', 'tsc'],
} as const;

interface ValidationCommandCatalog {
  readonly all: readonly string[];
  readonly build?: string;
  readonly test?: string;
  readonly lint?: string;
  readonly typecheck?: string;
}

interface StepCommandContext {
  readonly packageManagerKnown: boolean;
  readonly installCommand?: string;
  readonly validationCatalog: ValidationCommandCatalog;
}

export function buildReact19MigrationPlanV2(scanReport: ScanReport): React19MigrationPlanV2 {
  const gate = resolveReact19PlanGenerationGate(scanReport);
  const sourceMajor = scanReport.react19MigrationContext?.sourceReactMajor;
  const sourceReactVersion =
    scanReport.react19MigrationContext?.sourceReactVersion ??
    scanReport.react19SupportStatus?.sourceReactVersion ??
    scanReport.dependencies.reactVersion ??
    'unknown';
  const track = resolveReact19PlanTrack(scanReport);
  const blockedReasons = [...gate.reasons];
  const riskEngine = resolveRiskEngine(scanReport);
  if (!gate.canGeneratePlan || sourceMajor === undefined || track === null) {
    if (sourceMajor === undefined || track === null) {
      blockedReasons.push(
        'React migration track could not be resolved. React 16/17/18 migration context is required.',
      );
    }
    return {
      id: makePlanId(scanReport),
      version: 'react19-plan-v2',
      scanReportId: scanReport.id,
      projectPath: scanReport.projectPath,
      title: 'React 19 Migration Plan',
      summaryText: 'React 19 migration planning is blocked until eligibility issues are resolved.',
      sourceReactVersion,
      targetReactVersion: '19',
      sourceMajor: fallbackSourceMajor(sourceMajor),
      track: track ?? 'react-18-to-19',
      strategy: 'react-19-foundation-first',
      generatedAt: new Date().toISOString(),
      status: 'draft',
      canExecute: false,
      blockedReasons: Array.from(new Set(blockedReasons)),
      prerequisites: ['Run a fresh React 19 compatibility scan after fixing eligibility blockers.'],
      steps: [],
      skippedPhases: [],
      phaseSummary: emptyPhaseSummary(),
      validationStrategy: {
        baselineCommands: [],
        perStepCommands: [],
        finalCommands: [],
        missingCommands: [...VALIDATION_SCRIPT_PRIORITY],
      },
      highestRisk: 'high',
      summary: {
        title: 'React 19 migration plan blocked',
        description: 'Resolve eligibility blockers and regenerate the plan.',
        totalSteps: 0,
        estimatedRisk: 'high',
        estimatedComplexity: scanReport.projectInfo.complexity,
        approvalGates: 0,
        requiredSteps: 0,
      },
      blockers: Array.from(new Set(blockedReasons)),
      warnings: [],
      assumptions: [],
      recommendations: [],
    };
  }

  const steps = buildReact19PlanStepsFromRiskEngine(scanReport);
  const validationStrategy = buildReact19ValidationStrategy(scanReport);
  const skippedPhases = resolveSkippedPhases(sourceMajor);
  const phaseSummary = summarizeReact19PlanPhases(steps);

  const riskBlockedReasons = riskEngine.items
    .filter((item) => item.blocksPlanGeneration === true)
    .map((item) => item.recommendation);
  const mergedBlockedReasons = Array.from(new Set([...blockedReasons, ...riskBlockedReasons]));

  const executableSteps = steps.filter((step) => isExecutableStep(step));
  const canExecute = mergedBlockedReasons.length === 0 && executableSteps.length > 0;

  return {
    id: makePlanId(scanReport),
    version: 'react19-plan-v2',
    scanReportId: scanReport.id,
    projectPath: scanReport.projectPath,
    title: 'React 19 Migration Plan',
    summaryText: `Generated from the React 19 compatibility scan and risk engine for ${track}.`,
    sourceReactVersion,
    targetReactVersion: '19',
    sourceMajor,
    track,
    strategy: 'react-19-foundation-first',
    generatedAt: new Date().toISOString(),
    status: 'draft',
    canExecute,
    blockedReasons: mergedBlockedReasons,
    prerequisites: buildPrerequisites(scanReport, sourceMajor, validationStrategy),
    steps,
    skippedPhases,
    phaseSummary,
    validationStrategy,
    highestRisk: resolveHighestRisk(steps.map((step) => step.risk)),
    summary: {
      title: 'React 19 migration plan',
      description: `Track-aware React 19 plan for ${track}.`,
      totalSteps: steps.length,
      estimatedRisk: resolveHighestRisk(steps.map((step) => step.risk)),
      estimatedComplexity: scanReport.projectInfo.complexity,
      approvalGates: steps.filter((step) => step.requiresApprovalBeforeRun).length,
      requiredSteps: steps.filter((step) => step.status !== 'skipped').length,
    },
    blockers: mergedBlockedReasons,
    warnings: validationStrategy.missingCommands.map(
      (cmd) => `Validation command "${cmd}" was not detected in project scripts.`,
    ),
    assumptions: buildPrerequisites(scanReport, sourceMajor, validationStrategy),
    recommendations: [
      'Execute steps in phase order and validate after each high-risk change.',
      'Treat React bridge and API compatibility steps as human-reviewed checkpoints.',
    ],
  };
}

export function resolveReact19PlanTrack(scanReport: ScanReport): ReactMigrationTrack | null {
  const track = scanReport.react19MigrationContext?.track;
  if (track !== undefined) return track;
  const major =
    scanReport.react19MigrationContext?.sourceReactMajor ??
    scanReport.react19SupportStatus?.sourceReactMajor ??
    scanReport.dependencies.reactMajor;
  if (major === 16) return 'react-16-to-19';
  if (major === 17) return 'react-17-to-19';
  if (major === 18) return 'react-18-to-19';
  return null;
}

export function buildReact19PlanStepsFromRiskEngine(
  scanReport: ScanReport,
): MigrationPlanStepV2[] {
  const track = resolveReact19PlanTrack(scanReport);
  const sourceMajor = scanReport.react19MigrationContext?.sourceReactMajor;
  if (track === null || sourceMajor === undefined) return [];

  const validationStrategy = buildReact19ValidationStrategy(scanReport);
  const installCommand = resolveInstallCommand(scanReport);
  const commandContext: StepCommandContext = {
    packageManagerKnown: scanReport.dependencies.packageManager !== 'unknown',
    validationCatalog: resolveValidationCommandCatalog(scanReport),
    ...(installCommand !== undefined ? { installCommand } : {}),
  };
  const steps: MigrationPlanStepV2[] = [];
  let order = 1;

  if (validationStrategy.baselineCommands.length > 0) {
    const runRequirements = resolveMigrationPlanStepRunRequirements('validation-only');
    const resolution = resolveExecutorMetadata({
      stepId: 'react19.validation.baseline',
      phase: 'validation',
      executionType: 'validation-only',
      issueCodes: [],
      validationCommands: validationStrategy.baselineCommands,
    });
    const baselineExecution = mapExecutionMetadata(
      'validation-only',
      resolution.executorKey,
      resolution.params,
    );
    steps.push({
      id: 'react19.validation.baseline',
      order: order++,
      phase: 'validation',
      track,
      title: 'Run baseline validation in migration workspace',
      description:
        'Establish the current build/test/lint baseline inside the migration workspace before applying React 19 migration changes.',
      reason:
        'Baseline validation separates pre-existing project failures from migration-introduced regressions.',
      risk: 'medium',
      status: 'pending',
      issueCodes: [],
      executionType: 'validation-only',
      ...(resolution.executorKey !== undefined ? { executorKey: resolution.executorKey } : {}),
      capability: resolution.capability,
      ...(resolution.blockedReason !== undefined
        ? { blockedReason: resolution.blockedReason }
        : {}),
      requiresWorkspace: runRequirements.requiresWorkspace,
      requiresApprovalBeforeRun: runRequirements.requiresApprovalBeforeRun,
      requiresValidationAfterRun: runRequirements.requiresValidationAfterRun,
      expectedCommands: validationStrategy.baselineCommands,
      validationCommands: validationStrategy.baselineCommands,
      rollbackStrategy: resolveMigrationPlanStepRollbackStrategy('validation-only'),
      ...(baselineExecution !== undefined ? { execution: baselineExecution } : {}),
      sourceIssueCodes: [],
      expectedChangeScope: ['Validation command output only (no file modifications)'],
      requiresHumanReview: false,
      canRunInExecution: isExecutableStepCapability(resolution.capability),
    });
  }

  const grouped = groupRiskRecommendationsIntoPlanSteps(scanReport, commandContext);
  for (const step of grouped) {
    steps.push({ ...step, order: order++ });
  }

  if (validationStrategy.finalCommands.length > 0) {
    const runRequirements = resolveMigrationPlanStepRunRequirements('validation-only');
    const resolution = resolveExecutorMetadata({
      stepId: 'react19.validation.final',
      phase: 'validation',
      executionType: 'validation-only',
      issueCodes: [],
      validationCommands: validationStrategy.finalCommands,
    });
    const finalValidationExecution = mapExecutionMetadata(
      'validation-only',
      resolution.executorKey,
      resolution.params,
    );
    steps.push({
      id: 'react19.validation.final',
      order: order++,
      phase: 'validation',
      track,
      title: 'Run final React 19 migration validation',
      description:
        'Run the full validation suite after all selected migration steps to confirm project stability on the React 19 path.',
      reason: 'Final validation confirms the migrated state is stable and releasable.',
      risk: 'medium',
      status: 'pending',
      issueCodes: [],
      executionType: 'validation-only',
      ...(resolution.executorKey !== undefined ? { executorKey: resolution.executorKey } : {}),
      capability: resolution.capability,
      ...(resolution.blockedReason !== undefined
        ? { blockedReason: resolution.blockedReason }
        : {}),
      requiresWorkspace: runRequirements.requiresWorkspace,
      requiresApprovalBeforeRun: runRequirements.requiresApprovalBeforeRun,
      requiresValidationAfterRun: runRequirements.requiresValidationAfterRun,
      expectedCommands: validationStrategy.finalCommands,
      validationCommands: validationStrategy.finalCommands,
      rollbackStrategy: resolveMigrationPlanStepRollbackStrategy('validation-only'),
      ...(finalValidationExecution !== undefined ? { execution: finalValidationExecution } : {}),
      sourceIssueCodes: [],
      expectedChangeScope: ['Validation command output only (no file modifications)'],
      requiresHumanReview: false,
      canRunInExecution: isExecutableStepCapability(resolution.capability),
    });
  }

  const finalReviewResolution = resolveExecutorMetadata({
    stepId: 'react19.final-review.signoff',
    phase: 'final-review',
    executionType: 'manual',
    issueCodes: [],
  });
  const finalReviewExecution = mapExecutionMetadata(
    'manual',
    finalReviewResolution.executorKey,
    finalReviewResolution.params,
  );
  const finalReviewRequirements = resolveMigrationPlanStepRunRequirements('manual');
  steps.push({
    id: 'react19.final-review.signoff',
    order: order++,
    phase: 'final-review',
    track,
    title: 'Finalize migration review and rollout sign-off',
    description:
      track === 'react-18-to-19'
        ? 'Complete a final review focused on API compatibility changes, React 19 dependency upgrade outcomes, and validation evidence before rollout.'
        : 'Complete a final review covering bridge outcomes, React 19 upgrade impacts, and validation evidence before rollout.',
    reason: 'Final review captures migration readiness decisions and release confidence.',
    risk: 'medium',
    status: 'pending',
    issueCodes: [],
    executionType: 'manual',
    capability: finalReviewResolution.capability,
    ...(finalReviewResolution.blockedReason !== undefined
      ? { blockedReason: finalReviewResolution.blockedReason }
      : {}),
    requiresWorkspace: finalReviewRequirements.requiresWorkspace,
    requiresApprovalBeforeRun: finalReviewRequirements.requiresApprovalBeforeRun,
    requiresValidationAfterRun: finalReviewRequirements.requiresValidationAfterRun,
    expectedCommands: validationStrategy.finalCommands,
    validationCommands: validationStrategy.finalCommands,
    rollbackStrategy: resolveMigrationPlanStepRollbackStrategy('manual'),
    ...(finalReviewExecution !== undefined ? { execution: finalReviewExecution } : {}),
    sourceIssueCodes: [],
    expectedChangeScope: ['Migration summary and release readiness checklist'],
    requiresHumanReview: true,
    canRunInExecution: false,
  });

  return steps.map(ensureCapabilityReason);
}

export function groupRiskRecommendationsIntoPlanSteps(
  scanReport: ScanReport,
  commandContext: StepCommandContext,
): MigrationPlanStepV2[] {
  const track = resolveReact19PlanTrack(scanReport);
  const sourceMajor = scanReport.react19MigrationContext?.sourceReactMajor;
  if (track === null || sourceMajor === undefined) return [];

  const riskEngine = resolveRiskEngine(scanReport);
  const byPhase = riskEngine.byPhase;
  const output: Omit<MigrationPlanStepV2, 'order'>[] = [];

  const preflight = byPhase['preflight'].filter((item) => !isValidationSignal(item));
  if (preflight.length > 0) {
    output.push(
      createGroupedStep(track, 'preflight', 'react19.preflight.prerequisites', {
        title: 'Resolve React 19 migration preflight prerequisites',
        description:
          'Review package manager, lockfile, and source eligibility prerequisites before running executable migration work.',
        reason:
          'Preflight issues impact migration safety and can block later phases if not addressed first.',
        items: preflight,
        forceExecutionType: 'manual',
        forceCanRunInExecution: false,
      }, commandContext),
    );
  }

  const validationReadiness = byPhase['validation-readiness'].filter(
    (item) => !isValidationSignal(item),
  );
  if (validationReadiness.length > 0) {
    output.push(
      createGroupedStep(track, 'validation', 'react19.validation.readiness', {
        title: 'Strengthen migration validation readiness',
        description:
          'Resolve missing or weak validation gates so each migration step can be verified consistently.',
        reason: 'Reliable lint/typecheck/test/build signals reduce migration regression risk.',
        items: validationReadiness,
      }, commandContext),
    );
  }

  const bridgeItems = byPhase['react-bridge'];
  if (sourceMajor === 16 || sourceMajor === 17) {
    output.push(
      createGroupedStep(track, 'react-18-bridge', 'react19.bridge.react18', {
        title: `Bridge React ${sourceMajor} project through React 18 compatibility`,
        description:
          'Direct upgrades from React 16/17 to React 19 are high-risk. Align root APIs and compatibility assumptions through a React 18 bridge phase first.',
        reason:
          'The bridge reduces upgrade risk by sequencing API and runtime behavior changes before the React 19 package jump.',
        items: bridgeItems.filter((item) => item.riskLevel !== 'info'),
        forceRiskLevel: 'high',
        forceBlocksUpgrade: true,
      }, commandContext),
    );
  }

  const dependencyItems = byPhase['dependency-modernization'].filter(
    (item) => !isValidationSignal(item),
  );
  const reactUpgradeItems = dependencyItems.filter((item) =>
    /react-dom-|peer-dependency-risk-detected/.test(item.sourceIssueCode),
  );
  const foundationItems = dependencyItems.filter((item) => !reactUpgradeItems.includes(item));

  if (foundationItems.length > 0) {
    output.push(
      createGroupedStep(
        track,
        'react-19-upgrade',
        'react19.dependencies.foundation',
        {
          title: 'Modernize package foundation dependencies',
          description:
            'Address dependency modernization risks (including deprecated packages like node-sass) before final React 19 package alignment.',
          reason:
            'Dependency foundation updates reduce install/build instability during React package upgrades.',
          items: foundationItems,
        },
        commandContext,
      ),
    );
  }

  output.push(
    createGroupedStep(track, 'react-19-upgrade', 'react19.dependencies.react-upgrade', {
      title: 'Upgrade React and React DOM toward React 19',
      description:
        'Prepare React and React DOM package upgrades for React 19, including peer dependency compatibility checks and install/build verification.',
      reason: 'React package upgrades are the central migration objective and require explicit review.',
      items: reactUpgradeItems,
      fallbackRiskLevel: sourceMajor === 18 ? 'high' : 'blocker',
      forceHumanReview: true,
      fallbackIssueCode: 'react19-upgrade-preparation',
    }, commandContext),
  );

  const toolingItems = byPhase.tooling.filter((item) => !isValidationSignal(item));
  const jsxTransformItems = toolingItems.filter((item) =>
    mapRiskEnginePhaseToReactMigrationPhase(item.phase, item.sourceIssueCode) === 'jsx-transform',
  );
  const pureToolingItems = toolingItems.filter((item) => !jsxTransformItems.includes(item));

  if (pureToolingItems.length > 0 && track !== 'react-18-to-19') {
    output.push(
      createGroupedStep(track, 'tooling', 'react19.tooling', {
        title: 'Align React 19 tooling compatibility',
        description:
          'Update build/tooling configuration risks (build tool age and bundler compatibility).',
        reason: 'Tooling compatibility is required for stable React 19 builds and CI signals.',
        items: pureToolingItems,
      }, commandContext),
    );
  }
  if (jsxTransformItems.length > 0 && track !== 'react-18-to-19') {
    output.push(
      createGroupedStep(track, 'jsx-transform', 'react19.jsx-transform', {
        title: 'Upgrade JSX transform configuration',
        description:
          'Adopt and verify modern JSX transform configuration needed for React 19 compatibility.',
        reason: 'JSX transform mismatches create compile/runtime instability during migration.',
        items: jsxTransformItems,
      }, commandContext),
    );
  }

  const apiCompatibilityItems = byPhase['api-compatibility'].filter((item) => !isValidationSignal(item));
  if (apiCompatibilityItems.length > 0) {
    output.push(
      createGroupedStep(track, 'api-compatibility', 'react19.api-compatibility', {
        title: 'Resolve React API compatibility risks',
        description:
          'Address legacy APIs, lifecycle patterns, and component patterns incompatible with modern React behavior.',
        reason: 'API compatibility changes are high-impact and must be explicitly reviewed.',
        items: apiCompatibilityItems,
      }, commandContext),
    );
  }

  const sourceModernizationItems = [
    ...byPhase['typescript-readiness'],
    ...byPhase['routing-readiness'],
  ].filter((item) => !isValidationSignal(item));
  if (sourceModernizationItems.length > 0 && track !== 'react-18-to-19') {
    output.push(
      createGroupedStep(track, 'source-modernization', 'react19.source-modernization', {
        title: 'Modernize source and readiness foundations',
        description:
          'Address TypeScript and routing readiness risks that influence source migration stability.',
        reason: 'Readiness modernization reduces late-stage integration regressions.',
        items: sourceModernizationItems,
      }, commandContext),
    );
  }

  const testingReadinessItems = byPhase['testing-readiness'].filter((item) => !isValidationSignal(item));
  if (testingReadinessItems.length > 0) {
    output.push(
      createGroupedStep(track, 'validation', 'react19.validation.testing', {
        title: 'Upgrade testing readiness for React 19',
        description:
          'Address testing framework compatibility risks so migration regressions are detectable during rollout.',
        reason: 'Migration confidence depends on reliable test feedback throughout step execution.',
        items: testingReadinessItems,
      }, commandContext),
    );
  }

  return output
    .map((step) => ({ ...step, order: 0 }))
    .sort((a, b) => {
      const byPhase = getReactMigrationPhaseOrder(a.phase) - getReactMigrationPhaseOrder(b.phase);
      if (byPhase !== 0) return byPhase;
      return a.id.localeCompare(b.id);
    });
}

export function buildReact19ValidationStrategy(scanReport: ScanReport): React19ValidationStrategy {
  const commands = resolveValidationCommands(scanReport);
  const baselineCommands = commands.slice();
  const finalCommands = commands.slice();
  const missingCommands = VALIDATION_SCRIPT_PRIORITY.filter(
    (script) => !commands.some((cmd) => cmd.includes(` ${script}`) || cmd.endsWith(` ${script}`)),
  );

  return {
    baselineCommands,
    perStepCommands: commands.slice(),
    finalCommands,
    missingCommands,
  };
}

export function summarizeReact19PlanPhases(
  steps: readonly MigrationPlanStepV2[],
): React19MigrationPlanV2['phaseSummary'] {
  const out = emptyPhaseSummary();
  for (const phase of REACT_19_CANONICAL_PHASE_ORDER) {
    const phaseSteps = steps.filter((step) => step.phase === phase);
    const executionTypes = Array.from(new Set(phaseSteps.map((step) => step.executionType)));
    out[phase] = {
      totalSteps: phaseSteps.length,
      highestRisk:
        phaseSteps.length > 0
          ? resolveHighestRisk(phaseSteps.map((step) => step.risk))
          : 'low',
      executionTypes,
    };
  }
  return out;
}

function resolveRiskEngine(scanReport: ScanReport): React19RiskEngineResult {
  return scanReport.react19RiskEngine ?? buildReact19RiskEngine(scanReport);
}

function resolveSkippedPhases(
  sourceMajor: 16 | 17 | 18,
): readonly { phase: ReactMigrationPhase; reason: string }[] {
  if (sourceMajor !== 18) return [];
  return [
    {
      phase: 'react-18-bridge',
      reason:
        'Source project is already on React 18, so the React 18 bridge phase is not required. React 18 plans should focus directly on API compatibility, dependency upgrade, validation, and final review.',
    },
  ];
}

function createGroupedStep(
  track: ReactMigrationTrack,
  phase: ReactMigrationPhase,
  id: string,
  config: {
    readonly title: string;
    readonly description: string;
    readonly reason: string;
    readonly items: readonly React19RiskRecommendation[];
    readonly forceExecutionType?: MigrationPlanStepV2ExecutionType;
    readonly forceRiskLevel?: React19MigrationRiskLevel;
    readonly fallbackRiskLevel?: React19MigrationRiskLevel;
    readonly forceHumanReview?: boolean;
    readonly forceBlocksUpgrade?: boolean;
    readonly fallbackIssueCode?: string;
    readonly forceCanRunInExecution?: boolean;
  },
  commandContext: StepCommandContext,
): Omit<MigrationPlanStepV2, 'order'> {
  const items = config.items;
  const riskLevel =
    config.forceRiskLevel ??
    (items.length > 0
      ? resolveHighestSourceRisk(items.map((item) => item.riskLevel))
      : (config.fallbackRiskLevel ?? 'medium'));
  const executionType: MigrationPlanStepV2ExecutionType =
    config.forceExecutionType ??
    resolveStepExecutionType(items.map((item) => item.executionCapability));
  const runRequirements = resolveMigrationPlanStepRunRequirements(executionType);
  const sourceIssueCodes = Array.from(
    new Set(
      items.flatMap((item) => [item.sourceIssueCode, ...(item.relatedIssueCodes ?? [])]).filter(Boolean),
    ),
  );
  if (sourceIssueCodes.length === 0 && config.fallbackIssueCode !== undefined) {
    sourceIssueCodes.push(config.fallbackIssueCode);
  }

  const validationCommandsFromRisk = Array.from(
    new Set(items.flatMap((item) => item.validation.suggestedCommands ?? [])),
  );
  const stepCommands = resolveStepCommands({
    id,
    phase,
    executionType,
    validationCommandsFromRisk,
    context: commandContext,
  });
  const status: MigrationPlanStepV2['status'] =
    items.some((item) => item.blocksPlanGeneration === true) ? 'blocked' : 'pending';

  const requiresHumanReview =
    config.forceHumanReview ??
    (runRequirements.requiresApprovalBeforeRun ||
      items.some(
        (item) =>
          item.executionCapability === 'manual' ||
          item.executionCapability === 'ai-assisted' ||
          item.riskLevel === 'blocker' ||
          item.riskLevel === 'high',
      ));

  const executorResolution = resolveExecutorMetadata({
    stepId: id,
    phase,
    executionType,
    issueCodes: sourceIssueCodes,
    validationCommands: stepCommands.validationCommands,
  });
  const canRunInExecution = config.forceCanRunInExecution ?? isExecutableStepCapability(
    executorResolution.capability,
  );
  const execution = mapExecutionMetadata(
    executionType,
    executorResolution.executorKey,
    executorResolution.params,
  );
  const capability =
    status === 'blocked'
      ? 'blocked'
      : executorResolution.capability;
  const blockedReason =
    status === 'blocked'
      ? 'Blocked by risk-engine eligibility or migration constraints.'
      : executorResolution.blockedReason;

  return {
    id,
    title: config.title,
    description: config.description,
    phase,
    track,
    reason: config.reason,
    risk: toPlanStepRisk(riskLevel),
    status,
    issueCodes: sourceIssueCodes,
    executionType,
    ...(executorResolution.executorKey !== undefined
      ? { executorKey: executorResolution.executorKey }
      : {}),
    capability,
    ...(blockedReason !== undefined ? { blockedReason } : {}),
    requiresWorkspace: runRequirements.requiresWorkspace,
    requiresApprovalBeforeRun: runRequirements.requiresApprovalBeforeRun,
    requiresValidationAfterRun: runRequirements.requiresValidationAfterRun,
    expectedChangedFiles: expectedFilesForIssueCodes(sourceIssueCodes),
    ...(stepCommands.expectedCommands.length > 0
      ? { expectedCommands: stepCommands.expectedCommands }
      : {}),
    ...(stepCommands.validationCommands.length > 0
      ? { validationCommands: stepCommands.validationCommands }
      : {}),
    rollbackStrategy: resolveMigrationPlanStepRollbackStrategy(executionType),
    ...(execution !== undefined ? { execution } : {}),
    sourceIssueCodes,
    expectedChangeScope: expectedChangeScopeForPhase(phase),
    requiresHumanReview,
    canRunInExecution,
  };
}

function mapExecutionMetadata(
  executionType: MigrationPlanStepV2ExecutionType,
  executorKey: string | undefined,
  params: Record<string, unknown> | undefined,
): MigrationPlanStepV2['execution'] | undefined {
  if (executionType === 'manual') return { mode: 'manual' };
  if (executionType === 'validation-only') {
    return {
      mode: 'validation',
      ...(executorKey !== undefined ? { executorKey } : {}),
      ...(params !== undefined ? { params } : {}),
    };
  }
  if (executionType === 'ai-assisted') {
    return {
      mode: 'ai',
      ...(executorKey !== undefined ? { executorKey } : {}),
      ...(params !== undefined ? { params } : {}),
    };
  }
  return {
    mode: 'scripted',
    ...(executorKey !== undefined ? { executorKey } : {}),
    ...(params !== undefined ? { params } : {}),
  };
}

function resolveValidationCommands(scanReport: ScanReport): string[] {
  return [...resolveValidationCommandCatalog(scanReport).all];
}

function resolveValidationCommandCatalog(scanReport: ScanReport): ValidationCommandCatalog {
  if (scanReport.dependencies.packageManager === 'unknown') {
    // Avoid inventing package-manager-specific commands.
    return { all: [] };
  }
  const candidates = new Set(
    scanReport.react19CompatibilityReport?.signals.availableValidationCommands?.length
      ? scanReport.react19CompatibilityReport.signals.availableValidationCommands
      : Object.keys(scanReport.scripts.raw),
  );
  const build = candidates.has('build') ? formatRunCommand(scanReport, 'build') : undefined;
  const test = candidates.has('test') ? formatRunCommand(scanReport, 'test') : undefined;
  const lint = candidates.has('lint') ? formatRunCommand(scanReport, 'lint') : undefined;
  const typecheckScript = VALIDATION_SCRIPT_ALIASES.typecheck.find((script) =>
    candidates.has(script),
  );
  const typecheck =
    typecheckScript !== undefined ? formatRunCommand(scanReport, typecheckScript) : undefined;
  const all = [build, test, lint, typecheck].filter((command): command is string => command !== undefined);
  return {
    all,
    ...(build !== undefined ? { build } : {}),
    ...(test !== undefined ? { test } : {}),
    ...(lint !== undefined ? { lint } : {}),
    ...(typecheck !== undefined ? { typecheck } : {}),
  };
}

function resolveInstallCommand(scanReport: ScanReport): string | undefined {
  const packageManager = scanReport.dependencies.packageManager;
  if (packageManager === 'unknown') return undefined;
  return `${packageManager} install`;
}

function formatRunCommand(scanReport: ScanReport, scriptName: string): string {
  const packageManager = scanReport.dependencies.packageManager;
  return `${packageManager} run ${scriptName}`;
}

function resolveStepCommands(input: {
  readonly id: string;
  readonly phase: ReactMigrationPhase;
  readonly executionType: MigrationPlanStepV2ExecutionType;
  readonly validationCommandsFromRisk: readonly string[];
  readonly context: StepCommandContext;
}): {
  readonly expectedCommands: readonly string[];
  readonly validationCommands: readonly string[];
} {
  if (!input.context.packageManagerKnown) {
    return { expectedCommands: [], validationCommands: [] };
  }

  const riskValidation = dedupeCommands(input.validationCommandsFromRisk);
  const fullValidation = dedupeCommands(input.context.validationCatalog.all);
  const buildAndTest = dedupeCommands([
    input.context.validationCatalog.build,
    input.context.validationCatalog.test,
  ]);

  if (isDependencyOrPackageStep(input.phase, input.id)) {
    return {
      expectedCommands: dedupeCommands([input.context.installCommand, ...riskValidation]),
      validationCommands: dedupeCommands([...buildAndTest, ...riskValidation]),
    };
  }

  if (input.phase === 'api-compatibility' || input.executionType === 'codemod' || input.executionType === 'ai-assisted') {
    return {
      expectedCommands: riskValidation,
      validationCommands: dedupeCommands([...fullValidation, ...riskValidation]),
    };
  }

  if (input.executionType === 'manual') {
    return {
      expectedCommands: riskValidation,
      validationCommands: dedupeCommands([...fullValidation, ...riskValidation]),
    };
  }

  return {
    expectedCommands: riskValidation,
    validationCommands: riskValidation,
  };
}

function isDependencyOrPackageStep(phase: ReactMigrationPhase, stepId: string): boolean {
  return phase === 'react-19-upgrade' || stepId.startsWith('react19.dependencies.');
}

function dedupeCommands(commands: readonly (string | undefined)[]): string[] {
  return Array.from(
    new Set(commands.filter((command): command is string => typeof command === 'string' && command.length > 0)),
  );
}

function resolveStepExecutionType(
  capabilities: readonly React19RiskRecommendation['executionCapability'][],
): MigrationPlanStepV2ExecutionType {
  if (capabilities.includes('manual')) return mapExecutionCapabilityToPlanExecutionType('manual');
  if (capabilities.includes('ai-assisted')) {
    return mapExecutionCapabilityToPlanExecutionType('ai-assisted');
  }
  if (capabilities.includes('codemod')) return mapExecutionCapabilityToPlanExecutionType('codemod');
  if (capabilities.includes('scriptable')) {
    return mapExecutionCapabilityToPlanExecutionType('scriptable');
  }
  return 'validation-only';
}

function mapExecutionCapabilityToPlanExecutionType(
  capability: React19RiskRecommendation['executionCapability'],
): MigrationPlanStepV2ExecutionType {
  if (capability === 'scriptable') return 'scripted';
  return capability;
}

function resolveHighestRisk(levels: readonly MigrationPlanStepV2Risk[]): MigrationPlanStepV2Risk {
  if (levels.includes('high')) return 'high';
  if (levels.includes('medium')) return 'medium';
  return 'low';
}

function resolveHighestSourceRisk(
  levels: readonly React19MigrationRiskLevel[],
): React19MigrationRiskLevel {
  if (levels.includes('blocker')) return 'blocker';
  if (levels.includes('high')) return 'high';
  if (levels.includes('medium')) return 'medium';
  if (levels.includes('low')) return 'low';
  return 'info';
}

function toPlanStepRisk(level: React19MigrationRiskLevel): MigrationPlanStepV2Risk {
  if (level === 'blocker' || level === 'high') return 'high';
  if (level === 'medium') return 'medium';
  return 'low';
}

function expectedChangeScopeForPhase(phase: ReactMigrationPhase): readonly string[] {
  switch (phase) {
    case 'preflight':
      return ['package manager / lockfile hygiene', 'migration preconditions'];
    case 'tooling':
      return ['build tool and bundler config', 'toolchain compatibility'];
    case 'react-18-bridge':
      return ['React root APIs', 'bridge compatibility updates'];
    case 'api-compatibility':
      return ['React API usage in source files', 'legacy lifecycle replacement'];
    case 'jsx-transform':
      return ['JSX compiler settings', 'Babel/TypeScript JSX configuration'];
    case 'react-19-upgrade':
      return ['package.json dependencies', 'lockfile updates'];
    case 'source-modernization':
      return ['tsconfig and TS tooling', 'type safety setup'];
    case 'validation':
      return ['package.json scripts', 'CI validation gates', 'test setup and migration assertions'];
    case 'final-review':
      return ['migration summary', 'release readiness checklist'];
  }
}

function expectedFilesForIssueCodes(issueCodes: readonly string[]): readonly string[] {
  const files = new Set<string>();
  if (issueCodes.some((code) => code.includes('react-dom-render'))) {
    files.add('src/index.*');
  }
  if (issueCodes.some((code) => code.includes('find-dom-node'))) {
    files.add('src/**/*.tsx');
  }
  if (issueCodes.some((code) => code.includes('string-refs'))) {
    files.add('src/**/*.jsx');
    files.add('src/**/*.tsx');
  }
  if (issueCodes.some((code) => code.includes('legacy-context'))) {
    files.add('src/**/*context*');
  }
  if (issueCodes.some((code) => code.includes('deprecated-lifecycle'))) {
    files.add('src/**/*.tsx');
    files.add('src/**/*.jsx');
  }
  if (issueCodes.some((code) => code.includes('node-sass'))) {
    files.add('package.json');
    files.add('**/*.scss');
  }
  return Array.from(files);
}

function isExecutableStep(step: MigrationPlanStepV2): boolean {
  if (step.status !== 'pending') return false;
  return isExecutableStepCapability(step.capability);
}

function isExecutableStepCapability(capability: MigrationPlanStepV2Capability): boolean {
  return capability === 'available';
}

function resolveExecutorMetadata(input: {
  readonly stepId: string;
  readonly phase: ReactMigrationPhase;
  readonly executionType: MigrationPlanStepV2ExecutionType;
  readonly issueCodes: readonly string[];
  readonly validationCommands?: readonly string[];
}): {
  readonly executorKey?: string;
  readonly params?: Record<string, unknown>;
  readonly capability: MigrationPlanStepV2Capability;
  readonly blockedReason?: string;
} {
  const executorKey = resolveExecutorKey(input.stepId, input.phase, input.issueCodes);
  const params = resolveExecutorParams(
    input.stepId,
    input.executionType,
    input.issueCodes,
  );

  if (input.executionType === 'manual') {
    return {
      ...(executorKey !== undefined ? { executorKey } : {}),
      capability: 'manual-only',
      blockedReason:
        'This step requires human judgement and cannot be safely automated by Migrate Pilot yet.',
    };
  }

  if (input.executionType === 'validation-only') {
    if ((input.validationCommands ?? []).length === 0) {
      return {
        ...(executorKey !== undefined ? { executorKey } : {}),
        capability: 'blocked',
        blockedReason:
          'No validation commands were detected for this validation-only step.',
      };
    }
    return {
      ...(executorKey !== undefined ? { executorKey } : {}),
      capability: 'not-yet-supported',
      blockedReason:
        'Validation command execution is not implemented yet. Run the listed commands manually.',
    };
  }

  if (executorKey === undefined) {
    return {
      executorKey: fallbackExecutorKey(input.executionType),
      capability: 'not-yet-supported',
      blockedReason:
        'No executor has been mapped for this step yet, so automatic execution is not available.',
    };
  }

  if (input.executionType === 'scripted' && executorKey === 'package-json-dependency-update') {
    if (params === undefined) {
      return {
        executorKey,
        capability: 'not-yet-supported',
        blockedReason:
          'The package dependency executor requires deterministic params that are not available for this step yet.',
      };
    }
    if (!SUPPORTED_SCRIPTED_EXECUTOR_KEYS.has(executorKey)) {
      return {
        executorKey,
        capability: 'not-yet-supported',
        blockedReason: `Executor "${executorKey}" is declared but not supported in this build.`,
      };
    }
    return {
      executorKey,
      params,
      capability: 'available',
    };
  }

  if (input.executionType === 'scripted') {
    return {
      executorKey,
      ...(params !== undefined ? { params } : {}),
      capability: 'not-yet-supported',
      blockedReason:
        'A scripted executor is not implemented for this step yet. Keep this as a manual follow-up for now.',
    };
  }

  if (input.executionType === 'codemod') {
    return {
      executorKey,
      ...(params !== undefined ? { params } : {}),
      capability: 'not-yet-supported',
      blockedReason:
        'Codemod execution is planned but the codemod runner is not wired yet.',
    };
  }

  if (input.executionType === 'ai-assisted') {
    return {
      executorKey,
      ...(params !== undefined ? { params } : {}),
      capability: 'not-yet-supported',
      blockedReason:
        'AI-assisted execution is not wired into the execution engine yet.',
    };
  }

  return {
    executorKey,
    ...(params !== undefined ? { params } : {}),
    capability: 'not-yet-supported',
    blockedReason: 'Automatic execution for this step is not available yet.',
  };
}

function resolveExecutorKey(
  stepId: string,
  phase: ReactMigrationPhase,
  issueCodes: readonly string[],
): string | undefined {
  if (stepId === 'react19.validation.baseline') return 'validation.command-runner';
  if (stepId === 'react19.validation.final') return 'validation.command-runner';
  if (stepId === 'react19.bridge.react18') return 'ai-source-transform';
  if (stepId === 'react19.dependencies.react-upgrade') return 'package-json-dependency-update';
  if (stepId === 'react19.preflight.prerequisites') return 'manual-review';
  if (stepId === 'react19.final-review.signoff') return 'manual-review';

  if (issueCodes.includes('build-tool-react-scripts-very-old')) {
    return 'tooling.react-scripts';
  }
  if (
    issueCodes.some(
      (code) =>
        code === 'jsx-transform-classic' || code === 'jsx-transform-config-not-detected',
    )
  ) {
    return 'tooling.jsx-transform';
  }
  if (
    issueCodes.some((code) =>
      [
        'react-dom-render-detected',
        'react-dom-hydrate-detected',
        'unmount-component-at-node-detected',
        'unstable-render-subtree-detected',
        'create-factory-detected',
      ].includes(code),
    )
  ) {
    return 'api.legacy-render';
  }
  if (issueCodes.includes('find-dom-node-detected')) return 'api.find-dom-node';
  if (issueCodes.includes('string-refs-detected')) return 'api.string-refs';
  if (issueCodes.includes('legacy-context-detected')) return 'api.legacy-context';
  if (issueCodes.includes('deprecated-lifecycle-detected')) return 'api.unsafe-lifecycle';
  if (issueCodes.includes('node-sass-detected')) return 'package-json-dependency-update';
  if (
    issueCodes.some((code) =>
      ['typescript-not-configured', 'typescript-dependency-missing-but-files-present'].includes(
        code,
      ),
    )
  ) {
    return 'source.typescript-readiness';
  }

  if (phase === 'validation') return 'validation.command-runner';
  if (phase === 'tooling') return 'tsconfig-update';
  if (phase === 'jsx-transform') return 'file-create-or-update';
  if (phase === 'react-18-bridge') return 'ai-source-transform';
  if (phase === 'react-19-upgrade') return 'package-json-dependency-update';
  if (phase === 'source-modernization') return 'tsconfig-update';
  if (phase === 'api-compatibility') return 'codemod-react-class-to-function';
  return undefined;
}

function fallbackExecutorKey(executionType: MigrationPlanStepV2ExecutionType): string {
  switch (executionType) {
    case 'scripted':
      return 'tsconfig-update';
    case 'codemod':
      return 'codemod-react-class-to-function';
    case 'ai-assisted':
      return 'ai-source-transform';
    case 'validation-only':
      return 'validation.command-runner';
    case 'manual':
      return 'manual-review';
  }
}

function resolveExecutorParams(
  stepId: string,
  executionType: MigrationPlanStepV2ExecutionType,
  issueCodes: readonly string[],
): Record<string, unknown> | undefined {
  if (executionType !== 'scripted') return undefined;
  if (stepId !== 'react19.dependencies.foundation') return undefined;
  const dedupedIssueCodes = Array.from(new Set(issueCodes));
  if (dedupedIssueCodes.length !== 1 || dedupedIssueCodes[0] !== 'node-sass-detected') {
    return undefined;
  }
  return {
    remove: [
      {
        name: 'node-sass',
        from: ['dependencies', 'devDependencies', 'optionalDependencies'],
      },
    ],
    add: [
      {
        name: 'sass',
        version: '^1.69.0',
        to: 'devDependencies',
        onlyIfMissing: true,
      },
    ],
  };
}

function ensureCapabilityReason(step: MigrationPlanStepV2): MigrationPlanStepV2 {
  if (step.capability === 'available') return step;
  if (step.blockedReason !== undefined && step.blockedReason.trim().length > 0) {
    return step;
  }
  return {
    ...step,
    blockedReason: 'Automatic execution is not available for this step yet.',
  };
}

function isValidationSignal(item: React19RiskRecommendation): boolean {
  return item.sourceIssueCode.startsWith('validation-command-available:');
}

function buildPrerequisites(
  scanReport: ScanReport,
  sourceMajor: 16 | 17 | 18,
  validation: React19ValidationStrategy,
): readonly string[] {
  const prerequisites = [
    'Create and confirm the migration workspace in Step 05 before executing plan steps.',
    `Source track is React ${sourceMajor} -> React 19; follow ordered phase execution.`,
  ];
  if (validation.baselineCommands.length === 0) {
    prerequisites.push(
      'No validation scripts were detected. Add at least one validation command before execution.',
    );
  }
  if (scanReport.projectInfo.gitClean !== 'clean') {
    prerequisites.push(
      'Source repository is not confirmed clean. Resolve git state before workspace/execution.',
    );
  }
  return prerequisites;
}

function emptyPhaseSummary(): Record<ReactMigrationPhase, React19PlanPhaseSummary> {
  return {
    preflight: { totalSteps: 0, highestRisk: 'low', executionTypes: [] },
    tooling: { totalSteps: 0, highestRisk: 'low', executionTypes: [] },
    'react-18-bridge': { totalSteps: 0, highestRisk: 'low', executionTypes: [] },
    'api-compatibility': { totalSteps: 0, highestRisk: 'low', executionTypes: [] },
    'jsx-transform': { totalSteps: 0, highestRisk: 'low', executionTypes: [] },
    'react-19-upgrade': { totalSteps: 0, highestRisk: 'low', executionTypes: [] },
    'source-modernization': { totalSteps: 0, highestRisk: 'low', executionTypes: [] },
    validation: { totalSteps: 0, highestRisk: 'low', executionTypes: [] },
    'final-review': { totalSteps: 0, highestRisk: 'low', executionTypes: [] },
  };
}

function fallbackSourceMajor(major: number | undefined): 16 | 17 | 18 {
  if (major === 16 || major === 17 || major === 18) return major;
  return 18;
}

function makePlanId(scanReport: ScanReport): string {
  return `react19-plan-v2:${scanReport.id}:${Date.now()}`;
}

export function generateMigrationPlan(scanReport: ScanReport): MigrationPlan {
  return buildReact19MigrationPlanV2(scanReport);
}
