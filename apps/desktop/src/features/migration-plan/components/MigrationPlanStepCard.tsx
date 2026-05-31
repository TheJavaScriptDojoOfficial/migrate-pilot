import { Badge } from '@shared/ui/Badge';
import { Icon } from '@shared/ui/Icon';
import { cn } from '@shared/utils/cn';
import { getReactMigrationPhaseLabel } from '@features/react19-migration';

import type { MigrationStep } from '../types/migrationPlan.types';

import {
  CAPABILITY_LABEL,
  CAPABILITY_TONE,
  EXECUTION_TYPE_LABEL,
  EXECUTION_TYPE_TONE,
  RISK_TONE,
  ROLLBACK_LABEL,
  STEP_STATUS_TONE,
} from './migrationPlanPresentation';

/**
 * MigrationPlanStepCard — single step row (Plan Step Contract V2 surface).
 *
 * The card is split into three visual tiers so the list stays scannable:
 *
 *   1. A header row of small chips for everything the user needs to make
 *      a phase-by-phase decision at a glance: order, title, phase, track,
 *      risk, status, execution type, and capability.
 *   2. The step's `description` + `reason` (a single short reason block).
 *   3. A collapsible "Execution details" disclosure that exposes the full
 *      V2 contract (executor key, expected/validation commands, expected
 *      changed files, issue codes, run requirements, rollback strategy,
 *      and any `blockedReason`). The disclosure is closed by default so
 *      reviewers can fly down the plan without being drowned in metadata.
 *
 * The component is read-only — it never mutates the step. Visibility of
 * a step in an "approved/locked" plan is communicated via the `locked`
 * prop, which only changes opacity.
 */
export interface MigrationPlanStepCardProps {
  readonly step: MigrationStep;
  readonly locked?: boolean;
}

export function MigrationPlanStepCard({
  step,
  locked,
}: MigrationPlanStepCardProps): JSX.Element {
  const hasBlockedReason =
    step.capability !== 'available' &&
    step.blockedReason !== undefined &&
    step.blockedReason.trim().length > 0;

  return (
    <li
      className={cn(
        'flex gap-4 rounded-md border border-canvas-border bg-canvas-subtle-2/40 px-4 py-3.5',
        locked ? 'opacity-90' : undefined,
      )}
    >
      <StepNumber order={step.order} />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-ink">{step.title}</p>
          <Badge tone="neutral" variant="outline">
            {getReactMigrationPhaseLabel(step.phase)}
          </Badge>
          <Badge tone="neutral" variant="outline">
            {step.track}
          </Badge>
          <Badge tone={RISK_TONE[step.risk]} variant="soft" withDot uppercase>
            {step.risk} risk
          </Badge>
          <Badge
            tone={EXECUTION_TYPE_TONE[step.executionType]}
            variant="outline"
            uppercase
          >
            {EXECUTION_TYPE_LABEL[step.executionType]}
          </Badge>
          <Badge
            tone={CAPABILITY_TONE[step.capability]}
            variant="soft"
            withDot
            uppercase
          >
            {CAPABILITY_LABEL[step.capability]}
          </Badge>
          <Badge tone={STEP_STATUS_TONE[step.status]} variant="outline" uppercase>
            {step.status}
          </Badge>
        </div>

        <p className="mt-2 text-xs leading-relaxed text-ink-muted">
          {step.description}
        </p>

        <div className="mt-2 rounded-xs border border-canvas-border bg-canvas-subtle/40 px-2.5 py-1.5">
          <p className="text-2xs uppercase tracking-[0.12em] text-ink-subtle">Reason</p>
          <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">{step.reason}</p>
        </div>

        {hasBlockedReason ? (
          <BlockedCallout capability={step.capability} message={step.blockedReason ?? ''} />
        ) : null}

        <ExecutionDetails step={step} />
      </div>
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/* Sub-components                                                             */
/* -------------------------------------------------------------------------- */

function StepNumber({ order }: { readonly order: number }): JSX.Element {
  return (
    <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-canvas-border bg-canvas-overlay font-mono text-xs tabular-nums text-ink">
      {String(order).padStart(2, '0')}
    </span>
  );
}

interface BlockedCalloutProps {
  readonly capability: MigrationStep['capability'];
  readonly message: string;
}

/**
 * Surfaces the step's `blockedReason` in a tone that matches the
 * capability so the user instantly knows *why* the engine can't run
 * this step. Rendered out of the disclosure on purpose — the reason is
 * one of the most useful pieces of plan-quality information.
 */
function BlockedCallout({ capability, message }: BlockedCalloutProps): JSX.Element {
  const tone = CAPABILITY_TONE[capability];
  const label = CAPABILITY_LABEL[capability];
  return (
    <div
      className={cn(
        'mt-2 flex items-start gap-2 rounded-xs border px-2.5 py-1.5 text-2xs leading-relaxed',
        tone === 'danger'
          ? 'border-danger/30 bg-danger-soft text-danger'
          : tone === 'warning'
            ? 'border-warning/30 bg-warning-soft text-warning'
            : 'border-info/30 bg-info-soft text-info',
      )}
    >
      <Icon name="help" className="mt-px h-3 w-3 shrink-0" />
      <div>
        <p className="font-semibold uppercase tracking-[0.12em]">{label}</p>
        <p className="mt-0.5 text-ink-muted">{message}</p>
      </div>
    </div>
  );
}

interface ExecutionDetailsProps {
  readonly step: MigrationStep;
}

/**
 * Collapsible "Execution details" disclosure — surfaces the full V2
 * contract without crowding the step header.
 */
function ExecutionDetails({ step }: ExecutionDetailsProps): JSX.Element {
  return (
    <details className="group mt-3 rounded-xs border border-canvas-border bg-canvas-subtle/40 open:pb-2.5">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-2.5 py-1.5 text-2xs font-medium uppercase tracking-[0.12em] text-ink-subtle hover:text-ink">
        <span className="inline-flex items-center gap-1.5">
          <Icon name="settings" className="h-3 w-3" />
          Execution details
        </span>
        <span className="text-ink-subtle transition-transform group-open:rotate-90">
          <Icon name="arrow-right" className="h-3 w-3" />
        </span>
      </summary>
      <div className="space-y-2 px-2.5">
        <RequirementsRow step={step} />

        <DetailRow label="Executor">
          <Badge tone="info" variant="outline" className="font-mono">
            {step.executorKey ?? 'manual-only (no executor)'}
          </Badge>
        </DetailRow>

        {step.expectedCommands.length > 0 ? (
          <DetailRow label="Expected commands">
            {step.expectedCommands.map((command) => (
              <Badge
                key={`expected:${command}`}
                tone="neutral"
                variant="soft"
                className="font-mono"
              >
                {command}
              </Badge>
            ))}
          </DetailRow>
        ) : null}

        {step.validationCommands.length > 0 ? (
          <DetailRow label="Validation commands">
            {step.validationCommands.map((command) => (
              <Badge
                key={`validation:${command}`}
                tone="info"
                variant="soft"
                className="font-mono"
              >
                {command}
              </Badge>
            ))}
          </DetailRow>
        ) : null}

        {step.expectedChangedFiles.length > 0 ? (
          <DetailRow label="Expected changed files">
            {step.expectedChangedFiles.map((file) => (
              <Badge
                key={`files:${file}`}
                tone="neutral"
                variant="soft"
                className="font-mono"
              >
                {file}
              </Badge>
            ))}
          </DetailRow>
        ) : null}

        {step.issueCodes.length > 0 ? (
          <DetailRow label="Issue codes">
            {step.issueCodes.map((code) => (
              <Badge
                key={`issue:${code}`}
                tone="neutral"
                variant="outline"
                className="font-mono"
              >
                {code}
              </Badge>
            ))}
          </DetailRow>
        ) : null}

        {step.expectedChangeScope.length > 0 ? (
          <DetailRow label="Change scope">
            {step.expectedChangeScope.map((scope) => (
              <Badge key={`scope:${scope}`} tone="neutral" variant="soft">
                {scope}
              </Badge>
            ))}
          </DetailRow>
        ) : null}
      </div>
    </details>
  );
}

/**
 * The "run requirement" booleans live on every step (R5 Step 7). They
 * are grouped here so the user sees the workspace / approval /
 * validation / rollback triad as a single answer.
 */
function RequirementsRow({ step }: { readonly step: MigrationStep }): JSX.Element {
  return (
    <DetailRow label="Run requirements">
      <Badge
        tone={step.requiresApprovalBeforeRun ? 'accent' : 'success'}
        variant="soft"
        uppercase
      >
        <Icon name="check-circle" className="h-3 w-3" />
        {step.requiresApprovalBeforeRun ? 'Approval required' : 'No approval gate'}
      </Badge>
      <Badge
        tone={step.requiresWorkspace ? 'info' : 'neutral'}
        variant="soft"
        uppercase
      >
        {step.requiresWorkspace ? 'Workspace required' : 'No workspace required'}
      </Badge>
      <Badge
        tone={step.requiresValidationAfterRun ? 'warning' : 'neutral'}
        variant="soft"
        uppercase
      >
        {step.requiresValidationAfterRun
          ? 'Post-run validation required'
          : 'No post-run validation'}
      </Badge>
      <Badge tone="neutral" variant="outline" uppercase>
        Rollback: {ROLLBACK_LABEL[step.rollbackStrategy]}
      </Badge>
    </DetailRow>
  );
}

/* -------------------------------------------------------------------------- */
/* helpers                                                                    */
/* -------------------------------------------------------------------------- */

interface DetailRowProps {
  readonly label: string;
  readonly children: React.ReactNode;
}

function DetailRow({ label, children }: DetailRowProps): JSX.Element {
  return (
    <div className="flex flex-wrap items-start gap-2">
      <p className="min-w-[8.5rem] text-2xs uppercase tracking-[0.12em] text-ink-subtle">
        {label}
      </p>
      <div className="flex flex-1 flex-wrap items-center gap-1.5">{children}</div>
    </div>
  );
}
