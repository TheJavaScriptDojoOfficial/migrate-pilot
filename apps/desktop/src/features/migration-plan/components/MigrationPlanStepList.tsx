import { Badge } from '@shared/ui/Badge';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@shared/ui/Card';

import type { MigrationStep } from '../types/migrationPlan.types';

import { MigrationPlanStepCard } from './MigrationPlanStepCard';

/**
 * MigrationPlanStepList — vertical, numbered list of plan steps.
 *
 * The list does not own any business logic — it is a pure projection of the
 * steps array. Approval and editing actions live in the action bar; this
 * component is read-only.
 */
export interface MigrationPlanStepListProps {
  readonly steps: readonly MigrationStep[];
  readonly locked?: boolean;
}

export function MigrationPlanStepList({
  steps,
  locked,
}: MigrationPlanStepListProps): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Migration steps</CardTitle>
          <CardDescription>
            Each step is intentionally small and reviewable. Required steps cannot
            be skipped; steps with a human-approval gate halt execution until you
            confirm.
          </CardDescription>
        </div>
        <Badge tone="info" variant="outline">
          {steps.length} step{steps.length === 1 ? '' : 's'}
        </Badge>
      </CardHeader>

      {steps.length === 0 ? (
        <p className="text-xs text-ink-muted">
          The generator produced no steps for this project. This usually means
          the scan report is empty — re-run the scanner and try again.
        </p>
      ) : (
        <ol className="space-y-3">
          {steps.map((step) => (
            <MigrationPlanStepCard
              key={step.id}
              step={step}
              {...(locked ? { locked: true } : {})}
            />
          ))}
        </ol>
      )}
    </Card>
  );
}
