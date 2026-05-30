import { Button } from '@shared/ui/Button';
import { Icon } from '@shared/ui/Icon';

import type { ExecutionStatus } from '../types/execution.types';

/**
 * ExecutionActionBar — top-of-screen actions for the execution screen.
 *
 * Action visibility/affordance follows the engine state machine. Kept
 * presentational; the parent screen owns click handlers and the source-
 * of-truth status.
 */
export interface ExecutionActionBarProps {
  readonly status: ExecutionStatus;
  readonly canRun: boolean;
  readonly canRetry: boolean;
  readonly canReset: boolean;
  readonly disabledRunReason?: string;
  readonly disabledRetryReason?: string;
  readonly onRun: () => void;
  readonly onRetry: () => void;
  readonly onReset: () => void;
}

export function ExecutionActionBar({
  status,
  canRun,
  canRetry,
  canReset,
  disabledRunReason,
  disabledRetryReason,
  onRun,
  onRetry,
  onReset,
}: ExecutionActionBarProps): JSX.Element {
  const isRunning = status === 'running';
  const isFailed = status === 'failed';
  const isCompleted = status === 'completed';

  return (
    <>
      {canReset ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          leadingIcon={<Icon name="cross" />}
          title="Discard execution state for the current plan + workspace"
          disabled={isRunning}
        >
          Reset
        </Button>
      ) : null}

      {isFailed ? (
        <Button
          variant="secondary"
          size="md"
          onClick={onRetry}
          leadingIcon={<Icon name="play" />}
          disabled={!canRetry || isRunning}
          loading={isRunning}
          title={
            canRetry
              ? 'Retry the failed step using the scripted executor'
              : (disabledRetryReason ?? 'Retry is not available right now.')
          }
        >
          Retry step
        </Button>
      ) : (
        <Button
          variant="primary"
          size="md"
          onClick={onRun}
          leadingIcon={<Icon name="play" />}
          disabled={!canRun || isRunning}
          loading={isRunning}
          title={
            canRun
              ? 'Run the selected step using the scripted executor'
              : (disabledRunReason ?? 'Select a supported step to run.')
          }
        >
          {isCompleted ? 'Run step again' : 'Run step'}
        </Button>
      )}
    </>
  );
}
