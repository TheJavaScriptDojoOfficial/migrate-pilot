import { Badge } from '@shared/ui/Badge';
import {
  Card,
  CardDescription,
  CardHeader,
  CardSection,
  CardTitle,
} from '@shared/ui/Card';
import { Icon, type IconName } from '@shared/ui/Icon';
import { cn } from '@shared/utils/cn';

import type { RiskReport, ScanIssue, ScanIssueSeverity } from '../types/scanner.types';

/**
 * ScanRiskCard — blockers / warnings / infos with stable codes.
 *
 * Mirrors the structure of `ProjectValidationIssues` from the
 * project-selection feature so the visual language stays consistent
 * across workflow steps.
 */
export interface ScanRiskCardProps {
  readonly risks: RiskReport;
}

export function ScanRiskCard({ risks }: ScanRiskCardProps): JSX.Element {
  const totalIssues =
    risks.blockers.length + risks.warnings.length + risks.infos.length;

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Risks &amp; blockers</CardTitle>
          <CardDescription>
            Deterministic findings from the scan. Blockers must be addressed before
            the migration plan can run safely. Warnings are non-blocking but tracked.
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {risks.blockers.length > 0 ? (
            <Badge tone="danger" variant="soft" withDot>
              {risks.blockers.length} blocker
              {risks.blockers.length === 1 ? '' : 's'}
            </Badge>
          ) : null}
          {risks.warnings.length > 0 ? (
            <Badge tone="warning" variant="soft" withDot>
              {risks.warnings.length} warning
              {risks.warnings.length === 1 ? '' : 's'}
            </Badge>
          ) : null}
          {risks.infos.length > 0 ? (
            <Badge tone="info" variant="soft" withDot>
              {risks.infos.length} info
            </Badge>
          ) : null}
          {totalIssues === 0 ? (
            <Badge tone="success" variant="soft" withDot>
              No issues
            </Badge>
          ) : null}
        </div>
      </CardHeader>

      {totalIssues === 0 ? (
        <p className="flex items-center gap-2 text-xs text-ink-muted">
          <Icon name="check-circle" className="h-4 w-4 text-success" />
          The deterministic scanner did not find any blockers, warnings, or infos.
        </p>
      ) : (
        <>
          {risks.blockers.length > 0 ? (
            <CardSection label="Blockers">
              <IssueList issues={risks.blockers} />
            </CardSection>
          ) : null}
          {risks.warnings.length > 0 ? (
            <CardSection label="Warnings">
              <IssueList issues={risks.warnings} />
            </CardSection>
          ) : null}
          {risks.infos.length > 0 ? (
            <CardSection label="Information">
              <IssueList issues={risks.infos} />
            </CardSection>
          ) : null}
        </>
      )}
    </Card>
  );
}

function IssueList({ issues }: { issues: readonly ScanIssue[] }): JSX.Element {
  return (
    <ul className="space-y-2.5">
      {issues.map((issue, idx) => (
        <IssueRow key={`${issue.code}-${idx}`} issue={issue} />
      ))}
    </ul>
  );
}

const SEVERITY_STYLE: Record<
  ScanIssueSeverity,
  { icon: IconName; iconClass: string; bg: string; ring: string }
> = {
  blocker: {
    icon: 'cross',
    iconClass: 'text-danger',
    bg: 'bg-danger/15',
    ring: 'ring-1 ring-inset ring-danger/30',
  },
  warning: {
    icon: 'help',
    iconClass: 'text-warning',
    bg: 'bg-warning/15',
    ring: 'ring-1 ring-inset ring-warning/30',
  },
  info: {
    icon: 'sparkles',
    iconClass: 'text-info',
    bg: 'bg-info/15',
    ring: 'ring-1 ring-inset ring-info/30',
  },
};

function IssueRow({ issue }: { issue: ScanIssue }): JSX.Element {
  const style = SEVERITY_STYLE[issue.severity];
  return (
    <li className="flex items-start gap-3 rounded-md border border-canvas-border bg-canvas-subtle-2/40 px-3 py-2.5">
      <span
        className={cn(
          'mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
          style.bg,
          style.ring,
        )}
      >
        <Icon name={style.icon} className={cn('h-3 w-3', style.iconClass)} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-semibold text-ink">{issue.title}</p>
          <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
            {issue.code}
          </span>
          {issue.ref ? (
            <span className="font-mono text-[10px] text-ink-faint" title={issue.ref}>
              {issue.ref}
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-xs leading-relaxed text-ink-muted">
          {issue.description}
        </p>
      </div>
    </li>
  );
}
