import { Badge, type BadgeTone } from '@shared/ui/Badge';
import {
  Card,
  CardDescription,
  CardHeader,
  CardSection,
  CardTitle,
} from '@shared/ui/Card';
import { Icon, type IconName } from '@shared/ui/Icon';
import { cn } from '@shared/utils/cn';

import type { MigrationPlan } from '../types/migrationPlan.types';

/**
 * MigrationPlanRiskPanel — surfaces blockers / warnings / assumptions that
 * the planner attached to the plan.
 *
 * Mirrors the visual rhythm of `ScanRiskCard` so the user sees the same
 * affordances across workflow steps. Empty sections collapse so the panel
 * stays compact for clean projects.
 */
export interface MigrationPlanRiskPanelProps {
  readonly plan: MigrationPlan;
}

export function MigrationPlanRiskPanel({
  plan,
}: MigrationPlanRiskPanelProps): JSX.Element {
  const { blockers, warnings, assumptions } = plan;
  const totalItems = blockers.length + warnings.length + assumptions.length;

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Plan blockers, warnings &amp; assumptions</CardTitle>
          <CardDescription>
            Issues the planner detected from the scan report, plus the working
            assumptions used to produce the plan. Blockers should be addressed
            before approving execution.
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
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
          {totalItems === 0 ? (
            <Badge tone="success" variant="soft" withDot>
              Clean
            </Badge>
          ) : null}
        </div>
      </CardHeader>

      {blockers.length > 0 ? (
        <Section
          label="Blockers"
          icon="cross"
          tone="danger"
          items={blockers}
        />
      ) : null}
      {warnings.length > 0 ? (
        <Section
          label="Warnings"
          icon="help"
          tone="warning"
          items={warnings}
        />
      ) : null}
      {assumptions.length > 0 ? (
        <Section
          label="Assumptions"
          icon="sparkles"
          tone="info"
          items={assumptions}
        />
      ) : null}

      {totalItems === 0 ? (
        <p className="flex items-center gap-2 text-xs text-ink-muted">
          <Icon name="check-circle" className="h-4 w-4 text-success" />
          The planner did not surface blockers, warnings, or assumptions for this
          project.
        </p>
      ) : null}
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* helpers                                                                    */
/* -------------------------------------------------------------------------- */

interface SectionProps {
  readonly label: string;
  readonly icon: IconName;
  readonly tone: BadgeTone;
  readonly items: readonly string[];
}

function Section({ label, icon, tone, items }: SectionProps): JSX.Element {
  return (
    <CardSection label={label}>
      <ul className="space-y-2">
        {items.map((text, idx) => (
          <li
            key={`${label}-${idx}`}
            className="flex items-start gap-3 rounded-md border border-canvas-border bg-canvas-subtle-2/40 px-3 py-2"
          >
            <span
              className={cn(
                'mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
                ICON_BG[tone],
              )}
            >
              <Icon name={icon} className={cn('h-3 w-3', ICON_FG[tone])} />
            </span>
            <p className="min-w-0 flex-1 text-xs leading-relaxed text-ink-muted">
              {text}
            </p>
          </li>
        ))}
      </ul>
    </CardSection>
  );
}

const ICON_BG: Record<BadgeTone, string> = {
  neutral: 'bg-canvas-overlay',
  info: 'bg-info/15',
  success: 'bg-success/15',
  warning: 'bg-warning/15',
  danger: 'bg-danger/15',
  accent: 'bg-accent/15',
};

const ICON_FG: Record<BadgeTone, string> = {
  neutral: 'text-ink-subtle',
  info: 'text-info',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  accent: 'text-accent',
};
