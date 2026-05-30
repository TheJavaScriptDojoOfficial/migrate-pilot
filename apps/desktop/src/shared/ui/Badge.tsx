import type { HTMLAttributes, PropsWithChildren } from 'react';

import { cn } from '@shared/utils/cn';

/**
 * Badge / Chip — DESIGN.md "Chips/Tags".
 *
 * Uses a 4px (`rounded-xs`) radius and a desaturated tinted background per
 * the design spec. The `variant="solid"` variant is reserved for primary
 * key-value emphasis (e.g. step number indicator).
 */
export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'accent';
export type BadgeVariant = 'soft' | 'solid' | 'outline';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  variant?: BadgeVariant;
  /** Show a small leading dot in the tone color. */
  withDot?: boolean;
  /** Render with uppercase, wider tracking — for category labels. */
  uppercase?: boolean;
}

const SOFT: Record<BadgeTone, string> = {
  neutral: 'bg-canvas-overlay text-ink-muted border-canvas-border-strong',
  info: 'bg-info-soft text-info border-info/30',
  success: 'bg-success-soft text-success border-success/30',
  warning: 'bg-warning-soft text-warning border-warning/30',
  danger: 'bg-danger-soft text-danger border-danger/30',
  accent: 'bg-accent/10 text-accent border-accent/30',
};

const SOLID: Record<BadgeTone, string> = {
  neutral: 'bg-canvas-bright text-ink border-transparent',
  info: 'bg-info text-ink-inverse border-transparent',
  success: 'bg-success text-ink-inverse border-transparent',
  warning: 'bg-warning text-ink-inverse border-transparent',
  danger: 'bg-danger text-white border-transparent',
  accent: 'bg-accent text-ink-inverse border-transparent',
};

const OUTLINE: Record<BadgeTone, string> = {
  neutral: 'bg-transparent text-ink-muted border-canvas-border-strong',
  info: 'bg-transparent text-info border-info/50',
  success: 'bg-transparent text-success border-success/50',
  warning: 'bg-transparent text-warning border-warning/50',
  danger: 'bg-transparent text-danger border-danger/50',
  accent: 'bg-transparent text-accent border-accent/50',
};

const DOT: Record<BadgeTone, string> = {
  neutral: 'bg-ink-subtle',
  info: 'bg-info',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  accent: 'bg-accent',
};

export function Badge({
  tone = 'neutral',
  variant = 'soft',
  withDot,
  uppercase,
  className,
  children,
  ...rest
}: PropsWithChildren<BadgeProps>): JSX.Element {
  const variantClasses =
    variant === 'solid' ? SOLID[tone] : variant === 'outline' ? OUTLINE[tone] : SOFT[tone];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-xs border px-1.5 py-0.5 text-2xs font-medium',
        uppercase && 'uppercase tracking-[0.08em]',
        variantClasses,
        className,
      )}
      {...rest}
    >
      {withDot ? (
        <span className={cn('h-1.5 w-1.5 rounded-full', DOT[tone])} aria-hidden />
      ) : null}
      {children}
    </span>
  );
}
