import type { ReactNode } from 'react';

import { cn } from '@shared/utils/cn';

/**
 * PageHeader — the persistent header at the top of each screen.
 *
 * Layout: optional `eyebrow` (step number / breadcrumb) above the title,
 * subtitle as supporting copy, and a right-aligned action region. Renders
 * a subtle bottom hairline so it visually anchors the content below.
 */
export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  eyebrow,
  actions,
  meta,
  className,
}: PageHeaderProps): JSX.Element {
  return (
    <header
      className={cn(
        'flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-canvas-border bg-canvas px-8 py-5',
        className,
      )}
    >
      <div className="min-w-0 max-w-3xl">
        {eyebrow ? (
          <div className="mb-1.5 flex items-center gap-2 text-2xs font-medium uppercase tracking-[0.16em] text-ink-subtle">
            {eyebrow}
          </div>
        ) : null}
        <h1 className="truncate text-xl font-semibold tracking-tight text-ink">{title}</h1>
        {subtitle ? (
          <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">{subtitle}</p>
        ) : null}
        {meta ? <div className="mt-3 flex flex-wrap items-center gap-2">{meta}</div> : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}
