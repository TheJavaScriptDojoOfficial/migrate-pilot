import type { HTMLAttributes } from 'react';

import { cn } from '@shared/utils/cn';

export interface ErrorMessageProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  message: string;
  /** Optional technical detail block (collapsed by default in future versions). */
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
        'rounded-md border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-ink',
        className,
      )}
      {...rest}
    >
      <p className="font-semibold text-danger">{title}</p>
      <p className="mt-1 text-ink">{message}</p>
      {detail ? (
        <pre className="mt-2 overflow-x-auto rounded bg-canvas-subtle p-2 font-mono text-2xs text-ink-muted">
          {detail}
        </pre>
      ) : null}
    </div>
  );
}
