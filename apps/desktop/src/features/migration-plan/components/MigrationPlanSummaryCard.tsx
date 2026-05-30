import { Badge, type BadgeTone } from '@shared/ui/Badge';
import {
  Card,
  CardDescription,
  CardHeader,
  CardSection,
  CardTitle,
} from '@shared/ui/Card';
import { Icon } from '@shared/ui/Icon';
import { cn } from '@shared/utils/cn';

import type { MigrationPlan } from '../types/migrationPlan.types';

import { RISK_TONE } from './migrationPlanPresentation';

/**
 * MigrationPlanSummaryCard — headline figures for a generated plan.
 *
 * Visually mirrors the readiness summary on the scan report so the user
 * sees the same affordances (score-style tile, summary stats, project
 * identity) across the workflow.
 */
export interface MigrationPlanSummaryCardProps {
  readonly plan: MigrationPlan;
}

export function MigrationPlanSummaryCard({
  plan,
}: MigrationPlanSummaryCardProps): JSX.Element {
  const { summary, status, approvedAt, generatedAt } = plan;

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{summary.title}</CardTitle>
          <CardDescription>
            {summary.description}{' '}
            <span className="block pt-1 text-2xs text-ink-subtle">
              Generated{' '}
              <time dateTime={generatedAt} title={generatedAt}>
                {new Date(generatedAt).toLocaleString()}
              </time>
              {status === 'approved' && approvedAt !== undefined ? (
                <>
                  {' · approved '}
                  <time dateTime={approvedAt} title={approvedAt}>
                    {new Date(approvedAt).toLocaleString()}
                  </time>
                </>
              ) : null}
              .
            </span>
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge
            tone={status === 'approved' ? 'success' : 'info'}
            variant="soft"
            withDot
            uppercase
          >
            {status}
          </Badge>
          <Badge tone={RISK_TONE[summary.estimatedRisk]} variant="soft" withDot uppercase>
            {summary.estimatedRisk} risk
          </Badge>
        </div>
      </CardHeader>

      <CardSection>
        <div className="grid gap-4 sm:grid-cols-4">
          <Tile label="Total steps" value={summary.totalSteps} tone="info" />
          <Tile
            label="Required"
            value={summary.requiredSteps}
            tone={summary.requiredSteps > 0 ? 'warning' : 'success'}
          />
          <Tile
            label="Approval gates"
            value={summary.approvalGates}
            tone={summary.approvalGates > 0 ? 'accent' : 'success'}
          />
          <Tile
            label="Complexity"
            value={summary.estimatedComplexity}
            tone={
              summary.estimatedComplexity === 'large'
                ? 'warning'
                : summary.estimatedComplexity === 'medium'
                  ? 'info'
                  : 'success'
            }
            uppercase
          />
        </div>
      </CardSection>

      <CardSection>
        <div className="flex flex-wrap items-center gap-3 text-2xs text-ink-subtle">
          <span className="inline-flex items-center gap-1.5">
            <Icon name="shield" className="h-3 w-3 text-success" />
            Deterministic & rule-based — no AI yet
          </span>
          <span className="h-3 w-px bg-canvas-border" aria-hidden />
          <span>
            Strategy:{' '}
            <span className="font-mono uppercase tracking-[0.08em] text-ink-muted">
              {plan.strategy}
            </span>
          </span>
          <span className="h-3 w-px bg-canvas-border" aria-hidden />
          <span>
            Project:{' '}
            <span
              className="font-mono text-ink-muted"
              title={plan.projectPath}
            >
              {truncatePath(plan.projectPath)}
            </span>
          </span>
        </div>
      </CardSection>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* helpers                                                                    */
/* -------------------------------------------------------------------------- */

interface TileProps {
  readonly label: string;
  readonly value: string | number;
  readonly tone: BadgeTone;
  readonly uppercase?: boolean;
}

function Tile({ label, value, tone, uppercase }: TileProps): JSX.Element {
  return (
    <div className={cn('rounded-md border border-canvas-border bg-canvas-subtle-2/40 px-4 py-3')}>
      <p className="text-2xs font-medium uppercase tracking-[0.14em] text-ink-subtle">
        {label}
      </p>
      <div className="mt-2 flex items-baseline gap-2">
        <Badge
          tone={tone}
          variant="soft"
          className="font-mono tabular-nums"
          {...(uppercase ? { uppercase: true } : {})}
        >
          {value}
        </Badge>
      </div>
    </div>
  );
}

function truncatePath(path: string): string {
  if (path.length <= 48) return path;
  return `…${path.slice(path.length - 47)}`;
}
