import { Button } from '@shared/ui/Button';
import { EmptyState } from '@shared/ui/EmptyState';
import { Icon } from '@shared/ui/Icon';

/**
 * ExecutionBlockedState — shown when execution cannot proceed yet.
 *
 * The execution screen is gated by two upstream signals: the migration
 * plan must be approved AND the migration workspace must exist. This
 * component surfaces the *first* missing prerequisite with a clear CTA
 * back to the screen that will resolve it. Run / retry actions are
 * disabled at the screen level; this component exists purely to explain
 * *why*.
 */
export type ExecutionBlockedReason = 'no-plan' | 'no-workspace';

export interface ExecutionBlockedStateProps {
  readonly reason: ExecutionBlockedReason;
  readonly onGoToPlan: () => void;
  readonly onGoToWorkspace: () => void;
}

export function ExecutionBlockedState({
  reason,
  onGoToPlan,
  onGoToWorkspace,
}: ExecutionBlockedStateProps): JSX.Element {
  if (reason === 'no-plan') {
    return (
      <EmptyState
        icon="play"
        fullWidth
        title="Approve the migration plan first"
        description="Execution runs against the approved plan. Generate and approve the plan on Step 4 — once it is approved and a workspace is created, this screen unlocks."
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

  return (
    <EmptyState
      icon="play"
      fullWidth
      title="Create the migration workspace first"
      description="The execution engine only ever writes inside a created workspace. Complete Step 5 to create a Git worktree workspace — execution will unlock automatically."
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
