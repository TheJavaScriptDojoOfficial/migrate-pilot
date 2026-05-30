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
  ScanDependencyCard,
  ScanRecommendations,
  ScanRiskCard,
  ScanSourceAnalysisCard,
  ScanSummaryCard,
  selectScanReport,
  selectScanStatus,
  useProjectScannerStore,
} from '@features/scanner';

/**
 * Step 3 — Scan Report.
 *
 * Read-only view of the report produced by Step 2. Both screens consume
 * the same scanner store so the data stays consistent — the difference is
 * intent: this screen is a "review the artifact" surface, while
 * `ScannerScreen` owns the run / re-run state machine.
 */
export function ScanReportScreen(): JSX.Element {
  const navigate = useNavigate();
  const status = useProjectScannerStore(selectScanStatus);
  const report = useProjectScannerStore(selectScanReport);

  const hasReport = status === 'completed' && report !== undefined;

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        eyebrow={<StepEyebrow number={3} icon="report" label="Report" />}
        title="React 19 readiness report"
        subtitle="Review the deterministic React 19 compatibility scan artifact. Approve to continue to the React 19 migration plan."
        meta={
          <>
            <Badge tone="success" variant="soft" withDot>
              Read-only artifact
            </Badge>
            <StatusIndicator
              variant="chip"
              status={hasReport ? 'success' : 'idle'}
              label={hasReport ? 'React 19 report ready' : 'No report yet'}
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
              disabled={!hasReport}
              onClick={() => navigate(ROUTES.migrationPlan)}
              title={
                hasReport
                  ? 'Continue to the React 19 migration plan step'
                  : 'A successful React 19 compatibility scan is required before continuing.'
              }
            >
              Continue to Migration Plan
            </Button>
          </>
        }
      />

      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="mx-auto flex max-w-5xl flex-col gap-6">
          {hasReport && report !== undefined ? (
            <>
              <ScanSummaryCard report={report} />
              <ScanRiskCard risks={report.risks} />
              <ScanDependencyCard
                dependencies={report.dependencies}
                scripts={report.scripts}
              />
              <ScanSourceAnalysisCard source={report.sourceAnalysis} />
              <ScanRecommendations recommendations={report.recommendations} />
            </>
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
      description="Run the React 19 compatibility scan on Step 2 to populate the readiness report. Once the scan completes, this view becomes a read-only review surface."
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
