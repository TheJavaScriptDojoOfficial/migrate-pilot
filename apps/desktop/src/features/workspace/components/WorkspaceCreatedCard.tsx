import { Badge } from '@shared/ui/Badge';
import { Card, CardDescription, CardHeader, CardSection, CardTitle } from '@shared/ui/Card';
import { Icon } from '@shared/ui/Icon';

import {
  CLEANLINESS_LABEL,
  CLEANLINESS_TONE,
  STRATEGY_ICON,
  STRATEGY_LABEL,
  STRATEGY_TONE,
} from '../services/workspacePresentationService';
import type {
  WorkspaceCreationResult,
  WorkspaceState,
} from '../types/workspace.types';

/**
 * WorkspaceCreatedCard — shown after a successful workspace creation.
 *
 * Phase R5 surfaces the persisted {@link WorkspaceState} verbatim so
 * the user (and the execution screen) can see exactly what is being
 * handed off:
 *   - workspace path + branch name (the worktree the executor will
 *     mutate)
 *   - resolved strategy + package manager + plan id (so missing
 *     metadata is visible up-front)
 *   - baseline Git status captured at creation time
 *   - command logs from the Tauri creation pipeline (audit trail)
 *
 * The component is purely presentational — the screen owns the data
 * sourcing and gates the "Continue" action separately.
 */
export interface WorkspaceCreatedCardProps {
  readonly workspace: WorkspaceState;
  readonly result?: WorkspaceCreationResult;
}

export function WorkspaceCreatedCard({
  workspace,
  result,
}: WorkspaceCreatedCardProps): JSX.Element {
  const cleanliness: 'clean' | 'dirty' | 'unknown' = workspace.gitStatus.isClean
    ? 'clean'
    : workspace.gitStatus.isGitRepository
      ? 'dirty'
      : 'unknown';

  return (
    <>
      <div className="flex items-start gap-3 rounded-md border border-success/40 bg-success-soft px-4 py-3">
        <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success/20 text-success">
          <Icon name="check" className="h-3 w-3" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-success">Workspace ready</p>
          <p className="mt-1 text-xs leading-relaxed text-ink-muted">
            The migration workspace has been created. The original project is
            untouched. Future migration steps will edit only inside the
            workspace path below.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Workspace summary</CardTitle>
            <CardDescription>
              Created at {formatTimestamp(workspace.createdAt)}.
            </CardDescription>
          </div>
          <Badge tone={STRATEGY_TONE[workspace.strategy]} variant="soft" withDot>
            <Icon name={STRATEGY_ICON[workspace.strategy]} className="h-3 w-3" />
            {STRATEGY_LABEL[workspace.strategy]}
          </Badge>
        </CardHeader>

        <CardSection label="Identifiers">
          <dl className="grid grid-cols-1 gap-4 text-xs sm:grid-cols-2">
            <Field
              label="Workspace path"
              icon="folder"
              value={workspace.workspacePath}
            />
            <Field
              label="Branch name"
              icon="git-branch"
              value={workspace.branchName}
            />
            <Field
              label="Original project (read-only)"
              icon="folder"
              value={workspace.originalProjectPath}
            />
            <Field
              label="Plan id"
              icon="plan"
              value={workspace.planId}
            />
          </dl>
        </CardSection>

        <CardSection label="Baseline">
          <dl className="grid grid-cols-1 gap-4 text-xs sm:grid-cols-2">
            <BadgeField
              label="Working tree"
              tone={CLEANLINESS_TONE[cleanliness]}
              value={CLEANLINESS_LABEL[cleanliness]}
            />
            <BadgeField
              label="Source branch"
              tone="neutral"
              value={workspace.gitStatus.currentBranch ?? 'Unknown'}
              mono={workspace.gitStatus.currentBranch !== undefined}
            />
            <BadgeField
              label="Package manager"
              tone="neutral"
              value={workspace.packageManager ?? 'unknown'}
              mono
            />
            <BadgeField
              label="Strategy"
              tone={STRATEGY_TONE[workspace.strategy]}
              value={STRATEGY_LABEL[workspace.strategy]}
            />
          </dl>
          {workspace.gitStatus.summary !== undefined ? (
            <p className="mt-3 text-2xs leading-relaxed text-ink-subtle">
              {workspace.gitStatus.summary}
            </p>
          ) : null}
        </CardSection>

        {result?.commandLogs && result.commandLogs.length > 0 ? (
          <CardSection label="Commands run">
            <ul className="divide-y divide-canvas-border">
              {result.commandLogs.map((log) => (
                <li key={log.command} className="flex flex-col gap-2 py-3 first:pt-1 last:pb-1">
                  <div className="flex items-center justify-between gap-3">
                    <code className="break-all rounded-xs border border-canvas-border bg-canvas-subtle px-2 py-1 font-mono text-xs text-ink">
                      {log.command}
                    </code>
                    <Badge
                      tone={log.status === 'passed' ? 'success' : 'danger'}
                      variant="soft"
                      uppercase
                    >
                      {log.status}
                    </Badge>
                  </div>
                  {log.stdout !== undefined ? (
                    <pre className="overflow-x-auto rounded-xs border border-canvas-border bg-canvas-subtle p-2 font-mono text-2xs text-ink-subtle">
                      {log.stdout}
                    </pre>
                  ) : null}
                  {log.stderr !== undefined ? (
                    <pre className="overflow-x-auto rounded-xs border border-canvas-border bg-canvas-subtle p-2 font-mono text-2xs text-danger">
                      {log.stderr}
                    </pre>
                  ) : null}
                </li>
              ))}
            </ul>
          </CardSection>
        ) : null}
      </Card>
    </>
  );
}

import type { BadgeTone } from '@shared/ui/Badge';

function Field({
  label,
  icon,
  value,
}: {
  readonly label: string;
  readonly icon: 'folder' | 'git-branch' | 'plan';
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

function BadgeField({
  label,
  value,
  tone,
  mono,
}: {
  readonly label: string;
  readonly value: string;
  readonly tone: BadgeTone;
  readonly mono?: boolean;
}): JSX.Element {
  return (
    <div>
      <dt className="text-2xs font-medium uppercase tracking-[0.12em] text-ink-subtle">
        {label}
      </dt>
      <dd className="mt-1.5">
        <Badge tone={tone} variant="soft">
          <span className={mono === true ? 'font-mono' : undefined}>{value}</span>
        </Badge>
      </dd>
    </div>
  );
}

function formatTimestamp(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleString();
}
