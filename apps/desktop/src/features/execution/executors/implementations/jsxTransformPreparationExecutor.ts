/**
 * Executor Registry V2 — `jsx-transform-preparation` deterministic
 * executor (Phase R6 Step 3.5).
 *
 * Handles the modern JSX transform alignment step. The executor reads
 * the planner-detected build setup (Babel / react-scripts / Vite /
 * TypeScript / custom / unknown) and produces a deterministic plan to
 * align the configuration with the React 19 automatic JSX transform.
 * If the setup is `custom` or `unknown` the executor surfaces manual
 * guidance instead of attempting an unsafe edit.
 *
 * Selection metadata
 * ------------------
 *   - `supportedPhases: ['jsx-transform', 'tooling']` — both phases
 *     can route a JSX transform step depending on whether the
 *     planner separates tooling/JSX in the current track.
 *   - `supportedTracks: []` — eligible for every React 19 track.
 *   - `supportedIssueCodes` — the canonical
 *     {@link REACT19_ISSUE_CODES.JSX_TRANSFORM_OUTDATED} code.
 *
 * Run behaviour
 * -------------
 * - Parses `params.buildSetup` + `params.configFiles`.
 * - For each known setup, emits a `success` log describing the
 *   precise tsconfig / Babel / Vite change required, and a
 *   `warning` noting that no files were modified in this run (until
 *   the file-edit IPC lands).
 * - For `custom` / `unknown`, emits a `warning` with manual guidance
 *   and completes the run without touching anything.
 */
import {
  REACT19_ISSUE_CODES,
  type ReactMigrationPhase,
} from '@features/react19-migration';
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
  JsxTransformBuildSetup,
  JsxTransformPreparationExecutorParams,
} from './types';

/* -------------------------------------------------------------------------- */
/* Identity                                                                   */
/* -------------------------------------------------------------------------- */

export const JSX_TRANSFORM_PREPARATION_EXECUTOR_KEY = 'jsx-transform-preparation';

const SUPPORTED_PHASES: readonly ReactMigrationPhase[] = [
  'jsx-transform',
  'tooling',
];

const VALID_SETUPS: ReadonlySet<JsxTransformBuildSetup> = new Set<JsxTransformBuildSetup>([
  'babel',
  'react-scripts',
  'vite',
  'typescript',
  'custom',
  'unknown',
]);

/* -------------------------------------------------------------------------- */
/* Param parsing                                                              */
/* -------------------------------------------------------------------------- */

function parseParams(
  params: ExecutorContext['params'],
): JsxTransformPreparationExecutorParams {
  if (params === undefined) return {};
  const raw = params as Record<string, unknown>;

  const setupRaw = raw.buildSetup;
  const buildSetup =
    typeof setupRaw === 'string' && VALID_SETUPS.has(setupRaw as JsxTransformBuildSetup)
      ? (setupRaw as JsxTransformBuildSetup)
      : undefined;

  const filesRaw = raw.configFiles;
  const configFiles: readonly string[] = Array.isArray(filesRaw)
    ? filesRaw.filter(
        (item): item is string => typeof item === 'string' && item.trim().length > 0,
      )
    : [];

  return {
    ...(buildSetup !== undefined ? { buildSetup } : {}),
    ...(configFiles.length > 0 ? { configFiles } : {}),
  };
}

/* -------------------------------------------------------------------------- */
/* canRun                                                                     */
/* -------------------------------------------------------------------------- */

function canRun(context: ExecutorContext): ExecutorAvailability {
  const { buildSetup } = parseParams(context.params);

  if (buildSetup === undefined || buildSetup === 'unknown') {
    return {
      status: 'manual-only',
      reason:
        'Build setup could not be determined from the scan report. Inspect Babel / TypeScript / Vite / react-scripts configuration manually and switch to the automatic JSX transform.',
    };
  }
  if (buildSetup === 'custom') {
    return {
      status: 'manual-only',
      reason:
        'A custom build setup was detected. Migrate Pilot will not auto-edit unknown configuration files — review the JSX transform manually.',
    };
  }
  return {
    status: 'future-support',
    reason: `A deterministic JSX transform alignment plan exists for ${buildSetup} setups, but the safe config-edit IPC is not implemented yet.`,
  };
}

/* -------------------------------------------------------------------------- */
/* Setup-specific guidance                                                    */
/* -------------------------------------------------------------------------- */

interface SetupGuidance {
  readonly summary: string;
  readonly detail: string;
}

function guidanceForSetup(setup: JsxTransformBuildSetup): SetupGuidance | undefined {
  switch (setup) {
    case 'babel':
      return {
        summary: 'Switch Babel to the automatic JSX runtime.',
        detail:
          'Update babel.config.* / .babelrc to use @babel/preset-react with { "runtime": "automatic" }. Remove explicit React imports added solely to satisfy the classic runtime.',
      };
    case 'react-scripts':
      return {
        summary:
          'react-scripts ≥ 5 already uses the automatic JSX transform — verify the toolchain version is current.',
        detail:
          'No source-level changes are required. If the project is on react-scripts < 5, upgrade it (or migrate off CRA) in the React 19 upgrade phase.',
      };
    case 'vite':
      return {
        summary: 'Vite uses the automatic JSX transform via @vitejs/plugin-react by default.',
        detail:
          'Confirm vite.config.* declares @vitejs/plugin-react (or @vitejs/plugin-react-swc) — no additional changes are needed for React 19.',
      };
    case 'typescript':
      return {
        summary: 'Set tsconfig.json compilerOptions.jsx to "react-jsx".',
        detail:
          'Switch "jsx": "react" → "jsx": "react-jsx" (or "react-jsxdev" for development) so the TypeScript compiler emits the automatic runtime imports.',
      };
    case 'custom':
    case 'unknown':
      return undefined;
  }
}

/* -------------------------------------------------------------------------- */
/* run                                                                        */
/* -------------------------------------------------------------------------- */

async function run(input: ExecutorRunInput): Promise<ExecutionResult> {
  const logs: ExecutionLogEntry[] = [];
  try {
    const { buildSetup, configFiles } = parseParams(input.params);

    if (buildSetup === undefined || buildSetup === 'unknown') {
      logs.push(
        buildLog(
          'warning',
          'Build setup could not be determined; JSX transform alignment is a manual task.',
          'Inspect tsconfig.json / babel.config.* / vite.config.* to confirm the automatic JSX runtime is used.',
        ),
      );
      return buildCompletedRun({ input, logs });
    }

    if (buildSetup === 'custom') {
      logs.push(
        buildLog(
          'warning',
          'Custom build setup detected; Migrate Pilot will not auto-edit configuration.',
          'Manually align the toolchain with the automatic JSX runtime described in the React 18 upgrade docs.',
        ),
      );
      return buildCompletedRun({ input, logs });
    }

    logs.push(buildLog('info', `Build setup detected: ${buildSetup}.`));
    if (configFiles !== undefined && configFiles.length > 0) {
      logs.push(
        buildLog(
          'info',
          `Relevant config files: ${configFiles.join(', ')}`,
        ),
      );
    }

    const guidance = guidanceForSetup(buildSetup);
    if (guidance !== undefined) {
      logs.push(buildLog('success', guidance.summary, guidance.detail));
    }

    logs.push(
      buildLog(
        'warning',
        'No files were modified in this run.',
        'The deterministic config edit will ship once the safe file-edit IPC is wired into the executor framework.',
      ),
    );

    return buildCompletedRun({ input, logs });
  } catch (err) {
    return buildFailedRunFromError(
      input,
      logs,
      err,
      JSX_TRANSFORM_PREPARATION_EXECUTOR_KEY,
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Definition                                                                 */
/* -------------------------------------------------------------------------- */

export const jsxTransformPreparationExecutor: ExecutorDefinition = {
  key: JSX_TRANSFORM_PREPARATION_EXECUTOR_KEY,
  label: 'JSX transform preparation',
  supportedPhases: SUPPORTED_PHASES,
  supportedTracks: [],
  supportedIssueCodes: [REACT19_ISSUE_CODES.JSX_TRANSFORM_OUTDATED],
  executionType: 'scripted',
  canRun,
  run,
};
