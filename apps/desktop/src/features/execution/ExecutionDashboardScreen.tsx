import { Badge } from '@shared/ui/Badge';
import { Button } from '@shared/ui/Button';
import { Card, CardDescription, CardHeader, CardSection, CardTitle } from '@shared/ui/Card';
import { EmptyState } from '@shared/ui/EmptyState';
import { Icon } from '@shared/ui/Icon';
import { PageHeader } from '@shared/ui/PageHeader';
import { StatusIndicator } from '@shared/ui/StatusIndicator';
import { StepEyebrow } from '@shared/ui/StepEyebrow';

/**
 * Step 6 — Execution Dashboard.
 *
 * Streams provider + validation logs for the currently running step.
 * IMPORTANT: do not buffer the entire log stream in React state — render
 * line-by-line, cap in-memory history, and persist to NDJSON on disk.
 */
export function ExecutionDashboardScreen(): JSX.Element {
  return (
    <div className="flex h-full flex-col">
      <PageHeader
        eyebrow={<StepEyebrow number={6} icon="play" label="Execute" />}
        title="Execution"
        subtitle="One migration step at a time. Output streams directly from the orchestrator with no UI buffering."
        actions={
          <>
            <Button variant="ghost" size="sm" disabled>
              Skip step
            </Button>
            <Button variant="secondary" size="md" disabled>
              Pause
            </Button>
            <Button
              size="md"
              leadingIcon={<Icon name="play" />}
              disabled
            >
              Run step
            </Button>
          </>
        }
        meta={<StatusIndicator status="idle" label="Idle" variant="chip" />}
      />

      <div className="flex min-h-0 flex-1">
        {/* Step navigator (left) */}
        <aside className="hidden w-64 shrink-0 flex-col border-r border-canvas-border bg-canvas-subtle-2 lg:flex">
          <div className="border-b border-canvas-border px-4 py-3">
            <p className="text-2xs font-medium uppercase tracking-[0.14em] text-ink-subtle">
              Steps queue
            </p>
            <p className="mt-1 text-2xs text-ink-faint">0 of 0 ready</p>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-3 text-xs text-ink-subtle">
            <p>No steps queued.</p>
          </div>
        </aside>

        {/* Main pane */}
        <div className="flex min-w-0 flex-1 flex-col overflow-y-auto px-8 py-6">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Current step</CardTitle>
                  <CardDescription>
                    The currently selected step will appear here with controls to run, cancel,
                    or skip.
                  </CardDescription>
                </div>
                <Badge tone="neutral" variant="outline">
                  No step selected
                </Badge>
              </CardHeader>

              <CardSection label="Provider output">
                <LogPane placeholder="AI-provider stdout/stderr will stream here." />
              </CardSection>

              <CardSection label="Validation output">
                <LogPane placeholder="Type-checker, linter, and test output will stream here." />
              </CardSection>
            </Card>

            <EmptyState
              icon="play"
              title="No active step"
              description="When a step is running, AI output and validation logs will stream here. Logs are also persisted to NDJSON on disk."
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function LogPane({ placeholder }: { placeholder: string }): JSX.Element {
  return (
    <div className="rounded-md border border-canvas-border bg-canvas-subtle">
      <div className="flex items-center justify-between border-b border-canvas-border px-3 py-1.5 text-2xs text-ink-subtle">
        <span className="font-mono">stream • paused</span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-ink-faint" aria-hidden />
          idle
        </span>
      </div>
      <pre className="max-h-48 overflow-auto p-3 font-mono text-2xs leading-relaxed text-ink-faint">
        {placeholder}
      </pre>
    </div>
  );
}
