import { Button } from '@shared/ui/Button';
import { Icon } from '@shared/ui/Icon';

import type { ScanStatus } from '../types/scanner.types';

/**
 * ScanActionBar — top-of-screen actions: run / re-run scan and continue
 * to the migration plan. Kept presentational; the parent screen owns the
 * click handlers.
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
            ? (disabledReason ?? 'Select a valid React project before scanning.')
            : isCompleted
              ? 'Re-run the scan'
              : 'Run scan'
        }
      >
        {isCompleted ? 'Re-run scan' : isFailed ? 'Retry scan' : 'Run scan'}
      </Button>
      <Button
        variant="primary"
        size="md"
        trailingIcon={<Icon name="arrow-right" />}
        disabled={!canContinue}
        onClick={onContinue}
        title={
          canContinue
            ? 'Continue to the migration plan step'
            : 'A successful scan is required before continuing.'
        }
      >
        Continue to Migration Plan
      </Button>
    </>
  );
}
