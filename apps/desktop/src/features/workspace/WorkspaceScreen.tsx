import { PageHeader } from '@shared/ui/PageHeader';
import { Card, CardDescription, CardHeader, CardTitle } from '@shared/ui/Card';
import { Button } from '@shared/ui/Button';
import { Badge } from '@shared/ui/Badge';

/**
 * Step 5 - Workspace Creation Confirmation.
 *
 * Explicit human approval gate before any Git mutation. The orchestrator
 * will refuse to create a workspace until the user confirms here.
 */
export function WorkspaceScreen(): JSX.Element {
  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Create migration workspace"
        subtitle="A new Git branch and worktree will be created. The original project is not modified."
        actions={
          <>
            <Button variant="secondary" disabled>
              Cancel
            </Button>
            <Button disabled>Create workspace</Button>
          </>
        }
      />

      <div className="flex-1 space-y-4 overflow-y-auto p-6">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Workspace details</CardTitle>
              <CardDescription>
                Branch and worktree path are derived from the project name and session id.
              </CardDescription>
            </div>
            <Badge tone="info">Safe</Badge>
          </CardHeader>
          <dl className="grid grid-cols-1 gap-2 text-xs text-ink-muted sm:grid-cols-2">
            <div>
              <dt className="text-2xs uppercase tracking-wider text-ink-subtle">Branch</dt>
              <dd className="font-mono">migration/react-ts/session-XXX</dd>
            </div>
            <div>
              <dt className="text-2xs uppercase tracking-wider text-ink-subtle">Workspace path</dt>
              <dd className="font-mono">~/LegacyModernizer/workspaces/&lt;project&gt;/&lt;session&gt;</dd>
            </div>
          </dl>
        </Card>
      </div>
    </div>
  );
}
