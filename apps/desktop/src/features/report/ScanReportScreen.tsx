import { PageHeader } from '@shared/ui/PageHeader';
import { Card, CardDescription, CardHeader, CardTitle } from '@shared/ui/Card';
import { Badge } from '@shared/ui/Badge';
import { EmptyState } from '@shared/ui/EmptyState';

/**
 * Step 3 - Scan Report.
 *
 * Renders the static ScanReport produced by the orchestrator. The report is
 * meant to be read once - no live streaming, no AST queries from the UI.
 */
export function ScanReportScreen(): JSX.Element {
  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Scan report"
        subtitle="Detected stack, dependency risks, and migration recommendations."
        actions={<Badge tone="neutral">Pending</Badge>}
      />

      <div className="flex-1 space-y-4 overflow-y-auto p-6">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Project snapshot</CardTitle>
              <CardDescription>
                Filled in once the scanner completes. Stored as an artifact on disk.
              </CardDescription>
            </div>
          </CardHeader>
          <p className="text-xs text-ink-muted">
            Placeholder for stack details, file inventory, and risk score.
          </p>
        </Card>

        <EmptyState
          title="No report yet"
          description="Run a scan to populate this view."
        />
      </div>
    </div>
  );
}
