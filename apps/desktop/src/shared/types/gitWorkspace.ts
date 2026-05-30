export type WorkspaceStatus =
  | 'pending'
  | 'creating'
  | 'ready'
  | 'failed'
  | 'cleaning_up'
  | 'removed';

export interface GitWorkspace {
  readonly id: string;
  readonly sessionId: string;
  readonly projectId: string;
  /** Absolute path to the Git worktree. */
  readonly path: string;
  readonly branchName: string;
  /** Commit SHA the worktree was created from. */
  readonly baseCommitSha?: string;
  readonly status: WorkspaceStatus;
  readonly createdAt: string;
  readonly removedAt?: string;
}
