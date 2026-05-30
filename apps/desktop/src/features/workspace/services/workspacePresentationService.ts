/**
 * Workspace presentation service.
 *
 * Centralises the visual mappings used across workspace components. Keeps
 * components free of magic strings and forces every visual contract to
 * stay in sync via exhaustive `Record` types.
 */
import type { BadgeTone } from '@shared/ui/Badge';
import type { IconName } from '@shared/ui/Icon';
import type { StatusKind } from '@shared/ui/StatusIndicator';

import type {
  GitCleanliness,
  WorkspaceIssueSeverity,
  WorkspaceStatus,
  WorkspaceStrategy,
} from '../types/workspace.types';

/* -------------------------------------------------------------------------- */
/* Status                                                                     */
/* -------------------------------------------------------------------------- */

export const STATUS_KIND: Record<WorkspaceStatus, StatusKind> = {
  blocked: 'idle',
  idle: 'idle',
  checking: 'running',
  ready: 'pending',
  creating: 'running',
  created: 'success',
  failed: 'error',
};

export const STATUS_LABEL: Record<WorkspaceStatus, string> = {
  blocked: 'Plan approval required',
  idle: 'Awaiting preflight',
  checking: 'Running preflight',
  ready: 'Ready to create',
  creating: 'Creating workspace',
  created: 'Workspace ready',
  failed: 'Action failed',
};

/* -------------------------------------------------------------------------- */
/* Strategy                                                                   */
/* -------------------------------------------------------------------------- */

export const STRATEGY_LABEL: Record<WorkspaceStrategy, string> = {
  'git-worktree': 'Git worktree',
  copy: 'Copy fallback',
};

export const STRATEGY_DESCRIPTION: Record<WorkspaceStrategy, string> = {
  'git-worktree':
    'A new Git branch and worktree will be created. The original project stays read-only — every edit is isolated.',
  copy:
    'A read-only file copy of the project would be staged outside the source folder. The copy strategy is not enabled in V1.',
};

export const STRATEGY_ICON: Record<WorkspaceStrategy, IconName> = {
  'git-worktree': 'git-branch',
  copy: 'folder',
};

export const STRATEGY_TONE: Record<WorkspaceStrategy, BadgeTone> = {
  'git-worktree': 'success',
  copy: 'warning',
};

/* -------------------------------------------------------------------------- */
/* Issue severity                                                             */
/* -------------------------------------------------------------------------- */

export const ISSUE_TONE: Record<WorkspaceIssueSeverity, BadgeTone> = {
  blocker: 'danger',
  warning: 'warning',
  info: 'info',
};

export const ISSUE_LABEL: Record<WorkspaceIssueSeverity, string> = {
  blocker: 'Blocker',
  warning: 'Warning',
  info: 'Info',
};

export const ISSUE_ICON: Record<WorkspaceIssueSeverity, IconName> = {
  blocker: 'cross',
  warning: 'help',
  info: 'sparkles',
};

/* -------------------------------------------------------------------------- */
/* Cleanliness                                                                */
/* -------------------------------------------------------------------------- */

export const CLEANLINESS_LABEL: Record<GitCleanliness, string> = {
  clean: 'Working tree clean',
  dirty: 'Uncommitted changes',
  unknown: 'Cleanliness unknown',
};

export const CLEANLINESS_TONE: Record<GitCleanliness, BadgeTone> = {
  clean: 'success',
  dirty: 'danger',
  unknown: 'warning',
};
