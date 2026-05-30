import { Button } from '@shared/ui/Button';
import { ErrorMessage } from '@shared/ui/ErrorMessage';
import { Icon } from '@shared/ui/Icon';

import type { DiffReviewError } from '../types/diffReview.types';

/**
 * DiffReviewErrorState — single banner for any diff review failure.
 *
 * Always offers a recovery action that targets the specific failure mode
 * (reload diff, retry rejection). The screen owns retry semantics; this
 * component is presentational.
 */
export interface DiffReviewErrorStateProps {
  readonly error: DiffReviewError;
  readonly canReload: boolean;
  readonly canRetryReject: boolean;
  readonly onReload: () => void;
  readonly onRetryReject: () => void;
}

export function DiffReviewErrorState({
  error,
  canReload,
  canRetryReject,
  onReload,
  onRetryReject,
}: DiffReviewErrorStateProps): JSX.Element {
  return (
    <div className="space-y-3">
      <ErrorMessage
        title={titleFor(error.code)}
        message={error.message}
        {...(error.detail !== undefined ? { detail: error.detail } : {})}
      />
      <div className="flex flex-wrap items-center gap-2">
        {canReload ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={onReload}
            leadingIcon={<Icon name="history" />}
          >
            Reload diff
          </Button>
        ) : null}
        {canRetryReject ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={onRetryReject}
            leadingIcon={<Icon name="cross" />}
          >
            Retry rejection
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function titleFor(code: string): string {
  switch (code) {
    case 'load-failed':
      return 'Failed to load diff';
    case 'approve-failed':
      return 'Approval did not record';
    case 'reject-failed':
      return 'Rejection did not complete';
    case 'tauri-unavailable':
      return 'Diff review requires the desktop shell';
    case 'invalid-input':
      return 'Invalid diff input';
    case 'path-not-allowed':
      return 'Path not allowed';
    default:
      return 'Diff review error';
  }
}
