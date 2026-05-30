import { Badge } from '@shared/ui/Badge';
import { Card, CardDescription, CardHeader, CardTitle } from '@shared/ui/Card';
import { Icon, type IconName } from '@shared/ui/Icon';
import { cn } from '@shared/utils/cn';

import type {
  ProjectValidationIssue,
  ProjectValidationIssueType,
} from '../types/projectSelection.types';

/**
 * ProjectValidationIssues — surface validation errors / warnings / info
 * messages from `validateProjectRead` in a production-grade way.
 *
 * The component is purely presentational; it never re-runs validation.
 * Order is preserved as emitted by the validation service so ordering
 * decisions stay in one place.
 */
export interface ProjectValidationIssuesProps {
  readonly issues: readonly ProjectValidationIssue[];
  readonly className?: string;
  /** Caption shown when there are zero issues. Hidden if not provided. */
  readonly emptyLabel?: string;
}

export function ProjectValidationIssues({
  issues,
  className,
  emptyLabel,
}: ProjectValidationIssuesProps): JSX.Element | null {
  if (issues.length === 0) {
    if (!emptyLabel) return null;
    return (
      <Card className={className} tone="subtle">
        <div className="flex items-center gap-2 text-xs text-ink-muted">
          <Icon name="check-circle" className="h-4 w-4 text-success" />
          {emptyLabel}
        </div>
      </Card>
    );
  }

  const errors = issues.filter((i) => i.type === 'error').length;
  const warnings = issues.filter((i) => i.type === 'warning').length;

  return (
    <Card className={className}>
      <CardHeader>
        <div>
          <CardTitle>Validation</CardTitle>
          <CardDescription>
            Findings from inspecting the selected folder. Errors must be resolved before
            scanning. Warnings are non-blocking.
          </CardDescription>
        </div>
        <div className="flex items-center gap-1.5">
          {errors > 0 ? (
            <Badge tone="danger" variant="soft" withDot>
              {errors} error{errors === 1 ? '' : 's'}
            </Badge>
          ) : null}
          {warnings > 0 ? (
            <Badge tone="warning" variant="soft" withDot>
              {warnings} warning{warnings === 1 ? '' : 's'}
            </Badge>
          ) : null}
        </div>
      </CardHeader>

      <ul className="space-y-2.5">
        {issues.map((issue, idx) => (
          <IssueRow key={`${issue.code}-${idx}`} issue={issue} />
        ))}
      </ul>
    </Card>
  );
}

const TYPE_TONE: Record<
  ProjectValidationIssueType,
  { icon: IconName; iconClass: string; bg: string; ring: string }
> = {
  error: {
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

function IssueRow({ issue }: { issue: ProjectValidationIssue }): JSX.Element {
  const tone = TYPE_TONE[issue.type];
  return (
    <li className="flex items-start gap-3 rounded-md border border-canvas-border bg-canvas-subtle-2/40 px-3 py-2.5">
      <span
        className={cn(
          'mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
          tone.bg,
          tone.ring,
        )}
      >
        <Icon name={tone.icon} className={cn('h-3 w-3', tone.iconClass)} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold text-ink">{issue.title}</p>
          <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
            {issue.code}
          </span>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-ink-muted">
          {issue.description}
        </p>
      </div>
    </li>
  );
}
