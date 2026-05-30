import { Badge } from '@shared/ui/Badge';
import { Card, CardDescription, CardHeader, CardTitle } from '@shared/ui/Card';
import { Icon } from '@shared/ui/Icon';

import {
  ISSUE_ICON,
  ISSUE_LABEL,
  ISSUE_TONE,
} from '../services/workspacePresentationService';
import type { WorkspaceIssue } from '../types/workspace.types';

/**
 * WorkspaceIssueList — presentational list for blockers + warnings.
 *
 * Renders nothing when both lists are empty. The screen owns the empty
 * state so we keep this component tightly scoped.
 */
export interface WorkspaceIssueListProps {
  readonly blockers: readonly WorkspaceIssue[];
  readonly warnings: readonly WorkspaceIssue[];
}

export function WorkspaceIssueList({
  blockers,
  warnings,
}: WorkspaceIssueListProps): JSX.Element | null {
  if (blockers.length === 0 && warnings.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Preflight findings</CardTitle>
          <CardDescription>
            Blockers must be resolved before workspace creation. Warnings can
            be acknowledged and skipped at the user&apos;s discretion.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          {blockers.length > 0 ? (
            <Badge tone="danger" variant="soft" withDot>
              {blockers.length} blocker{blockers.length === 1 ? '' : 's'}
            </Badge>
          ) : null}
          {warnings.length > 0 ? (
            <Badge tone="warning" variant="soft" withDot>
              {warnings.length} warning{warnings.length === 1 ? '' : 's'}
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <ul className="divide-y divide-canvas-border">
        {[...blockers, ...warnings].map((issue) => (
          <li
            key={`${issue.code}:${issue.message}`}
            className="flex items-start gap-3 py-3 first:pt-1 last:pb-1"
          >
            <span
              className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${SEVERITY_BG[issue.severity]} ${SEVERITY_FG[issue.severity]}`}
              aria-hidden
            >
              <Icon name={ISSUE_ICON[issue.severity]} className="h-3 w-3" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-semibold text-ink">
                  {issue.message}
                </p>
                <Badge tone={ISSUE_TONE[issue.severity]} variant="soft" uppercase>
                  {ISSUE_LABEL[issue.severity]}
                </Badge>
                <Badge tone="neutral" variant="outline" uppercase>
                  {issue.code}
                </Badge>
              </div>
              {issue.detail !== undefined ? (
                <p className="mt-1 text-xs leading-relaxed text-ink-muted">
                  {issue.detail}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

const SEVERITY_BG: Record<WorkspaceIssue['severity'], string> = {
  blocker: 'bg-danger/15',
  warning: 'bg-warning/15',
  info: 'bg-info/15',
};

const SEVERITY_FG: Record<WorkspaceIssue['severity'], string> = {
  blocker: 'text-danger',
  warning: 'text-warning',
  info: 'text-info',
};
