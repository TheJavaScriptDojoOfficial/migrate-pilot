import { Badge } from '@shared/ui/Badge';
import { Button } from '@shared/ui/Button';
import { Card, CardDescription, CardHeader, CardSection, CardTitle } from '@shared/ui/Card';
import { EmptyState } from '@shared/ui/EmptyState';
import { Icon } from '@shared/ui/Icon';
import { PageHeader } from '@shared/ui/PageHeader';
import { StepEyebrow } from '@shared/ui/StepEyebrow';

/**
 * Step 8 — Migration Summary.
 *
 * Final report after all steps are processed. Aggregates approved commits,
 * validation outcomes, and remaining manual follow-ups.
 */
export function MigrationSummaryScreen(): JSX.Element {
  return (
    <div className="flex h-full flex-col">
      <PageHeader
        eyebrow={<StepEyebrow number={8} icon="check-circle" label="Summary" />}
        title="Migration summary"
        subtitle="A consolidated view of approved commits, rolled-back steps, and final validation."
        actions={
          <>
            <Button variant="ghost" size="sm" disabled>
              Export report
            </Button>
            <Button
              variant="secondary"
              size="md"
              leadingIcon={<Icon name="git-branch" />}
              disabled
            >
              Open branch
            </Button>
          </>
        }
        meta={<Badge tone="neutral">Pending</Badge>}
      />

      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="mx-auto flex max-w-5xl flex-col gap-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Steps run" value="—" tone="neutral" />
            <StatTile label="Approved" value="—" tone="success" />
            <StatTile label="Rolled back" value="—" tone="warning" />
            <StatTile label="Failed" value="—" tone="danger" />
          </div>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Outcome</CardTitle>
                <CardDescription>
                  Populated once the session reaches <span className="font-mono">COMPLETED</span>.
                </CardDescription>
              </div>
            </CardHeader>

            <CardSection label="Approved commits">
              <p className="text-xs text-ink-subtle">No commits yet.</p>
            </CardSection>

            <CardSection label="Follow-ups">
              <p className="text-xs text-ink-subtle">No outstanding follow-ups.</p>
            </CardSection>
          </Card>

          <EmptyState
            icon="check-circle"
            title="No summary available"
            description="The summary is generated automatically when a session reaches COMPLETED. You can re-open this screen any time from the workflow sidebar."
          />
        </div>
      </div>
    </div>
  );
}

interface StatTileProps {
  label: string;
  value: string;
  tone: 'neutral' | 'success' | 'warning' | 'danger';
}

const TONE_ACCENT: Record<StatTileProps['tone'], string> = {
  neutral: 'text-ink',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
};

function StatTile({ label, value, tone }: StatTileProps): JSX.Element {
  return (
    <Card padded={false} className="px-4 py-3">
      <p className="text-2xs font-medium uppercase tracking-[0.14em] text-ink-subtle">
        {label}
      </p>
      <p
        className={`mt-1 font-mono text-2xl font-semibold tabular-nums ${TONE_ACCENT[tone]}`}
      >
        {value}
      </p>
    </Card>
  );
}
