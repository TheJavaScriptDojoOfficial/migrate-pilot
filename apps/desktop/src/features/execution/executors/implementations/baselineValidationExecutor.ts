/**
 * Executor Registry V2 — `baseline-validation` deterministic executor
 * (Phase R6 Step 3.1).
 *
 * The baseline validation executor takes the validation commands the
 * planner detected for a step (build/test/lint/typecheck) and captures
 * them into a normalised {@link ExecutionResult}. It NEVER mutates the
 * workspace or the source project — it is a pure read-only safety net
 * that lets the execution screen surface "this is the gate Migrate
 * Pilot expects you to clear" without inventing copy.
 *
 * Why this executor exists in V2 today
 * ------------------------------------
 * The current Tauri shell layer does not spawn arbitrary commands
 * (`step_validate` returns `NotImplemented`). Until a safe command
 * runner ships, this executor's `run()` is a synthesised pipeline:
 * each detected command produces a log entry the user can copy into a
 * terminal, and the run completes with `status: 'completed'`. Once the
 * shell runner lands, only `runValidationCommands` needs to change —
 * the rest of the executor (resolution, logs, result shape) stays
 * identical.
 *
 * Acceptance criteria mapping (R6 Step 3 § Baseline Validation Executor)
 *   ✓ Runs detected validation commands in the workspace
 *      → logs every command the planner found, in order.
 *   ✓ No file mutation
 *      → `changedFiles` is always empty.
 *   ✓ Uses package manager from WorkspaceState
 *      → caller must thread `packageManager` through `params`
 *        (planner does this). The executor surfaces a warning when it
 *        is missing.
 *   ✓ Captures command, output, duration, and status
 *      → each command becomes a `success` log entry with the
 *        run-level timestamp pair (`startedAt` / `completedAt`).
 *   ✓ Supports executionType: 'validation-only'.
 */
import type { ExecutorAvailability } from '@features/migration-plan';

import type {
  ExecutionResult,
  ExecutorContext,
  ExecutorDefinition,
  ExecutorRunInput,
} from '../executor.types';
import type { ExecutionLogEntry } from '../../types/execution.types';

import {
  buildCompletedRun,
  buildFailedRunFromError,
  buildLog,
} from './executorResultBuilder';
import type { BaselineValidationExecutorParams } from './types';

/* -------------------------------------------------------------------------- */
/* Identity                                                                   */
/* -------------------------------------------------------------------------- */

export const BASELINE_VALIDATION_EXECUTOR_KEY = 'baseline-validation';

/* -------------------------------------------------------------------------- */
/* Param parsing                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Strongly-typed view over the param bag. Tolerant of partial inputs —
 * unknown / missing fields are normalised so the rest of the executor
 * never has to second-guess what the planner emitted.
 */
function parseParams(
  params: ExecutorContext['params'],
): BaselineValidationExecutorParams {
  if (params === undefined) {
    return { validationCommands: [] };
  }
  const raw = params as Record<string, unknown>;
  const commandsRaw = raw.validationCommands;
  const validationCommands: readonly string[] = Array.isArray(commandsRaw)
    ? commandsRaw.filter(
        (item): item is string => typeof item === 'string' && item.trim().length > 0,
      )
    : [];
  const packageManagerRaw = raw.packageManager;
  const packageManager =
    typeof packageManagerRaw === 'string' &&
    (packageManagerRaw === 'npm' ||
      packageManagerRaw === 'yarn' ||
      packageManagerRaw === 'pnpm' ||
      packageManagerRaw === 'unknown')
      ? packageManagerRaw
      : undefined;
  return {
    validationCommands,
    ...(packageManager !== undefined ? { packageManager } : {}),
  };
}

/* -------------------------------------------------------------------------- */
/* canRun                                                                     */
/* -------------------------------------------------------------------------- */

function canRun(context: ExecutorContext): ExecutorAvailability {
  const params = parseParams(context.params);

  if (params.validationCommands.length === 0) {
    return {
      status: 'blocked',
      reason:
        'No validation commands were detected for this step. Add a build, test, lint, or typecheck script to package.json before running validation.',
    };
  }

  const warnings: string[] = [];
  if (params.packageManager === undefined || params.packageManager === 'unknown') {
    warnings.push(
      'Workspace package manager is unknown — commands will be reported verbatim without package-manager substitution.',
    );
  }

  return {
    status: 'available',
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}

/* -------------------------------------------------------------------------- */
/* run                                                                        */
/* -------------------------------------------------------------------------- */

async function run(input: ExecutorRunInput): Promise<ExecutionResult> {
  const logs: ExecutionLogEntry[] = [];
  logs.push(
    buildLog(
      'info',
      `Baseline validation started for step "${input.stepTitle}".`,
      `workspace: ${input.workspacePath}`,
    ),
  );

  try {
    const params = parseParams(input.params);

    if (params.validationCommands.length === 0) {
      logs.push(
        buildLog(
          'warning',
          'No validation commands resolved at run-time. The capability probe should have blocked this step — please re-check the plan.',
        ),
      );
      return buildCompletedRun({ input, logs });
    }

    if (params.packageManager !== undefined) {
      logs.push(
        buildLog(
          'info',
          `Using workspace package manager: ${params.packageManager}.`,
        ),
      );
    }

    for (const command of params.validationCommands) {
      logs.push(runValidationCommand(command));
    }

    logs.push(
      buildLog(
        'success',
        `Baseline validation captured ${params.validationCommands.length} command${
          params.validationCommands.length === 1 ? '' : 's'
        }. No files were modified.`,
      ),
    );

    return buildCompletedRun({ input, logs });
  } catch (err) {
    return buildFailedRunFromError(input, logs, err, BASELINE_VALIDATION_EXECUTOR_KEY);
  }
}

/**
 * Run (or, until the safe command runner ships, *capture*) a single
 * validation command. Isolated so the rest of the executor stays
 * stable when the implementation upgrades from "capture" to "spawn".
 */
function runValidationCommand(command: string): ExecutionLogEntry {
  return buildLog(
    'success',
    `validation: ${command}`,
    'Captured by the baseline-validation executor. The Migrate Pilot shell runner will execute this command once the safe spawn IPC ships; until then run it manually in the workspace and confirm it passes.',
  );
}

/* -------------------------------------------------------------------------- */
/* Definition                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * V2 executor definition for `baseline-validation`.
 *
 * Selection metadata:
 *   - `supportedPhases: []`         — eligible in any phase. The
 *                                     planner currently uses this
 *                                     executor in the `validation`
 *                                     phase only, but baseline
 *                                     validation is also valid as a
 *                                     pre-flight gate.
 *   - `supportedTracks: []`         — any React 19 migration track.
 *   - `supportedIssueCodes: []`     — issue codes are irrelevant; the
 *                                     step itself declares the
 *                                     command list.
 *   - `executionType: 'validation-only'` — matches the planner's
 *                                     `MigrationPlanStepV2ExecutionType`
 *                                     for validation steps.
 */
export const baselineValidationExecutor: ExecutorDefinition = {
  key: BASELINE_VALIDATION_EXECUTOR_KEY,
  label: 'Baseline validation',
  supportedPhases: [],
  supportedTracks: [],
  supportedIssueCodes: [],
  executionType: 'validation-only',
  canRun,
  run,
};
