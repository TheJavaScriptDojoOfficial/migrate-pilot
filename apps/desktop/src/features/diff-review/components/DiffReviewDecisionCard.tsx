import { Badge } from '@shared/ui/Badge';
import { Button } from '@shared/ui/Button';
import {
  Card,
  CardDescription,
  CardHeader,
  CardSection,
  CardTitle,
} from '@shared/ui/Card';
import { Icon } from '@shared/ui/Icon';

import { formatReviewTimestamp } from '../services/diffReviewPresentationService';
import type { DiffReviewDecision } from '../types/diffReview.types';

/**
 * DiffReviewDecisionCard — presents the user's recorded decision and the
 * onward action.
 *
 * Approved:
 *   Banner + "Continue to validation" CTA. Diff is kept visible above.
 *
 * Rejected:
 *   Banner + reverted-files / manual-cleanup-files lists + a clear
 *   message that the user must rerun execution to try again.
 */
export interface DiffReviewDecisionCardProps {
  readonly decision: DiffReviewDecision;
  readonly onContinueToValidation: () => void;
  readonly onGoToExecute: () => void;
}

export function DiffReviewDecisionCard({
  decision,
  onContinueToValidation,
  onGoToExecute,
}: DiffReviewDecisionCardProps): JSX.Element {
  if (decision.type === 'approved') {
    return (
      <Card accent>
        <CardHeader>
          <div>
            <CardTitle>Changes approved</CardTitle>
            <CardDescription>
              The diff was recorded as approved. No commit was created and
              no validation has run yet.
            </CardDescription>
          </div>
          <Badge tone="success" variant="soft" withDot uppercase>
            Approved
          </Badge>
        </CardHeader>

        <ApprovedBanner decidedAt={decision.decidedAt} />

        <CardSection label="Next step">
          <p className="text-xs leading-relaxed text-ink-muted">
            Approval only records your decision. The next milestone runs
            validation commands against the workspace before any commit.
          </p>
          <div className="mt-3">
            <Button
              size="md"
              leadingIcon={<Icon name="arrow-right" />}
              onClick={onContinueToValidation}
            >
              Continue to validation
            </Button>
          </div>
        </CardSection>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Changes rejected</CardTitle>
          <CardDescription>
            The workspace was reverted to its baseline for the changed
            files below. The original project is unchanged.
          </CardDescription>
        </div>
        <Badge tone="danger" variant="soft" withDot uppercase>
          Rejected
        </Badge>
      </CardHeader>

      <RejectedBanner decidedAt={decision.decidedAt} />

      {decision.revertedFiles !== undefined && decision.revertedFiles.length > 0 ? (
        <CardSection label="Reverted files">
          <FileList files={decision.revertedFiles} tone="success" />
        </CardSection>
      ) : null}

      {decision.manualCleanupFiles !== undefined &&
      decision.manualCleanupFiles.length > 0 ? (
        <CardSection label="Manual cleanup required">
          <p className="text-xs leading-relaxed text-ink-muted">
            The safe revert refused to delete the files below — typically
            because they are newly created. Remove them manually inside
            the workspace if you want a clean baseline before re-running.
          </p>
          <div className="mt-2">
            <FileList
              files={decision.manualCleanupFiles}
              tone="warning"
            />
          </div>
        </CardSection>
      ) : null}

      <CardSection label="Next step">
        <p className="text-xs leading-relaxed text-ink-muted">
          Validation remains locked. Re-run the migration step to try
          again, or pick a different supported step.
        </p>
        <div className="mt-3">
          <Button
            variant="secondary"
            size="md"
            leadingIcon={<Icon name="play" />}
            onClick={onGoToExecute}
          >
            Back to execute
          </Button>
        </div>
      </CardSection>
    </Card>
  );
}

function ApprovedBanner({ decidedAt }: { readonly decidedAt: string }): JSX.Element {
  return (
    <div className="flex items-start gap-3 rounded-md border border-success/40 bg-success-soft px-4 py-3">
      <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success/20 text-success">
        <Icon name="check" className="h-3 w-3" />
      </span>
      <div>
        <p className="text-xs font-semibold text-success">
          Decision recorded — diff approved
        </p>
        <p className="mt-1 text-xs leading-relaxed text-ink-muted">
          Recorded at {formatReviewTimestamp(decidedAt)}. No commit was
          created. No validation command was run.
        </p>
      </div>
    </div>
  );
}

function RejectedBanner({ decidedAt }: { readonly decidedAt: string }): JSX.Element {
  return (
    <div className="flex items-start gap-3 rounded-md border border-danger/40 bg-danger-soft px-4 py-3">
      <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-danger/20 text-danger">
        <Icon name="cross" className="h-3 w-3" />
      </span>
      <div>
        <p className="text-xs font-semibold text-danger">
          Workspace changes reverted
        </p>
        <p className="mt-1 text-xs leading-relaxed text-ink-muted">
          Recorded at {formatReviewTimestamp(decidedAt)}. Only the listed
          files were touched and they were restored using
          {' '}
          <code className="rounded-xs border border-canvas-border bg-canvas-subtle px-1 py-0.5 font-mono text-[11px]">
            git restore --
          </code>
          .
        </p>
      </div>
    </div>
  );
}

function FileList({
  files,
  tone,
}: {
  readonly files: readonly string[];
  readonly tone: 'success' | 'warning';
}): JSX.Element {
  return (
    <ul className="space-y-1.5">
      {files.map((file) => (
        <li key={file}>
          <Badge tone={tone} variant="outline" className="font-mono">
            {file}
          </Badge>
        </li>
      ))}
    </ul>
  );
}
