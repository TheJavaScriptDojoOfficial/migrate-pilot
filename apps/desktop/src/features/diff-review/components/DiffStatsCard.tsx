import { Badge } from '@shared/ui/Badge';
import {
  Card,
  CardDescription,
  CardHeader,
  CardSection,
  CardTitle,
} from '@shared/ui/Card';

import type { DiffCommandLog } from '../types/diffReview.types';

/**
 * DiffStatsCard — collapsible summary of the Git command log captured
 * while loading or rejecting the diff. Lets the user verify the exact
 * commands the safe loader / revert executed.
 */
export interface DiffStatsCardProps {
  readonly title: string;
  readonly description: string;
  readonly logs: readonly DiffCommandLog[];
}

export function DiffStatsCard({
  title,
  description,
  logs,
}: DiffStatsCardProps): JSX.Element {
  if (logs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <Badge tone="neutral" variant="outline">
            0 commands
          </Badge>
        </CardHeader>
        <p className="text-xs text-ink-muted">No Git commands were captured.</p>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <Badge tone="neutral" variant="outline">
          {logs.length} command{logs.length === 1 ? '' : 's'}
        </Badge>
      </CardHeader>

      <ul className="space-y-2">
        {logs.map((log, index) => (
          <li key={`${log.command}-${index}`}>
            <CardSection label={`#${index + 1}`}>
              <div className="flex flex-wrap items-center gap-2">
                <code className="block flex-1 break-all rounded-xs border border-canvas-border bg-canvas-subtle px-2 py-1 font-mono text-2xs text-ink">
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
                <pre className="mt-2 max-h-40 overflow-auto rounded-xs border border-canvas-border bg-canvas-subtle px-2 py-1.5 font-mono text-2xs text-ink-subtle">
                  {log.stdout}
                </pre>
              ) : null}
              {log.stderr !== undefined ? (
                <pre className="mt-2 max-h-40 overflow-auto rounded-xs border border-danger/30 bg-danger-soft px-2 py-1.5 font-mono text-2xs text-danger">
                  {log.stderr}
                </pre>
              ) : null}
            </CardSection>
          </li>
        ))}
      </ul>
    </Card>
  );
}
