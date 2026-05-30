import { Button } from '@shared/ui/Button';
import { Icon } from '@shared/ui/Icon';

import type { MigrationPlanStatus } from '../types/migrationPlan.types';

/**
 * MigrationPlanActionBar — top-of-screen actions.
 *
 * Action visibility/affordance follows the plan state machine. Kept
 * presentational; the parent screen owns the click handlers and the
 * source-of-truth status.
 */
export interface MigrationPlanActionBarProps {
  readonly status: MigrationPlanStatus;
  readonly canGenerate: boolean;
  readonly canApprove: boolean;
  readonly canContinue: boolean;
  readonly disabledGenerateReason?: string;
  readonly disabledApproveReason?: string;
  readonly disabledContinueReason?: string;
  readonly onGenerate: () => void;
  readonly onApprove: () => void;
  readonly onReset: () => void;
  readonly onContinue: () => void;
}

export function MigrationPlanActionBar({
  status,
  canGenerate,
  canApprove,
  canContinue,
  disabledGenerateReason,
  disabledApproveReason,
  disabledContinueReason,
  onGenerate,
  onApprove,
  onReset,
  onContinue,
}: MigrationPlanActionBarProps): JSX.Element {
  const isGenerating = status === 'generating';
  const isGenerated = status === 'generated';
  const isApproved = status === 'approved';
  const isFailed = status === 'failed';
  const hasDraftOrApproved = isGenerated || isApproved;

  return (
    <>
      {hasDraftOrApproved ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          leadingIcon={<Icon name="cross" />}
          title={
            isApproved
              ? 'Discard the approved plan and regenerate from the scan report'
              : 'Discard the draft plan'
          }
        >
          {isApproved ? 'Discard plan' : 'Reset plan'}
        </Button>
      ) : null}

      <Button
        variant="secondary"
        size="md"
        leadingIcon={<Icon name="plan" />}
        onClick={onGenerate}
        disabled={!canGenerate || isGenerating}
        loading={isGenerating}
        title={
          !canGenerate
            ? (disabledGenerateReason ?? 'A completed React 19 compatibility scan is required.')
            : isGenerated
              ? 'Re-generate the React 19 migration plan from the latest scan report'
              : isApproved
                ? 'Generate a new React 19 migration plan (will discard the approved plan)'
                : isFailed
                  ? 'Retry React 19 plan generation'
                  : 'Generate the React 19 migration plan'
        }
      >
        {isGenerated || isApproved
          ? 'Regenerate React 19 plan'
          : isFailed
            ? 'Retry generation'
            : 'Generate React 19 migration plan'}
      </Button>

      {!isApproved ? (
        <Button
          variant="primary"
          size="md"
          leadingIcon={<Icon name="check" />}
          onClick={onApprove}
          disabled={!canApprove}
          title={
            canApprove
              ? 'Approve the React 19 migration plan — the workspace step unlocks afterwards'
              : (disabledApproveReason ?? 'Generate a plan before approving.')
          }
        >
          Approve React 19 plan
        </Button>
      ) : (
        <Button
          variant="primary"
          size="md"
          trailingIcon={<Icon name="arrow-right" />}
          disabled={!canContinue}
          onClick={onContinue}
          title={
            canContinue
              ? 'Continue to the workspace step'
              : (disabledContinueReason ?? 'Approve the plan to continue.')
          }
        >
          Continue to Workspace
        </Button>
      )}
    </>
  );
}
