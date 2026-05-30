import { Badge } from '@shared/ui/Badge';
import { Button } from '@shared/ui/Button';
import { Card, CardDescription, CardHeader, CardSection, CardTitle } from '@shared/ui/Card';
import { Icon } from '@shared/ui/Icon';
import { PageHeader } from '@shared/ui/PageHeader';
import { StepEyebrow } from '@shared/ui/StepEyebrow';

/**
 * Step 5 — Workspace Creation Confirmation.
 *
 * Explicit human approval gate before any Git mutation. The orchestrator
 * will refuse to create a workspace until the user confirms here.
 */
export function WorkspaceScreen(): JSX.Element {
  return (
    <div className="flex h-full flex-col">
      <PageHeader
        eyebrow={<StepEyebrow number={5} icon="workspace" label="Workspace" />}
        title="Create migration workspace"
        subtitle="A new Git branch and worktree will be created. The original project is not modified — every edit is isolated."
        actions={
          <>
            <Button variant="secondary" size="md" disabled>
              Cancel
            </Button>
            <Button
              size="md"
              leadingIcon={<Icon name="git-branch" />}
              disabled
            >
              Create workspace
            </Button>
          </>
        }
        meta={
          <>
            <Badge tone="success" withDot variant="soft">
              Reversible
            </Badge>
            <Badge tone="neutral" variant="outline">
              No remote push
            </Badge>
          </>
        }
      />

      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="mx-auto flex max-w-5xl flex-col gap-6">
          <Card accent>
            <CardHeader>
              <div>
                <CardTitle>Workspace details</CardTitle>
                <CardDescription>
                  Branch and worktree path are derived from the project name and the active
                  session id. You can rename either before creation.
                </CardDescription>
              </div>
              <Badge tone="info" variant="soft">
                Preview
              </Badge>
            </CardHeader>

            <CardSection label="Destination">
              <dl className="grid grid-cols-1 gap-4 text-xs sm:grid-cols-2">
                <Field
                  label="Branch"
                  value="migration/react-ts/session-XXX"
                  icon="git-branch"
                />
                <Field
                  label="Workspace path"
                  value="~/LegacyModernizer/workspaces/<project>/<session>"
                  icon="folder"
                />
              </dl>
            </CardSection>

            <CardSection label="Guardrails">
              <ul className="grid gap-2 text-xs text-ink-muted sm:grid-cols-2">
                <Bullet>The original project stays read-only.</Bullet>
                <Bullet>Workspace is a Git worktree — fast and disposable.</Bullet>
                <Bullet>Every step commits to a fresh branch.</Bullet>
                <Bullet>Rollback is one `git worktree remove` away.</Bullet>
              </ul>
            </CardSection>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: 'folder' | 'git-branch';
}): JSX.Element {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-2xs font-medium uppercase tracking-[0.12em] text-ink-subtle">
        <Icon name={icon} className="h-3 w-3" />
        {label}
      </dt>
      <dd className="mt-1.5 break-all rounded-xs border border-canvas-border bg-canvas-subtle px-2 py-1.5 font-mono text-xs text-ink-muted">
        {value}
      </dd>
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <li className="flex items-start gap-2">
      <Icon name="check" className="mt-0.5 h-3 w-3 shrink-0 text-success" />
      <span>{children}</span>
    </li>
  );
}
