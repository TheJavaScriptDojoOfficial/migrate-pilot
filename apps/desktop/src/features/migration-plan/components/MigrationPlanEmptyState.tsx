import { Button } from '@shared/ui/Button';
import { EmptyState } from '@shared/ui/EmptyState';
import { Icon } from '@shared/ui/Icon';

/**
 * MigrationPlanEmptyState — shown when no completed ScanReport exists.
 *
 * The Generate Plan affordance is disabled at the screen level; this state
 * exists purely to tell the user *why* and gives them a one-click path back
 * to the scanner.
 */
export interface MigrationPlanEmptyStateProps {
  readonly onGoToScanner: () => void;
}

export function MigrationPlanEmptyState({
  onGoToScanner,
}: MigrationPlanEmptyStateProps): JSX.Element {
  return (
    <EmptyState
      icon="plan"
      fullWidth
      title="Complete the project scan first"
      description="The migration plan is generated deterministically from the scan report. Run the scanner on Step 2 — once it completes, you can generate the plan here."
      action={
        <Button
          variant="secondary"
          size="md"
          leadingIcon={<Icon name="scan" />}
          onClick={onGoToScanner}
        >
          Go to scanner
        </Button>
      }
    />
  );
}
