import type { HTMLAttributes } from 'react';

import { cn } from '@shared/utils/cn';

/**
 * StatusIndicator — labelled dot used for streamed states.
 *
 * Pairs a tone-colored dot with an optional label. The `running` state
 * animates with `pulse-soft` to communicate liveness without flashing.
 */
export type StatusKind = 'idle' | 'pending' | 'running' | 'success' | 'warning' | 'error';

export interface StatusIndicatorProps extends HTMLAttributes<HTMLSpanElement> {
  status: StatusKind;
  label?: string;
  /** Larger pill-style chip presentation (used in headers / toolbars). */
  variant?: 'inline' | 'chip';
}

const DOT_CLASSES: Record<StatusKind, string> = {
  idle: 'bg-ink-subtle',
  pending: 'bg-ink-faint ring-2 ring-canvas-border',
  running: 'bg-info animate-pulse-soft shadow-[0_0_0_3px_rgba(88,166,255,0.18)]',
  success: 'bg-success',
  warning: 'bg-warning',
  error: 'bg-danger',
};

const TEXT_CLASSES: Record<StatusKind, string> = {
  idle: 'text-ink-subtle',
  pending: 'text-ink-faint',
  running: 'text-info',
  success: 'text-success',
  warning: 'text-warning',
  error: 'text-danger',
};

const CHIP_CLASSES: Record<StatusKind, string> = {
  idle: 'bg-canvas-overlay border-canvas-border-strong text-ink-muted',
  pending: 'bg-canvas-overlay border-canvas-border-strong text-ink-muted',
  running: 'bg-info-soft border-info/30 text-info',
  success: 'bg-success-soft border-success/30 text-success',
  warning: 'bg-warning-soft border-warning/30 text-warning',
  error: 'bg-danger-soft border-danger/30 text-danger',
};

export function StatusIndicator({
  status,
  label,
  variant = 'inline',
  className,
  ...rest
}: StatusIndicatorProps): JSX.Element {
  if (variant === 'chip') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-xs border px-2 py-0.5 text-2xs font-medium uppercase tracking-[0.08em]',
          CHIP_CLASSES[status],
          className,
        )}
        {...rest}
      >
        <span className={cn('h-1.5 w-1.5 rounded-full', DOT_CLASSES[status])} aria-hidden />
        {label ?? status}
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-xs',
        TEXT_CLASSES[status],
        className,
      )}
      {...rest}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', DOT_CLASSES[status])} aria-hidden />
      {label}
    </span>
  );
}
