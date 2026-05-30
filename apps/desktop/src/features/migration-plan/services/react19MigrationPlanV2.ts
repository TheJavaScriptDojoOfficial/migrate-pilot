import type { ScanReport } from '@features/scanner';
import {
  buildReact19RiskEngine,
  resolveReact19PlanGenerationGate,
  type React19MigrationPhase,
  type React19MigrationRiskLevel,
  type React19RiskRecommendation,
  type React19RiskEngineResult,
  type ReactMigrationTrack,
} from '@features/react19-migration';

import type {
  MigrationPlan,
  React19MigrationPlanV2,
  React19PlanPhaseSummary,
  React19PlanStep,
  React19PlanStepExecutionType,
  React19ValidationStrategy,
} from '../types/migrationPlan.types';

const PHASE_ORDER: readonly React19MigrationPhase[] = [
  'preflight',
  'validation-readiness',
  'react-bridge',
  'dependency-modernization',
  'tooling',
  'typescript-readiness',
  'api-compatibility',
  'routing-readiness',
  'testing-readiness',
];

const VALIDATION_SCRIPT_PRIORITY = ['build', 'test', 'lint', 'typecheck'] as const;

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
      highestRisk: 'blocker',
      summary: {
        title: 'React 19 migration plan blocked',
        description: 'Resolve eligibility blockers and regenerate the plan.',
        totalSteps: 0,
        estimatedRisk: 'blocker',
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

  const executableSteps = steps.filter(
    (step) => step.status === 'pending' && step.canRunInExecution !== false,
  );
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
    highestRisk: resolveHighestRisk(steps.map((step) => step.riskLevel)),
    summary: {
      title: 'React 19 migration plan',
      description: `Track-aware React 19 plan for ${track}.`,
      totalSteps: steps.length,
      estimatedRisk: resolveHighestRisk(steps.map((step) => step.riskLevel)),
      estimatedComplexity: scanReport.projectInfo.complexity,
      approvalGates: steps.filter((step) => step.requiresHumanReview).length,
      requiredSteps: steps.filter((step) => step.required).length,
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

export function buildReact19PlanStepsFromRiskEngine(scanReport: ScanReport): React19PlanStep[] {
  const track = resolveReact19PlanTrack(scanReport);
  const sourceMajor = scanReport.react19MigrationContext?.sourceReactMajor;
  if (track === null || sourceMajor === undefined) return [];

  const validationStrategy = buildReact19ValidationStrategy(scanReport);
  const steps: React19PlanStep[] = [];
  let order = 1;

  if (validationStrategy.baselineCommands.length > 0) {
    steps.push({
      id: 'react19.validation.baseline',
      order: order++,
      title: 'Run baseline validation in migration workspace',
      description:
        'Establish the current build/test/lint baseline inside the migration workspace before applying React 19 migration changes.',
      phase: 'validation-readiness',
      track,
      riskLevel: 'medium',
      executionType: 'validation-only',
      status: 'pending',
      reason:
        'Baseline validation separates pre-existing project failures from migration-introduced regressions.',
      category: 'validation',
      risk: 'medium',
      sourceIssueCodes: [],
      relatedRecommendationIds: [],
      expectedChangeScope: ['Validation command output only (no file modifications)'],
      expectedAreas: ['validation scripts'],
      validationCommands: validationStrategy.baselineCommands,
      required: true,
      approvalRequired: false,
      requiresHumanReview: false,
      canRunInExecution: true,
      execution: { mode: 'validation' },
    });
  }

  const grouped = groupRiskRecommendationsIntoPlanSteps(scanReport);
  for (const step of grouped) {
    steps.push({ ...step, order: order++ });
  }

  if (validationStrategy.finalCommands.length > 0) {
    steps.push({
      id: 'react19.validation.final',
      order: order++,
      title: 'Run final React 19 migration validation',
      description:
        'Run the full validation suite after all selected migration steps to confirm project stability on the React 19 path.',
      phase: 'validation-readiness',
      track,
      riskLevel: 'medium',
      executionType: 'validation-only',
      status: 'pending',
      reason: 'Final validation confirms the migrated state is stable and releasable.',
      category: 'validation',
      risk: 'medium',
      sourceIssueCodes: [],
      relatedRecommendationIds: [],
      expectedChangeScope: ['Validation command output only (no file modifications)'],
      expectedAreas: ['validation scripts'],
      validationCommands: validationStrategy.finalCommands,
      required: true,
      approvalRequired: false,
      requiresHumanReview: false,
      canRunInExecution: true,
      execution: { mode: 'validation' },
    });
  }

  return steps;
}

export function groupRiskRecommendationsIntoPlanSteps(
  scanReport: ScanReport,
): React19PlanStep[] {
  const track = resolveReact19PlanTrack(scanReport);
  const sourceMajor = scanReport.react19MigrationContext?.sourceReactMajor;
  if (track === null || sourceMajor === undefined) return [];

  const riskEngine = resolveRiskEngine(scanReport);
  const byPhase = riskEngine.byPhase;
  const output: Omit<React19PlanStep, 'order'>[] = [];

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
      }),
    );
  }

  const validationReadiness = byPhase['validation-readiness'].filter(
    (item) => !isValidationSignal(item),
  );
  if (validationReadiness.length > 0) {
    output.push(
      createGroupedStep(track, 'validation-readiness', 'react19.validation.readiness', {
        title: 'Strengthen migration validation readiness',
        description:
          'Resolve missing or weak validation gates so each migration step can be verified consistently.',
        reason: 'Reliable lint/typecheck/test/build signals reduce migration regression risk.',
        items: validationReadiness,
      }),
    );
  }

  const bridgeItems = byPhase['react-bridge'];
  if (sourceMajor === 16 || sourceMajor === 17) {
    output.push(
      createGroupedStep(track, 'react-bridge', 'react19.bridge.react18', {
        title: `Bridge React ${sourceMajor} project through React 18 compatibility`,
        description:
          'Direct upgrades from React 16/17 to React 19 are high-risk. Align root APIs and compatibility assumptions through a React 18 bridge phase first.',
        reason:
          'The bridge reduces upgrade risk by sequencing API and runtime behavior changes before the React 19 package jump.',
        items: bridgeItems.filter((item) => item.riskLevel !== 'info'),
        forceRiskLevel: 'high',
        forceBlocksUpgrade: true,
      }),
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
        'dependency-modernization',
        'react19.dependencies.foundation',
        {
          title: 'Modernize package foundation dependencies',
          description:
            'Address dependency modernization risks (including deprecated packages like node-sass) before final React 19 package alignment.',
          reason:
            'Dependency foundation updates reduce install/build instability during React package upgrades.',
          items: foundationItems,
        },
      ),
    );
  }

  output.push(
    createGroupedStep(track, 'dependency-modernization', 'react19.dependencies.react-upgrade', {
      title: 'Upgrade React and React DOM toward React 19',
      description:
        'Prepare React and React DOM package upgrades for React 19, including peer dependency compatibility checks and install/build verification.',
      reason: 'React package upgrades are the central migration objective and require explicit review.',
      items: reactUpgradeItems,
      fallbackRiskLevel: sourceMajor === 18 ? 'high' : 'blocker',
      forceHumanReview: true,
      fallbackIssueCode: 'react19-upgrade-preparation',
    }),
  );

  const phaseTitles: Readonly<
    Record<
      Exclude<React19MigrationPhase, 'preflight' | 'react-bridge' | 'dependency-modernization'>,
      { title: string; description: string; reason: string }
    >
  > = {
    tooling: {
      title: 'Align React 19 tooling compatibility',
      description:
        'Update build/tooling configuration risks (build tool age, JSX transform, bundler compatibility).',
      reason: 'Tooling compatibility is required for stable React 19 builds and CI signals.',
    },
    'typescript-readiness': {
      title: 'Prepare TypeScript readiness for React 19',
      description:
        'Address TypeScript readiness and compiler setup risks that can block safe API upgrades.',
      reason: 'Type safety helps surface migration regressions early in the upgrade sequence.',
    },
    'api-compatibility': {
      title: 'Resolve React API compatibility risks',
      description:
        'Address legacy APIs, lifecycle patterns, and component patterns incompatible with modern React behavior.',
      reason: 'API compatibility changes are high-impact and must be explicitly reviewed.',
    },
    'routing-readiness': {
      title: 'Prepare routing compatibility for React 19',
      description:
        'Resolve routing version and readiness concerns before final migration validation.',
      reason: 'Routing upgrades can affect critical user flows and require targeted verification.',
    },
    'testing-readiness': {
      title: 'Upgrade testing readiness for React 19',
      description:
        'Address testing framework compatibility risks so migration regressions are detectable during rollout.',
      reason: 'Migration confidence depends on reliable test feedback throughout step execution.',
    },
    'validation-readiness': {
      title: '',
      description: '',
      reason: '',
    },
  };

  for (const phase of PHASE_ORDER) {
    if (
      phase === 'preflight' ||
      phase === 'validation-readiness' ||
      phase === 'react-bridge' ||
      phase === 'dependency-modernization'
    ) {
      continue;
    }
    const items = byPhase[phase].filter((item) => !isValidationSignal(item));
    if (items.length === 0) continue;
    const preset = phaseTitles[phase];
    output.push(
      createGroupedStep(track, phase, `react19.${phase}`, {
        title: preset.title,
        description: preset.description,
        reason: preset.reason,
        items,
      }),
    );
  }

  return output.map((step) => ({ ...step, order: 0 }));
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
  steps: readonly React19PlanStep[],
): React19MigrationPlanV2['phaseSummary'] {
  const out: Record<React19MigrationPhase, React19PlanPhaseSummary> = {
    preflight: { totalSteps: 0, highestRisk: 'info', executionTypes: [] },
    tooling: { totalSteps: 0, highestRisk: 'info', executionTypes: [] },
    'react-bridge': { totalSteps: 0, highestRisk: 'info', executionTypes: [] },
    'api-compatibility': { totalSteps: 0, highestRisk: 'info', executionTypes: [] },
    'dependency-modernization': { totalSteps: 0, highestRisk: 'info', executionTypes: [] },
    'typescript-readiness': { totalSteps: 0, highestRisk: 'info', executionTypes: [] },
    'routing-readiness': { totalSteps: 0, highestRisk: 'info', executionTypes: [] },
    'testing-readiness': { totalSteps: 0, highestRisk: 'info', executionTypes: [] },
    'validation-readiness': { totalSteps: 0, highestRisk: 'info', executionTypes: [] },
  };
  for (const phase of Object.keys(out) as React19MigrationPhase[]) {
    const phaseSteps = steps.filter((step) => step.phase === phase);
    const executionTypes = Array.from(new Set(phaseSteps.map((step) => step.executionType)));
    out[phase] = {
      totalSteps: phaseSteps.length,
      highestRisk:
        phaseSteps.length > 0
          ? resolveHighestRisk(phaseSteps.map((step) => step.riskLevel))
          : 'info',
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
): readonly { phase: React19MigrationPhase; reason: string }[] {
  if (sourceMajor !== 18) return [];
  return [
    {
      phase: 'react-bridge',
      reason:
        'Source project is already on React 18, so the React 18 bridge phase is not required.',
    },
  ];
}

function createGroupedStep(
  track: ReactMigrationTrack,
  phase: React19MigrationPhase,
  id: string,
  config: {
    readonly title: string;
    readonly description: string;
    readonly reason: string;
    readonly items: readonly React19RiskRecommendation[];
    readonly forceExecutionType?: React19PlanStepExecutionType;
    readonly forceRiskLevel?: React19MigrationRiskLevel;
    readonly fallbackRiskLevel?: React19MigrationRiskLevel;
    readonly forceHumanReview?: boolean;
    readonly forceBlocksUpgrade?: boolean;
    readonly fallbackIssueCode?: string;
    readonly forceCanRunInExecution?: boolean;
  },
): Omit<React19PlanStep, 'order'> {
  const items = config.items;
  const riskLevel =
    config.forceRiskLevel ??
    (items.length > 0
      ? resolveHighestRisk(items.map((item) => item.riskLevel))
      : (config.fallbackRiskLevel ?? 'medium'));
  const executionType =
    config.forceExecutionType ??
    resolveStepExecutionType(items.map((item) => item.executionCapability));
  const sourceIssueCodes = Array.from(
    new Set(
      items.flatMap((item) => [item.sourceIssueCode, ...(item.relatedIssueCodes ?? [])]).filter(Boolean),
    ),
  );
  if (sourceIssueCodes.length === 0 && config.fallbackIssueCode !== undefined) {
    sourceIssueCodes.push(config.fallbackIssueCode);
  }

  const validationCommands = Array.from(
    new Set(items.flatMap((item) => item.validation.suggestedCommands ?? [])),
  );
  const status: React19PlanStep['status'] =
    items.some((item) => item.blocksPlanGeneration === true) ? 'blocked' : 'pending';

  const requiresHumanReview =
    config.forceHumanReview ??
    items.some(
      (item) =>
        item.executionCapability === 'manual' ||
        item.executionCapability === 'ai-assisted' ||
        item.riskLevel === 'blocker' ||
        item.riskLevel === 'high',
    );

  const canRunInExecution =
    config.forceCanRunInExecution ??
    (status === 'pending' && executionType !== 'manual');
  const execution = mapExecutionMetadata(executionType);

  return {
    id,
    title: config.title,
    description: config.description,
    phase,
    track,
    riskLevel,
    executionType,
    status,
    reason: config.reason,
    category: categoryForPhase(phase),
    risk: riskLevel,
    sourceIssueCodes,
    relatedRecommendationIds: items.map((item) => item.id),
    expectedChangeScope: expectedChangeScopeForPhase(phase),
    expectedAreas: expectedChangeScopeForPhase(phase),
    validationCommands,
    required: riskLevel === 'blocker' || riskLevel === 'high' || phase === 'dependency-modernization',
    approvalRequired: requiresHumanReview,
    requiresHumanReview,
    ...(config.forceBlocksUpgrade === true || items.some((item) => item.blocksUpgrade === true)
      ? { blocksUpgrade: true }
      : {}),
    canRunInExecution,
    ...(items.length > 0
      ? {
          executionCapability: resolveDominantExecutionCapability(
            items.map((item) => item.executionCapability),
          ),
        }
      : {}),
    ...(execution !== undefined ? { execution } : {}),
  };
}

function mapExecutionMetadata(
  executionType: React19PlanStepExecutionType,
): React19PlanStep['execution'] | undefined {
  if (executionType === 'validation-only') return { mode: 'validation' };
  if (executionType === 'manual') return { mode: 'manual' };
  if (executionType === 'ai-assisted') return { mode: 'ai' };
  if (executionType === 'scriptable') return { mode: 'scripted' };
  return { mode: 'manual' };
}

function resolveValidationCommands(scanReport: ScanReport): string[] {
  const signals = scanReport.react19CompatibilityReport?.signals.availableValidationCommands ?? [];
  const scripts = scanReport.scripts.raw;
  const runPrefix =
    scanReport.dependencies.packageManager === 'unknown'
      ? 'npm run'
      : `${scanReport.dependencies.packageManager} run`;

  const candidates = signals.length > 0 ? signals : Object.keys(scripts);
  const commands: string[] = [];
  for (const scriptName of candidates) {
    if (
      scriptName !== 'build' &&
      scriptName !== 'test' &&
      scriptName !== 'lint' &&
      scriptName !== 'typecheck' &&
      scriptName !== 'type-check' &&
      scriptName !== 'tsc'
    ) {
      continue;
    }
    commands.push(`${runPrefix} ${scriptName}`);
  }
  return Array.from(new Set(commands));
}

function resolveStepExecutionType(
  capabilities: readonly React19RiskRecommendation['executionCapability'][],
): React19PlanStepExecutionType {
  if (capabilities.includes('manual')) return 'manual';
  if (capabilities.includes('ai-assisted')) return 'ai-assisted';
  if (capabilities.includes('codemod')) return 'codemod';
  if (capabilities.includes('scriptable')) return 'scriptable';
  return 'validation-only';
}

function resolveDominantExecutionCapability(
  capabilities: readonly React19RiskRecommendation['executionCapability'][],
): React19RiskRecommendation['executionCapability'] {
  if (capabilities.includes('manual')) return 'manual';
  if (capabilities.includes('ai-assisted')) return 'ai-assisted';
  if (capabilities.includes('codemod')) return 'codemod';
  if (capabilities.includes('scriptable')) return 'scriptable';
  return 'validation-only';
}

function resolveHighestRisk(levels: readonly React19MigrationRiskLevel[]): React19MigrationRiskLevel {
  if (levels.includes('blocker')) return 'blocker';
  if (levels.includes('high')) return 'high';
  if (levels.includes('medium')) return 'medium';
  if (levels.includes('low')) return 'low';
  return 'info';
}

function expectedChangeScopeForPhase(phase: React19MigrationPhase): readonly string[] {
  switch (phase) {
    case 'preflight':
      return ['package manager / lockfile hygiene', 'migration preconditions'];
    case 'validation-readiness':
      return ['package.json scripts', 'CI validation gates'];
    case 'react-bridge':
      return ['React root APIs', 'bridge compatibility updates'];
    case 'dependency-modernization':
      return ['package.json dependencies', 'lockfile updates'];
    case 'tooling':
      return ['build tool and bundler config', 'JSX transform configuration'];
    case 'typescript-readiness':
      return ['tsconfig and TS tooling', 'type safety setup'];
    case 'api-compatibility':
      return ['React API usage in source files', 'legacy lifecycle replacement'];
    case 'routing-readiness':
      return ['routing configuration and route modules'];
    case 'testing-readiness':
      return ['test setup and migration assertions'];
  }
}

function categoryForPhase(phase: React19MigrationPhase): React19PlanStep['category'] {
  switch (phase) {
    case 'preflight':
      return 'preflight';
    case 'validation-readiness':
      return 'validation';
    case 'react-bridge':
      return 'bridge';
    case 'dependency-modernization':
      return 'dependency';
    case 'tooling':
      return 'tooling';
    case 'typescript-readiness':
      return 'typescript';
    case 'api-compatibility':
      return 'api';
    case 'routing-readiness':
      return 'routing';
    case 'testing-readiness':
      return 'testing';
  }
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

function emptyPhaseSummary(): Readonly<Record<React19MigrationPhase, React19PlanPhaseSummary>> {
  return {
    preflight: { totalSteps: 0, highestRisk: 'info', executionTypes: [] },
    tooling: { totalSteps: 0, highestRisk: 'info', executionTypes: [] },
    'react-bridge': { totalSteps: 0, highestRisk: 'info', executionTypes: [] },
    'api-compatibility': { totalSteps: 0, highestRisk: 'info', executionTypes: [] },
    'dependency-modernization': { totalSteps: 0, highestRisk: 'info', executionTypes: [] },
    'typescript-readiness': { totalSteps: 0, highestRisk: 'info', executionTypes: [] },
    'routing-readiness': { totalSteps: 0, highestRisk: 'info', executionTypes: [] },
    'testing-readiness': { totalSteps: 0, highestRisk: 'info', executionTypes: [] },
    'validation-readiness': { totalSteps: 0, highestRisk: 'info', executionTypes: [] },
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
