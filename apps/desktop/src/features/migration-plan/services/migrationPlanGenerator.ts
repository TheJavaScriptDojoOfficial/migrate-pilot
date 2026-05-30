/**
 * Migration plan generator (Milestone 4).
 *
 * Pure, deterministic, rule-based migration plan builder. Consumes a
 * completed `ScanReport` and emits a `MigrationPlan` describing a
 * foundation-first migration strategy tailored to that specific project.
 *
 * Architectural rules
 * -------------------
 * - No React imports. No IPC. No filesystem access. No process spawning.
 *   Trivially unit-testable and reusable by the future orchestrator layer.
 * - Pure function in / out: same `ScanReport` → same `MigrationPlan` for
 *   the same wall clock (only `generatedAt` and the plan id are time-based).
 * - The generator NEVER invents data the scanner did not see. If the
 *   ScanReport says no build script exists, the step's validationCommands
 *   list is empty and a plan-level warning is added.
 *
 * Rule index (matches docs in the user prompt)
 * --------------------------------------------
 *   1.  Always emit a "Create safe migration workspace" step.
 *   2.  Add "Replace node-sass with sass" if styling.usesNodeSass.
 *   3.  If sass already present and node-sass absent, only add a soft
 *       recommendation — never a redundant step.
 *   4.  TypeScript: foundation step if missing, verification step if present.
 *   5.  JS/JSX source conversion steps depend on file counts + complexity.
 *   6.  Class components → modernise-in-batches step (medium risk).
 *   7.  Deprecated lifecycle methods → high-risk fix step (requires approval).
 *   8.  ReactDOM.render usage → React root rendering API assessment step.
 *   9.  Router → review modernisation step.
 *  10.  Redux/Redux Toolkit → state-management compatibility review.
 *  11.  Missing validation scripts → blockers + validation setup step.
 *  12.  Always emit a final validation step.
 *  13.  Always emit a final summary report step.
 */
import type {
  DependencyReport,
  Recommendation,
  RiskReport,
  ScanProjectInfo,
  ScanReport,
  SourceAnalysisReport,
  ScriptReport,
} from '@features/scanner';

import {
  pickValidationCommands,
  resolveAllValidationCommands,
} from './migrationPlanValidationService';
import {
  countApprovalGates,
  countRequiredSteps,
  deriveBlockers,
  deriveWarnings,
  estimatePlanRisk,
} from './migrationPlanRiskService';

import type {
  MigrationPlan,
  MigrationPlanComplexity,
  MigrationPlanSummary,
  MigrationStep,
  MigrationStepCategory,
  MigrationStepExecution,
  MigrationStepRisk,
} from '../types/migrationPlan.types';

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Generate a `MigrationPlan` from a completed `ScanReport`.
 *
 * The function is intentionally synchronous — generation should take
 * sub-millisecond time. Callers may still wrap it in `async` to keep their
 * own state machine consistent.
 */
export function generateMigrationPlan(scanReport: ScanReport): MigrationPlan {
  const ctx: GeneratorContext = buildContext(scanReport);
  const builder = new StepBuilder();

  appendWorkspaceStep(builder, ctx);
  appendDependencyModernizationSteps(builder, ctx);
  appendBuildToolingStep(builder, ctx);
  appendTypeScriptStep(builder, ctx);
  appendSourceConversionSteps(builder, ctx);
  appendComponentSteps(builder, ctx);
  appendLifecycleStep(builder, ctx);
  appendReactDomRenderStep(builder, ctx);
  appendRoutingStep(builder, ctx);
  appendStateManagementStep(builder, ctx);
  appendValidationSetupStep(builder, ctx);
  appendFinalValidationStep(builder, ctx);
  appendFinalReportStep(builder, ctx);

  const steps = builder.build();
  const summary = buildSummary(steps, scanReport);
  const blockers = computeBlockers(ctx);
  const warnings = computeWarnings(ctx);
  const assumptions = computeAssumptions(ctx);
  const recommendations = computeRecommendations(ctx);

  return {
    id: makePlanId(scanReport),
    scanReportId: scanReport.id,
    projectPath: scanReport.projectPath,
    generatedAt: new Date().toISOString(),
    strategy: 'foundation-first',
    status: 'draft',
    summary,
    steps,
    assumptions,
    blockers,
    warnings,
    recommendations,
  };
}

/* -------------------------------------------------------------------------- */
/* Context                                                                    */
/* -------------------------------------------------------------------------- */

interface GeneratorContext {
  readonly scanReport: ScanReport;
  readonly projectInfo: ScanProjectInfo;
  readonly dependencies: DependencyReport;
  readonly sourceAnalysis: SourceAnalysisReport;
  readonly scripts: ScriptReport;
  readonly risks: RiskReport;
  readonly scannerRecommendations: readonly Recommendation[];
  /** Total handwritten code files (.js + .jsx + .ts + .tsx). */
  readonly codeFileCount: number;
  /** True when scanner detected at least one .js or .jsx file. */
  readonly hasJsSources: boolean;
  /** True when the project has any TypeScript present. */
  readonly hasTypeScript: boolean;
}

function buildContext(scanReport: ScanReport): GeneratorContext {
  const source = scanReport.sourceAnalysis;
  const codeFileCount =
    source.jsFiles + source.jsxFiles + source.tsFiles + source.tsxFiles;

  return {
    scanReport,
    projectInfo: scanReport.projectInfo,
    dependencies: scanReport.dependencies,
    sourceAnalysis: source,
    scripts: scanReport.scripts,
    risks: scanReport.risks,
    scannerRecommendations: scanReport.recommendations,
    codeFileCount,
    hasJsSources: source.jsFiles + source.jsxFiles > 0,
    hasTypeScript: scanReport.projectInfo.hasTypeScript,
  };
}

/* -------------------------------------------------------------------------- */
/* Step builder                                                               */
/* -------------------------------------------------------------------------- */

interface StepDraft {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly category: MigrationStepCategory;
  readonly risk: MigrationStepRisk;
  readonly required: boolean;
  readonly approvalRequired: boolean;
  readonly reason: string;
  readonly expectedFiles?: readonly string[];
  readonly expectedAreas?: readonly string[];
  readonly validationCommands?: readonly string[];
  readonly dependsOn?: readonly string[];
  readonly execution?: MigrationStepExecution;
}

class StepBuilder {
  private readonly drafts: StepDraft[] = [];
  private readonly seenIds = new Set<string>();

  public add(draft: StepDraft): void {
    if (this.seenIds.has(draft.id)) {
      // Defensive guard — generator bugs would otherwise yield duplicated steps.
      return;
    }
    this.seenIds.add(draft.id);
    this.drafts.push(draft);
  }

  public has(id: string): boolean {
    return this.seenIds.has(id);
  }

  public build(): readonly MigrationStep[] {
    return this.drafts.map((draft, index): MigrationStep => {
      return {
        id: draft.id,
        order: index + 1,
        title: draft.title,
        description: draft.description,
        category: draft.category,
        risk: draft.risk,
        status: 'pending',
        required: draft.required,
        approvalRequired: draft.approvalRequired,
        reason: draft.reason,
        ...(draft.expectedFiles !== undefined && draft.expectedFiles.length > 0
          ? { expectedFiles: draft.expectedFiles }
          : {}),
        ...(draft.expectedAreas !== undefined && draft.expectedAreas.length > 0
          ? { expectedAreas: draft.expectedAreas }
          : {}),
        ...(draft.validationCommands !== undefined && draft.validationCommands.length > 0
          ? { validationCommands: draft.validationCommands }
          : {}),
        ...(draft.dependsOn !== undefined && draft.dependsOn.length > 0
          ? { dependsOn: draft.dependsOn }
          : {}),
        ...(draft.execution !== undefined ? { execution: draft.execution } : {}),
      };
    });
  }
}

/* -------------------------------------------------------------------------- */
/* Step rules                                                                 */
/* -------------------------------------------------------------------------- */

const STEP_IDS = {
  workspace: 'workspace.create',
  nodeSass: 'dependency.replace-node-sass',
  buildTooling: 'config.build-tooling',
  typescriptFoundation: 'typescript.foundation',
  typescriptVerify: 'typescript.verify',
  convertUtilities: 'source.convert-utilities',
  convertComponents: 'component.convert-shared',
  convertPages: 'source.convert-pages',
  classComponents: 'component.modernize-class',
  lifecycle: 'component.fix-deprecated-lifecycle',
  reactDomRender: 'source.assess-react-root',
  routing: 'routing.review-modernization',
  stateManagement: 'state-management.review-compatibility',
  validationSetup: 'validation.improve-setup',
  validationFinal: 'validation.run-final',
  finalReport: 'report.generate-summary',
} as const;

function appendWorkspaceStep(b: StepBuilder, ctx: GeneratorContext): void {
  const isGit = ctx.projectInfo.isGitRepository;
  const cleanState = ctx.projectInfo.gitClean;

  // Risk: medium when we have a clean git repo, high when git is missing or
  // unknown/dirty (rollback safety is reduced).
  const risk: MigrationStepRisk =
    isGit && cleanState === 'clean' ? 'medium' : 'high';

  const reason = isGit
    ? cleanState === 'clean'
      ? 'A Git worktree gives us an isolated, reversible workspace per migration session.'
      : 'Git is present but the working tree is not clean. The workspace step will surface this so we never migrate on top of uncommitted work.'
    : 'No Git repository detected — the workspace step will fall back to a copy-based workspace and clearly mark this as higher risk.';

  b.add({
    id: STEP_IDS.workspace,
    title: 'Create safe migration workspace',
    description:
      'Set up an isolated workspace (Git worktree when possible, copy-mode otherwise) so the original project is never modified directly.',
    category: 'workspace',
    risk,
    required: true,
    approvalRequired: true,
    reason,
    expectedAreas: ['migration workspace'],
  });
}

function appendDependencyModernizationSteps(
  b: StepBuilder,
  ctx: GeneratorContext,
): void {
  const { styling } = ctx.dependencies;
  if (!styling.usesNodeSass) return;

  // Risk escalates with style + source complexity: if there are many style
  // files or a large source base, the swap touches more output than usual.
  const styleFiles = ctx.sourceAnalysis.styleFiles;
  const risk: MigrationStepRisk =
    styleFiles > 30 || ctx.projectInfo.complexity === 'large'
      ? 'high'
      : 'medium';

  const validation = pickValidationCommands(
    ctx.dependencies.packageManager,
    ctx.scripts,
    ['build', 'lint', 'test'],
  );

  // Generic execution metadata — the executor itself is `package-json-
  // dependency-update` (not node-sass-specific). The step id stays
  // node-sass-specific because the *step* is specific, even though the
  // executor is reusable for any package add/remove flow.
  const execution: MigrationStepExecution = {
    mode: 'scripted',
    executorKey: 'package-json-dependency-update',
    params: {
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
    },
  };

  b.add({
    id: STEP_IDS.nodeSass,
    title: 'Replace node-sass with sass',
    description:
      'Remove node-sass (unmaintained since 2020, tied to LibSass) and install the modern sass (Dart Sass) package. Preserve style behaviour exactly.',
    category: 'dependency',
    risk,
    required: true,
    approvalRequired: true,
    reason:
      'node-sass is deprecated and blocks safe modernization. Replacing it standalone keeps the change auditable and reversible.',
    expectedFiles: ['package.json', ...inferLockfileTargets(ctx.dependencies.lockFiles)],
    expectedAreas: ['styles (*.scss, *.sass)'],
    validationCommands: validation,
    dependsOn: [STEP_IDS.workspace],
    execution,
  });
}

function appendBuildToolingStep(b: StepBuilder, ctx: GeneratorContext): void {
  // Emit this step when the project is missing a build script OR is using
  // a deprecated build tool surface (react-scripts on React < 18 is the
  // most common case in V1).
  const missingBuild = !ctx.scripts.hasBuild;
  const usingReactScripts = ctx.dependencies.reactScriptsVersion !== undefined;

  if (!missingBuild && !usingReactScripts) return;

  const reason = missingBuild
    ? 'No build script is declared. The plan needs a build gate before any migration step can be validated.'
    : 'react-scripts (CRA) is still active. We need to plan whether to keep CRA or migrate the build tool — either way it is a foundation decision, not an in-flight one.';

  b.add({
    id: STEP_IDS.buildTooling,
    title: missingBuild
      ? 'Prepare build & tooling compatibility'
      : 'Review build tooling (react-scripts)',
    description: missingBuild
      ? 'Add a `build` script and confirm the project compiles before any code conversion. The migration plan validates every step against this gate.'
      : 'Decide whether to keep react-scripts as the build tool for the migration, plan an upgrade to a maintained version, or migrate to Vite/esbuild as a separate follow-up.',
    category: 'config',
    risk: 'medium',
    required: missingBuild,
    approvalRequired: true,
    reason,
    expectedFiles: ['package.json'],
    expectedAreas: ['build configuration'],
    validationCommands: pickValidationCommands(
      ctx.dependencies.packageManager,
      ctx.scripts,
      ['build'],
    ),
    dependsOn: [STEP_IDS.workspace],
  });
}

function appendTypeScriptStep(b: StepBuilder, ctx: GeneratorContext): void {
  if (ctx.hasTypeScript) {
    b.add({
      id: STEP_IDS.typescriptVerify,
      title: 'Verify TypeScript configuration',
      description:
        'Confirm tsconfig.json is healthy (strict mode where reasonable, correct lib/target, no orphan path mappings). No source conversion in this step.',
      category: 'typescript',
      risk: 'low',
      required: false,
      approvalRequired: false,
      reason:
        'TypeScript is already present. Verifying the config protects subsequent conversion steps from drifting on compiler options.',
      expectedFiles: ['tsconfig.json'],
      expectedAreas: ['type-checking configuration'],
      validationCommands: pickValidationCommands(
        ctx.dependencies.packageManager,
        ctx.scripts,
        ['typecheck', 'build'],
      ),
      dependsOn: [STEP_IDS.workspace],
    });
    return;
  }

  // No TypeScript at all — add a foundation step but DO NOT convert sources
  // here. Source conversion is sequenced separately so each step stays
  // small and reviewable.
  b.add({
    id: STEP_IDS.typescriptFoundation,
    title: 'Prepare TypeScript foundation',
    description:
      'Introduce tsconfig.json, install typescript and @types/* baselines, and add a typecheck script. Source files are not converted in this step.',
    category: 'typescript',
    risk: 'medium',
    required: true,
    approvalRequired: true,
    reason:
      'A solid TypeScript foundation must land before any file conversion so that compiler signals are immediately useful.',
    expectedFiles: ['tsconfig.json', 'package.json'],
    expectedAreas: ['type-checking configuration', 'dev dependencies'],
    validationCommands: pickValidationCommands(
      ctx.dependencies.packageManager,
      ctx.scripts,
      ['build'],
    ),
    dependsOn: [STEP_IDS.workspace],
  });
}

function appendSourceConversionSteps(
  b: StepBuilder,
  ctx: GeneratorContext,
): void {
  if (!ctx.hasJsSources) return;

  const typescriptDependsOn = ctx.hasTypeScript
    ? STEP_IDS.typescriptVerify
    : STEP_IDS.typescriptFoundation;

  // Utility conversion is always small and high-value, scoped to .js files.
  if (ctx.sourceAnalysis.jsFiles > 0) {
    b.add({
      id: STEP_IDS.convertUtilities,
      title: 'Convert utilities & constants to TypeScript',
      description:
        'Convert small, leaf .js files (helpers, constants, formatters). These have no UI surface and offer the highest signal-to-risk ratio.',
      category: 'source',
      risk: 'low',
      required: false,
      approvalRequired: false,
      reason:
        'Utility files are the safest starting point — converting them produces immediate type-coverage gains without touching components.',
      expectedAreas: ['utils/', 'lib/', 'constants/', 'helpers/'],
      validationCommands: pickValidationCommands(
        ctx.dependencies.packageManager,
        ctx.scripts,
        ['typecheck', 'build', 'test'],
      ),
      dependsOn: [typescriptDependsOn],
    });
  }

  // Pages / modules conversion is only added for medium/large projects.
  // Small projects do not need a separate batch — the components step is
  // enough to cover the surface area.
  if (
    ctx.sourceAnalysis.jsxFiles > 0 &&
    (ctx.projectInfo.complexity === 'medium' ||
      ctx.projectInfo.complexity === 'large')
  ) {
    b.add({
      id: STEP_IDS.convertPages,
      title: 'Convert low-risk pages & feature modules to TypeScript',
      description:
        'Sweep page-level .jsx files into .tsx in small reviewable batches. Skip pages with deprecated patterns until their dedicated step lands.',
      category: 'source',
      risk: 'medium',
      required: false,
      approvalRequired: true,
      reason:
        'Pages can encode business logic; converting them deserves a dedicated, reviewable step rather than being bundled with leaf utilities.',
      expectedAreas: ['pages/', 'features/', 'screens/', 'routes/'],
      validationCommands: pickValidationCommands(
        ctx.dependencies.packageManager,
        ctx.scripts,
        ['typecheck', 'build', 'test'],
      ),
      dependsOn: [typescriptDependsOn],
    });
  }
}

function appendComponentSteps(b: StepBuilder, ctx: GeneratorContext): void {
  if (ctx.sourceAnalysis.jsxFiles === 0 && ctx.sourceAnalysis.classComponentIndicators === 0) {
    return;
  }

  // Conversion-to-TSX for shared low-risk components is a different concern
  // from class-component modernisation, even though they touch similar
  // files. Keep them as separate steps so the user can review independently.
  if (ctx.sourceAnalysis.jsxFiles > 0) {
    b.add({
      id: STEP_IDS.convertComponents,
      title: 'Convert reusable UI components to TypeScript',
      description:
        'Convert shared / low-risk components (Button, Input, Card, Modal-style primitives) to .tsx. Keep one component per change set.',
      category: 'component',
      risk: 'medium',
      required: false,
      approvalRequired: true,
      reason:
        'Shared components are reused widely; converting them in isolation makes the eventual page-level conversion safer.',
      expectedAreas: ['components/', 'ui/', 'shared/'],
      validationCommands: pickValidationCommands(
        ctx.dependencies.packageManager,
        ctx.scripts,
        ['typecheck', 'build', 'test'],
      ),
      dependsOn: [
        ctx.hasTypeScript
          ? STEP_IDS.typescriptVerify
          : STEP_IDS.typescriptFoundation,
      ],
    });
  }

  if (ctx.sourceAnalysis.classComponentIndicators > 0) {
    const indicators = ctx.sourceAnalysis.classComponentIndicators;
    b.add({
      id: STEP_IDS.classComponents,
      title: 'Assess and modernize class components',
      description: `Modernise the ${indicators} detected class component${indicators === 1 ? '' : 's'} module-by-module: prefer function components + hooks where lifecycle is simple, keep class form when it accurately reflects component contract.`,
      category: 'component',
      risk: 'medium',
      required: false,
      approvalRequired: true,
      reason:
        'Class components are still supported but block adoption of newer patterns. Convert them in small, reviewable batches — never as one big rewrite.',
      expectedAreas: ['components/', 'pages/', 'features/'],
      validationCommands: pickValidationCommands(
        ctx.dependencies.packageManager,
        ctx.scripts,
        ['typecheck', 'build', 'test'],
      ),
      dependsOn: [STEP_IDS.workspace],
    });
  }
}

function appendLifecycleStep(b: StepBuilder, ctx: GeneratorContext): void {
  if (ctx.sourceAnalysis.deprecatedLifecycleIndicators.length === 0) return;

  const methods = ctx.sourceAnalysis.deprecatedLifecycleIndicators
    .map((u) => `${u.method} (${u.fileCount})`)
    .join(', ');

  b.add({
    id: STEP_IDS.lifecycle,
    title: 'Fix deprecated React lifecycle methods',
    description: `Replace deprecated lifecycle methods (${methods}) with modern alternatives — componentDidMount + getDerivedStateFromProps, or function components with hooks. These break concurrent rendering on React 18.`,
    category: 'component',
    risk: 'high',
    required: true,
    approvalRequired: true,
    reason:
      'Deprecated lifecycle methods cause warnings on React 17 and break concurrent rendering on React 18. They must be replaced before the React major upgrade.',
    expectedAreas: ['components/', 'pages/', 'features/'],
    validationCommands: pickValidationCommands(
      ctx.dependencies.packageManager,
      ctx.scripts,
      ['typecheck', 'build', 'test'],
    ),
    dependsOn: [STEP_IDS.workspace],
  });
}

function appendReactDomRenderStep(b: StepBuilder, ctx: GeneratorContext): void {
  if (ctx.sourceAnalysis.reactDomRenderUsages === 0) return;

  // Risk depends on whether a React major upgrade is also implied: an
  // outdated React + ReactDOM.render is more invasive than a single-file
  // bootstrap swap.
  const reactMajor = ctx.dependencies.reactMajor;
  const upgradeImplied = reactMajor !== undefined && reactMajor < 18;
  const risk: MigrationStepRisk = upgradeImplied ? 'medium' : 'medium';

  b.add({
    id: STEP_IDS.reactDomRender,
    title: 'Assess React root rendering API (ReactDOM.render)',
    description:
      'Plan the migration from `ReactDOM.render` to `createRoot` (react-dom/client). Audit hydration, Suspense boundaries, and concurrent-feature compatibility before swapping.',
    category: 'config',
    risk,
    required: true,
    approvalRequired: true,
    reason:
      'ReactDOM.render is deprecated in React 18. We assess before swapping because the change can affect hydration timing and concurrent rendering.',
    expectedAreas: ['app entry (index.*, main.*)'],
    validationCommands: pickValidationCommands(
      ctx.dependencies.packageManager,
      ctx.scripts,
      ['build', 'test'],
    ),
    dependsOn: [STEP_IDS.workspace],
  });
}

function appendRoutingStep(b: StepBuilder, ctx: GeneratorContext): void {
  const routing = ctx.dependencies.routing;
  if (routing.packageName === undefined) return;

  const usageIndicators = ctx.sourceAnalysis.routerUsageIndicators;
  // Risk is driven by how much routing surface the project actually uses,
  // not the version string alone. Heavy router usage on an outdated version
  // is the riskiest combination.
  const routerMajor = routing.version !== undefined ? parseMajor(routing.version) : undefined;
  const isOutdatedRouter = routerMajor !== undefined && routerMajor < 6;
  const risk: MigrationStepRisk =
    isOutdatedRouter && usageIndicators > 20
      ? 'high'
      : isOutdatedRouter || usageIndicators > 20
        ? 'medium'
        : 'low';

  b.add({
    id: STEP_IDS.routing,
    title: 'Review routing modernization',
    description: `${routing.packageName}${routing.version !== undefined ? ` ${routing.version}` : ''} is in use across ${usageIndicators} indicator${usageIndicators === 1 ? '' : 's'}. Plan a routing upgrade pass once core foundations land.`,
    category: 'routing',
    risk,
    required: false,
    approvalRequired: risk !== 'low',
    reason:
      'Routing modernization touches navigation flow, layouts, and data loading. Review explicitly so the user owns the upgrade strategy rather than discovering it mid-step.',
    expectedAreas: ['routes/', 'app/', 'pages/'],
    validationCommands: pickValidationCommands(
      ctx.dependencies.packageManager,
      ctx.scripts,
      ['typecheck', 'build', 'test'],
    ),
    dependsOn: [STEP_IDS.workspace],
  });
}

function appendStateManagementStep(b: StepBuilder, ctx: GeneratorContext): void {
  const sm = ctx.dependencies.stateManagement;
  if (sm.redux === undefined && sm.reduxToolkit === undefined) return;

  // Redux Toolkit means the project has already started migrating off
  // hand-written Redux — that path is lower risk than a Redux-only setup.
  const risk: MigrationStepRisk =
    sm.reduxToolkit !== undefined ? 'low' : 'medium';

  b.add({
    id: STEP_IDS.stateManagement,
    title: 'Review state management compatibility',
    description:
      'Inspect Redux store config, middleware, and React-Redux bindings. We do not migrate state management automatically — this step exists to surface compatibility concerns before they leak into component conversion steps.',
    category: 'state-management',
    risk,
    required: false,
    approvalRequired: false,
    reason:
      'Redux upgrades and React 18 batching interact subtly. Reviewing explicitly avoids surprise regressions when components are converted.',
    expectedAreas: ['store/', 'state/', 'redux/'],
    validationCommands: pickValidationCommands(
      ctx.dependencies.packageManager,
      ctx.scripts,
      ['typecheck', 'build', 'test'],
    ),
    dependsOn: [STEP_IDS.workspace],
  });
}

function appendValidationSetupStep(b: StepBuilder, ctx: GeneratorContext): void {
  const missing = collectMissingValidationScripts(ctx.scripts);
  if (missing.length === 0) return;

  b.add({
    id: STEP_IDS.validationSetup,
    title: 'Improve validation setup',
    description: `The project is missing the following scripts: ${missing.join(', ')}. Add them in a single foundation step so every later step gets a fast regression gate.`,
    category: 'validation',
    risk: 'low',
    required: false,
    approvalRequired: false,
    reason:
      'Migration steps are only as safe as the validation that follows them. Plugging the missing scripts up front pays off compounding interest.',
    expectedFiles: ['package.json'],
    expectedAreas: ['package.json#scripts'],
    dependsOn: [STEP_IDS.workspace],
  });
}

function appendFinalValidationStep(b: StepBuilder, ctx: GeneratorContext): void {
  const all = resolveAllValidationCommands(
    ctx.dependencies.packageManager,
    ctx.scripts,
  );
  const commands = all.map((c) => c.command);

  b.add({
    id: STEP_IDS.validationFinal,
    title: 'Run final validation',
    description:
      'After all preceding migration steps are accepted, run the available validation gates end-to-end. This is the last automated gate before the human reviews the final summary.',
    category: 'validation',
    risk: 'low',
    required: true,
    approvalRequired: false,
    reason:
      'A clean end-to-end validation run is the strongest objective signal that the migration is healthy.',
    ...(commands.length > 0
      ? { validationCommands: commands }
      : {}),
  });
}

function appendFinalReportStep(b: StepBuilder, ctx: GeneratorContext): void {
  b.add({
    id: STEP_IDS.finalReport,
    title: 'Generate final migration summary report',
    description: `Produce a summary of every accepted, skipped, and failed step for ${ctx.projectInfo.name}. The user uses this report to close the migration session or plan the next iteration.`,
    category: 'report',
    risk: 'low',
    required: true,
    approvalRequired: false,
    reason:
      'A migration without a final summary is invisible. The report is what makes the work reviewable by people outside the loop.',
    dependsOn: [STEP_IDS.validationFinal],
  });
}

/* -------------------------------------------------------------------------- */
/* Summary / blockers / warnings / recs                                       */
/* -------------------------------------------------------------------------- */

function buildSummary(
  steps: readonly MigrationStep[],
  scanReport: ScanReport,
): MigrationPlanSummary {
  const estimatedRisk = estimatePlanRisk(steps, scanReport.risks.level);
  const complexity: MigrationPlanComplexity = scanReport.projectInfo.complexity;
  const description = describeStrategy(scanReport);

  return {
    title: `Foundation-first migration plan for ${scanReport.projectInfo.name}`,
    description,
    totalSteps: steps.length,
    estimatedRisk,
    estimatedComplexity: complexity,
    approvalGates: countApprovalGates(steps),
    requiredSteps: countRequiredSteps(steps),
  };
}

function describeStrategy(scanReport: ScanReport): string {
  const parts: string[] = [];
  parts.push(
    'Foundation-first strategy: stabilise dependencies, prepare TypeScript and validation foundations, then convert source in small reviewable batches.',
  );
  if (scanReport.dependencies.styling.usesNodeSass) {
    parts.push('node-sass replacement is isolated as its own dedicated step.');
  }
  if (!scanReport.projectInfo.hasTypeScript) {
    parts.push('TypeScript is introduced as a foundation step, not bundled with source conversion.');
  }
  if (scanReport.sourceAnalysis.deprecatedLifecycleIndicators.length > 0) {
    parts.push('Deprecated lifecycle methods are addressed before any React major upgrade.');
  }
  return parts.join(' ');
}

function computeBlockers(ctx: GeneratorContext): readonly string[] {
  const out: string[] = [];

  // Reflect scanner blockers verbatim so the user sees the same wording the
  // readiness report used.
  for (const text of deriveBlockers(ctx.risks)) out.push(text);

  if (!ctx.scripts.hasBuild) {
    out.push(
      'No build script is declared. The migration plan needs a build gate before any step can be validated.',
    );
  }
  if (!ctx.projectInfo.isGitRepository) {
    out.push(
      'The selected project is not a Git repository. Workspace isolation will fall back to copy-mode and rollback is harder.',
    );
  } else if (ctx.projectInfo.gitClean === 'dirty') {
    out.push(
      'The Git working tree is dirty. Commit or stash existing changes before workspace creation.',
    );
  }
  return out;
}

function computeWarnings(ctx: GeneratorContext): readonly string[] {
  const out: string[] = [];

  for (const text of deriveWarnings(ctx.risks)) out.push(text);

  if (resolveAllValidationCommands(ctx.dependencies.packageManager, ctx.scripts).length === 0) {
    out.push('No validation commands detected. Manual validation will be required between steps.');
  }
  if (
    ctx.dependencies.styling.usesNodeSass &&
    ctx.sourceAnalysis.styleFiles === 0
  ) {
    out.push(
      'node-sass is declared but no .scss/.sass files were found at scan time. Replacement is still recommended but should be verified.',
    );
  }
  if (ctx.projectInfo.gitClean === 'unknown') {
    out.push(
      'Git cleanliness could not be confirmed at scan time. Re-check before approving the workspace step.',
    );
  }
  if (ctx.sourceAnalysis.truncated) {
    out.push(
      'The deterministic scan was truncated at the file limit; the plan is built from lower-bound indicators and may under-represent risk.',
    );
  }
  return out;
}

function computeAssumptions(ctx: GeneratorContext): readonly string[] {
  const out: string[] = [];
  out.push('Migration follows the foundation-first strategy from the project constitution.');
  out.push(
    `Detected package manager: ${ctx.dependencies.packageManager}. Validation commands are formatted accordingly.`,
  );
  if (ctx.dependencies.styling.usesSass && !ctx.dependencies.styling.usesNodeSass) {
    out.push('Styling already uses the modern sass package — no replacement step is generated.');
  }
  if (!ctx.hasJsSources && ctx.hasTypeScript) {
    out.push('Project is already TypeScript-only; no JS/JSX → TS/TSX conversion steps are generated.');
  }
  return out;
}

function computeRecommendations(ctx: GeneratorContext): readonly string[] {
  // Reuse the scanner's deterministic recommendations directly. They already
  // explain "what should the user do next" and were generated from the
  // same ScanReport — avoid duplicating the logic.
  const out: string[] = [];
  for (const rec of ctx.scannerRecommendations) {
    if (rec.id === 'looks-ready') continue;
    out.push(`${rec.title}: ${rec.detail}`);
  }
  if (
    ctx.dependencies.styling.usesSass &&
    !ctx.dependencies.styling.usesNodeSass &&
    out.length < 3
  ) {
    out.push(
      'Styling foundation already uses the modern sass package — no node-sass replacement is needed.',
    );
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* helpers                                                                    */
/* -------------------------------------------------------------------------- */

function collectMissingValidationScripts(scripts: ScriptReport): readonly string[] {
  const out: string[] = [];
  if (!scripts.hasBuild) out.push('build');
  if (!scripts.hasLint) out.push('lint');
  if (!scripts.hasTest) out.push('test');
  if (!scripts.hasTypecheck) out.push('typecheck');
  return out;
}

function inferLockfileTargets(lockFiles: readonly string[]): readonly string[] {
  if (lockFiles.length === 0) return [];
  return lockFiles.slice();
}

function parseMajor(version: string): number | undefined {
  const match = version.match(/(\d+)/);
  if (!match || match[1] === undefined) return undefined;
  const major = Number.parseInt(match[1], 10);
  return Number.isFinite(major) ? major : undefined;
}

function makePlanId(scanReport: ScanReport): string {
  return `plan:${scanReport.id}:${Date.now()}`;
}
