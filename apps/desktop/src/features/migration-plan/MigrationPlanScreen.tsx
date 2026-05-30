import { PageHeader } from '@shared/ui/PageHeader';
import { Card, CardDescription, CardHeader, CardTitle } from '@shared/ui/Card';
import { Button } from '@shared/ui/Button';
import { EmptyState } from '@shared/ui/EmptyState';

/**
 * Step 4 - Migration Plan.
 *
 * Shows the generated, editable plan. Approval here gates workspace creation.
 */
export function MigrationPlanScreen(): JSX.Element {
  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Migration plan"
        subtitle="Review the proposed steps. Approval is required before a workspace is created."
        actions={
          <>
            <Button variant="secondary" disabled>
              Edit plan
            </Button>
            <Button disabled>Approve plan</Button>
          </>
        }
      />

      <div className="flex-1 space-y-4 overflow-y-auto p-6">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Step list</CardTitle>
              <CardDescription>
                Each step is small enough to review comfortably. Risk and validation are listed inline.
              </CardDescription>
            </div>
          </CardHeader>
          <p className="text-xs text-ink-muted">Placeholder for the step list.</p>
        </Card>

        <EmptyState
          title="Plan not generated"
          description="Once the scan completes, a step-by-step plan will be generated and shown here."
        />
      </div>
    </div>
  );
}
