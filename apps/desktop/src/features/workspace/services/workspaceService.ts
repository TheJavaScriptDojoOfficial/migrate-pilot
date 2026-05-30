/**
 * Workspace service.
 *
 * Single entry-point for talking to the Tauri workspace commands and
 * converting raw payloads into strongly-typed feature contracts.
 *
 * Architectural rules
 * -------------------
 * - No React imports. Pure logic so this module is trivially unit-testable
 *   and reusable by the future orchestrator layer.
 * - No filesystem access from JS. Path canonicalisation, Git invocation,
 *   and worktree creation all live in Rust.
 * - Throws typed `WorkspaceServiceError` so the calling hook can branch on
 *   the failure mode without parsing strings.
 */
import {
  invokeCommand,
  type WorkspaceCommandLogRaw,
  type WorkspaceCreationResultRaw,
  type WorkspaceIssueRaw,
  type WorkspacePreflightRaw,
} from '@shared/utils/commands';
import { runtimeConfig } from '@shared/config/runtime';

import type {
  GitCleanliness,
  WorkspaceCommandLog,
  WorkspaceCreationResult,
  WorkspaceIssue,
  WorkspaceIssueCode,
  WorkspaceIssueSeverity,
  WorkspacePreflight,
  WorkspaceStrategy,
} from '../types/workspace.types';

/* -------------------------------------------------------------------------- */
/* Error type                                                                 */
/* -------------------------------------------------------------------------- */

export type WorkspaceServiceErrorKind =
  | 'tauri-unavailable'
  | 'invalid-input'
  | 'preflight-failed'
  | 'creation-failed';

export class WorkspaceServiceError extends Error {
  public readonly kind: WorkspaceServiceErrorKind;
  public readonly detail?: string;

  public constructor(
    kind: WorkspaceServiceErrorKind,
    message: string,
    detail?: string,
  ) {
    super(message);
    this.name = 'WorkspaceServiceError';
    this.kind = kind;
    if (detail !== undefined) {
      this.detail = detail;
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

export interface RunPreflightInput {
  readonly sourcePath: string;
  readonly projectName: string;
}

export async function runWorkspacePreflight(
  input: RunPreflightInput,
): Promise<WorkspacePreflight> {
  if (!runtimeConfig.isTauri) {
    throw new WorkspaceServiceError(
      'tauri-unavailable',
      'Workspace creation is only available inside the Migrate Pilot desktop shell. Run `npm run tauri:dev`.',
    );
  }

  let raw: WorkspacePreflightRaw;
  try {
    raw = await invokeCommand('workspace_preflight', {
      sourcePath: input.sourcePath,
      projectName: input.projectName,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/empty|invalid|not accessible|not a directory/i.test(message)) {
      throw new WorkspaceServiceError('invalid-input', message);
    }
    throw new WorkspaceServiceError('preflight-failed', message);
  }

  return parsePreflight(raw);
}

export interface CreateWorkspaceInput {
  readonly sourcePath: string;
  readonly workspacePath: string;
  readonly branchName: string;
  readonly strategy: WorkspaceStrategy;
}

export async function createWorkspace(
  input: CreateWorkspaceInput,
): Promise<WorkspaceCreationResult> {
  if (!runtimeConfig.isTauri) {
    throw new WorkspaceServiceError(
      'tauri-unavailable',
      'Workspace creation is only available inside the Migrate Pilot desktop shell. Run `npm run tauri:dev`.',
    );
  }

  let raw: WorkspaceCreationResultRaw;
  try {
    raw = await invokeCommand('workspace_create', {
      sourcePath: input.sourcePath,
      workspacePath: input.workspacePath,
      branchName: input.branchName,
      strategy: input.strategy,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/invalid|empty|already exists|inside the source|invalid characters/i.test(message)) {
      throw new WorkspaceServiceError('invalid-input', message);
    }
    throw new WorkspaceServiceError('creation-failed', message);
  }

  return parseCreationResult(raw);
}

/* -------------------------------------------------------------------------- */
/* Pure converters (exported for unit tests)                                  */
/* -------------------------------------------------------------------------- */

const KNOWN_CODES: ReadonlySet<WorkspaceIssueCode> = new Set<WorkspaceIssueCode>([
  'GIT_NOT_AVAILABLE',
  'NOT_A_GIT_REPOSITORY',
  'GIT_DIRTY',
  'GIT_CLEANLINESS_UNKNOWN',
  'BRANCH_EXISTS',
  'WORKSPACE_PATH_EXISTS',
  'WORKSPACE_INSIDE_SOURCE',
  'COPY_FALLBACK_DISABLED',
  'TAURI_UNAVAILABLE',
  'UNKNOWN',
]);

const KNOWN_SEVERITIES: ReadonlySet<WorkspaceIssueSeverity> =
  new Set<WorkspaceIssueSeverity>(['blocker', 'warning', 'info']);

export function parsePreflight(raw: WorkspacePreflightRaw): WorkspacePreflight {
  const blockers = raw.blockers.map(parseIssue);
  const warnings = raw.warnings.map(parseIssue);

  const cleanliness = parseCleanliness(raw.gitCleanliness);
  const strategy = parseStrategy(raw.recommendedStrategy);

  return {
    sourcePath: raw.sourcePath,
    projectName: raw.projectName,
    isGitRepository: raw.isGitRepository,
    gitAvailable: raw.gitAvailable,
    ...(typeof raw.currentBranch === 'string' && raw.currentBranch.length > 0
      ? { currentBranch: raw.currentBranch }
      : {}),
    gitCleanliness: cleanliness,
    recommendedStrategy: strategy,
    fallbackAvailable: raw.fallbackAvailable,
    proposedBranchName: raw.proposedBranchName,
    proposedWorkspacePath: raw.proposedWorkspacePath,
    blockers,
    warnings,
  };
}

export function parseCreationResult(
  raw: WorkspaceCreationResultRaw,
): WorkspaceCreationResult {
  return {
    id: raw.id,
    sourcePath: raw.sourcePath,
    workspacePath: raw.workspacePath,
    strategy: parseStrategy(raw.strategy),
    ...(typeof raw.branchName === 'string' && raw.branchName.length > 0
      ? { branchName: raw.branchName }
      : {}),
    createdAt: raw.createdAt,
    commandLogs: raw.commandLogs.map(parseCommandLog),
  };
}

function parseIssue(raw: WorkspaceIssueRaw): WorkspaceIssue {
  const code: WorkspaceIssueCode = (KNOWN_CODES as Set<string>).has(raw.code)
    ? (raw.code as WorkspaceIssueCode)
    : 'UNKNOWN';
  const severity: WorkspaceIssueSeverity = (
    KNOWN_SEVERITIES as Set<string>
  ).has(raw.severity)
    ? (raw.severity as WorkspaceIssueSeverity)
    : 'info';
  return {
    code,
    severity,
    message: raw.message,
    ...(raw.detail !== undefined && raw.detail.length > 0
      ? { detail: raw.detail }
      : {}),
  };
}

function parseCleanliness(value: string): GitCleanliness {
  if (value === 'clean' || value === 'dirty' || value === 'unknown') {
    return value;
  }
  return 'unknown';
}

function parseStrategy(value: string): WorkspaceStrategy {
  return value === 'copy' ? 'copy' : 'git-worktree';
}

function parseCommandLog(raw: WorkspaceCommandLogRaw): WorkspaceCommandLog {
  return {
    command: raw.command,
    status: raw.status === 'failed' ? 'failed' : 'passed',
    ...(typeof raw.stdout === 'string' && raw.stdout.length > 0
      ? { stdout: raw.stdout }
      : {}),
    ...(typeof raw.stderr === 'string' && raw.stderr.length > 0
      ? { stderr: raw.stderr }
      : {}),
  };
}
