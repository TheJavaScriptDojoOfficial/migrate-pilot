import type { ReactNode } from 'react';

import { Icon, type IconName } from '@shared/ui/Icon';
import { cn } from '@shared/utils/cn';

/**
 * EmptyState — placeholder for views with no data yet.
 *
 * Uses the dotted-grid texture utility (`.bg-grid`) so empty regions read
 * as "intentionally empty" rather than broken. Pair with an action button
 * that gets the user to the next obvious step.
 */
export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: IconName;
  className?: string;
  /** Render at full width inside the parent rather than a max-w-sm pill. */
  fullWidth?: boolean;
}

export function EmptyState({
  title,
  description,
  action,
  icon = 'sparkles',
  fullWidth,
  className,
}: EmptyStateProps): JSX.Element {
  return (
    <div
      className={cn(
        'bg-grid flex flex-col items-center gap-3 rounded-md border border-dashed border-canvas-border-strong bg-canvas-subtle-2/40 px-8 py-12 text-center',
        fullWidth ? 'w-full' : 'mx-auto max-w-md',
        className,
      )}
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-md border border-canvas-border bg-canvas-overlay text-ink-subtle">
        <Icon name={icon} className="h-5 w-5" />
      </span>
      <h2 className="text-sm font-semibold tracking-tight text-ink">{title}</h2>
      {description ? (
        <p className="max-w-sm text-xs leading-relaxed text-ink-muted">{description}</p>
      ) : null}
      {action ? <div className="pt-2">{action}</div> : null}
    </div>
  );
}
