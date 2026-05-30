import { Badge } from '@shared/ui/Badge';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@shared/ui/Card';

import {
  LOG_LEVEL_LABEL,
  LOG_LEVEL_TONE,
  formatLogTimestamp,
} from '../services/executionPresentationService';
import type { ExecutionLogEntry } from '../types/execution.types';

/**
 * ExecutionLogPanel — auditable, append-only timeline of the executor.
 *
 * Logs are captured server-side and rendered after the command returns
 * (Milestone 6 has no streaming). The panel intentionally renders the
 * timestamp + level next to every entry so the user can audit ordering.
 */
export interface ExecutionLogPanelProps {
  readonly logs: readonly ExecutionLogEntry[];
  readonly title?: string;
  readonly description?: string;
}

export function ExecutionLogPanel({
  logs,
  title = 'Execution logs',
  description = 'Captured by the scripted executor. Logs are read-only and appended in chronological order.',
}: ExecutionLogPanelProps): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <Badge tone="neutral" variant="outline">
          {logs.length} entr{logs.length === 1 ? 'y' : 'ies'}
        </Badge>
      </CardHeader>
      {logs.length === 0 ? (
        <p className="text-xs text-ink-muted">No log entries captured yet.</p>
      ) : (
        <ol className="space-y-1.5">
          {logs.map((log, index) => (
            <li
              key={`${log.timestamp}-${index}`}
              className="rounded-xs border border-canvas-border bg-canvas-subtle/60 px-2.5 py-1.5"
            >
              <div className="flex items-center gap-2 text-2xs">
                <span className="font-mono text-ink-faint">
                  {formatLogTimestamp(log.timestamp)}
                </span>
                <Badge tone={LOG_LEVEL_TONE[log.level]} variant="soft" uppercase>
                  {LOG_LEVEL_LABEL[log.level]}
                </Badge>
                <span className="text-ink">{log.message}</span>
              </div>
              {log.detail !== undefined ? (
                <pre className="mt-1.5 overflow-x-auto rounded-xs border border-canvas-border bg-canvas-subtle px-2 py-1.5 font-mono text-2xs leading-snug text-ink-subtle">
                  {log.detail}
                </pre>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
