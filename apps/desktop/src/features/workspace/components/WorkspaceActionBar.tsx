import { Button } from '@shared/ui/Button';
import { Icon } from '@shared/ui/Icon';

import type { WorkspaceStatus } from '../types/workspace.types';

/**
 * WorkspaceActionBar — top-of-screen actions.
 *
 * Action visibility/affordance follows the workspace state machine. Kept
 * presentational; the parent screen owns the click handlers and the
 * source-of-truth status.
 */
export interface WorkspaceActionBarProps {
  readonly status: WorkspaceStatus;
  readonly canRunPreflight: boolean;
  readonly canCreate: boolean;
  readonly canContinue: boolean;
  readonly disabledPreflightReason?: string;
  readonly disabledCreateReason?: string;
  readonly disabledContinueReason?: string;
  readonly onRunPreflight: () => void;
  readonly onCreate: () => void;
  readonly onReset: () => void;
  readonly onContinue: () => void;
}

export function WorkspaceActionBar({
  status,
  canRunPreflight,
  canCreate,
  canContinue,
  disabledPreflightReason,
  disabledCreateReason,
  disabledContinueReason,
  onRunPreflight,
  onCreate,
  onReset,
  onContinue,
}: WorkspaceActionBarProps): JSX.Element {
  const isChecking = status === 'checking';
  const isCreating = status === 'creating';
  const isCreated = status === 'created';
  const isReady = status === 'ready';
  const showReset = status !== 'blocked' && status !== 'idle' && status !== 'checking';

  return (
    <>
      {showReset ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          leadingIcon={<Icon name="cross" />}
          title="Discard the current workspace setup state"
          disabled={isCreating}
        >
          Reset
        </Button>
      ) : null}

      {!isCreated ? (
        <Button
          variant="secondary"
          size="md"
          leadingIcon={<Icon name="scan" />}
          onClick={onRunPreflight}
          disabled={!canRunPreflight || isChecking || isCreating}
          loading={isChecking}
          title={
            !canRunPreflight
              ? (disabledPreflightReason ?? 'Preflight is not available right now.')
              : isReady
                ? 'Re-run preflight to refresh signals'
                : 'Run the safe, read-only preflight'
          }
        >
          {isReady ? 'Re-run preflight' : 'Check workspace readiness'}
        </Button>
      ) : null}

      {!isCreated ? (
        <Button
          variant="primary"
          size="md"
          leadingIcon={<Icon name="git-branch" />}
          onClick={onCreate}
          disabled={!canCreate || isCreating}
          loading={isCreating}
          title={
            canCreate
              ? 'Create the migration workspace using the proposed parameters'
              : (disabledCreateReason ?? 'Run preflight before creating the workspace.')
          }
        >
          Create workspace
        </Button>
      ) : (
        <Button
          variant="primary"
          size="md"
          trailingIcon={<Icon name="arrow-right" />}
          onClick={onContinue}
          disabled={!canContinue}
          title={
            canContinue
              ? 'Continue to the execute migration step'
              : (disabledContinueReason ?? 'Workspace must be created first.')
          }
        >
          Continue to execute
        </Button>
      )}
    </>
  );
}
