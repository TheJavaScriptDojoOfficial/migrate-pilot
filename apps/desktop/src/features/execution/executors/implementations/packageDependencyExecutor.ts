/**
 * Executor Registry V2 — `package-dependency-update` deterministic
 * executor (Phase R6 Step 3.2).
 *
 * Generic dependency executor that handles approved
 * `add` / `remove` / `upgrade` / `replace` actions across React
 * package upgrades, React DOM upgrades, deprecated package
 * replacements, and peer-dependency preparation. It is deliberately
 * NOT node-sass-centric — the package list is driven entirely by the
 * `dependencyActions` array threaded through `params`.
 *
 * How it ships end-to-end today
 * -----------------------------
 * The executor translates its declarative
 * {@link PackageDependencyAction} list into the legacy
 * `package-json-dependency-update` `{ remove, add }` schema the Rust
 * executor already supports, then dispatches via
 * `runExecutionStep` (the existing IPC). The resulting
 * {@link ExecutionStepRun} is returned verbatim so the captured
 * changed-file list (`workspace/package.json`) is correct without
 * client-side reshaping.
 *
 * Safety rules (R6 Step 3 § Package Dependency Executor)
 *   ✓ Updates package.json / lockfile through package-manager-safe
 *     commands where possible
 *      → relies on the Rust executor which only edits
 *        `workspace/package.json` and never touches lockfiles.
 *   ✓ Does not bundle unrelated upgrades
 *      → only the actions threaded through `params` are dispatched.
 *   ✓ Does not auto-commit
 *      → the Rust executor never invokes Git.
 *   ✓ No executor writes to the original project path
 *      → enforced by the Rust path safety checks
 *        (`ensure_workspace_safe`).
 */
import type { ExecutorAvailability } from '@features/migration-plan';

import {
  ExecutionServiceError,
  runExecutionStep,
} from '../../services/executionService';
import type {
  ExecutionLogEntry,
  ExecutionStepRun,
} from '../../types/execution.types';

import type {
  ExecutionResult,
  ExecutorContext,
  ExecutorDefinition,
  ExecutorRunInput,
} from '../executor.types';
import {
  buildCompletedRun,
  buildFailedRun,
  buildFailedRunFromError,
  buildLog,
} from './executorResultBuilder';
import type {
  PackageDependencyAction,
  PackageDependencyActionKind,
  PackageDependencyExecutorParams,
  PackageDependencyType,
} from './types';

/* -------------------------------------------------------------------------- */
/* Identity                                                                   */
/* -------------------------------------------------------------------------- */

export const PACKAGE_DEPENDENCY_UPDATE_EXECUTOR_KEY = 'package-dependency-update';

/**
 * Legacy executor key shipped by the Rust dispatch layer. The V2
 * executor in this file translates its declarative inputs onto the
 * legacy `{ remove, add }` shape and delegates via
 * `runExecutionStep`.
 */
const LEGACY_PACKAGE_JSON_EXECUTOR_KEY = 'package-json-dependency-update';

const VALID_ACTIONS: ReadonlySet<PackageDependencyActionKind> = new Set([
  'add',
  'remove',
  'upgrade',
  'replace',
]);

const VALID_DEPENDENCY_TYPES: ReadonlySet<PackageDependencyType> = new Set([
  'dependencies',
  'devDependencies',
]);

/* -------------------------------------------------------------------------- */
/* Param parsing                                                              */
/* -------------------------------------------------------------------------- */

function parseAction(raw: unknown): PackageDependencyAction | string {
  if (typeof raw !== 'object' || raw === null) {
    return 'dependencyActions[] must be an object';
  }
  const r = raw as Record<string, unknown>;

  const action = r.action;
  if (typeof action !== 'string' || !VALID_ACTIONS.has(action as PackageDependencyActionKind)) {
    return `dependencyActions[].action must be one of ${[...VALID_ACTIONS].join(', ')}`;
  }
  const packageName = r.packageName;
  if (typeof packageName !== 'string' || packageName.trim().length === 0) {
    return 'dependencyActions[].packageName must be a non-empty string';
  }
  const dependencyType = r.dependencyType;
  if (
    typeof dependencyType !== 'string' ||
    !VALID_DEPENDENCY_TYPES.has(dependencyType as PackageDependencyType)
  ) {
    return `dependencyActions[].dependencyType must be one of ${[...VALID_DEPENDENCY_TYPES].join(', ')}`;
  }
  const targetPackageName = r.targetPackageName;
  const targetVersion = r.targetVersion;

  if (
    targetPackageName !== undefined &&
    (typeof targetPackageName !== 'string' || targetPackageName.trim().length === 0)
  ) {
    return 'dependencyActions[].targetPackageName must be a non-empty string when present';
  }
  if (
    targetVersion !== undefined &&
    (typeof targetVersion !== 'string' || targetVersion.trim().length === 0)
  ) {
    return 'dependencyActions[].targetVersion must be a non-empty string when present';
  }

  if (action === 'replace' && (typeof targetPackageName !== 'string' || targetPackageName.trim().length === 0)) {
    return `dependencyActions[].targetPackageName is required for action "replace" (source: ${packageName})`;
  }
  if (action === 'upgrade' && (typeof targetVersion !== 'string' || targetVersion.trim().length === 0)) {
    return `dependencyActions[].targetVersion is required for action "upgrade" (package: ${packageName})`;
  }
  if (action === 'add' && (typeof targetVersion !== 'string' || targetVersion.trim().length === 0)) {
    return `dependencyActions[].targetVersion is required for action "add" (package: ${packageName})`;
  }

  return {
    action: action as PackageDependencyActionKind,
    packageName,
    dependencyType: dependencyType as PackageDependencyType,
    ...(typeof targetPackageName === 'string' ? { targetPackageName } : {}),
    ...(typeof targetVersion === 'string' ? { targetVersion } : {}),
  };
}

interface ParsedParams {
  readonly value?: PackageDependencyExecutorParams;
  readonly error?: string;
}

function parseParams(params: ExecutorContext['params']): ParsedParams {
  if (params === undefined) {
    return { error: 'params must include a dependencyActions array' };
  }
  const raw = params as Record<string, unknown>;
  const actionsRaw = raw.dependencyActions;
  if (!Array.isArray(actionsRaw) || actionsRaw.length === 0) {
    return { error: 'params.dependencyActions must be a non-empty array' };
  }

  const actions: PackageDependencyAction[] = [];
  for (const entry of actionsRaw) {
    const parsed = parseAction(entry);
    if (typeof parsed === 'string') {
      return { error: parsed };
    }
    actions.push(parsed);
  }

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
    value: {
      dependencyActions: actions,
      ...(packageManager !== undefined ? { packageManager } : {}),
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
      reason: parsed.error ?? 'Invalid params for package-dependency-update executor.',
    };
  }
  return { status: 'available' };
}

/* -------------------------------------------------------------------------- */
/* Action → legacy schema translation                                         */
/* -------------------------------------------------------------------------- */

interface LegacyAddSpec {
  readonly name: string;
  readonly version?: string;
  readonly to: PackageDependencyType;
  readonly onlyIfMissing?: boolean;
}

interface LegacyRemoveSpec {
  readonly name: string;
  readonly from?: readonly PackageDependencyType[];
}

interface LegacyParams {
  readonly add: readonly LegacyAddSpec[];
  readonly remove: readonly LegacyRemoveSpec[];
}

/**
 * Map declarative dependency actions onto the
 * `package-json-dependency-update` `{ add, remove }` shape. The
 * mapping is intentionally narrow so the Rust executor stays the
 * single source of truth for what is mutated.
 */
function buildLegacyParams(
  actions: readonly PackageDependencyAction[],
): LegacyParams {
  const add: LegacyAddSpec[] = [];
  const remove: LegacyRemoveSpec[] = [];

  for (const action of actions) {
    switch (action.action) {
      case 'add':
        add.push({
          name: action.packageName,
          ...(action.targetVersion !== undefined ? { version: action.targetVersion } : {}),
          to: action.dependencyType,
          onlyIfMissing: true,
        });
        break;
      case 'remove':
        remove.push({
          name: action.packageName,
          from: [action.dependencyType],
        });
        break;
      case 'upgrade':
        // The Rust executor's add+remove flow rewrites a package's
        // version when the same name is added back into the same
        // section, so an upgrade is encoded as remove → add.
        remove.push({
          name: action.packageName,
          from: [action.dependencyType],
        });
        add.push({
          name: action.packageName,
          ...(action.targetVersion !== undefined ? { version: action.targetVersion } : {}),
          to: action.dependencyType,
        });
        break;
      case 'replace': {
        remove.push({
          name: action.packageName,
          from: [action.dependencyType],
        });
        const targetName = action.targetPackageName ?? action.packageName;
        add.push({
          name: targetName,
          ...(action.targetVersion !== undefined ? { version: action.targetVersion } : {}),
          to: action.dependencyType,
        });
        break;
      }
    }
  }

  return { add, remove };
}

function describeAction(action: PackageDependencyAction): string {
  switch (action.action) {
    case 'add':
      return `add ${action.packageName}${
        action.targetVersion !== undefined ? `@${action.targetVersion}` : ''
      } → ${action.dependencyType}`;
    case 'remove':
      return `remove ${action.packageName} from ${action.dependencyType}`;
    case 'upgrade':
      return `upgrade ${action.packageName} → ${
        action.targetVersion ?? '(latest)'
      } in ${action.dependencyType}`;
    case 'replace':
      return `replace ${action.packageName} → ${
        action.targetPackageName ?? action.packageName
      }${action.targetVersion !== undefined ? `@${action.targetVersion}` : ''} in ${
        action.dependencyType
      }`;
  }
}

/* -------------------------------------------------------------------------- */
/* run                                                                        */
/* -------------------------------------------------------------------------- */

async function run(input: ExecutorRunInput): Promise<ExecutionResult> {
  const logs: ExecutionLogEntry[] = [];
  logs.push(
    buildLog(
      'info',
      `Generic dependency update started for step "${input.stepTitle}".`,
    ),
  );

  const parsed = parseParams(input.params);
  if (parsed.error !== undefined || parsed.value === undefined) {
    const message =
      parsed.error ?? 'Invalid params for package-dependency-update executor.';
    logs.push(buildLog('error', message));
    return buildFailedRun({
      input,
      logs,
      error: {
        code: `${PACKAGE_DEPENDENCY_UPDATE_EXECUTOR_KEY}:invalid-params`,
        message,
      },
    });
  }

  const { dependencyActions, packageManager } = parsed.value;

  if (packageManager !== undefined) {
    logs.push(
      buildLog(
        'info',
        `Workspace package manager: ${packageManager}.`,
        'Package manager is recorded for telemetry; package.json edits themselves are package-manager-agnostic.',
      ),
    );
  }

  for (const action of dependencyActions) {
    logs.push(buildLog('info', `Planned: ${describeAction(action)}`));
  }

  const legacy = buildLegacyParams(dependencyActions);
  if (legacy.add.length === 0 && legacy.remove.length === 0) {
    logs.push(
      buildLog(
        'warning',
        'No add/remove operations were derived from the supplied actions.',
      ),
    );
    return buildCompletedRun({ input, logs });
  }

  try {
    const ipcResult = await runExecutionStep({
      workspacePath: input.workspacePath,
      sourcePath: input.sourcePath,
      planId: input.planId,
      planStepId: input.planStepId,
      stepTitle: input.stepTitle,
      execution: {
        mode: 'scripted',
        executorKey: LEGACY_PACKAGE_JSON_EXECUTOR_KEY,
        params: legacy as unknown as Readonly<Record<string, unknown>>,
      },
    });
    return mergeIpcRun(input, logs, ipcResult);
  } catch (err) {
    if (err instanceof ExecutionServiceError) {
      logs.push(buildLog('error', err.message, err.detail));
      return buildFailedRun({
        input,
        logs,
        error: {
          code: `${PACKAGE_DEPENDENCY_UPDATE_EXECUTOR_KEY}:${err.kind}`,
          message: err.message,
          ...(err.detail !== undefined ? { detail: err.detail } : {}),
        },
      });
    }
    return buildFailedRunFromError(
      input,
      logs,
      err,
      PACKAGE_DEPENDENCY_UPDATE_EXECUTOR_KEY,
    );
  }
}

/**
 * Combine the executor-level planning logs with the Rust-emitted run
 * payload. We keep the IPC's own logs / changed files / status verbatim
 * — the V2 executor only adds context lines around them so the
 * captured run is fully traceable from "decision" through "mutation".
 *
 * `executorKey` is overwritten with the V2 key so downstream consumers
 * (UI badges, persistence) attribute the run to this executor rather
 * than the legacy underlying one.
 */
function mergeIpcRun(
  input: ExecutorRunInput,
  prefixLogs: readonly ExecutionLogEntry[],
  ipcResult: ExecutionStepRun,
): ExecutionResult {
  const mergedLogs: ExecutionLogEntry[] = [...prefixLogs, ...ipcResult.logs];
  return {
    ...ipcResult,
    id: input.runId,
    planId: input.planId,
    planStepId: input.planStepId,
    stepTitle: input.stepTitle,
    workspacePath: input.workspacePath,
    startedAt: input.startedAt,
    executorKey: input.executorKey,
    mode: input.mode,
    logs: mergedLogs,
  };
}

/* -------------------------------------------------------------------------- */
/* Definition                                                                 */
/* -------------------------------------------------------------------------- */

export const packageDependencyExecutor: ExecutorDefinition = {
  key: PACKAGE_DEPENDENCY_UPDATE_EXECUTOR_KEY,
  label: 'Package dependency update',
  /* Eligible across every phase that mutates package.json — the
   * executor itself doesn't care which phase routed the action list. */
  supportedPhases: [],
  supportedTracks: [],
  supportedIssueCodes: [],
  executionType: 'scripted',
  canRun,
  run,
};
