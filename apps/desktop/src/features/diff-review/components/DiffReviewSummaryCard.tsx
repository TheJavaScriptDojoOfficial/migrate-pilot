import { Badge } from '@shared/ui/Badge';
import {
  Card,
  CardDescription,
  CardHeader,
  CardSection,
  CardTitle,
} from '@shared/ui/Card';
import { Icon } from '@shared/ui/Icon';

import type { DiffReviewSession } from '../types/diffReview.types';

/**
 * DiffReviewSummaryCard — top-of-screen identity card for the review
 * session. Surfaces the executed step title, workspace path, branch
 * name (if known), execution run id, and aggregated additions/deletions
 * counts.
 */
export interface DiffReviewSummaryCardProps {
  readonly session: DiffReviewSession;
}

export function DiffReviewSummaryCard({
  session,
}: DiffReviewSummaryCardProps): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Review session</CardTitle>
          <CardDescription>
            All file changes shown below were produced by the scripted
            executor inside the migration workspace. The original project
            stays read-only.
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="success" variant="soft" withDot>
            +{session.totalAdditions}
          </Badge>
          <Badge tone="danger" variant="soft" withDot>
            −{session.totalDeletions}
          </Badge>
          <Badge tone="info" variant="outline">
            {session.files.length} file{session.files.length === 1 ? '' : 's'}
          </Badge>
        </div>
      </CardHeader>

      <CardSection label="Identifiers">
        <dl className="grid grid-cols-1 gap-4 text-xs sm:grid-cols-2">
          {session.stepTitle !== undefined ? (
            <Field
              label="Executed step"
              icon="play"
              value={session.stepTitle}
              mono={false}
            />
          ) : null}
          <Field
            label="Plan step id"
            icon="plan"
            value={session.planStepId}
          />
          <Field
            label="Workspace path"
            icon="folder"
            value={session.workspacePath}
          />
          {session.branchName !== undefined ? (
            <Field
              label="Branch"
              icon="git-branch"
              value={session.branchName}
            />
          ) : null}
          <Field label="Execution run id" icon="dot" value={session.executionRunId} />
        </dl>
      </CardSection>
    </Card>
  );
}

function Field({
  label,
  icon,
  value,
  mono = true,
}: {
  readonly label: string;
  readonly icon: 'folder' | 'git-branch' | 'plan' | 'play' | 'dot';
  readonly value: string;
  readonly mono?: boolean;
}): JSX.Element {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-2xs font-medium uppercase tracking-[0.12em] text-ink-subtle">
        <Icon name={icon} className="h-3 w-3" />
        {label}
      </dt>
      <dd
        className={`mt-1.5 break-all rounded-xs border border-canvas-border bg-canvas-subtle px-2 py-1.5 text-xs text-ink-muted ${
          mono ? 'font-mono' : ''
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
