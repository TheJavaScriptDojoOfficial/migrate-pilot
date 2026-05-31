/**
 * Executor Registry V2 — `manual-instruction` executor (Phase R6
 * Step 4.2).
 *
 * Some migration steps are intentionally manual — Migrate Pilot
 * cannot safely automate them and the human author is the only one
 * who can decide on the right shape (e.g. choosing a Context boundary
 * when modernising legacy context, or moving from `prop-types` to
 * TypeScript types, or confirming a custom Webpack/Babel setup is
 * compatible with the React 19 automatic JSX runtime). For those
 * steps, the V2 framework still routes the run through a registered
 * executor so:
 *
 *   - The captured {@link ExecutionResult} carries the canonical list
 *     of instructions the user is expected to follow, in order.
 *   - The screen never has to invent copy — it renders the run's logs
 *     verbatim.
 *   - Persistence treats manual steps the same as scripted / codemod
 *     steps (single dispatched run, single captured outcome), so the
 *     downstream summary / session-state code does not need a
 *     special "manual" code path.
 *   - The result is flagged with
 *     `requiresManualVerification: true` so the UI surfaces a
 *     distinct "Manual verification required" banner and downstream
 *     gates can refuse to mark the step truly done until the user
 *     accepts.
 *
 * The executor NEVER mutates the workspace. It is a checklist runner:
 * `changedFiles` is always empty, and the captured run completes as
 * soon as the instructions have been emitted into the logs.
 *
 * Run behaviour
 * -------------
 *   - Parses `params.instructions` (required, non-empty).
 *   - Emits the optional `summary` as the first `info` log.
 *   - Emits one `info` log per instruction step (preserving order).
 *   - Emits a `success` log carrying the validation recommendation
 *     when present, or a `warning` reminding the user to confirm the
 *     project still builds otherwise.
 *   - Emits a closing `warning` so the captured run makes the
 *     "Migrate Pilot did not touch your files" invariant obvious to
 *     the reviewer.
 *   - Marks the captured run as `requiresManualVerification: true`
 *     so the screen distinguishes a manual-checklist run from a
 *     deterministic auto-verified one.
 *
 * Acceptance criteria mapping (R6 Step 4 § Manual Instruction Executor)
 *   ✓ Does not mutate files
 *      → `changedFiles` is hard-coded to `[]`; the executor performs
 *        no fs / IPC work.
 *   ✓ Generates clear manual steps
 *      → `params.instructions` is required, non-empty, and emitted
 *        in order as one `info` log per step (with optional file /
 *        command / references detail lines).
 *   ✓ Marks result as `requiresManualVerification: true`
 *      → the captured run carries the flag verbatim so the UI can
 *        render a distinct "Manual verification required" banner.
 */
import type { ExecutorAvailability } from '@features/migration-plan';

import type { ExecutionLogEntry } from '../../types/execution.types';
import type {
  ExecutionResult,
  ExecutorContext,
  ExecutorDefinition,
  ExecutorRunInput,
} from '../executor.types';

import {
  buildCompletedRun,
  buildFailedRunFromError,
  buildLog,
} from './executorResultBuilder';
import type {
  ManualInstructionExecutorParams,
  ManualInstructionStep,
} from './types';

/* -------------------------------------------------------------------------- */
/* Identity                                                                   */
/* -------------------------------------------------------------------------- */

export const MANUAL_INSTRUCTION_EXECUTOR_KEY = 'manual-instruction';

/* -------------------------------------------------------------------------- */
/* Param parsing                                                              */
/* -------------------------------------------------------------------------- */

interface ParsedParams {
  readonly value?: ManualInstructionExecutorParams;
  readonly error?: string;
}

function parseInstruction(raw: unknown): ManualInstructionStep | string {
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      return 'instructions[] entries must be non-empty strings';
    }
    return { description: trimmed };
  }
  if (typeof raw !== 'object' || raw === null) {
    return 'instructions[] entries must be a string or { description, file?, command?, references? } object';
  }
  const r = raw as Record<string, unknown>;
  const description = r.description;
  if (typeof description !== 'string' || description.trim().length === 0) {
    return 'instructions[].description must be a non-empty string';
  }
  const fileRaw = r.file;
  const commandRaw = r.command;
  const referencesRaw = r.references;

  const file =
    typeof fileRaw === 'string' && fileRaw.trim().length > 0 ? fileRaw.trim() : undefined;
  const command =
    typeof commandRaw === 'string' && commandRaw.trim().length > 0
      ? commandRaw.trim()
      : undefined;
  const references: readonly string[] | undefined = Array.isArray(referencesRaw)
    ? referencesRaw.filter(
        (item): item is string => typeof item === 'string' && item.trim().length > 0,
      )
    : undefined;

  return {
    description: description.trim(),
    ...(file !== undefined ? { file } : {}),
    ...(command !== undefined ? { command } : {}),
    ...(references !== undefined && references.length > 0 ? { references } : {}),
  };
}

function parseParams(params: ExecutorContext['params']): ParsedParams {
  if (params === undefined) {
    return { error: 'params must include an instructions array' };
  }
  const raw = params as Record<string, unknown>;

  const instructionsRaw = raw.instructions;
  if (!Array.isArray(instructionsRaw) || instructionsRaw.length === 0) {
    return { error: 'params.instructions must be a non-empty array' };
  }

  const instructions: ManualInstructionStep[] = [];
  for (const entry of instructionsRaw) {
    const parsed = parseInstruction(entry);
    if (typeof parsed === 'string') {
      return { error: parsed };
    }
    instructions.push(parsed);
  }

  const summaryRaw = raw.summary;
  const summary =
    typeof summaryRaw === 'string' && summaryRaw.trim().length > 0
      ? summaryRaw.trim()
      : undefined;

  const validationRaw = raw.validationRecommendation;
  const validationRecommendation =
    typeof validationRaw === 'string' && validationRaw.trim().length > 0
      ? validationRaw.trim()
      : undefined;

  const referencesRaw = raw.references;
  const references: readonly string[] | undefined = Array.isArray(referencesRaw)
    ? referencesRaw.filter(
        (item): item is string => typeof item === 'string' && item.trim().length > 0,
      )
    : undefined;

  return {
    value: {
      instructions,
      ...(summary !== undefined ? { summary } : {}),
      ...(validationRecommendation !== undefined ? { validationRecommendation } : {}),
      ...(references !== undefined && references.length > 0 ? { references } : {}),
    },
  };
}

/* -------------------------------------------------------------------------- */
/* canRun                                                                     */
/* -------------------------------------------------------------------------- */

function canRun(context: ExecutorContext): ExecutorAvailability {
  const parsed = parseParams(context.params);
  if (parsed.error !== undefined || parsed.value === undefined) {
    return {
      status: 'blocked',
      reason: parsed.error ?? 'Invalid params for manual-instruction executor.',
    };
  }
  return {
    status: 'manual-only',
    reason:
      'This step is intentionally manual. Migrate Pilot will not edit any files — the captured run lists the instructions you need to perform in your workspace.',
  };
}

/* -------------------------------------------------------------------------- */
/* Logging                                                                    */
/* -------------------------------------------------------------------------- */

function buildInstructionLog(
  index: number,
  total: number,
  step: ManualInstructionStep,
): ExecutionLogEntry {
  const detailParts: string[] = [];
  if (step.file !== undefined) detailParts.push(`file: ${step.file}`);
  if (step.command !== undefined) detailParts.push(`command: ${step.command}`);
  if (step.references !== undefined && step.references.length > 0) {
    detailParts.push(`references: ${step.references.join(', ')}`);
  }
  return buildLog(
    'info',
    `Step ${index + 1}/${total}: ${step.description}`,
    detailParts.length > 0 ? detailParts.join('\n') : undefined,
  );
}

/* -------------------------------------------------------------------------- */
/* run                                                                        */
/* -------------------------------------------------------------------------- */

async function run(input: ExecutorRunInput): Promise<ExecutionResult> {
  const logs: ExecutionLogEntry[] = [];
  try {
    const parsed = parseParams(input.params);
    if (parsed.error !== undefined || parsed.value === undefined) {
      const message = parsed.error ?? 'Invalid params for manual-instruction executor.';
      logs.push(buildLog('error', message));
      return buildFailedRunFromError(
        input,
        logs,
        new Error(message),
        MANUAL_INSTRUCTION_EXECUTOR_KEY,
      );
    }

    const { instructions, summary, validationRecommendation, references } =
      parsed.value;

    logs.push(
      buildLog(
        'info',
        summary ?? `Manual instructions captured for "${input.stepTitle}".`,
        `workspace: ${input.workspacePath}`,
      ),
    );

    instructions.forEach((step, index) => {
      logs.push(buildInstructionLog(index, instructions.length, step));
    });

    if (references !== undefined && references.length > 0) {
      logs.push(
        buildLog(
          'info',
          'Reference material',
          references.map((ref) => `  - ${ref}`).join('\n'),
        ),
      );
    }

    if (validationRecommendation !== undefined) {
      logs.push(
        buildLog('success', 'Validation recommendation', validationRecommendation),
      );
    } else {
      logs.push(
        buildLog(
          'warning',
          'No validation recommendation was attached to this step.',
          'After finishing the manual steps above, run the project\u2019s build / typecheck / test commands before marking the step complete.',
        ),
      );
    }

    logs.push(
      buildLog(
        'warning',
        'Migrate Pilot did not modify any files in this run.',
        'The captured run is a checklist of manual actions you are expected to perform in your workspace. Accept the step only after completing the instructions.',
      ),
    );

    return buildCompletedRun({
      input,
      logs,
      changedFiles: [],
      requiresManualVerification: true,
    });
  } catch (err) {
    return buildFailedRunFromError(
      input,
      logs,
      err,
      MANUAL_INSTRUCTION_EXECUTOR_KEY,
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Definition                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * V2 executor definition for `manual-instruction`.
 *
 * Selection metadata:
 *   - `supportedPhases: []`     — manual instructions can show up in
 *                                 every phase (preflight, source
 *                                 modernisation, validation, …).
 *   - `supportedTracks: []`     — eligible on every React 19 track.
 *   - `supportedIssueCodes: []` — no axis-level restriction. The
 *                                 executor is selected ONLY when the
 *                                 step declares `executorKey:
 *                                 'manual-instruction'` explicitly,
 *                                 which keeps generic axis-matching
 *                                 from accidentally routing
 *                                 deterministic steps through this
 *                                 path.
 *   - `executionType: 'manual'` — matches the planner's
 *                                 {@link MigrationPlanStepV2ExecutionType}
 *                                 for manual steps.
 */
export const manualInstructionExecutor: ExecutorDefinition = {
  key: MANUAL_INSTRUCTION_EXECUTOR_KEY,
  label: 'Manual instructions',
  supportedPhases: [],
  supportedTracks: [],
  supportedIssueCodes: [],
  executionType: 'manual',
  canRun,
  run,
};
