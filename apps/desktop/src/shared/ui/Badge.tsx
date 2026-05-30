import type { HTMLAttributes, PropsWithChildren } from 'react';

import { cn } from '@shared/utils/cn';

export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'accent';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: 'bg-canvas-raised text-ink-muted border-canvas-border',
  info: 'bg-info/10 text-info border-info/30',
  success: 'bg-success/10 text-success border-success/30',
  warning: 'bg-warning/10 text-warning border-warning/30',
  danger: 'bg-danger/10 text-danger border-danger/30',
  accent: 'bg-accent/10 text-accent border-accent/30',
};

export function Badge({
  tone = 'neutral',
  className,
  children,
  ...rest
}: PropsWithChildren<BadgeProps>): JSX.Element {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-1.5 py-0.5 text-2xs font-medium uppercase tracking-wider',
        TONE_CLASSES[tone],
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
