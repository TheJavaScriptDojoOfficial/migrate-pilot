import { Badge } from '@shared/ui/Badge';
import {
  Card,
  CardDescription,
  CardHeader,
  CardSection,
  CardTitle,
} from '@shared/ui/Card';
import { Icon } from '@shared/ui/Icon';

import type {
  WorkspacePackageManager,
  WorkspaceStrategy,
} from '@features/workspace';

/**
 * ExecutionWorkspaceCard — shows the resolved workspace context the
 * scripted executor is bound to.
 *
 * Phase R5 surfaces the full handoff metadata so the user can verify
 * the executor is targeting the workspace (not the original project)
 * before running anything: workspace path, branch, strategy, plan id,
 * track, and (optional) package manager. The original project path is
 * shown clearly with a "read-only" annotation.
 *
 * Purely presentational — the screen owns the data sourcing.
 */
export interface ExecutionWorkspaceCardProps {
  readonly workspacePath: string;
  readonly sourcePath: string;
  readonly branchName: string;
  readonly strategy: WorkspaceStrategy;
  readonly planId: string;
  readonly planTitle: string;
  readonly planTotalSteps: number;
  readonly track: string;
  readonly packageManager?: WorkspacePackageManager;
}

const STRATEGY_LABEL: Record<WorkspaceStrategy, string> = {
  'git-worktree': 'Git worktree',
  copy: 'Copy fallback',
};

export function ExecutionWorkspaceCard({
  workspacePath,
  sourcePath,
  branchName,
  strategy,
  planId,
  planTitle,
  planTotalSteps,
  track,
  packageManager,
}: ExecutionWorkspaceCardProps): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Workspace context</CardTitle>
          <CardDescription>
            Execution will run inside the migration workspace below — the
            original project stays read-only. The execution engine never
            silently falls back to the original project path.
          </CardDescription>
        </div>
        <Badge tone="success" variant="soft" withDot>
          Workspace ready
        </Badge>
      </CardHeader>

      <CardSection label="Identifiers">
        <dl className="grid grid-cols-1 gap-4 text-xs sm:grid-cols-2">
          <Field label="Workspace path" icon="folder" value={workspacePath} />
          <Field label="Branch" icon="git-branch" value={branchName} />
          <Field
            label="Original project (read-only)"
            icon="folder"
            value={sourcePath}
          />
          <Field label="Plan id" icon="plan" value={planId} />
        </dl>
      </CardSection>

      <CardSection label="Handoff metadata">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone="success" variant="soft" withDot>
            <Icon name="git-branch" className="h-3 w-3" />
            Strategy: {STRATEGY_LABEL[strategy]}
          </Badge>
          <Badge tone="accent" variant="soft" uppercase>
            Track: {track}
          </Badge>
          <Badge tone="neutral" variant="outline" className="font-mono">
            Package manager: {packageManager ?? 'unknown'}
          </Badge>
          <Badge tone="info" variant="outline">
            {planTotalSteps} executable step{planTotalSteps === 1 ? '' : 's'}
          </Badge>
        </div>
      </CardSection>

      <CardSection label="Plan summary">
        <p className="text-xs leading-relaxed text-ink-muted">
          <span className="font-semibold text-ink">{planTitle}</span> —{' '}
          {planTotalSteps} executable step{planTotalSteps === 1 ? '' : 's'}{' '}
          will run inside the workspace, not the original project. Pick a
          step on the right to see whether the scripted executor can run it.
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
