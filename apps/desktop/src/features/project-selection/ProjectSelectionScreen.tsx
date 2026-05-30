import { Badge } from '@shared/ui/Badge';
import { Button } from '@shared/ui/Button';
import { Card, CardDescription, CardHeader, CardSection, CardTitle } from '@shared/ui/Card';
import { EmptyState } from '@shared/ui/EmptyState';
import { Icon } from '@shared/ui/Icon';
import { PageHeader } from '@shared/ui/PageHeader';
import { StepEyebrow } from '@shared/ui/StepEyebrow';

/**
 * Step 1 — Project Selection.
 *
 * Lets the user pick a local React project to register as a Project.
 * The orchestrator only reads from the selected path. All future mutations
 * happen inside a derived Git worktree.
 */
export function ProjectSelectionScreen(): JSX.Element {
  return (
    <div className="flex h-full flex-col">
      <PageHeader
        eyebrow={<StepEyebrow number={1} icon="folder" label="Project" />}
        title="Select a project"
        subtitle="Choose the React project you want Migrate Pilot to analyse. The original repository will remain read-only throughout the session."
        meta={
          <>
            <Badge tone="success" variant="soft" withDot>
              Read-only safe
            </Badge>
            <Badge tone="neutral" variant="outline">
              No network calls
            </Badge>
          </>
        }
        actions={
          <>
            <Button variant="ghost" size="sm" disabled>
              Recent…
            </Button>
            <Button
              size="md"
              leadingIcon={<Icon name="folder" />}
              disabled
              title="Wired up in a follow-up step"
            >
              Choose folder…
            </Button>
          </>
        }
      />

      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="mx-auto flex max-w-5xl flex-col gap-6">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <div>
                  <CardTitle>What Migrate Pilot will do</CardTitle>
                  <CardDescription>
                    Scan, plan, and execute migration steps inside a Git worktree.
                  </CardDescription>
                </div>
                <Badge tone="accent" variant="soft" uppercase>
                  Local-first
                </Badge>
              </CardHeader>

              <CardSection label="Capabilities">
                <ul className="grid gap-2 text-xs text-ink-muted sm:grid-cols-2">
                  <FeatureLine>
                    Detect package manager, React version, build tool, routing, state libraries.
                  </FeatureLine>
                  <FeatureLine>
                    Score risk and recommend a safe migration order.
                  </FeatureLine>
                  <FeatureLine>
                    Produce a step-by-step plan you can review and edit.
                  </FeatureLine>
                  <FeatureLine>
                    Never modify the selected project directly.
                  </FeatureLine>
                </ul>
              </CardSection>

              <CardSection label="What happens next">
                <ol className="grid gap-2 text-xs text-ink-muted">
                  <NumberedLine n={1}>
                    Validate the folder is a Git repository on a clean working tree.
                  </NumberedLine>
                  <NumberedLine n={2}>
                    Run a quick metadata scan (package.json, lockfile, config files).
                  </NumberedLine>
                  <NumberedLine n={3}>
                    Surface a project snapshot before the deeper AST scan.
                  </NumberedLine>
                </ol>
              </CardSection>
            </Card>

            <Card tone="subtle">
              <CardHeader>
                <div>
                  <CardTitle>Requirements</CardTitle>
                  <CardDescription>
                    The orchestrator will halt politely if any of these are missing.
                  </CardDescription>
                </div>
              </CardHeader>
              <ul className="space-y-2.5 text-xs text-ink-muted">
                <RequirementLine label="Git repository" />
                <RequirementLine label="package.json present" />
                <RequirementLine label="Clean working tree" />
                <RequirementLine label="Node 18+ available on PATH" />
              </ul>
            </Card>
          </div>

          <EmptyState
            icon="folder"
            title="No project selected yet"
            description="Pick a local React project folder to get started. We validate that it is a Git repository before any scan runs."
            action={
              <Button leadingIcon={<Icon name="folder" />} disabled>
                Choose folder…
              </Button>
            }
          />
        </div>
      </div>
    </div>
  );
}

function FeatureLine({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <li className="flex items-start gap-2">
      <Icon name="check" className="mt-0.5 h-3 w-3 shrink-0 text-success" />
      <span>{children}</span>
    </li>
  );
}

function NumberedLine({ n, children }: { n: number; children: React.ReactNode }): JSX.Element {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-xs border border-canvas-border bg-canvas-subtle font-mono text-[10px] tabular-nums text-ink-subtle">
        {n}
      </span>
      <span>{children}</span>
    </li>
  );
}

function RequirementLine({ label }: { label: string }): JSX.Element {
  return (
    <li className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2">
        <Icon name="check-circle" className="h-3.5 w-3.5 text-ink-subtle" />
        {label}
      </span>
      <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
        pending
      </span>
    </li>
  );
}
