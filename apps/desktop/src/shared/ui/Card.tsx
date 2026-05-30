import type { HTMLAttributes, PropsWithChildren } from 'react';

import { cn } from '@shared/utils/cn';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padded?: boolean;
}

export function Card({
  className,
  padded = true,
  children,
  ...rest
}: PropsWithChildren<CardProps>): JSX.Element {
  return (
    <div
      className={cn(
        'rounded-lg border border-canvas-border bg-canvas-raised shadow-panel',
        padded && 'p-4',
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
    <div
      className={cn('mb-3 flex items-start justify-between gap-3', className)}
      {...rest}
    >
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
    <h3 className={cn('text-sm font-semibold tracking-tight text-ink', className)} {...rest}>
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
    <p className={cn('text-xs text-ink-muted', className)} {...rest}>
      {children}
    </p>
  );
}
