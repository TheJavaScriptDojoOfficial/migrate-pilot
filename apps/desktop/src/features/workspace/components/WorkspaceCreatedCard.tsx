import { Badge } from '@shared/ui/Badge';
import { Card, CardDescription, CardHeader, CardSection, CardTitle } from '@shared/ui/Card';
import { Icon } from '@shared/ui/Icon';

import {
  STRATEGY_ICON,
  STRATEGY_LABEL,
  STRATEGY_TONE,
} from '../services/workspacePresentationService';
import type { WorkspaceCreationResult } from '../types/workspace.types';

/**
 * WorkspaceCreatedCard — shown after a successful workspace creation.
 *
 * Surfaces the resolved branch + path, lists the Git commands that ran
 * verbatim (so reviewers can audit the operation), and gives the user a
 * clear hand-off message before the next step.
 */
export interface WorkspaceCreatedCardProps {
  readonly result: WorkspaceCreationResult;
}

export function WorkspaceCreatedCard({
  result,
}: WorkspaceCreatedCardProps): JSX.Element {
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
              Created at {formatTimestamp(result.createdAt)}.
            </CardDescription>
          </div>
          <Badge tone={STRATEGY_TONE[result.strategy]} variant="soft" withDot>
            <Icon name={STRATEGY_ICON[result.strategy]} className="h-3 w-3" />
            {STRATEGY_LABEL[result.strategy]}
          </Badge>
        </CardHeader>

        <CardSection label="Identifiers">
          <dl className="grid grid-cols-1 gap-4 text-xs sm:grid-cols-2">
            <Field
              label="Workspace path"
              icon="folder"
              value={result.workspacePath}
            />
            {result.branchName !== undefined ? (
              <Field
                label="Branch name"
                icon="git-branch"
                value={result.branchName}
              />
            ) : null}
            <Field label="Source project" icon="folder" value={result.sourcePath} />
            <Field label="Workspace id" icon="folder" value={result.id} />
          </dl>
        </CardSection>

        {result.commandLogs.length > 0 ? (
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

function formatTimestamp(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleString();
}
