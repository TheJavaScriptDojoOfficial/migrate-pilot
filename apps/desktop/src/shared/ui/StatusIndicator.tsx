import type { HTMLAttributes } from 'react';

import { cn } from '@shared/utils/cn';

export type StatusKind = 'idle' | 'pending' | 'running' | 'success' | 'warning' | 'error';

export interface StatusIndicatorProps extends HTMLAttributes<HTMLSpanElement> {
  status: StatusKind;
  label?: string;
}

const DOT_CLASSES: Record<StatusKind, string> = {
  idle: 'bg-ink-subtle',
  pending: 'bg-ink-muted',
  running: 'bg-info animate-pulse',
  success: 'bg-success',
  warning: 'bg-warning',
  error: 'bg-danger',
};

const TEXT_CLASSES: Record<StatusKind, string> = {
  idle: 'text-ink-subtle',
  pending: 'text-ink-muted',
  running: 'text-info',
  success: 'text-success',
  warning: 'text-warning',
  error: 'text-danger',
};

export function StatusIndicator({
  status,
  label,
  className,
  ...rest
}: StatusIndicatorProps): JSX.Element {
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 text-xs', TEXT_CLASSES[status], className)}
      {...rest}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', DOT_CLASSES[status])} aria-hidden />
      {label}
    </span>
  );
}
