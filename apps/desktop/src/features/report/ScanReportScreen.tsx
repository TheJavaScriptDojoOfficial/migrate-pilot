import { useNavigate } from 'react-router-dom';

import { Badge } from '@shared/ui/Badge';
import { Button } from '@shared/ui/Button';
import { EmptyState } from '@shared/ui/EmptyState';
import { Icon } from '@shared/ui/Icon';
import { PageHeader } from '@shared/ui/PageHeader';
import { StatusIndicator } from '@shared/ui/StatusIndicator';
import { StepEyebrow } from '@shared/ui/StepEyebrow';
import { ROUTES } from '@shared/constants/routes';

import {
  selectCanGenerateMigrationPlan,
  selectReact19ReadinessReport,
  selectScanReport,
  selectScanStatus,
  useProjectScannerStore,
} from '@features/scanner';

import { React19ReadinessReport } from './components/React19ReadinessReport';

/**
 * Step 3 — Scan Report.
 *
 * Read-only React 19 migration readiness report produced by Step 2.
 * Consumes the persisted scanner store (including the readiness view model)
 * so returning to this screen or reloading the app keeps the latest report.
 */
export function ScanReportScreen(): JSX.Element {
  const navigate = useNavigate();
  const status = useProjectScannerStore(selectScanStatus);
  const report = useProjectScannerStore(selectScanReport);
  const readinessReport = useProjectScannerStore(selectReact19ReadinessReport);
  const canGeneratePlan = useProjectScannerStore(selectCanGenerateMigrationPlan);

  const hasReport = status === 'completed' && report !== undefined && readinessReport !== undefined;

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        eyebrow={<StepEyebrow number={3} icon="report" label="Report" />}
        title="React 19 Migration Readiness Report"
        subtitle="Review the deterministic React 16/17/18 → React 19 migration readiness artifact before generating a migration plan."
        meta={
          <>
            <Badge tone="success" variant="soft" withDot>
              Read-only artifact
            </Badge>
            <StatusIndicator
              variant="chip"
              status={hasReport ? (canGeneratePlan ? 'success' : 'warning') : 'idle'}
              label={
                hasReport
                  ? canGeneratePlan
                    ? 'Ready for plan generation'
                    : 'Plan generation blocked'
                  : 'No report yet'
              }
            />
          </>
        }
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              leadingIcon={<Icon name="scan" />}
              onClick={() => navigate(ROUTES.scanner)}
            >
              Back to scanner
            </Button>
            <Button
              variant="primary"
              size="md"
              trailingIcon={<Icon name="arrow-right" />}
              disabled={!hasReport || !canGeneratePlan}
              onClick={() => navigate(ROUTES.migrationPlan)}
              title={
                !hasReport
                  ? 'A successful React 19 compatibility scan is required before continuing.'
                  : !canGeneratePlan
                    ? readinessReport?.planGenerationExplanation ??
                      'Plan generation is blocked until eligibility issues are resolved.'
                    : 'Continue to the React 19 migration plan step'
              }
            >
              Continue to Migration Plan
            </Button>
          </>
        }
      />

      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="mx-auto flex max-w-5xl flex-col gap-6">
          {hasReport && readinessReport !== undefined ? (
            <React19ReadinessReport viewModel={readinessReport} />
          ) : (
            <NoReportState onGoToScanner={() => navigate(ROUTES.scanner)} />
          )}
        </div>
      </div>
    </div>
  );
}

function NoReportState({
  onGoToScanner,
}: {
  readonly onGoToScanner: () => void;
}): JSX.Element {
  return (
    <EmptyState
      icon="report"
      fullWidth
      title="No React 19 readiness report yet"
      description="Run the React 19 compatibility scan on Step 2 to populate the migration readiness report. Once the scan completes, this view becomes a read-only review surface and is saved for the session."
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
