import { Badge } from '@shared/ui/Badge';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@shared/ui/Card';

import type { MigrationStep } from '@features/migration-plan';

import type {
  ExecutionCapability,
  ExecutionStepStatus,
} from '../types/execution.types';

import { ExecutionStepCard } from './ExecutionStepCard';

/**
 * ExecutionPlanStepList — vertical list of plan steps with selection.
 *
 * Pure projection of `steps` + per-step capability/status state. Approval
 * and execution actions live in the action bar; this component is
 * read-only beyond the click-to-select interaction.
 */
export interface ExecutionPlanStepListProps {
  readonly steps: readonly MigrationStep[];
  readonly capabilities: Readonly<Record<string, ExecutionCapability>>;
  readonly stepStatuses: Readonly<Record<string, ExecutionStepStatus>>;
  readonly selectedPlanStepId: string | undefined;
  readonly disabled: boolean;
  readonly onSelectStep: (planStepId: string) => void;
}

export function ExecutionPlanStepList({
  steps,
  capabilities,
  stepStatuses,
  selectedPlanStepId,
  disabled,
  onSelectStep,
}: ExecutionPlanStepListProps): JSX.Element {
  const executableCount = steps.filter(
    (s) => capabilities[s.id]?.executable === true,
  ).length;

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Migration steps</CardTitle>
          <CardDescription>
            Pick a step to inspect its executor availability. Only the
            scripted node-sass replacement can run in this milestone — every
            other step shows an Unsupported badge.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="info" variant="outline">
            {steps.length} step{steps.length === 1 ? '' : 's'}
          </Badge>
          {executableCount > 0 ? (
            <Badge tone="success" variant="soft" withDot>
              {executableCount} executable
            </Badge>
          ) : (
            <Badge tone="neutral" variant="outline">
              No executable steps yet
            </Badge>
          )}
        </div>
      </CardHeader>

      {steps.length === 0 ? (
        <p className="text-xs text-ink-muted">
          The plan contains no steps. Re-generate the plan and try again.
        </p>
      ) : (
        <ul className="space-y-2">
          {steps.map((step) => (
            <li key={step.id}>
              <ExecutionStepCard
                step={step}
                status={stepStatuses[step.id] ?? 'pending'}
                capability={capabilities[step.id]}
                selected={step.id === selectedPlanStepId}
                disabled={disabled}
                onSelect={() => onSelectStep(step.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
