import type { ReactNode } from 'react';

import { cn } from '@shared/utils/cn';

export interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  title,
  description,
  action,
  className,
}: EmptyStateProps): JSX.Element {
  return (
    <div
      className={cn(
        'flex max-w-sm flex-col items-center gap-3 rounded-lg border border-dashed border-canvas-border bg-canvas-subtle/60 px-6 py-10 text-center',
        className,
      )}
    >
      <h2 className="text-sm font-semibold tracking-tight text-ink">{title}</h2>
      {description ? (
        <p className="text-xs leading-relaxed text-ink-muted">{description}</p>
      ) : null}
      {action ? <div className="pt-2">{action}</div> : null}
    </div>
  );
}
