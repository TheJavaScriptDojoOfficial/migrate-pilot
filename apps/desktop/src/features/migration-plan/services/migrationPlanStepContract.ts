/**
 * Plan Step Contract V2 helpers (Phase R5).
 *
 * Centralises the mapping logic that decides:
 *   - which executor key handles a given plan step,
 *   - which `MigrationPlanStepV2Capability` (available / not-yet-supported
 *     / manual-only / blocked) the step has, and the corresponding
 *     `blockedReason`,
 *   - which legacy `MigrationStepExecution` shape (mode + executorKey +
 *     params) the execution engine should see, and
 *   - how plan steps order themselves against the canonical React 19
 *     migration phase order.
 *
 * Why a dedicated module
 * ----------------------
 * Before R5 these helpers lived inside `react19MigrationPlanV2.ts`. That
 * conflated plan *shaping* (which step exists for what reason) with
 * *contract* decisions (whether a step is dispatchable, which executor,
 * which mode). Splitting them lets planners, the store normaliser, and
 * the execution layer all share a single source of truth without pulling
 * the planner into their dependency graph.
 *
 * Architectural rules:
 *   - This module never builds a plan step itself — it only resolves
 *     contract metadata for an already-shaped step or step blueprint.
 *   - It never depends on Zustand, IPC, or React.
 *   - It never reads the scan report directly; everything it needs is
 *     passed in by the planner.
 */
import type {
  ReactMigrationPhase,
} from '@features/react19-migration';

import type {
  MigrationPlanStepV2Capability,
  MigrationPlanStepV2ExecutionType,
  MigrationStepExecution,
} from '../types/migrationPlan.types';
import { mapMigrationPlanStepExecutionTypeToMode } from '../types/migrationPlan.types';

/**
 * The set of executor keys whose scripted implementation is wired into
 * the desktop build today. Anything outside this set is reported as
 * `not-yet-supported` even when an executor key is mapped — the planner
 * stays honest about what the engine can actually run.
 */
export const SUPPORTED_SCRIPTED_EXECUTOR_KEYS: ReadonlySet<string> = new Set([
  'package-json-dependency-update',
]);

export interface MigrationPlanStepExecutorResolutionInput {
  readonly stepId: string;
  readonly phase: ReactMigrationPhase;
  readonly executionType: MigrationPlanStepV2ExecutionType;
  readonly issueCodes: readonly string[];
  readonly validationCommands?: readonly string[];
  /**
   * Executor params resolved by the planner from the step's
   * scanner-derived inputs. Required for some scripted executors;
   * `undefined` when no params are needed or available.
   */
  readonly params?: Readonly<Record<string, unknown>>;
}

export interface MigrationPlanStepExecutorResolution {
  readonly executorKey?: string;
  readonly params?: Readonly<Record<string, unknown>>;
  readonly capability: MigrationPlanStepV2Capability;
  readonly blockedReason?: string;
}

/**
 * Resolve the executor key for a step from its id, phase, and source
 * issue codes. Specific step ids and well-known issue codes win over
 * the phase-default mapping so two scripted steps in the same phase
 * can route to different executors.
 */
export function resolveMigrationPlanStepExecutorKey(
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
        code === 'jsx-transform-classic' ||
        code === 'jsx-transform-config-not-detected',
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
      [
        'typescript-not-configured',
        'typescript-dependency-missing-but-files-present',
      ].includes(code),
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

/**
 * Fallback executor key per execution type, used when no specific
 * mapping fired. Kept separate so callers can choose to *not* fall
 * back when they want the resolution to remain `undefined`.
 */
export function getMigrationPlanStepFallbackExecutorKey(
  executionType: MigrationPlanStepV2ExecutionType,
): string {
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

/**
 * Resolve the contract-V2 capability + executor metadata for a step.
 *
 * The result is the single source of truth for `executorKey`,
 * `capability`, `blockedReason`, and (for scripted steps) `params`.
 * The planner threads it directly into the V2 step.
 */
export function resolveMigrationPlanStepCapability(
  input: MigrationPlanStepExecutorResolutionInput,
): MigrationPlanStepExecutorResolution {
  const executorKey = resolveMigrationPlanStepExecutorKey(
    input.stepId,
    input.phase,
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
      executorKey: getMigrationPlanStepFallbackExecutorKey(input.executionType),
      capability: 'not-yet-supported',
      blockedReason:
        'No executor has been mapped for this step yet, so automatic execution is not available.',
    };
  }

  if (
    input.executionType === 'scripted' &&
    executorKey === 'package-json-dependency-update'
  ) {
    if (input.params === undefined) {
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
      params: input.params,
      capability: 'available',
    };
  }

  if (input.executionType === 'scripted') {
    return {
      executorKey,
      ...(input.params !== undefined ? { params: input.params } : {}),
      capability: 'not-yet-supported',
      blockedReason:
        'A scripted executor is not implemented for this step yet. Keep this as a manual follow-up for now.',
    };
  }

  if (input.executionType === 'codemod') {
    return {
      executorKey,
      ...(input.params !== undefined ? { params: input.params } : {}),
      capability: 'not-yet-supported',
      blockedReason:
        'Codemod execution is planned but the codemod runner is not wired yet.',
    };
  }

  if (input.executionType === 'ai-assisted') {
    return {
      executorKey,
      ...(input.params !== undefined ? { params: input.params } : {}),
      capability: 'not-yet-supported',
      blockedReason:
        'AI-assisted execution is not wired into the execution engine yet.',
    };
  }

  return {
    executorKey,
    ...(input.params !== undefined ? { params: input.params } : {}),
    capability: 'not-yet-supported',
    blockedReason: 'Automatic execution for this step is not available yet.',
  };
}

/**
 * Build the legacy `MigrationStepExecution` shape from V2 contract
 * fields. Returns `undefined` when there is nothing meaningful to
 * surface (e.g. the planner declined to assign an executor and the
 * step is not manual).
 */
export function buildMigrationStepExecution(
  executionType: MigrationPlanStepV2ExecutionType,
  executorKey: string | undefined,
  params: Readonly<Record<string, unknown>> | undefined,
): MigrationStepExecution | undefined {
  const mode = mapMigrationPlanStepExecutionTypeToMode(executionType);
  if (mode === 'manual') {
    return { mode: 'manual' };
  }
  return {
    mode,
    ...(executorKey !== undefined ? { executorKey } : {}),
    ...(params !== undefined ? { params } : {}),
  };
}

/**
 * Capability is `available` only for steps the engine can dispatch
 * right now. The planner uses this to decide `canRunInExecution`.
 */
export function isExecutableMigrationPlanStepCapability(
  capability: MigrationPlanStepV2Capability,
): boolean {
  return capability === 'available';
}

/**
 * Ensure every non-`available` step carries a `blockedReason` so the
 * UI never has to fall back to a generic "auto-run blocked" string.
 *
 * Idempotent — returns the original step when it already satisfies the
 * invariant, otherwise returns a copy with a default reason.
 */
export function ensureMigrationPlanStepBlockedReason<
  TStep extends {
    readonly capability: MigrationPlanStepV2Capability;
    readonly blockedReason?: string;
  },
>(step: TStep): TStep {
  if (step.capability === 'available') return step;
  if (step.blockedReason !== undefined && step.blockedReason.trim().length > 0) {
    return step;
  }
  return {
    ...step,
    blockedReason: 'Automatic execution is not available for this step yet.',
  };
}
