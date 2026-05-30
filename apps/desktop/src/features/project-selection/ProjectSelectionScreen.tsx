import { PageHeader } from '@shared/ui/PageHeader';
import { Card, CardDescription, CardHeader, CardTitle } from '@shared/ui/Card';
import { Button } from '@shared/ui/Button';
import { EmptyState } from '@shared/ui/EmptyState';

/**
 * Step 1 - Project Selection.
 *
 * Lets the user pick a local React project to register as a Project.
 * The orchestrator only reads from the selected path. All future mutations
 * happen inside a derived Git worktree.
 */
export function ProjectSelectionScreen(): JSX.Element {
  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Select a project"
        subtitle="Choose the React project you want Migrate Pilot to analyse. The original repository will remain read-only."
        actions={
          <Button disabled title="Wired up in a follow-up step">
            Choose folder…
          </Button>
        }
      />

      <div className="flex-1 space-y-4 overflow-y-auto p-6">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>What Migrate Pilot will do</CardTitle>
              <CardDescription>
                Scan, plan, and execute migration steps inside a Git worktree.
              </CardDescription>
            </div>
          </CardHeader>
          <ul className="space-y-1 text-xs text-ink-muted">
            <li>· Detect package manager, React version, build tool, routing, state libraries.</li>
            <li>· Score risk and recommend safe migration order.</li>
            <li>· Produce a step-by-step plan you can review and edit.</li>
            <li>· Never modify the selected project directly.</li>
          </ul>
        </Card>

        <div className="flex items-center justify-center pt-6">
          <EmptyState
            title="No project selected yet"
            description="Pick a local React project folder to get started. We will validate that it has a Git repository before scanning."
          />
        </div>
      </div>
    </div>
  );
}
