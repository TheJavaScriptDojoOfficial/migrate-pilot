import { Button } from '@shared/ui/Button';
import { Card, CardDescription, CardHeader, CardSection, CardTitle } from '@shared/ui/Card';
import { EmptyState } from '@shared/ui/EmptyState';
import { Icon } from '@shared/ui/Icon';
import { PageHeader } from '@shared/ui/PageHeader';
import { StatusIndicator } from '@shared/ui/StatusIndicator';
import { StepEyebrow } from '@shared/ui/StepEyebrow';

/**
 * Step 2 — Scan Progress.
 *
 * Streams scanner progress from the orchestrator. The UI must not buffer
 * the entire file tree — it should render lightweight progress indicators
 * and rely on the eventual ScanReport for details.
 */
export function ScannerScreen(): JSX.Element {
  return (
    <div className="flex h-full flex-col">
      <PageHeader
        eyebrow={<StepEyebrow number={2} icon="scan" label="Scan" />}
        title="Scanning project"
        subtitle="Inspecting source files, dependencies and build configuration. Results stream in as phases complete."
        actions={
          <>
            <Button variant="ghost" size="sm" disabled>
              Cancel
            </Button>
            <Button
              variant="secondary"
              size="md"
              leadingIcon={<Icon name="scan" />}
              disabled
            >
              Re-run scan
            </Button>
          </>
        }
        meta={<StatusIndicator status="idle" label="Idle" variant="chip" />}
      />

      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="mx-auto flex max-w-5xl flex-col gap-6">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Scan phases</CardTitle>
                <CardDescription>
                  Cheap metadata scan first, then a deeper AST pass once the project is accepted.
                </CardDescription>
              </div>
            </CardHeader>

            <CardSection>
              <ul className="divide-y divide-canvas-border">
                <PhaseRow
                  index={1}
                  title="Detect package manager & build tool"
                  hint="Reads package.json + lockfile fingerprints"
                  status="pending"
                />
                <PhaseRow
                  index={2}
                  title="Read dependency graph"
                  hint="Resolves direct + transitive deps"
                  status="pending"
                />
                <PhaseRow
                  index={3}
                  title="Walk source tree"
                  hint="Excludes node_modules, .git, dist, build"
                  status="pending"
                />
                <PhaseRow
                  index={4}
                  title="Risk analysis"
                  hint="Heuristic scoring per module + recommendation"
                  status="pending"
                />
              </ul>
            </CardSection>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Files scanned" value="—" />
            <Stat label="Dependencies" value="—" />
            <Stat label="Issues flagged" value="—" />
            <Stat label="Risk score" value="—" />
          </div>

          <EmptyState
            icon="scan"
            title="Scanner not started"
            description="Once a project is selected, scan results will stream incrementally here. Logs are also persisted to disk."
          />
        </div>
      </div>
    </div>
  );
}

interface PhaseRowProps {
  index: number;
  title: string;
  hint: string;
  status: 'idle' | 'pending' | 'running' | 'success' | 'warning' | 'error';
}

function PhaseRow({ index, title, hint, status }: PhaseRowProps): JSX.Element {
  return (
    <li className="flex items-center justify-between gap-4 py-3 first:pt-1 last:pb-1">
      <div className="flex items-center gap-3">
        <span className="flex h-6 w-6 items-center justify-center rounded-xs border border-canvas-border bg-canvas-subtle font-mono text-[10px] tabular-nums text-ink-subtle">
          {index}
        </span>
        <div>
          <p className="text-xs font-medium text-ink">{title}</p>
          <p className="text-2xs text-ink-subtle">{hint}</p>
        </div>
      </div>
      <StatusIndicator status={status} variant="chip" />
    </li>
  );
}

function Stat({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <Card padded={false} className="px-4 py-3">
      <p className="text-2xs font-medium uppercase tracking-[0.14em] text-ink-subtle">{label}</p>
      <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-ink">{value}</p>
    </Card>
  );
}
