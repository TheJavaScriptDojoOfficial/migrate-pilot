import { Button } from '@shared/ui/Button';
import { Icon } from '@shared/ui/Icon';

import type { ScanStatus } from '../types/scanner.types';

/**
 * ScanActionBar — top-of-screen actions: run / re-run the React 19
 * compatibility scan and continue to the React 19 migration plan. Kept
 * presentational; the parent screen owns the click handlers.
 */
export interface ScanActionBarProps {
  readonly status: ScanStatus;
  readonly canScan: boolean;
  readonly canContinue: boolean;
  readonly disabledReason?: string;
  readonly onScan: () => void;
  readonly onReset: () => void;
  readonly onContinue: () => void;
}

export function ScanActionBar({
  status,
  canScan,
  canContinue,
  disabledReason,
  onScan,
  onReset,
  onContinue,
}: ScanActionBarProps): JSX.Element {
  const isScanning = status === 'scanning';
  const isCompleted = status === 'completed';
  const isFailed = status === 'failed';

  return (
    <>
      {isCompleted ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={onReset}
          leadingIcon={<Icon name="cross" />}
        >
          Reset scan
        </Button>
      ) : null}
      <Button
        variant="secondary"
        size="md"
        leadingIcon={<Icon name="scan" />}
        onClick={onScan}
        disabled={!canScan || isScanning}
        loading={isScanning}
        title={
          !canScan
            ? (disabledReason ?? 'Select a valid React 16/17/18 project before scanning.')
            : isCompleted
              ? 'Re-run the React 19 compatibility scan'
              : 'Run the React 19 compatibility scan'
        }
      >
        {isCompleted
          ? 'Re-run React 19 scan'
          : isFailed
            ? 'Retry React 19 scan'
            : 'Run React 19 scan'}
      </Button>
      <Button
        variant="primary"
        size="md"
        trailingIcon={<Icon name="arrow-right" />}
        disabled={!canContinue}
        onClick={onContinue}
        title={
          canContinue
            ? 'Continue to the React 19 migration plan step'
            : 'A successful React 19 compatibility scan is required before continuing.'
        }
      >
        Continue to Migration Plan
      </Button>
    </>
  );
}
