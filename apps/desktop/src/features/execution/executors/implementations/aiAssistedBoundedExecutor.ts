/**
 * Executor Registry V2 — `ai-assisted-bounded` executor (Phase R6
 * Step 4.1).
 *
 * Bridges the V2 executor framework to AI-assisted edits while keeping
 * the AI tightly scoped and human-reviewable. Concretely:
 *
 *   - The executor operates ONLY inside `context.workspacePath`. The
 *     original `sourcePath` is never passed to the AI runner and is
 *     refused as a target when the resolved workspace happens to
 *     equal the source path.
 *   - The prompt the executor would send is built from a strictly
 *     bounded set of inputs (selected step, scan issue codes,
 *     planner-resolved relevant file list, optional snippets,
 *     validation commands). Whole-codebase prompts are impossible by
 *     construction — the executor refuses to run when the file list
 *     is empty.
 *   - The executor never auto-commits. The captured
 *     {@link ExecutionResult} contains a `manual-review` warning so
 *     the screen always asks the human to inspect the diff before
 *     accepting.
 *
 * Run shape
 * ---------
 * The AI runner is not wired into the desktop shell yet (Phase R7).
 * Until it ships, `run()` produces a `completed` no-op run that
 * captures:
 *
 *   - A single-line `summary` log.
 *   - One log entry per bounded file the AI is allowed to look at.
 *   - The exact prompt contract the future AI runner MUST honour
 *     (verbatim).
 *   - A `validation-recommendation` log derived from
 *     `params.validationCommands` so the screen surfaces the
 *     follow-up step the user needs to gate on.
 *   - A `manual-review-required` warning so the user knows the run
 *     is observational only.
 *
 * `changedFiles` is intentionally empty — the AI runner is the only
 * code that may populate it, and it is not wired yet. Once it ships,
 * only the `invokeAiRunner` helper changes; the rest of the executor
 * (param parsing, prompt assembly, result shape) stays identical.
 *
 * Acceptance criteria mapping (R6 Step 4 § AI-Assisted Bounded Executor)
 *   ✓ Works only inside workspacePath
 *      → `canRun` refuses when the workspace is missing / equals the
 *        source path; `run` re-checks the invariant defensively.
 *   ✓ Receives only the bounded inputs
 *      → params shape is intentionally narrow (`relevantFiles`,
 *        scan issue codes carried on the context, validation
 *        commands, additional context). Anything outside this list
 *        is not threaded into the prompt.
 *   ✓ Must not send whole-codebase prompts
 *      → empty `relevantFiles` is a hard `blocked`; file count is
 *        capped by `maxRelevantFiles` (default
 *        {@link DEFAULT_MAX_RELEVANT_FILES}) and the executor refuses
 *        rather than silently truncating.
 *   ✓ Must not auto-commit
 *      → no Git IPC is invoked. The captured run always emits the
 *        `manual-review-required` warning.
 *   ✓ Must return summary, changed files, logs, validation
 *      recommendation, manual review notes
 *      → encoded in the captured run via summary log, structured
 *        `info`/`success`/`warning` log entries, and the empty
 *        `changedFiles` array (the AI runner will populate it once
 *        wired).
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
  AiAssistedBoundedExecutorParams,
  AiAssistedBoundedRelevantFile,
} from './types';

/* -------------------------------------------------------------------------- */
/* Identity                                                                   */
/* -------------------------------------------------------------------------- */

export const AI_ASSISTED_BOUNDED_EXECUTOR_KEY = 'ai-assisted-bounded';

/**
 * Hard cap on the bounded relevant-file list. Acts as the framework
 * default when a planner step omits `maxRelevantFiles`. Picked to be
 * large enough for realistic multi-file edits (e.g. refactoring a few
 * hooks across a feature) but small enough to keep the AI prompt well
 * under any reasonable model context window. Steps that need a larger
 * scope MUST split into multiple plan steps instead of raising the
 * cap.
 */
export const DEFAULT_MAX_RELEVANT_FILES = 20;

/**
 * Frozen prompt contract every future invocation of this executor's
 * AI runner MUST honour. Exposed for unit tests and the screen
 * (developer-mode tooltip) so the contract is visible without
 * grepping the implementation.
 */
export const AI_ASSISTED_BOUNDED_PROMPT_CONTRACT: readonly string[] = Object.freeze([
  'Implement only this migration step.',
  'Do not modify unrelated files.',
  'Do not change the original project path.',
  'Do not commit.',
  'Keep the change minimal and reversible.',
  'Explain risky changes in the run summary.',
]);

/* -------------------------------------------------------------------------- */
/* Param parsing                                                              */
/* -------------------------------------------------------------------------- */

interface ParsedParams {
  readonly value?: AiAssistedBoundedExecutorParams;
  readonly error?: string;
}

function parseRelevantFile(raw: unknown): AiAssistedBoundedRelevantFile | string {
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      return 'relevantFiles[] entries must be non-empty strings';
    }
    return { path: trimmed };
  }
  if (typeof raw !== 'object' || raw === null) {
    return 'relevantFiles[] entries must be a string or { path, excerpt?, reason? } object';
  }
  const r = raw as Record<string, unknown>;
  const pathRaw = r.path;
  if (typeof pathRaw !== 'string' || pathRaw.trim().length === 0) {
    return 'relevantFiles[].path must be a non-empty string';
  }
  const excerptRaw = r.excerpt;
  const reasonRaw = r.reason;
  const excerpt =
    typeof excerptRaw === 'string' && excerptRaw.length > 0 ? excerptRaw : undefined;
  const reason =
    typeof reasonRaw === 'string' && reasonRaw.trim().length > 0
      ? reasonRaw.trim()
      : undefined;
  return {
    path: pathRaw.trim(),
    ...(excerpt !== undefined ? { excerpt } : {}),
    ...(reason !== undefined ? { reason } : {}),
  };
}

function parseParams(params: ExecutorContext['params']): ParsedParams {
  if (params === undefined) {
    return {
      error:
        'params must include a relevantFiles array — the AI executor refuses to receive whole-codebase prompts.',
    };
  }
  const raw = params as Record<string, unknown>;
  const filesRaw = raw.relevantFiles;
  if (!Array.isArray(filesRaw) || filesRaw.length === 0) {
    return {
      error:
        'params.relevantFiles must be a non-empty array — the AI executor refuses to receive whole-codebase prompts.',
    };
  }

  const relevantFiles: AiAssistedBoundedRelevantFile[] = [];
  for (const entry of filesRaw) {
    const parsed = parseRelevantFile(entry);
    if (typeof parsed === 'string') {
      return { error: parsed };
    }
    relevantFiles.push(parsed);
  }

  const validationRaw = raw.validationCommands;
  const validationCommands: readonly string[] | undefined = Array.isArray(validationRaw)
    ? validationRaw.filter(
        (item): item is string => typeof item === 'string' && item.trim().length > 0,
      )
    : undefined;

  const additionalContextRaw = raw.additionalContext;
  const additionalContext =
    typeof additionalContextRaw === 'string' && additionalContextRaw.trim().length > 0
      ? additionalContextRaw.trim()
      : undefined;

  const maxRelevantFilesRaw = raw.maxRelevantFiles;
  const maxRelevantFiles =
    typeof maxRelevantFilesRaw === 'number' &&
    Number.isFinite(maxRelevantFilesRaw) &&
    maxRelevantFilesRaw > 0
      ? Math.floor(maxRelevantFilesRaw)
      : undefined;

  return {
    value: {
      relevantFiles,
      ...(validationCommands !== undefined && validationCommands.length > 0
        ? { validationCommands }
        : {}),
      ...(additionalContext !== undefined ? { additionalContext } : {}),
      ...(maxRelevantFiles !== undefined ? { maxRelevantFiles } : {}),
    },
  };
}

/* -------------------------------------------------------------------------- */
/* Safety probes                                                              */
/* -------------------------------------------------------------------------- */

interface WorkspaceSafetyResult {
  readonly ok: boolean;
  readonly reason?: string;
}

/**
 * Verify the executor is targeting a real, isolated workspace and not
 * the original project path. The AI runner must never touch the
 * source-of-truth project — that is one of the framework's hardest
 * invariants.
 */
function probeWorkspaceSafety(context: ExecutorContext): WorkspaceSafetyResult {
  const workspace = context.workspacePath.trim();
  if (workspace.length === 0) {
    return {
      ok: false,
      reason:
        'AI-assisted execution requires a migration workspace. Create the safe workspace before dispatching this step.',
    };
  }
  if (
    context.sourcePath.trim().length > 0 &&
    context.sourcePath.trim() === workspace
  ) {
    return {
      ok: false,
      reason:
        'AI-assisted execution refuses to run against the original project path. Create an isolated migration workspace before dispatching this step.',
    };
  }
  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* canRun                                                                     */
/* -------------------------------------------------------------------------- */

function canRun(context: ExecutorContext): ExecutorAvailability {
  const safety = probeWorkspaceSafety(context);
  if (!safety.ok) {
    return { status: 'blocked', reason: safety.reason ?? 'Workspace safety probe failed.' };
  }

  const parsed = parseParams(context.params);
  if (parsed.error !== undefined || parsed.value === undefined) {
    return {
      status: 'blocked',
      reason: parsed.error ?? 'Invalid params for ai-assisted-bounded executor.',
    };
  }

  const cap = parsed.value.maxRelevantFiles ?? DEFAULT_MAX_RELEVANT_FILES;
  if (parsed.value.relevantFiles.length > cap) {
    return {
      status: 'blocked',
      reason: `relevantFiles count (${parsed.value.relevantFiles.length}) exceeds the bounded cap (${cap}). Split the step into smaller bounded slices instead of widening the AI prompt.`,
    };
  }

  const warnings: string[] = [];
  if (parsed.value.validationCommands === undefined) {
    warnings.push(
      'No validation commands were attached to this step — the screen will recommend running build/test/lint manually after the AI lands its edits.',
    );
  }

  return {
    /* The AI runner IPC is not wired into the desktop shell yet, so
     * `available` would be misleading. `future-support` is the
     * honest badge here — the executor itself is registered and
     * inputs validate, but no automatic dispatch happens yet. */
    status: 'future-support',
    reason:
      'The bounded AI runner is not wired into the desktop shell in this build yet. The captured run will surface the exact prompt contract and the bounded file list the runner will receive once it ships.',
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}

/* -------------------------------------------------------------------------- */
/* Prompt assembly (no IPC; the runner will consume the same shape)           */
/* -------------------------------------------------------------------------- */

interface BoundedPromptInputs {
  readonly stepTitle: string;
  readonly issueCodes: readonly string[];
  readonly relevantFiles: readonly AiAssistedBoundedRelevantFile[];
  readonly validationCommands?: readonly string[];
  readonly additionalContext?: string;
}

function summarizeBoundedPrompt(inputs: BoundedPromptInputs): string {
  const fileCount = inputs.relevantFiles.length;
  const codeHint =
    inputs.issueCodes.length > 0
      ? ` (issue codes: ${inputs.issueCodes.join(', ')})`
      : '';
  return `AI bounded edit planned for "${inputs.stepTitle}" across ${fileCount} file${
    fileCount === 1 ? '' : 's'
  }${codeHint}.`;
}

/* -------------------------------------------------------------------------- */
/* run                                                                        */
/* -------------------------------------------------------------------------- */

async function run(input: ExecutorRunInput): Promise<ExecutionResult> {
  const logs: ExecutionLogEntry[] = [];

  try {
    const safety = probeWorkspaceSafety(input);
    if (!safety.ok) {
      logs.push(buildLog('error', safety.reason ?? 'Workspace safety probe failed.'));
      return buildFailedRunFromError(
        input,
        logs,
        new Error(safety.reason ?? 'Workspace safety probe failed.'),
        AI_ASSISTED_BOUNDED_EXECUTOR_KEY,
      );
    }

    const parsed = parseParams(input.params);
    if (parsed.error !== undefined || parsed.value === undefined) {
      const message = parsed.error ?? 'Invalid params for ai-assisted-bounded executor.';
      logs.push(buildLog('error', message));
      return buildFailedRunFromError(
        input,
        logs,
        new Error(message),
        AI_ASSISTED_BOUNDED_EXECUTOR_KEY,
      );
    }

    const params = parsed.value;
    const cap = params.maxRelevantFiles ?? DEFAULT_MAX_RELEVANT_FILES;
    if (params.relevantFiles.length > cap) {
      const message = `relevantFiles count (${params.relevantFiles.length}) exceeds the bounded cap (${cap}).`;
      logs.push(buildLog('error', message));
      return buildFailedRunFromError(
        input,
        logs,
        new Error(message),
        AI_ASSISTED_BOUNDED_EXECUTOR_KEY,
      );
    }

    /* 1. Headline summary so the captured run has a single line the
     *    UI can show as a glanceable title. */
    logs.push(
      buildLog(
        'info',
        summarizeBoundedPrompt({
          stepTitle: input.stepTitle,
          issueCodes: input.issueCodes,
          relevantFiles: params.relevantFiles,
          ...(params.validationCommands !== undefined
            ? { validationCommands: params.validationCommands }
            : {}),
          ...(params.additionalContext !== undefined
            ? { additionalContext: params.additionalContext }
            : {}),
        }),
        `workspace: ${input.workspacePath}`,
      ),
    );

    /* 2. The exact prompt contract the AI runner MUST honour. Emitted
     *    verbatim so any deviation in a future runner is observable
     *    in the captured run. */
    logs.push(
      buildLog(
        'info',
        'AI prompt contract',
        AI_ASSISTED_BOUNDED_PROMPT_CONTRACT.map((line, i) => `${i + 1}. ${line}`).join(
          '\n',
        ),
      ),
    );

    /* 3. Bounded file list — one entry per file so the captured run
     *    is a literal record of the AI's allowed scope. */
    for (const file of params.relevantFiles) {
      const detailParts: string[] = [];
      if (file.reason !== undefined) detailParts.push(`reason: ${file.reason}`);
      if (file.excerpt !== undefined) {
        detailParts.push(
          `excerpt provided (${file.excerpt.length.toString()} char${file.excerpt.length === 1 ? '' : 's'})`,
        );
      }
      logs.push(
        buildLog(
          'info',
          `relevant: ${file.path}`,
          detailParts.length > 0 ? detailParts.join('; ') : undefined,
        ),
      );
    }

    /* 4. Additional planner-supplied context, when present. */
    if (params.additionalContext !== undefined) {
      logs.push(
        buildLog('info', 'Additional context for the AI runner', params.additionalContext),
      );
    }

    /* 5. Validation recommendation. The executor never spawns
     *    validation itself — it surfaces what the user should run
     *    after the AI lands its edits. */
    if (params.validationCommands !== undefined && params.validationCommands.length > 0) {
      logs.push(
        buildLog(
          'success',
          'Validation recommendation',
          [
            'Run these commands after accepting the AI changes to confirm they did not regress the workspace:',
            ...params.validationCommands.map((cmd) => `  - ${cmd}`),
          ].join('\n'),
        ),
      );
    } else {
      logs.push(
        buildLog(
          'warning',
          'No validation commands were attached to this step.',
          'Manually run the project\u2019s build / typecheck / test commands after the AI lands its edits before accepting the diff.',
        ),
      );
    }

    /* 6. Manual review notes — every AI-assisted run must surface
     *    this warning. The captured run is observational only until
     *    the user reviews and accepts the diff. */
    logs.push(
      buildLog(
        'warning',
        'Manual review required',
        [
          'Migrate Pilot never auto-commits AI changes. Review the produced diff in the workspace, confirm only the bounded files were touched, and accept or reject before moving on.',
          'If the AI produced edits outside the bounded file list, reject the run and re-scope the step.',
        ].join(' '),
      ),
    );

    /* 7. Runner not wired yet. Captured logs above describe what the
     *    runner WILL do once shipped; `changedFiles` stays empty. */
    logs.push(
      buildLog(
        'warning',
        'AI runner not yet wired into the desktop shell.',
        'The captured run above is a faithful preview of the bounded prompt. No files were modified in this run.',
      ),
    );

    /* AI-assisted bounded runs are observational by contract — the
     * human author always has to diff-review the produced edits
     * before accepting. Mark the run accordingly so the screen
     * surfaces the "Manual verification required" banner, mirroring
     * the manual-instruction executor's contract. */
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
      AI_ASSISTED_BOUNDED_EXECUTOR_KEY,
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Definition                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * V2 executor definition for `ai-assisted-bounded`.
 *
 * Selection metadata:
 *   - `supportedPhases: []`     — eligible across every phase. The
 *                                 planner is the source of truth for
 *                                 which steps escalate to AI.
 *   - `supportedTracks: []`     — eligible on every React 19 track.
 *   - `supportedIssueCodes: []` — no axis-level restriction. The
 *                                 executor is selected ONLY when the
 *                                 step declares `executorKey:
 *                                 'ai-assisted-bounded'` explicitly,
 *                                 which keeps generic axis-matching
 *                                 from accidentally routing
 *                                 deterministic steps through the AI
 *                                 path.
 *   - `executionType: 'ai-assisted'` — matches the planner's
 *                                 {@link MigrationPlanStepV2ExecutionType}
 *                                 for AI-routed steps.
 */
export const aiAssistedBoundedExecutor: ExecutorDefinition = {
  key: AI_ASSISTED_BOUNDED_EXECUTOR_KEY,
  label: 'AI-assisted (bounded)',
  supportedPhases: [],
  supportedTracks: [],
  supportedIssueCodes: [],
  executionType: 'ai-assisted',
  canRun,
  run,
};
