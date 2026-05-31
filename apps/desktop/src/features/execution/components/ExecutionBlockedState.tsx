import { Button } from '@shared/ui/Button';
import { Card, CardDescription, CardHeader, CardTitle } from '@shared/ui/Card';
import { EmptyState } from '@shared/ui/EmptyState';
import { Icon } from '@shared/ui/Icon';

/**
 * ExecutionBlockedState — shown when execution cannot proceed yet.
 *
 * The execution screen is gated by three upstream signals:
 *   1. The migration plan must be approved.
 *   2. A migration workspace must exist.
 *   3. The persisted workspace state must be valid (state-level
 *      validation passes; the saved plan id matches the active plan;
 *      the workspace path is not equal to the original project path).
 *
 * This component surfaces the *first* missing prerequisite with a
 * clear CTA back to the screen that will resolve it. Run / retry
 * actions are disabled at the screen level; this component exists
 * purely to explain *why*.
 */
export type ExecutionBlockedReason =
  | 'no-plan'
  | 'no-workspace'
  | 'invalid-workspace';

export interface ExecutionBlockedStateProps {
  readonly reason: ExecutionBlockedReason;
  /**
   * Required when `reason === 'invalid-workspace'`. Surfaces the
   * concrete validator messages so the user knows which rule failed.
   */
  readonly invalidReasons?: readonly string[];
  readonly onGoToPlan: () => void;
  readonly onGoToWorkspace: () => void;
}

export function ExecutionBlockedState({
  reason,
  invalidReasons,
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

  if (reason === 'no-workspace') {
    return (
      <EmptyState
        icon="play"
        fullWidth
        title="Migration workspace has not been created yet"
        description="Create the workspace before running plan steps. The execution engine only ever writes inside a workspace — it never touches the original project."
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

  // reason === 'invalid-workspace'
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Saved workspace is no longer valid</CardTitle>
          <CardDescription>
            Saved workspace path is no longer available, or its metadata
            no longer matches the approved plan. Recreate the workspace
            to unblock execution. The execution engine will never silently
            fall back to the original project path.
          </CardDescription>
        </div>
      </CardHeader>
      {invalidReasons !== undefined && invalidReasons.length > 0 ? (
        <ul className="space-y-1.5">
          {invalidReasons.map((reasonMessage) => (
            <li
              key={reasonMessage}
              className="flex items-start gap-2 rounded-xs border border-danger/30 bg-danger-soft px-2.5 py-1.5 text-xs leading-relaxed text-danger"
            >
              <Icon name="help" className="mt-px h-3 w-3 shrink-0" />
              <span>{reasonMessage}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-2 flex items-center gap-2">
        <Button
          variant="secondary"
          size="md"
          leadingIcon={<Icon name="workspace" />}
          onClick={onGoToWorkspace}
        >
          Recreate workspace
        </Button>
      </div>
    </Card>
  );
}
