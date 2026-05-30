import type { HTMLAttributes, PropsWithChildren, ReactNode } from 'react';

import { cn } from '@shared/utils/cn';

/**
 * Card — Level-1 surface per DESIGN.md.
 *
 * Always pairs the raised surface color with a 1px hairline border. No
 * box-shadow by default (depth is conveyed via tonal contrast, not bloom).
 * Set `tone="overlay"` to switch to the Level-2 surface used by tooltips
 * and modals.
 */
export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padded?: boolean;
  tone?: 'raised' | 'overlay' | 'subtle';
  /** Optional accent left-border for emphasis (selected/active card). */
  accent?: boolean;
  interactive?: boolean;
}

const TONE_CLASSES: Record<NonNullable<CardProps['tone']>, string> = {
  raised: 'bg-canvas-raised border-canvas-border',
  overlay: 'bg-canvas-overlay border-canvas-border-strong shadow-overlay',
  subtle: 'bg-canvas-subtle-2 border-canvas-border',
};

export function Card({
  className,
  padded = true,
  tone = 'raised',
  accent,
  interactive,
  children,
  ...rest
}: PropsWithChildren<CardProps>): JSX.Element {
  return (
    <div
      className={cn(
        'relative rounded-md border',
        TONE_CLASSES[tone],
        padded && 'p-5',
        accent &&
          'before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-r-md before:bg-accent',
        interactive &&
          'transition-colors duration-150 hover:border-canvas-border-strong hover:bg-canvas-overlay',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  className,
  children,
  ...rest
}: PropsWithChildren<HTMLAttributes<HTMLDivElement>>): JSX.Element {
  return (
    <div className={cn('mb-4 flex items-start justify-between gap-3', className)} {...rest}>
      {children}
    </div>
  );
}

export function CardTitle({
  className,
  children,
  ...rest
}: PropsWithChildren<HTMLAttributes<HTMLHeadingElement>>): JSX.Element {
  return (
    <h3
      className={cn('text-sm font-semibold tracking-tight text-ink', className)}
      {...rest}
    >
      {children}
    </h3>
  );
}

export function CardDescription({
  className,
  children,
  ...rest
}: PropsWithChildren<HTMLAttributes<HTMLParagraphElement>>): JSX.Element {
  return (
    <p className={cn('mt-1 text-xs leading-relaxed text-ink-muted', className)} {...rest}>
      {children}
    </p>
  );
}

export interface CardSectionProps extends HTMLAttributes<HTMLDivElement> {
  label?: string;
  trailing?: ReactNode;
}

/** Optional sub-section divider within a card body. */
export function CardSection({
  label,
  trailing,
  className,
  children,
  ...rest
}: PropsWithChildren<CardSectionProps>): JSX.Element {
  return (
    <div
      className={cn(
        'border-t border-canvas-border pt-4 first:border-t-0 first:pt-0 [&+&]:mt-4',
        className,
      )}
      {...rest}
    >
      {label ? (
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-2xs font-medium uppercase tracking-[0.14em] text-ink-subtle">
            {label}
          </p>
          {trailing}
        </div>
      ) : null}
      {children}
    </div>
  );
}
