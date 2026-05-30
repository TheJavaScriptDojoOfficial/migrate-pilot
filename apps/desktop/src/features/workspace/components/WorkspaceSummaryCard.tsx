import { Badge } from '@shared/ui/Badge';
import { Card, CardDescription, CardHeader, CardSection, CardTitle } from '@shared/ui/Card';
import { Icon } from '@shared/ui/Icon';

/**
 * WorkspaceSummaryCard — top-of-screen context.
 *
 * Shows the source project, the approved plan title, and the high-level
 * intent for the workspace step. Purely presentational.
 */
export interface WorkspaceSummaryCardProps {
  readonly projectName: string;
  readonly sourcePath: string;
  readonly planTitle: string;
  readonly planTotalSteps: number;
}

export function WorkspaceSummaryCard({
  projectName,
  sourcePath,
  planTitle,
  planTotalSteps,
}: WorkspaceSummaryCardProps): JSX.Element {
  return (
    <Card accent>
      <CardHeader>
        <div>
          <CardTitle>Workspace context</CardTitle>
          <CardDescription>
            The original project stays read-only. Every change made by future
            migration steps lands inside the workspace, not the source folder.
          </CardDescription>
        </div>
        <Badge tone="success" variant="soft" withDot>
          Source read-only
        </Badge>
      </CardHeader>

      <CardSection label="Source project">
        <dl className="grid grid-cols-1 gap-4 text-xs sm:grid-cols-2">
          <Field label="Name" icon="folder" value={projectName} />
          <Field label="Path" icon="folder" value={sourcePath} mono />
        </dl>
      </CardSection>

      <CardSection label="Approved plan">
        <dl className="grid grid-cols-1 gap-4 text-xs sm:grid-cols-2">
          <Field label="Title" icon="plan" value={planTitle} />
          <Field
            label="Steps"
            icon="plan"
            value={`${planTotalSteps} step${planTotalSteps === 1 ? '' : 's'}`}
          />
        </dl>
      </CardSection>
    </Card>
  );
}

function Field({
  label,
  icon,
  value,
  mono,
}: {
  readonly label: string;
  readonly icon: 'folder' | 'plan';
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
        className={
          mono === true
            ? 'mt-1.5 break-all rounded-xs border border-canvas-border bg-canvas-subtle px-2 py-1.5 font-mono text-xs text-ink-muted'
            : 'mt-1.5 text-xs text-ink'
        }
      >
        {value}
      </dd>
    </div>
  );
}
