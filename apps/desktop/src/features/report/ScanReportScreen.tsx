import { Badge } from '@shared/ui/Badge';
import { Button } from '@shared/ui/Button';
import { Card, CardDescription, CardHeader, CardSection, CardTitle } from '@shared/ui/Card';
import { EmptyState } from '@shared/ui/EmptyState';
import { Icon } from '@shared/ui/Icon';
import { PageHeader } from '@shared/ui/PageHeader';
import { StepEyebrow } from '@shared/ui/StepEyebrow';

/**
 * Step 3 — Scan Report.
 *
 * Renders the static ScanReport produced by the orchestrator. The report is
 * meant to be read once — no live streaming, no AST queries from the UI.
 */
export function ScanReportScreen(): JSX.Element {
  return (
    <div className="flex h-full flex-col">
      <PageHeader
        eyebrow={<StepEyebrow number={3} icon="report" label="Report" />}
        title="Scan report"
        subtitle="Detected stack, dependency risks, and migration recommendations."
        actions={
          <>
            <Button variant="ghost" size="sm" disabled>
              Export JSON
            </Button>
            <Button
              variant="secondary"
              size="md"
              trailingIcon={<Icon name="arrow-right" />}
              disabled
            >
              Continue to plan
            </Button>
          </>
        }
        meta={<Badge tone="neutral">Pending</Badge>}
      />

      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="mx-auto flex max-w-5xl flex-col gap-6">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Project snapshot</CardTitle>
                <CardDescription>
                  Filled in once the scanner completes. Stored as an artifact on disk.
                </CardDescription>
              </div>
              <Badge tone="info" variant="outline">
                Snapshot
              </Badge>
            </CardHeader>

            <CardSection label="Detected stack">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-xs sm:grid-cols-3">
                <Field label="Package manager" value="—" />
                <Field label="Build tool" value="—" />
                <Field label="React version" value="—" />
                <Field label="Router" value="—" />
                <Field label="State management" value="—" />
                <Field label="Testing" value="—" />
              </dl>
            </CardSection>

            <CardSection label="Inventory">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Modules" />
                <Stat label="Components" />
                <Stat label="Hooks" />
                <Stat label="Routes" />
              </div>
            </CardSection>
          </Card>

          <EmptyState
            icon="report"
            title="No report yet"
            description="Run a scan to populate this view. The report file is also written to ~/.migrate-pilot/<session>/scan.json."
          />
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div>
      <dt className="text-2xs font-medium uppercase tracking-[0.12em] text-ink-subtle">
        {label}
      </dt>
      <dd className="mt-1 font-mono text-xs text-ink-muted">{value}</dd>
    </div>
  );
}

function Stat({ label }: { label: string }): JSX.Element {
  return (
    <Card padded={false} className="px-3 py-2.5" tone="subtle">
      <p className="text-2xs font-medium uppercase tracking-[0.12em] text-ink-subtle">{label}</p>
      <p className="mt-1 font-mono text-base font-semibold tabular-nums text-ink">—</p>
    </Card>
  );
}
