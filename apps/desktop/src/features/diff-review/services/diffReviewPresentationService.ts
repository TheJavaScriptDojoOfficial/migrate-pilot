/**
 * Diff review presentation service.
 *
 * Centralises the visual mappings used across diff-review components.
 * Keeps components free of magic strings and forces every visual contract
 * to stay in sync via exhaustive `Record` types.
 */
import type { BadgeTone } from '@shared/ui/Badge';
import type { IconName } from '@shared/ui/Icon';
import type { StatusKind } from '@shared/ui/StatusIndicator';

import type {
  DiffFileStatus,
  DiffReviewStatus,
} from '../types/diffReview.types';

/* -------------------------------------------------------------------------- */
/* Diff review status                                                         */
/* -------------------------------------------------------------------------- */

export const REVIEW_STATUS_KIND: Record<DiffReviewStatus, StatusKind> = {
  blocked: 'idle',
  idle: 'idle',
  loading: 'running',
  ready: 'pending',
  approving: 'running',
  approved: 'success',
  rejecting: 'running',
  rejected: 'error',
  failed: 'error',
};

export const REVIEW_STATUS_LABEL: Record<DiffReviewStatus, string> = {
  blocked: 'Blocked',
  idle: 'Awaiting load',
  loading: 'Loading diff',
  ready: 'Awaiting decision',
  approving: 'Recording approval',
  approved: 'Approved',
  rejecting: 'Reverting changes',
  rejected: 'Rejected',
  failed: 'Failed',
};

/* -------------------------------------------------------------------------- */
/* Per-file status                                                            */
/* -------------------------------------------------------------------------- */

export const FILE_STATUS_TONE: Record<DiffFileStatus, BadgeTone> = {
  modified: 'info',
  created: 'success',
  deleted: 'danger',
  renamed: 'warning',
  unknown: 'neutral',
};

export const FILE_STATUS_LABEL: Record<DiffFileStatus, string> = {
  modified: 'Modified',
  created: 'Created',
  deleted: 'Deleted',
  renamed: 'Renamed',
  unknown: 'Unknown',
};

export const FILE_STATUS_ICON: Record<DiffFileStatus, IconName> = {
  modified: 'diff',
  created: 'check',
  deleted: 'cross',
  renamed: 'arrow-right',
  unknown: 'help',
};

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Format an ISO timestamp for compact rendering. Falls back to the raw
 * string when parsing fails so the UI never silently swallows data.
 */
export function formatReviewTimestamp(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleString();
}

/**
 * Classify a single line of unified diff text for syntax highlighting.
 * Header lines (`diff --git`, `index `, `---`, `+++`, `@@`) are kept as
 * `header`; everything else is `addition` / `deletion` / `context`.
 */
export type DiffLineKind = 'header' | 'hunk' | 'addition' | 'deletion' | 'context';

export function classifyDiffLine(line: string): DiffLineKind {
  if (line.startsWith('diff --git ')) return 'header';
  if (line.startsWith('index ')) return 'header';
  if (line.startsWith('--- ')) return 'header';
  if (line.startsWith('+++ ')) return 'header';
  if (line.startsWith('@@')) return 'hunk';
  if (line.startsWith('+')) return 'addition';
  if (line.startsWith('-')) return 'deletion';
  return 'context';
}
