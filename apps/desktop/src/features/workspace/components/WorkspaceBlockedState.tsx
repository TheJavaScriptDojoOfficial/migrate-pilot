import { Button } from '@shared/ui/Button';
import { EmptyState } from '@shared/ui/EmptyState';
import { Icon } from '@shared/ui/Icon';

/**
 * WorkspaceBlockedState — shown when no approved migration plan exists.
 *
 * The Create / Run preflight affordances are disabled at the screen level;
 * this state exists purely to tell the user *why* and gives them a one-
 * click path back to the migration plan screen.
 */
export interface WorkspaceBlockedStateProps {
  readonly onGoToPlan: () => void;
}

export function WorkspaceBlockedState({
  onGoToPlan,
}: WorkspaceBlockedStateProps): JSX.Element {
  return (
    <EmptyState
      icon="workspace"
      fullWidth
      title="Approve the migration plan first"
      description="The migration workspace is created from the approved plan. Generate and approve the plan on Step 4 — once it is approved, the workspace step unlocks here."
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
