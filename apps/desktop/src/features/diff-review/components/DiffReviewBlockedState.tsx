import { Button } from '@shared/ui/Button';
import { EmptyState } from '@shared/ui/EmptyState';
import { Icon } from '@shared/ui/Icon';

/**
 * DiffReviewBlockedState — shown when diff review cannot proceed yet.
 *
 * The screen is gated by three upstream signals: the migration plan must
 * be approved, the migration workspace must exist, AND a successful
 * execution run must have produced changed files. This component
 * surfaces the *first* missing prerequisite with a clear CTA back to the
 * screen that will resolve it. Approve / reject actions are disabled at
 * the screen level; this component exists purely to explain *why*.
 */
export type DiffReviewBlockedReason =
  | 'no-plan'
  | 'no-workspace'
  | 'no-execution-run';

export interface DiffReviewBlockedStateProps {
  readonly reason: DiffReviewBlockedReason;
  readonly onGoToPlan: () => void;
  readonly onGoToWorkspace: () => void;
  readonly onGoToExecute: () => void;
}

export function DiffReviewBlockedState({
  reason,
  onGoToPlan,
  onGoToWorkspace,
  onGoToExecute,
}: DiffReviewBlockedStateProps): JSX.Element {
  if (reason === 'no-plan') {
    return (
      <EmptyState
        icon="diff"
        fullWidth
        title="Approve the migration plan first"
        description="Diff review is only available after a successful execution run. Generate and approve the plan on Step 4 — the workflow will guide you through the remaining steps."
        action={
          <Button
            variant="secondary"
            size="md"
            leadingIcon={<Icon name="plan" />}
            onClick={onGoToPlan}
          >
            Go to migration plan
          </Button>
        }
      />
    );
  }

  if (reason === 'no-workspace') {
    return (
      <EmptyState
        icon="diff"
        fullWidth
        title="Create the migration workspace first"
        description="Diff review reads from the migration workspace. Complete Step 5 to create a Git worktree workspace — diff review will unlock automatically once an execution step succeeds."
        action={
          <Button
            variant="secondary"
            size="md"
            leadingIcon={<Icon name="workspace" />}
            onClick={onGoToWorkspace}
          >
            Go to workspace
          </Button>
        }
      />
    );
  }

  return (
    <EmptyState
      icon="diff"
      fullWidth
      title="Execute a migration step first"
      description="Diff review surfaces the file changes produced by the most recent successful execution run. Run a supported step on Step 6 to populate this screen."
      action={
        <Button
          variant="secondary"
          size="md"
          leadingIcon={<Icon name="play" />}
          onClick={onGoToExecute}
        >
          Go to execute
        </Button>
      }
    />
  );
}
