import { Badge } from '@shared/ui/Badge';
import { Button } from '@shared/ui/Button';
import { Card, CardDescription, CardHeader, CardSection, CardTitle } from '@shared/ui/Card';
import { EmptyState } from '@shared/ui/EmptyState';
import { Icon } from '@shared/ui/Icon';
import { PageHeader } from '@shared/ui/PageHeader';
import { StepEyebrow } from '@shared/ui/StepEyebrow';

/**
 * Step 4 — Migration Plan.
 *
 * Shows the generated, editable plan. Approval here gates workspace creation.
 */
export function MigrationPlanScreen(): JSX.Element {
  return (
    <div className="flex h-full flex-col">
      <PageHeader
        eyebrow={<StepEyebrow number={4} icon="plan" label="Plan" />}
        title="Migration plan"
        subtitle="Review the proposed steps. Approval here is required before any workspace is created."
        actions={
          <>
            <Button variant="ghost" size="sm" disabled>
              Re-generate
            </Button>
            <Button variant="secondary" size="md" disabled>
              Edit plan
            </Button>
            <Button
              size="md"
              leadingIcon={<Icon name="check" />}
              disabled
            >
              Approve plan
            </Button>
          </>
        }
        meta={
          <>
            <Badge tone="neutral" variant="outline">
              Draft
            </Badge>
            <Badge tone="info" variant="soft">
              0 / 0 approved
            </Badge>
          </>
        }
      />

      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="mx-auto flex max-w-5xl flex-col gap-6">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Step list</CardTitle>
                <CardDescription>
                  Each step is intentionally small. Risk and validation strategy are listed inline
                  so reviewers can scan without diving into the orchestrator log.
                </CardDescription>
              </div>
            </CardHeader>

            <CardSection>
              <table className="w-full border-separate border-spacing-0 text-xs">
                <thead>
                  <tr className="text-left text-2xs font-medium uppercase tracking-[0.12em] text-ink-subtle">
                    <th className="pb-2 pr-3">#</th>
                    <th className="pb-2 pr-3">Step</th>
                    <th className="pb-2 pr-3">Risk</th>
                    <th className="pb-2 pr-3">Validation</th>
                    <th className="pb-2 pr-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="text-ink-muted">
                  <tr>
                    <td colSpan={5} className="border-t border-canvas-border py-8 text-center">
                      <p className="text-xs text-ink-subtle">
                        Steps will appear here once the plan is generated.
                      </p>
                    </td>
                  </tr>
                </tbody>
              </table>
            </CardSection>
          </Card>

          <EmptyState
            icon="plan"
            title="Plan not generated"
            description="Once the scan completes, a step-by-step plan will be generated and shown here. You can re-order, edit, or remove steps before approval."
          />
        </div>
      </div>
    </div>
  );
}
