/**
 * Execution presentation service.
 *
 * Centralises the visual mappings used across execution components. Keeps
 * components free of magic strings and forces every visual contract to
 * stay in sync via exhaustive `Record` types.
 */
import type { BadgeTone } from '@shared/ui/Badge';
import type { IconName } from '@shared/ui/Icon';
import type { StatusKind } from '@shared/ui/StatusIndicator';

import type {
  ExecutionChangeType,
  ExecutionLogLevel,
  ExecutionStatus,
  ExecutionStepStatus,
} from '../types/execution.types';

/* -------------------------------------------------------------------------- */
/* Engine status                                                              */
/* -------------------------------------------------------------------------- */

export const ENGINE_STATUS_KIND: Record<ExecutionStatus, StatusKind> = {
  blocked: 'idle',
  idle: 'idle',
  ready: 'pending',
  running: 'running',
  completed: 'success',
  failed: 'error',
};

export const ENGINE_STATUS_LABEL: Record<ExecutionStatus, string> = {
  blocked: 'Blocked',
  idle: 'Awaiting selection',
  ready: 'Ready to run',
  running: 'Running step',
  completed: 'Step completed',
  failed: 'Step failed',
};

/* -------------------------------------------------------------------------- */
/* Per-step status                                                            */
/* -------------------------------------------------------------------------- */

export const STEP_STATUS_TONE: Record<ExecutionStepStatus, BadgeTone> = {
  pending: 'neutral',
  running: 'info',
  completed: 'success',
  failed: 'danger',
  unsupported: 'warning',
  skipped: 'neutral',
};

export const STEP_STATUS_LABEL: Record<ExecutionStepStatus, string> = {
  pending: 'Pending',
  running: 'Running',
  completed: 'Completed',
  failed: 'Failed',
  unsupported: 'Unsupported',
  skipped: 'Skipped',
};

export const STEP_STATUS_ICON: Record<ExecutionStepStatus, IconName> = {
  pending: 'dot',
  running: 'play',
  completed: 'check-circle',
  failed: 'cross',
  unsupported: 'lock',
  skipped: 'arrow-right',
};

/* -------------------------------------------------------------------------- */
/* Log level                                                                  */
/* -------------------------------------------------------------------------- */

export const LOG_LEVEL_TONE: Record<ExecutionLogLevel, BadgeTone> = {
  info: 'info',
  warning: 'warning',
  error: 'danger',
  success: 'success',
};

export const LOG_LEVEL_LABEL: Record<ExecutionLogLevel, string> = {
  info: 'INFO',
  warning: 'WARN',
  error: 'ERROR',
  success: 'OK',
};

/* -------------------------------------------------------------------------- */
/* Changed file                                                               */
/* -------------------------------------------------------------------------- */

export const CHANGE_TYPE_TONE: Record<ExecutionChangeType, BadgeTone> = {
  modified: 'info',
  created: 'success',
  deleted: 'danger',
};

export const CHANGE_TYPE_LABEL: Record<ExecutionChangeType, string> = {
  modified: 'Modified',
  created: 'Created',
  deleted: 'Deleted',
};

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Format an ISO timestamp for compact log rendering. Falls back to the
 * raw string when parsing fails so the UI never silently swallows data.
 */
export function formatLogTimestamp(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  const hh = String(parsed.getHours()).padStart(2, '0');
  const mm = String(parsed.getMinutes()).padStart(2, '0');
  const ss = String(parsed.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}
