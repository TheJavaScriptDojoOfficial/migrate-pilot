/**
 * Diff review service.
 *
 * Single entry-point for talking to the Tauri diff commands and converting
 * raw payloads into strongly-typed feature contracts.
 *
 * Architectural rules
 * -------------------
 * - No React imports. Pure logic so this module is trivially unit-testable
 *   and reusable by the future orchestrator layer.
 * - No filesystem access from JS. Every Git invocation, path
 *   canonicalisation, and revert lives in Rust.
 * - Throws typed `DiffReviewServiceError` so the calling hook can branch
 *   on the failure mode without parsing strings.
 */
import {
  invokeCommand,
  type DiffCommandLogRaw,
  type DiffFileRaw,
  type DiffReviewDecisionRaw,
  type DiffReviewRaw,
} from '@shared/utils/commands';
import { runtimeConfig } from '@shared/config/runtime';

import type {
  DiffCommandLog,
  DiffFile,
  DiffFileStatus,
  DiffReviewDecision,
  DiffReviewSession,
} from '../types/diffReview.types';

/* -------------------------------------------------------------------------- */
/* Error type                                                                 */
/* -------------------------------------------------------------------------- */

export type DiffReviewServiceErrorKind =
  | 'tauri-unavailable'
  | 'invalid-input'
  | 'path-not-allowed'
  | 'load-failed'
  | 'approve-failed'
  | 'reject-failed';

export class DiffReviewServiceError extends Error {
  public readonly kind: DiffReviewServiceErrorKind;
  public readonly detail?: string;

  public constructor(
    kind: DiffReviewServiceErrorKind,
    message: string,
    detail?: string,
  ) {
    super(message);
    this.name = 'DiffReviewServiceError';
    this.kind = kind;
    if (detail !== undefined) {
      this.detail = detail;
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

export interface LoadDiffInput {
  readonly workspacePath: string;
  readonly sourcePath: string;
  readonly executionRunId: string;
  readonly planId: string;
  readonly planStepId: string;
  readonly stepTitle?: string;
  readonly changedFiles: readonly string[];
}

export async function loadDiffReview(
  input: LoadDiffInput,
): Promise<DiffReviewSession> {
  if (!runtimeConfig.isTauri) {
    throw new DiffReviewServiceError(
      'tauri-unavailable',
      'Diff review is only available inside the Migrate Pilot desktop shell. Run `npm run tauri:dev`.',
    );
  }

  let raw: DiffReviewRaw;
  try {
    raw = await invokeCommand('diff_load', {
      workspacePath: input.workspacePath,
      sourcePath: input.sourcePath,
      executionRunId: input.executionRunId,
      planId: input.planId,
      planStepId: input.planStepId,
      changedFiles: input.changedFiles,
    });
  } catch (err) {
    throw mapInvocationError(err, 'load-failed');
  }

  return parseDiffReviewSession(raw, input.stepTitle);
}

export interface ApproveDiffInput {
  readonly workspacePath: string;
  readonly executionRunId: string;
  readonly planId: string;
  readonly planStepId: string;
}

export async function approveDiffReview(
  input: ApproveDiffInput,
): Promise<DiffReviewDecision> {
  if (!runtimeConfig.isTauri) {
    throw new DiffReviewServiceError(
      'tauri-unavailable',
      'Diff review is only available inside the Migrate Pilot desktop shell. Run `npm run tauri:dev`.',
    );
  }

  let raw: DiffReviewDecisionRaw;
  try {
    raw = await invokeCommand('diff_approve', {
      workspacePath: input.workspacePath,
      executionRunId: input.executionRunId,
      planId: input.planId,
      planStepId: input.planStepId,
    });
  } catch (err) {
    throw mapInvocationError(err, 'approve-failed');
  }

  return parseDiffReviewDecision(raw);
}

export interface RejectDiffInput {
  readonly workspacePath: string;
  readonly sourcePath: string;
  readonly executionRunId: string;
  readonly planId: string;
  readonly planStepId: string;
  readonly changedFiles: readonly string[];
}

export async function rejectDiffReview(
  input: RejectDiffInput,
): Promise<DiffReviewDecision> {
  if (!runtimeConfig.isTauri) {
    throw new DiffReviewServiceError(
      'tauri-unavailable',
      'Diff review is only available inside the Migrate Pilot desktop shell. Run `npm run tauri:dev`.',
    );
  }

  let raw: DiffReviewDecisionRaw;
  try {
    raw = await invokeCommand('diff_reject', {
      workspacePath: input.workspacePath,
      sourcePath: input.sourcePath,
      executionRunId: input.executionRunId,
      planId: input.planId,
      planStepId: input.planStepId,
      changedFiles: input.changedFiles,
    });
  } catch (err) {
    throw mapInvocationError(err, 'reject-failed');
  }

  return parseDiffReviewDecision(raw);
}

/* -------------------------------------------------------------------------- */
/* Pure converters (exported for unit tests)                                  */
/* -------------------------------------------------------------------------- */

const KNOWN_FILE_STATUSES: ReadonlySet<DiffFileStatus> = new Set<DiffFileStatus>([
  'modified',
  'created',
  'deleted',
  'renamed',
  'unknown',
]);

export function parseDiffReviewSession(
  raw: DiffReviewRaw,
  stepTitle?: string,
): DiffReviewSession {
  const files = raw.files.map(parseDiffFile);
  const totalAdditions = files.reduce((acc, f) => acc + f.additions, 0);
  const totalDeletions = files.reduce((acc, f) => acc + f.deletions, 0);
  const selectedFilePath = files[0]?.path;

  return {
    id: `diff-review:${raw.executionRunId}:${raw.loadedAt}`,
    executionRunId: raw.executionRunId,
    planId: raw.planId,
    planStepId: raw.planStepId,
    ...(stepTitle !== undefined ? { stepTitle } : {}),
    workspacePath: raw.workspacePath,
    ...(typeof raw.branchName === 'string' && raw.branchName.length > 0
      ? { branchName: raw.branchName }
      : {}),
    status: 'ready',
    files,
    ...(selectedFilePath !== undefined ? { selectedFilePath } : {}),
    loadedAt: raw.loadedAt,
    commandLogs: raw.commandLogs.map(parseCommandLog),
    totalAdditions,
    totalDeletions,
  };
}

export function parseDiffFile(raw: DiffFileRaw): DiffFile {
  const status: DiffFileStatus = (KNOWN_FILE_STATUSES as Set<string>).has(raw.status)
    ? (raw.status as DiffFileStatus)
    : 'unknown';
  return {
    path: raw.path,
    status,
    additions: Math.max(0, Math.floor(raw.additions)),
    deletions: Math.max(0, Math.floor(raw.deletions)),
    diffText: raw.diffText,
    ...(raw.isBinary === true ? { isBinary: true } : {}),
    ...(raw.tooLarge === true ? { tooLarge: true } : {}),
  };
}

export function parseDiffReviewDecision(
  raw: DiffReviewDecisionRaw,
): DiffReviewDecision {
  const type: DiffReviewDecision['type'] =
    raw.decision === 'rejected' ? 'rejected' : 'approved';
  return {
    type,
    decidedAt: raw.decidedAt,
    ...(type === 'rejected'
      ? {
          revertedFiles: raw.revertedFiles,
          manualCleanupFiles: raw.manualCleanupFiles,
        }
      : {}),
  };
}

export function parseCommandLog(raw: DiffCommandLogRaw): DiffCommandLog {
  const status: DiffCommandLog['status'] =
    raw.status === 'failed' ? 'failed' : 'passed';
  return {
    command: raw.command,
    status,
    ...(typeof raw.stdout === 'string' && raw.stdout.length > 0
      ? { stdout: raw.stdout }
      : {}),
    ...(typeof raw.stderr === 'string' && raw.stderr.length > 0
      ? { stderr: raw.stderr }
      : {}),
  };
}

/* -------------------------------------------------------------------------- */
/* Internal helpers                                                           */
/* -------------------------------------------------------------------------- */

function mapInvocationError(
  err: unknown,
  fallback: DiffReviewServiceErrorKind,
): DiffReviewServiceError {
  const message = err instanceof Error ? err.message : String(err);
  if (/path not allowed|inside the source|inside the workspace|outside the workspace|must be relative|may not contain/i.test(
    message,
  )) {
    return new DiffReviewServiceError('path-not-allowed', message);
  }
  if (
    /empty|invalid|not accessible|not a directory|nul byte|too many|max [0-9]/i.test(
      message,
    )
  ) {
    return new DiffReviewServiceError('invalid-input', message);
  }
  return new DiffReviewServiceError(fallback, message);
}
