import { Badge } from '@shared/ui/Badge';
import {
  Card,
  CardDescription,
  CardHeader,
  CardSection,
  CardTitle,
} from '@shared/ui/Card';
import { Icon } from '@shared/ui/Icon';

import {
  CHANGE_TYPE_LABEL,
  CHANGE_TYPE_TONE,
} from '../services/executionPresentationService';
import type { ExecutionStepRun } from '../types/execution.types';

/**
 * ExecutionResultCard — summary of the most recent run for the selected
 * step. Renders the success/failure banner, identifying metadata, and the
 * list of files the executor touched.
 */
export interface ExecutionResultCardProps {
  readonly run: ExecutionStepRun;
}

export function ExecutionResultCard({
  run,
}: ExecutionResultCardProps): JSX.Element {
  const isSuccess = run.status === 'completed';

  return (
    <Card accent={isSuccess}>
      <CardHeader>
        <div>
          <CardTitle>Execution result</CardTitle>
          <CardDescription>
            Captured by the scripted executor on {formatTimestamp(run.startedAt)}.
          </CardDescription>
        </div>
        <Badge
          tone={isSuccess ? 'success' : 'danger'}
          variant="soft"
          withDot
          uppercase
        >
          {isSuccess ? 'Completed' : 'Failed'}
        </Badge>
      </CardHeader>

      <div
        className={`flex items-start gap-3 rounded-md border px-4 py-3 ${
          isSuccess
            ? 'border-success/40 bg-success-soft'
            : 'border-danger/40 bg-danger-soft'
        }`}
      >
        <span
          className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
            isSuccess ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'
          }`}
        >
          <Icon name={isSuccess ? 'check' : 'cross'} className="h-3 w-3" />
        </span>
        <div className="min-w-0 flex-1">
          <p
            className={`text-xs font-semibold ${
              isSuccess ? 'text-success' : 'text-danger'
            }`}
          >
            {isSuccess ? 'Step completed safely' : 'Step failed'}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-ink-muted">
            {isSuccess
              ? 'Only the workspace package.json was modified. The original project remains untouched.'
              : (run.error?.message ?? 'See logs for details.')}
          </p>
        </div>
      </div>

      <CardSection label="Identifiers">
        <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
          <Field label="Run id" icon="dot" value={run.id} />
          <Field label="Plan step id" icon="plan" value={run.planStepId} />
          <Field
            label="Workspace path"
            icon="folder"
            value={run.workspacePath}
          />
          <Field label="Executor" icon="play" value={run.executor} />
        </dl>
      </CardSection>

      <CardSection label="Changed files">
        {run.changedFiles.length === 0 ? (
          <p className="text-xs text-ink-muted">
            No files were changed by this run.
          </p>
        ) : (
          <ul className="divide-y divide-canvas-border">
            {run.changedFiles.map((file) => (
              <li
                key={file.path}
                className="flex flex-col gap-1.5 py-2.5 first:pt-1 last:pb-1 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="min-w-0">
                  <code className="block break-all rounded-xs border border-canvas-border bg-canvas-subtle px-2 py-1 font-mono text-xs text-ink">
                    {file.path}
                  </code>
                  <p className="mt-1.5 text-2xs leading-relaxed text-ink-muted">
                    {file.summary}
                  </p>
                </div>
                <Badge
                  tone={CHANGE_TYPE_TONE[file.changeType]}
                  variant="soft"
                  uppercase
                  className="shrink-0"
                >
                  {CHANGE_TYPE_LABEL[file.changeType]}
                </Badge>
              </li>
            ))}
          </ul>
        )}
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
  readonly icon: 'folder' | 'plan' | 'play' | 'dot';
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
