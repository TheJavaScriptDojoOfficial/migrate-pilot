import { Badge } from '@shared/ui/Badge';
import { Card, CardDescription, CardHeader, CardSection, CardTitle } from '@shared/ui/Card';
import { Icon } from '@shared/ui/Icon';

import type { WorkspacePreflight } from '../types/workspace.types';

/**
 * WorkspacePreflightCard — shows the proposed branch, the proposed
 * workspace path, and the preflight outcome at a glance.
 */
export interface WorkspacePreflightCardProps {
  readonly preflight: WorkspacePreflight;
}

export function WorkspacePreflightCard({
  preflight,
}: WorkspacePreflightCardProps): JSX.Element {
  const blockers = preflight.blockers.length;
  const warnings = preflight.warnings.length;

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Workspace destination</CardTitle>
          <CardDescription>
            These names were generated deterministically and validated server-
            side. You confirm before any Git operation runs.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          {blockers > 0 ? (
            <Badge tone="danger" variant="soft" withDot>
              {blockers} blocker{blockers === 1 ? '' : 's'}
            </Badge>
          ) : null}
          {warnings > 0 ? (
            <Badge tone="warning" variant="soft" withDot>
              {warnings} warning{warnings === 1 ? '' : 's'}
            </Badge>
          ) : null}
          {blockers === 0 && warnings === 0 ? (
            <Badge tone="success" variant="soft" withDot>
              Preflight clear
            </Badge>
          ) : null}
        </div>
      </CardHeader>

      <CardSection label="Proposed identifiers">
        <dl className="grid grid-cols-1 gap-4 text-xs sm:grid-cols-2">
          <Field
            label="Migration branch"
            icon="git-branch"
            value={preflight.proposedBranchName}
          />
          <Field
            label="Workspace path"
            icon="folder"
            value={preflight.proposedWorkspacePath}
          />
        </dl>
      </CardSection>

      <CardSection label="Safety guarantees">
        <ul className="grid gap-2 text-xs text-ink-muted sm:grid-cols-2">
          <Bullet>The original project stays read-only.</Bullet>
          <Bullet>Workspace path lives outside the source folder.</Bullet>
          <Bullet>Branch name is sanitised and collision-checked.</Bullet>
          <Bullet>No package manager command runs.</Bullet>
          <Bullet>No AI provider is contacted.</Bullet>
          <Bullet>No file is overwritten or deleted.</Bullet>
        </ul>
      </CardSection>
    </Card>
  );
}

function Field({
  label,
  icon,
  value,
}: {
  readonly label: string;
  readonly icon: 'folder' | 'git-branch';
  readonly value: string;
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

function Bullet({ children }: { readonly children: React.ReactNode }): JSX.Element {
  return (
    <li className="flex items-start gap-2">
      <Icon name="check" className="mt-0.5 h-3 w-3 shrink-0 text-success" />
      <span>{children}</span>
    </li>
  );
}
