import type { SessionState } from '@shared/constants/sessionStates';

/**
 * One migration attempt for a single Project.
 * The session owns its plan, steps, workspace, and persistent event log.
 */
export interface MigrationSession {
  readonly id: string;
  readonly projectId: string;
  readonly state: SessionState;
  /** Optional human-friendly label. */
  readonly label?: string;
  /** Workspace branch name (e.g. "migration/react-ts/session-001"). */
  readonly branchName?: string;
  /** Absolute path to the Git worktree workspace. */
  readonly workspacePath?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly completedAt?: string;
}
