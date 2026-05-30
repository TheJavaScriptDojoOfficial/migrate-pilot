import type { HTMLAttributes } from 'react';

import { Icon } from '@shared/ui/Icon';
import { cn } from '@shared/utils/cn';

/**
 * ErrorMessage — alert banner used inside content regions.
 *
 * For toasts or system-level errors prefer a dedicated Toast component
 * (out of scope for V1). This banner is opinionated for in-page failures.
 */
export interface ErrorMessageProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  message: string;
  /** Optional technical detail block (e.g. stack trace). */
  detail?: string;
}

export function ErrorMessage({
  title = 'Something went wrong',
  message,
  detail,
  className,
  ...rest
}: ErrorMessageProps): JSX.Element {
  return (
    <div
      role="alert"
      className={cn(
        'flex gap-3 rounded-md border border-danger/40 bg-danger-soft px-4 py-3 text-sm text-ink',
        className,
      )}
      {...rest}
    >
      <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-danger/20 text-danger">
        <Icon name="cross" className="h-3 w-3" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-danger">{title}</p>
        <p className="mt-1 text-xs leading-relaxed text-ink-muted">{message}</p>
        {detail ? (
          <pre className="mt-2 overflow-x-auto rounded-xs border border-canvas-border bg-canvas-subtle p-2 font-mono text-2xs text-ink-subtle">
            {detail}
          </pre>
        ) : null}
      </div>
    </div>
  );
}
