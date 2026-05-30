import { Badge } from '@shared/ui/Badge';
import {
  Card,
  CardDescription,
  CardHeader,
  CardSection,
  CardTitle,
} from '@shared/ui/Card';
import { Icon } from '@shared/ui/Icon';

/**
 * ExecutionWorkspaceCard — shows the resolved workspace context the
 * scripted executor is bound to: workspace path, optional Git branch,
 * source path (read-only), and the approved plan's headline summary.
 *
 * Purely presentational. The screen owns the data sourcing.
 */
export interface ExecutionWorkspaceCardProps {
  readonly workspacePath: string;
  readonly sourcePath: string;
  readonly branchName?: string;
  readonly planTitle: string;
  readonly planTotalSteps: number;
}

export function ExecutionWorkspaceCard({
  workspacePath,
  sourcePath,
  branchName,
  planTitle,
  planTotalSteps,
}: ExecutionWorkspaceCardProps): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Workspace context</CardTitle>
          <CardDescription>
            Every execution writes only inside the workspace path below. The
            original project stays read-only.
          </CardDescription>
        </div>
        <Badge tone="success" variant="soft" withDot>
          Workspace ready
        </Badge>
      </CardHeader>

      <CardSection label="Identifiers">
        <dl className="grid grid-cols-1 gap-4 text-xs sm:grid-cols-2">
          <Field label="Workspace path" icon="folder" value={workspacePath} />
          {branchName !== undefined ? (
            <Field label="Branch" icon="git-branch" value={branchName} />
          ) : null}
          <Field label="Source project (read-only)" icon="folder" value={sourcePath} />
          <Field label="Approved plan" icon="plan" value={planTitle} mono={false} />
        </dl>
      </CardSection>

      <CardSection label="Plan summary">
        <p className="text-xs leading-relaxed text-ink-muted">
          {planTotalSteps} step{planTotalSteps === 1 ? '' : 's'} were generated for this
          project. Pick a step on the right to see whether the scripted
          executor can run it.
        </p>
      </CardSection>
    </Card>
  );
}

function Field({
  label,
  icon,
  value,
  mono = true,
}: {
  readonly label: string;
  readonly icon: 'folder' | 'git-branch' | 'plan';
  readonly value: string;
  readonly mono?: boolean;
}): JSX.Element {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-2xs font-medium uppercase tracking-[0.12em] text-ink-subtle">
        <Icon name={icon} className="h-3 w-3" />
        {label}
      </dt>
      <dd
        className={`mt-1.5 break-all rounded-xs border border-canvas-border bg-canvas-subtle px-2 py-1.5 text-xs text-ink-muted ${
          mono ? 'font-mono' : ''
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
