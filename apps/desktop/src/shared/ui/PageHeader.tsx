import type { ReactNode } from 'react';

import { cn } from '@shared/utils/cn';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, actions, className }: PageHeaderProps): JSX.Element {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-4 border-b border-canvas-border px-6 py-4',
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="truncate text-base font-semibold tracking-tight text-ink">{title}</h1>
        {subtitle ? <p className="mt-0.5 text-xs text-ink-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
