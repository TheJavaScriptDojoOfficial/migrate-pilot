/**
 * Unit tests for the Phase R6 Step 5 run-step enablement resolver.
 *
 * The resolver is the single source of truth for "can the user click
 * Run on the currently selected plan step right now?". Every disabled
 * state MUST trace back to an exact user-facing reason — these tests
 * pin the contract for the screen and downstream callers.
 *
 * The tests intentionally cover:
 *   - Registry resolution (matched executor, returned in `resolution`).
 *   - Missing executor (unregistered `executorKey`).
 *   - Unsupported phase/track (future-support from the resolver).
 *   - Manual-only executor (manual-only guidance).
 *   - Valid runnable executor (`enabled === true`).
 *   - Previous-step blocking.
 *   - Workspace validation blocking.
 *   - Completed-step blocking.
 *   - Running-step blocking.
 *
 * The resolver is pure logic — these tests use an injected registry
 * adapter so the module-level V2 registry is never touched.
 */
import { describe, expect, it } from 'vitest';

import type { ExecutorAvailability } from '@features/migration-plan';
import type {
  MigrationPlan,
  MigrationPlanStepV2,
} from '@features/migration-plan';
import type { WorkspaceState } from '@features/workspace';

import {
  canRunSelectedStep,
  type ExecutorRegistryAdapter,
} from '../runStepEnablementService';
import type {
  ExecutorContext,
  ExecutorDefinition,
  ExecutorRunInput,
} from '../../executors/executor.types';

/* -------------------------------------------------------------------------- */
/* Fixtures                                                                   */
/* -------------------------------------------------------------------------- */

const PLAN_ID = 'plan_react19_001';
const WORKSPACE_PATH = '/tmp/projects/sample.migration';
const SOURCE_PATH = '/tmp/projects/sample';

function makeWorkspaceState(
  overrides: Partial<WorkspaceState> = {},
): WorkspaceState {
  return {
    originalProjectPath: SOURCE_PATH,
    workspacePath: WORKSPACE_PATH,
    branchName: 'react-19-migration',
    strategy: 'git-worktree',
    createdAt: '2025-05-30T12:00:00.000Z',
    gitStatus: {
      isGitRepository: true,
      isClean: true,
      currentBranch: 'main',
    },
    packageManager: 'npm',
    planId: PLAN_ID,
    ...overrides,
  };
}

interface StepOverrides extends Omit<Partial<MigrationPlanStepV2>, 'executorKey'> {
  /**
   * Allow tests to explicitly drop the executor key while still
   * satisfying `exactOptionalPropertyTypes`. `null` means "omit the
   * field entirely" and `undefined` keeps the default.
   */
  readonly executorKey?: string | null;
}

function makeStep(overrides: StepOverrides = {}): MigrationPlanStepV2 {
  const { executorKey: executorKeyOverride, ...rest } = overrides;
  const base: MigrationPlanStepV2 = {
    id: 'step_baseline_validation',
    order: 1,
    phase: 'preflight',
    canonicalPhaseOrder: 0,
    track: 'react-18-to-19',
    title: 'Baseline validation',
    description: 'Capture baseline build/test/typecheck output.',
    reason: 'Establish a green baseline before migrating.',
    risk: 'low',
    status: 'pending',
    issueCodes: [],
    executionType: 'scripted',
    executorKey: 'baseline-validation',
    capability: 'available',
    requiresWorkspace: true,
    requiresApprovalBeforeRun: true,
    requiresValidationAfterRun: false,
    expectedChangedFiles: [],
    expectedCommands: [],
    validationCommands: ['npm run build'],
    rollbackStrategy: 'manual',
    sourceIssueCodes: [],
    expectedChangeScope: [],
    requiresHumanReview: false,
    canRunInExecution: true,
    ...rest,
  };
  if (executorKeyOverride === null) {
    const { executorKey: _drop, ...withoutKey } = base;
    return withoutKey as MigrationPlanStepV2;
  }
  if (executorKeyOverride !== undefined) {
    return { ...base, executorKey: executorKeyOverride };
  }
  return base;
}

function makePlan(steps: readonly MigrationPlanStepV2[]): MigrationPlan {
  return {
    id: PLAN_ID,
    version: 'react19-plan-v2',
    scanReportId: 'scan_001',
    projectPath: SOURCE_PATH,
    title: 'React 18 → 19',
    summaryText: 'Tiny test plan.',
    sourceReactVersion: '18.3.1',
    targetReactVersion: '19',
    sourceMajor: 18,
    track: 'react-18-to-19',
    strategy: 'react-19-foundation-first',
    generatedAt: '2025-05-30T11:00:00.000Z',
    status: 'approved',
    canExecute: true,
    blockedReasons: [],
    prerequisites: [],
    steps,
    skippedPhases: [],
    phaseSummary: {
      preflight: {
        totalSteps: 1,
        highestRisk: 'low',
        executionTypes: ['scripted'],
      },
      tooling: { totalSteps: 0, highestRisk: 'low', executionTypes: [] },
      'react-18-bridge': {
        totalSteps: 0,
        highestRisk: 'low',
        executionTypes: [],
      },
      'api-compatibility': {
        totalSteps: 0,
        highestRisk: 'low',
        executionTypes: [],
      },
      'jsx-transform': {
        totalSteps: 0,
        highestRisk: 'low',
        executionTypes: [],
      },
      'react-19-upgrade': {
        totalSteps: 0,
        highestRisk: 'low',
        executionTypes: [],
      },
      'source-modernization': {
        totalSteps: 0,
        highestRisk: 'low',
        executionTypes: [],
      },
      validation: { totalSteps: 0, highestRisk: 'low', executionTypes: [] },
      'final-review': { totalSteps: 0, highestRisk: 'low', executionTypes: [] },
    },
    validationStrategy: {
      baselineCommands: ['npm run build'],
      perStepCommands: [],
      finalCommands: ['npm run build'],
      missingCommands: [],
    },
    highestRisk: 'low',
    summary: {
      title: 'React 18 → 19',
      description: 'Tiny test plan.',
      totalSteps: steps.length,
      estimatedRisk: 'low',
      estimatedComplexity: 'small',
      approvalGates: 1,
      requiredSteps: steps.length,
    },
    blockers: [],
    warnings: [],
    assumptions: [],
    recommendations: [],
  };
}

/* -------------------------------------------------------------------------- */
/* Executor stubs                                                             */
/* -------------------------------------------------------------------------- */

function makeExecutor(
  key: string,
  availability: ExecutorAvailability,
  overrides: Partial<ExecutorDefinition> = {},
): ExecutorDefinition {
  return {
    key,
    label: `${key} (stub)`,
    supportedPhases: [],
    supportedTracks: [],
    supportedIssueCodes: [],
    executionType: 'scripted',
    canRun: (_context: ExecutorContext) => availability,
    run: async (_input: ExecutorRunInput) =>
      Promise.reject(new Error('test stub — run() not implemented')),
    ...overrides,
  };
}

function makeRegistry(
  executors: readonly ExecutorDefinition[],
): ExecutorRegistryAdapter {
  const byKey = new Map(executors.map((e) => [e.key, e]));
  return {
    getExecutorByKey: (key) =>
      key === undefined || key.length === 0 ? undefined : byKey.get(key),
    isExecutorRegistered: (key) =>
      key !== undefined && key.length > 0 && byKey.has(key),
  };
}

/* -------------------------------------------------------------------------- */
/* Tests                                                                      */
/* -------------------------------------------------------------------------- */

describe('canRunSelectedStep', () => {
  describe('registry resolution', () => {
    it('returns the matched executor in the resolution result when canRun is available', () => {
      const step = makeStep();
      const plan = makePlan([step]);
      const executor = makeExecutor('baseline-validation', {
        status: 'available',
      });
      const registry = makeRegistry([executor]);

      const result = canRunSelectedStep({
        approvedPlan: plan,
        isPlanApproved: true,
        workspaceState: makeWorkspaceState(),
        selectedStep: step,
        executorRegistry: registry,
        completedSteps: new Set(),
        skippedSteps: new Set(),
      });

      expect(result.enabled).toBe(true);
      expect(result.reasons).toEqual([]);
      expect(result.resolution?.executor).toBe(executor);
      expect(result.resolution?.capability.status).toBe('available');
    });
  });

  describe('missing executor', () => {
    it('disables the Run button when the declared executor key is not registered', () => {
      const step = makeStep({
        executorKey: 'react-root-api-codemod',
        executionType: 'codemod',
      });
      const plan = makePlan([step]);
      const registry = makeRegistry([]);

      const result = canRunSelectedStep({
        approvedPlan: plan,
        isPlanApproved: true,
        workspaceState: makeWorkspaceState(),
        selectedStep: step,
        executorRegistry: registry,
        completedSteps: new Set(),
        skippedSteps: new Set(),
      });

      expect(result.enabled).toBe(false);
      expect(result.reasons).toHaveLength(1);
      expect(result.reasons[0]).toBe(
        'Run step disabled because executor react-root-api-codemod is not registered yet.',
      );
      expect(result.guidance?.kind).toBe('future-support');
      expect(result.guidance?.message).toContain('react-root-api-codemod');
    });
  });

  describe('unsupported phase/track', () => {
    it('returns a future-support guidance when the matched executor reports future-support', () => {
      const step = makeStep({
        phase: 'react-18-bridge',
        executorKey: 'react-root-api-codemod',
        executionType: 'codemod',
      });
      const plan = makePlan([step]);
      const executor = makeExecutor('react-root-api-codemod', {
        status: 'future-support',
        reason:
          'The deterministic AST runner is not implemented yet. Once it ships, the executor will rewrite ReactDOM.render automatically.',
      });
      const registry = makeRegistry([executor]);

      const result = canRunSelectedStep({
        approvedPlan: plan,
        isPlanApproved: true,
        workspaceState: makeWorkspaceState(),
        selectedStep: step,
        executorRegistry: registry,
        completedSteps: new Set(),
        skippedSteps: new Set(),
      });

      expect(result.enabled).toBe(false);
      expect(result.reasons[0]).toBe(
        'Run step disabled because executor react-root-api-codemod is not registered yet.',
      );
      expect(result.guidance?.kind).toBe('future-support');
      expect(result.guidance?.message).toContain('AST runner');
    });
  });

  describe('manual-only executor', () => {
    it('returns manual-only guidance when the matched executor reports manual-only', () => {
      const step = makeStep({
        executorKey: 'manual-instruction',
        executionType: 'manual',
      });
      const plan = makePlan([step]);
      const executor = makeExecutor('manual-instruction', {
        status: 'manual-only',
        reason:
          'This step is intentionally manual. Migrate Pilot will not edit any files.',
      });
      const registry = makeRegistry([executor]);

      const result = canRunSelectedStep({
        approvedPlan: plan,
        isPlanApproved: true,
        workspaceState: makeWorkspaceState(),
        selectedStep: step,
        executorRegistry: registry,
        completedSteps: new Set(),
        skippedSteps: new Set(),
      });

      expect(result.enabled).toBe(false);
      expect(result.reasons).toEqual([
        'Run step disabled because this step is manual-only.',
      ]);
      expect(result.guidance?.kind).toBe('manual-only');
    });

    it('returns manual-only guidance when the step has executionType=manual and no executor key', () => {
      const step = makeStep({
        executionType: 'manual',
        // Drop the executor key entirely.
        executorKey: null,
        capability: 'manual-only',
      });
      const plan = makePlan([step]);
      const registry = makeRegistry([]);

      const result = canRunSelectedStep({
        approvedPlan: plan,
        isPlanApproved: true,
        workspaceState: makeWorkspaceState(),
        selectedStep: step,
        executorRegistry: registry,
        completedSteps: new Set(),
        skippedSteps: new Set(),
      });

      expect(result.enabled).toBe(false);
      expect(result.reasons).toEqual([
        'Run step disabled because this step is manual-only.',
      ]);
      expect(result.guidance?.kind).toBe('manual-only');
    });
  });

  describe('valid runnable executor', () => {
    it('enables the Run button when every check passes', () => {
      const step = makeStep();
      const plan = makePlan([step]);
      const executor = makeExecutor('baseline-validation', {
        status: 'available',
      });
      const registry = makeRegistry([executor]);

      const result = canRunSelectedStep({
        approvedPlan: plan,
        isPlanApproved: true,
        workspaceState: makeWorkspaceState(),
        selectedStep: step,
        executorRegistry: registry,
        completedSteps: new Set(),
        skippedSteps: new Set(),
      });

      expect(result.enabled).toBe(true);
      expect(result.reasons).toEqual([]);
      expect(result.guidance).toBeUndefined();
    });
  });

  describe('previous-step blocking', () => {
    it('blocks the selected step when a non-manual prior step is neither completed nor skipped', () => {
      const dependencyStep = makeStep({
        id: 'step_dependencies',
        order: 0,
        title: 'Update React 19 dependencies',
        executorKey: 'package-dependency-update',
        executionType: 'scripted',
      });
      const codemodStep = makeStep({
        id: 'step_codemod',
        order: 1,
        phase: 'react-18-bridge',
        canonicalPhaseOrder: 2,
        title: 'React root API codemod',
        executorKey: 'react-root-api-codemod',
        executionType: 'codemod',
      });
      const plan = makePlan([dependencyStep, codemodStep]);
      const executor = makeExecutor('react-root-api-codemod', {
        status: 'available',
      });
      const registry = makeRegistry([
        executor,
        makeExecutor('package-dependency-update', { status: 'available' }),
      ]);

      const result = canRunSelectedStep({
        approvedPlan: plan,
        isPlanApproved: true,
        workspaceState: makeWorkspaceState(),
        selectedStep: codemodStep,
        executorRegistry: registry,
        completedSteps: new Set(),
        skippedSteps: new Set(),
      });

      expect(result.enabled).toBe(false);
      expect(result.reasons[0]).toBe(
        'Run step disabled because the required previous "Update React 19 dependencies" step is not completed.',
      );
    });

    it('allows the selected step to run when prior step is skipped', () => {
      const dependencyStep = makeStep({
        id: 'step_dependencies',
        order: 0,
        title: 'Update React 19 dependencies',
        executorKey: 'package-dependency-update',
        executionType: 'scripted',
      });
      const codemodStep = makeStep({
        id: 'step_codemod',
        order: 1,
        phase: 'react-18-bridge',
        canonicalPhaseOrder: 2,
        title: 'React root API codemod',
        executorKey: 'react-root-api-codemod',
        executionType: 'codemod',
      });
      const plan = makePlan([dependencyStep, codemodStep]);
      const registry = makeRegistry([
        makeExecutor('react-root-api-codemod', { status: 'available' }),
        makeExecutor('package-dependency-update', { status: 'available' }),
      ]);

      const result = canRunSelectedStep({
        approvedPlan: plan,
        isPlanApproved: true,
        workspaceState: makeWorkspaceState(),
        selectedStep: codemodStep,
        executorRegistry: registry,
        completedSteps: new Set(),
        skippedSteps: new Set([dependencyStep.id]),
      });

      expect(result.enabled).toBe(true);
      expect(result.reasons).toEqual([]);
    });

    it('treats manual-only prior steps as implicit checkpoints (does not block)', () => {
      const manualPrior = makeStep({
        id: 'step_manual',
        order: 0,
        title: 'Migrate prop-types to TypeScript',
        executionType: 'manual',
        executorKey: null,
        capability: 'manual-only',
      });
      const codemodStep = makeStep({
        id: 'step_codemod',
        order: 1,
        phase: 'react-18-bridge',
        canonicalPhaseOrder: 2,
        title: 'React root API codemod',
        executorKey: 'react-root-api-codemod',
        executionType: 'codemod',
      });
      const plan = makePlan([manualPrior, codemodStep]);
      const registry = makeRegistry([
        makeExecutor('react-root-api-codemod', { status: 'available' }),
      ]);

      const result = canRunSelectedStep({
        approvedPlan: plan,
        isPlanApproved: true,
        workspaceState: makeWorkspaceState(),
        selectedStep: codemodStep,
        executorRegistry: registry,
        completedSteps: new Set(),
        skippedSteps: new Set(),
      });

      expect(result.enabled).toBe(true);
    });
  });

  describe('workspace validation blocking', () => {
    it('blocks when workspace state is missing', () => {
      const step = makeStep();
      const plan = makePlan([step]);
      const registry = makeRegistry([
        makeExecutor('baseline-validation', { status: 'available' }),
      ]);

      const result = canRunSelectedStep({
        approvedPlan: plan,
        isPlanApproved: true,
        workspaceState: undefined,
        selectedStep: step,
        executorRegistry: registry,
        completedSteps: new Set(),
        skippedSteps: new Set(),
      });

      expect(result.enabled).toBe(false);
      expect(result.reasons[0]).toContain('no migration workspace has been created');
    });

    it('blocks when workspace path equals the original project path', () => {
      const step = makeStep();
      const plan = makePlan([step]);
      const registry = makeRegistry([
        makeExecutor('baseline-validation', { status: 'available' }),
      ]);

      const result = canRunSelectedStep({
        approvedPlan: plan,
        isPlanApproved: true,
        workspaceState: makeWorkspaceState({
          workspacePath: SOURCE_PATH,
        }),
        selectedStep: step,
        executorRegistry: registry,
        completedSteps: new Set(),
        skippedSteps: new Set(),
      });

      expect(result.enabled).toBe(false);
      expect(result.reasons[0]).toContain('not valid');
      expect(result.reasons[0]).toContain('original project path');
    });

    it('blocks when the workspace plan id no longer matches the approved plan', () => {
      const step = makeStep();
      const plan = makePlan([step]);
      const registry = makeRegistry([
        makeExecutor('baseline-validation', { status: 'available' }),
      ]);

      const result = canRunSelectedStep({
        approvedPlan: plan,
        isPlanApproved: true,
        workspaceState: makeWorkspaceState({ planId: 'plan_other' }),
        selectedStep: step,
        executorRegistry: registry,
        completedSteps: new Set(),
        skippedSteps: new Set(),
      });

      expect(result.enabled).toBe(false);
      expect(result.reasons[0]).toContain('different plan id');
    });

    it('blocks when the plan is not approved', () => {
      const step = makeStep();
      const plan = makePlan([step]);
      const registry = makeRegistry([
        makeExecutor('baseline-validation', { status: 'available' }),
      ]);

      const result = canRunSelectedStep({
        approvedPlan: plan,
        isPlanApproved: false,
        workspaceState: makeWorkspaceState(),
        selectedStep: step,
        executorRegistry: registry,
        completedSteps: new Set(),
        skippedSteps: new Set(),
      });

      expect(result.enabled).toBe(false);
      expect(result.reasons[0]).toContain('not been approved');
    });
  });

  describe('completed-step blocking', () => {
    it('blocks the Run button when the selected step has already been completed', () => {
      const step = makeStep();
      const plan = makePlan([step]);
      const registry = makeRegistry([
        makeExecutor('baseline-validation', { status: 'available' }),
      ]);

      const result = canRunSelectedStep({
        approvedPlan: plan,
        isPlanApproved: true,
        workspaceState: makeWorkspaceState(),
        selectedStep: step,
        executorRegistry: registry,
        completedSteps: new Set([step.id]),
        skippedSteps: new Set(),
      });

      expect(result.enabled).toBe(false);
      expect(result.reasons[0]).toContain('already completed');
    });
  });

  describe('running-step blocking', () => {
    it('blocks when a DIFFERENT step is currently running', () => {
      const step = makeStep();
      const plan = makePlan([step]);
      const registry = makeRegistry([
        makeExecutor('baseline-validation', { status: 'available' }),
      ]);

      const result = canRunSelectedStep({
        approvedPlan: plan,
        isPlanApproved: true,
        workspaceState: makeWorkspaceState(),
        selectedStep: step,
        executorRegistry: registry,
        runningStepId: 'some_other_step',
        completedSteps: new Set(),
        skippedSteps: new Set(),
      });

      expect(result.enabled).toBe(false);
      expect(result.reasons[0]).toContain('another step is currently running');
    });

    it('does not block when the running step is the same one being asked about', () => {
      const step = makeStep();
      const plan = makePlan([step]);
      const registry = makeRegistry([
        makeExecutor('baseline-validation', { status: 'available' }),
      ]);

      const result = canRunSelectedStep({
        approvedPlan: plan,
        isPlanApproved: true,
        workspaceState: makeWorkspaceState(),
        selectedStep: step,
        executorRegistry: registry,
        runningStepId: step.id,
        completedSteps: new Set(),
        skippedSteps: new Set(),
      });

      // The resolver lets the step pass the running-id gate, leaving
      // capability to make the final call; the screen layers a
      // `status !== 'running'` check on top before exposing the Run
      // button.
      expect(result.enabled).toBe(true);
    });
  });

  describe('capability propagation', () => {
    it('surfaces an unavailable reason verbatim from the matched executor', () => {
      const step = makeStep({
        executorKey: 'package-dependency-update',
        executionType: 'scripted',
      });
      const plan = makePlan([step]);
      const executor = makeExecutor('package-dependency-update', {
        status: 'unavailable',
        reason: 'workspace/package.json is missing.',
      });
      const registry = makeRegistry([executor]);

      const result = canRunSelectedStep({
        approvedPlan: plan,
        isPlanApproved: true,
        workspaceState: makeWorkspaceState(),
        selectedStep: step,
        executorRegistry: registry,
        completedSteps: new Set(),
        skippedSteps: new Set(),
      });

      expect(result.enabled).toBe(false);
      expect(result.reasons[0]).toContain('workspace/package.json is missing.');
    });

    it('surfaces a blocked reason verbatim from the matched executor', () => {
      const step = makeStep({
        executorKey: 'baseline-validation',
      });
      const plan = makePlan([step]);
      const executor = makeExecutor('baseline-validation', {
        status: 'blocked',
        reason: 'No validation commands attached to this step.',
      });
      const registry = makeRegistry([executor]);

      const result = canRunSelectedStep({
        approvedPlan: plan,
        isPlanApproved: true,
        workspaceState: makeWorkspaceState(),
        selectedStep: step,
        executorRegistry: registry,
        completedSteps: new Set(),
        skippedSteps: new Set(),
      });

      expect(result.enabled).toBe(false);
      expect(result.reasons[0]).toContain(
        'No validation commands attached to this step.',
      );
    });
  });

  describe('no-selection blocking', () => {
    it('blocks when no step is selected even if everything else is fine', () => {
      const step = makeStep();
      const plan = makePlan([step]);
      const registry = makeRegistry([
        makeExecutor('baseline-validation', { status: 'available' }),
      ]);

      const result = canRunSelectedStep({
        approvedPlan: plan,
        isPlanApproved: true,
        workspaceState: makeWorkspaceState(),
        selectedStep: undefined,
        executorRegistry: registry,
        completedSteps: new Set(),
        skippedSteps: new Set(),
      });

      expect(result.enabled).toBe(false);
      expect(result.reasons[0]).toContain('no plan step is currently selected');
    });
  });
});
