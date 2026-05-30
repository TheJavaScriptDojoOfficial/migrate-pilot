import { PageHeader } from '@shared/ui/PageHeader';
import { Card, CardDescription, CardHeader, CardTitle } from '@shared/ui/Card';
import { StatusIndicator } from '@shared/ui/StatusIndicator';
import { EmptyState } from '@shared/ui/EmptyState';

/**
 * Step 6 - Execution Dashboard.
 *
 * Streams provider + validation logs for the currently running step.
 * IMPORTANT: do not buffer the entire log stream in React state - render
 * line-by-line, cap in-memory history, and persist to NDJSON on disk.
 */
export function ExecutionDashboardScreen(): JSX.Element {
  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Execution"
        subtitle="One migration step at a time. Output streams from the orchestrator."
        actions={<StatusIndicator status="idle" label="Idle" />}
      />

      <div className="flex-1 space-y-4 overflow-y-auto p-6">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Current step</CardTitle>
              <CardDescription>
                The currently selected step will appear here with controls to run, cancel, or skip.
              </CardDescription>
            </div>
          </CardHeader>
          <p className="text-xs text-ink-muted">Placeholder for the live execution panel.</p>
        </Card>

        <EmptyState
          title="No active step"
          description="When a step is running, AI output and validation logs will stream here."
        />
      </div>
    </div>
  );
}
