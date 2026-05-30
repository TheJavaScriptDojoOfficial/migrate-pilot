import { Button } from '@shared/ui/Button';
import { Icon } from '@shared/ui/Icon';

import type { DiffReviewStatus } from '../types/diffReview.types';

/**
 * DiffReviewActionBar — top-of-screen actions for diff review.
 *
 * Action visibility/affordance follows the diff-review state machine.
 * Kept presentational; the parent screen owns click handlers and the
 * source-of-truth status.
 */
export interface DiffReviewActionBarProps {
  readonly status: DiffReviewStatus;
  readonly canApprove: boolean;
  readonly canReject: boolean;
  readonly canReload: boolean;
  readonly disabledApproveReason?: string;
  readonly disabledRejectReason?: string;
  readonly onApprove: () => void;
  readonly onReject: () => void;
  readonly onReload: () => void;
}

export function DiffReviewActionBar({
  status,
  canApprove,
  canReject,
  canReload,
  disabledApproveReason,
  disabledRejectReason,
  onApprove,
  onReject,
  onReload,
}: DiffReviewActionBarProps): JSX.Element {
  const isApproving = status === 'approving';
  const isRejecting = status === 'rejecting';
  const isLoading = status === 'loading';
  const inFlight = isApproving || isRejecting || isLoading;

  return (
    <>
      {canReload ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={onReload}
          leadingIcon={<Icon name="history" />}
          disabled={inFlight}
          title="Reload the diff from the workspace"
        >
          Reload diff
        </Button>
      ) : null}

      <Button
        variant="secondary"
        size="md"
        onClick={onReject}
        leadingIcon={<Icon name="cross" />}
        disabled={!canReject || inFlight}
        loading={isRejecting}
        title={
          canReject
            ? 'Revert the changed files inside the workspace and mark the review rejected'
            : (disabledRejectReason ?? 'Reject is not available right now.')
        }
      >
        {isRejecting ? 'Reverting…' : 'Reject'}
      </Button>

      <Button
        variant="primary"
        size="md"
        onClick={onApprove}
        leadingIcon={<Icon name="check" />}
        disabled={!canApprove || inFlight}
        loading={isApproving}
        title={
          canApprove
            ? 'Approve the diff. No commit is created in this milestone.'
            : (disabledApproveReason ?? 'Approve is not available right now.')
        }
      >
        {isApproving ? 'Approving…' : 'Approve changes'}
      </Button>
    </>
  );
}
