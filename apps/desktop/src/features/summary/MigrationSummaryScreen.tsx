import { PageHeader } from '@shared/ui/PageHeader';
import { Card, CardDescription, CardHeader, CardTitle } from '@shared/ui/Card';
import { Badge } from '@shared/ui/Badge';
import { EmptyState } from '@shared/ui/EmptyState';

/**
 * Step 8 - Migration Summary.
 *
 * Final report after all steps are processed. Aggregates approved commits,
 * validation outcomes, and remaining manual follow-ups.
 */
export function MigrationSummaryScreen(): JSX.Element {
  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Migration summary"
        subtitle="A consolidated view of approved commits, rolled-back steps, and final validation."
        actions={<Badge tone="neutral">Pending</Badge>}
      />

      <div className="flex-1 space-y-4 overflow-y-auto p-6">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Outcome</CardTitle>
              <CardDescription>Populated once the session completes.</CardDescription>
            </div>
          </CardHeader>
          <p className="text-xs text-ink-muted">Placeholder for the summary content.</p>
        </Card>

        <EmptyState
          title="No summary available"
          description="The summary is generated automatically when a session reaches COMPLETED."
        />
      </div>
    </div>
  );
}
