import { Badge } from '@shared/ui/Badge';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@shared/ui/Card';
import { Icon } from '@shared/ui/Icon';

import type { MigrationPlan } from '../types/migrationPlan.types';

/**
 * MigrationPlanRecommendations — generator-side suggestions surfaced
 * alongside the plan. Distinct from per-step risk: these are advisory and
 * do not gate plan approval.
 */
export interface MigrationPlanRecommendationsProps {
  readonly plan: MigrationPlan;
}

export function MigrationPlanRecommendations({
  plan,
}: MigrationPlanRecommendationsProps): JSX.Element | null {
  const { recommendations } = plan;
  if (recommendations.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Recommendations</CardTitle>
          <CardDescription>
            Advisory hints derived from the scan report. The plan already covers
            the deterministic steps — these are extra context for the reviewer.
          </CardDescription>
        </div>
        <Badge tone="info" variant="outline">
          {recommendations.length} item{recommendations.length === 1 ? '' : 's'}
        </Badge>
      </CardHeader>

      <ol className="space-y-2">
        {recommendations.map((rec, idx) => (
          <li
            key={`${idx}`}
            className="flex gap-3 rounded-md border border-canvas-border bg-canvas-subtle-2/40 px-3 py-2.5"
          >
            <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-canvas-border bg-canvas-overlay font-mono text-2xs tabular-nums text-ink-subtle">
              {String(idx + 1).padStart(2, '0')}
            </span>
            <p className="min-w-0 flex-1 text-xs leading-relaxed text-ink-muted">
              {rec}
            </p>
            <Icon name="sparkles" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
          </li>
        ))}
      </ol>
    </Card>
  );
}
