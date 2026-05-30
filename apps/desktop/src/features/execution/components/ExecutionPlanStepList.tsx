import { Badge } from '@shared/ui/Badge';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@shared/ui/Card';

import type { MigrationStep } from '@features/migration-plan';

import { EXECUTOR_REGISTRY } from '../services/executorRegistry';
import type {
  ExecutionCapability,
  ExecutionStepStatus,
} from '../types/execution.types';

import { ExecutionStepCard } from './ExecutionStepCard';

/**
 * ExecutionPlanStepList — vertical list of React 19 migration plan steps
 * with selection.
 *
 * Pure projection of `steps` + per-step capability/status state. Approval
 * and execution actions live in the action bar; this component is
 * read-only beyond the click-to-select interaction.
 *
 * The header copy is generic: it lists what executors are currently
 * supported by the registry rather than naming a single migration
 * scenario. When the React 19 plan has zero scripted-executable steps,
 * the body copy explains that this is *expected*, not a failure mode.
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
    (s) =>
      capabilities[s.id]?.executable === true ||
      capabilities[s.id]?.badge === 'scripted-unverified',
  ).length;

  const supportedExecutorLabels = Object.values(EXECUTOR_REGISTRY)
    .filter((e) => e.supported)
    .map((e) => e.label);

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>React 19 migration steps</CardTitle>
          <CardDescription>
            Pick a step to inspect its executor availability. Scripted
            execution is available only for steps backed by a registered
            safe executor.{' '}
            {supportedExecutorLabels.length > 0
              ? `Currently supported: ${supportedExecutorLabels.join(', ')}.`
              : 'No scripted executors are supported in this build yet.'}
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="info" variant="outline">
            {steps.length} step{steps.length === 1 ? '' : 's'}
          </Badge>
          {executableCount > 0 ? (
            <Badge tone="success" variant="soft" withDot>
              {executableCount} scripted
            </Badge>
          ) : (
            <Badge tone="neutral" variant="outline">
              No scripted steps in this plan yet
            </Badge>
          )}
        </div>
      </CardHeader>

      {steps.length === 0 ? (
        <p className="text-xs text-ink-muted">
          The React 19 migration plan contains no steps. Re-generate the plan and
          try again.
        </p>
      ) : executableCount === 0 ? (
        <div className="rounded-md border border-canvas-border bg-canvas-subtle-2/40 p-3">
          <p className="text-xs leading-relaxed text-ink-muted">
            No executable scripted steps are available yet for this React 19
            plan. This does not mean the plan is invalid. Some steps may require
            future executors, codemods, validation, or AI-assisted
            implementation. The list still works for review and selection.
          </p>
        </div>
      ) : null}

      {steps.length > 0 ? (
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
      ) : null}
    </Card>
  );
}
