/**
 * Execution service.
 *
 * Single entry-point for talking to the Tauri execution commands and
 * converting raw payloads into strongly-typed feature contracts.
 *
 * Architectural rules
 * -------------------
 * - No React imports. Pure logic so this module is trivially unit-testable
 *   and reusable by the future orchestrator layer.
 * - No filesystem access from JS. Path canonicalisation, package.json
 *   parsing, and file writes all live in Rust.
 * - Throws typed `ExecutionServiceError` so the calling hook can branch on
 *   the failure mode without parsing strings.
 * - The execution wire contract is generic: the JS layer sends the
 *   step's `MigrationStepExecution` metadata (mode + executorKey +
 *   params) and Rust dispatches based on `executorKey`. The plan step
 *   id is forwarded for telemetry / logging only — it is NEVER used to
 *   choose an executor.
 */
import {
  invokeCommand,
  type ExecutionCapabilityRaw,
  type ExecutionChangedFileRaw,
  type ExecutionErrorRaw,
  type ExecutionLogEntryRaw,
  type ExecutionRequestRaw,
  type ExecutionStepRunRaw,
} from '@shared/utils/commands';
import { runtimeConfig } from '@shared/config/runtime';

import type { MigrationStepExecution } from '@features/migration-plan';

import type {
  ExecutionCapability,
  ExecutionCapabilityBadge,
  ExecutionChangeType,
  ExecutionChangedFile,
  ExecutionError,
  ExecutionLogEntry,
  ExecutionLogLevel,
  ExecutionStepRun,
  MigrationStepExecutionMode,
} from '../types/execution.types';

/* -------------------------------------------------------------------------- */
/* Error type                                                                 */
/* -------------------------------------------------------------------------- */

export type ExecutionServiceErrorKind =
  | 'tauri-unavailable'
  | 'invalid-input'
  | 'not-implemented'
  | 'execution-failed';

export class ExecutionServiceError extends Error {
  public readonly kind: ExecutionServiceErrorKind;
  public readonly detail?: string;

  public constructor(
    kind: ExecutionServiceErrorKind,
    message: string,
    detail?: string,
  ) {
    super(message);
    this.name = 'ExecutionServiceError';
    this.kind = kind;
    if (detail !== undefined) {
      this.detail = detail;
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

export interface CheckCapabilityInput {
  readonly workspacePath: string;
  readonly sourcePath: string;
  readonly planStepId: string;
  readonly stepTitle: string;
  /** Required: the planner's declared execution intent for the step. */
  readonly execution: MigrationStepExecution;
}

export async function checkExecutionCapability(
  input: CheckCapabilityInput,
): Promise<ExecutionCapability> {
  if (!runtimeConfig.isTauri) {
    throw new ExecutionServiceError(
      'tauri-unavailable',
      'Execution actions are only available inside the Migrate Pilot desktop shell. Run `npm run tauri:dev`.',
    );
  }

  let raw: ExecutionCapabilityRaw;
  try {
    raw = await invokeCommand('execution_check_capability', {
      workspacePath: input.workspacePath,
      sourcePath: input.sourcePath,
      planStepId: input.planStepId,
      stepTitle: input.stepTitle,
      execution: toExecutionRequest(input.execution),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/empty|invalid|not accessible|not a directory/i.test(message)) {
      throw new ExecutionServiceError('invalid-input', message);
    }
    throw new ExecutionServiceError('execution-failed', message);
  }

  return parseCapability(raw);
}

export interface RunStepInput {
  readonly workspacePath: string;
  readonly sourcePath: string;
  readonly planId: string;
  readonly planStepId: string;
  readonly stepTitle: string;
  /** Required: the planner's declared execution intent for the step. */
  readonly execution: MigrationStepExecution;
}

export async function runExecutionStep(
  input: RunStepInput,
): Promise<ExecutionStepRun> {
  if (!runtimeConfig.isTauri) {
    throw new ExecutionServiceError(
      'tauri-unavailable',
      'Execution actions are only available inside the Migrate Pilot desktop shell. Run `npm run tauri:dev`.',
    );
  }

  let raw: ExecutionStepRunRaw;
  try {
    raw = await invokeCommand('execution_run_step', {
      workspacePath: input.workspacePath,
      sourcePath: input.sourcePath,
      planId: input.planId,
      planStepId: input.planStepId,
      stepTitle: input.stepTitle,
      execution: toExecutionRequest(input.execution),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/not implemented|not available for this step/i.test(message)) {
      throw new ExecutionServiceError('not-implemented', message);
    }
    if (
      /empty|invalid|not accessible|not a directory|not allowed|inside the source|workspace path/i.test(
        message,
      )
    ) {
      throw new ExecutionServiceError('invalid-input', message);
    }
    throw new ExecutionServiceError('execution-failed', message);
  }

  return parseStepRun(raw);
}

/* -------------------------------------------------------------------------- */
/* Pure converters (exported for unit tests)                                  */
/* -------------------------------------------------------------------------- */

const KNOWN_LEVELS: ReadonlySet<ExecutionLogLevel> =
  new Set<ExecutionLogLevel>(['info', 'warning', 'error', 'success']);

const KNOWN_CHANGE_TYPES: ReadonlySet<ExecutionChangeType> =
  new Set<ExecutionChangeType>(['modified', 'created', 'deleted']);

const KNOWN_BADGES: ReadonlySet<ExecutionCapabilityBadge> =
  new Set<ExecutionCapabilityBadge>([
    'executable',
    'scripted-unverified',
    'manual',
    'validation',
    'ai-not-available',
    'unsupported-executor',
    'missing-metadata',
  ]);

const KNOWN_MODES: ReadonlySet<MigrationStepExecutionMode> =
  new Set<MigrationStepExecutionMode>(['scripted', 'ai', 'manual', 'validation']);

export function parseCapability(
  raw: ExecutionCapabilityRaw,
): ExecutionCapability {
  const executable = raw.executable === true;
  const badge: ExecutionCapabilityBadge =
    typeof raw.badge === 'string' && (KNOWN_BADGES as Set<string>).has(raw.badge)
      ? (raw.badge as ExecutionCapabilityBadge)
      : executable
        ? 'executable'
        : 'unsupported-executor';
  const mode =
    typeof raw.mode === 'string' && (KNOWN_MODES as Set<string>).has(raw.mode)
      ? (raw.mode as MigrationStepExecutionMode)
      : undefined;
  const executorKey =
    typeof raw.executorKey === 'string' && raw.executorKey.length > 0
      ? raw.executorKey
      : undefined;
  const missingRequirements =
    Array.isArray(raw.missingRequirements) && raw.missingRequirements.length > 0
      ? raw.missingRequirements.filter((s): s is string => typeof s === 'string')
      : undefined;
  return {
    planStepId: raw.planStepId,
    executable,
    badge,
    ...(mode !== undefined ? { mode } : {}),
    ...(executorKey !== undefined ? { executorKey } : {}),
    reason: raw.reason,
    ...(missingRequirements !== undefined && missingRequirements.length > 0
      ? { missingRequirements }
      : {}),
  };
}

export function parseStepRun(raw: ExecutionStepRunRaw): ExecutionStepRun {
  const status: ExecutionStepRun['status'] =
    raw.status === 'running'
      ? 'running'
      : raw.status === 'failed'
        ? 'failed'
        : 'completed';

  const mode: MigrationStepExecutionMode =
    typeof raw.mode === 'string' && (KNOWN_MODES as Set<string>).has(raw.mode)
      ? (raw.mode as MigrationStepExecutionMode)
      : 'scripted';

  return {
    id: raw.id,
    planId: raw.planId,
    planStepId: raw.planStepId,
    stepTitle: raw.stepTitle,
    workspacePath: raw.workspacePath,
    status,
    startedAt: raw.startedAt,
    ...(typeof raw.completedAt === 'string' && raw.completedAt.length > 0
      ? { completedAt: raw.completedAt }
      : {}),
    executorKey: typeof raw.executorKey === 'string' ? raw.executorKey : '',
    mode,
    changedFiles: raw.changedFiles.map(parseChangedFile),
    logs: raw.logs.map(parseLog),
    ...(raw.error !== undefined && raw.error !== null
      ? { error: parseError(raw.error) }
      : {}),
    ...(raw.requiresManualVerification === true
      ? { requiresManualVerification: true }
      : {}),
  };
}

function parseChangedFile(raw: ExecutionChangedFileRaw): ExecutionChangedFile {
  const changeType: ExecutionChangeType = (
    KNOWN_CHANGE_TYPES as Set<string>
  ).has(raw.changeType)
    ? (raw.changeType as ExecutionChangeType)
    : 'modified';
  return {
    path: raw.path,
    changeType,
    summary: raw.summary,
  };
}

function parseLog(raw: ExecutionLogEntryRaw): ExecutionLogEntry {
  const level: ExecutionLogLevel = (KNOWN_LEVELS as Set<string>).has(raw.level)
    ? (raw.level as ExecutionLogLevel)
    : 'info';
  return {
    timestamp: raw.timestamp,
    level,
    message: raw.message,
    ...(typeof raw.detail === 'string' && raw.detail.length > 0
      ? { detail: raw.detail }
      : {}),
  };
}

function parseError(raw: ExecutionErrorRaw): ExecutionError {
  return {
    code: raw.code,
    message: raw.message,
    ...(typeof raw.detail === 'string' && raw.detail.length > 0
      ? { detail: raw.detail }
      : {}),
  };
}

/**
 * Coerce a `MigrationStepExecution` into the wire shape consumed by the
 * Rust commands. We only forward known fields and never dispatch on the
 * params client-side — Rust is responsible for validating the params.
 */
function toExecutionRequest(execution: MigrationStepExecution): ExecutionRequestRaw {
  const out: {
    mode: string;
    executorKey?: string;
    params?: Record<string, unknown>;
  } = {
    mode: execution.mode,
  };
  if (execution.executorKey !== undefined) {
    out.executorKey = execution.executorKey;
  }
  if (execution.params !== undefined) {
    out.params = execution.params as Record<string, unknown>;
  }
  return out;
}
