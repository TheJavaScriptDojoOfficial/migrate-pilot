import type { ReactNode } from 'react';

import { Badge, type BadgeTone } from '@shared/ui/Badge';
import {
  Card,
  CardDescription,
  CardHeader,
  CardSection,
  CardTitle,
} from '@shared/ui/Card';
import { Icon } from '@shared/ui/Icon';

import {
  getReactMigrationPhaseLabel,
  type ReactMigrationPhase,
  type ReactMigrationTrack,
} from '@features/react19-migration';
import type {
  ExecutorAvailabilityStatus,
  MigrationPlanStepV2,
  MigrationPlanStepV2ExecutionType,
} from '@features/migration-plan';

import type { RunStepEnablement } from '../services/runStepEnablementService';
import type { ExecutorResolutionSummary } from '../executors/executor.types';

/**
 * ExecutionRunEnablementCard — Phase R6 Step 5.
 *
 * Surfaces every field the user needs to understand WHY the Run button
 * is enabled or disabled for the currently selected plan step:
 *
 *   - Phase           (canonical React 19 plan phase)
 *   - Track           (React 16/17/18 → 19 track)
 *   - Issue codes     (planner-attached / scanner codes)
 *   - Executor key    (resolved or step-declared)
 *   - Execution type  (planner taxonomy: scripted / codemod / …)
 *   - Capability      (resolver's `ExecutorAvailability.status`)
 *   - Disabled reason (string from the enablement resolver)
 *   - Manual guidance (when the step is intentionally manual or
 *                      future-support — the card swaps in a dedicated
 *                      explanatory section instead of pretending the
 *                      Run button is about to flip on)
 *
 * The card is pure presentation — it does NOT compute enablement
 * itself. The screen owns the {@link RunStepEnablement} resolver and
 * passes the result down so this component stays trivially testable
 * and reusable from future Run/Retry surfaces.
 */
export interface ExecutionRunEnablementCardProps {
  readonly step: MigrationPlanStepV2;
  readonly summary: ExecutorResolutionSummary | undefined;
  readonly enablement: RunStepEnablement;
}

const EXECUTION_TYPE_LABEL: Record<MigrationPlanStepV2ExecutionType, string> = {
  scripted: 'Scripted',
  codemod: 'Codemod',
  'ai-assisted': 'AI-assisted',
  manual: 'Manual',
  'validation-only': 'Validation-only',
};

const CAPABILITY_TONE: Record<ExecutorAvailabilityStatus, BadgeTone> = {
  available: 'success',
  unavailable: 'warning',
  'manual-only': 'neutral',
  'future-support': 'info',
  blocked: 'danger',
};

const CAPABILITY_LABEL: Record<ExecutorAvailabilityStatus, string> = {
  available: 'Available',
  unavailable: 'Unavailable',
  'manual-only': 'Manual-only',
  'future-support': 'Future support',
  blocked: 'Blocked',
};

const TRACK_LABEL: Record<ReactMigrationTrack, string> = {
  'react-16-to-19': 'React 16 → 19',
  'react-17-to-19': 'React 17 → 19',
  'react-18-to-19': 'React 18 → 19',
};

export function ExecutionRunEnablementCard({
  step,
  summary,
  enablement,
}: ExecutionRunEnablementCardProps): JSX.Element {
  const capabilityStatus = summary?.capabilityStatus;
  const capabilityTone =
    capabilityStatus !== undefined
      ? CAPABILITY_TONE[capabilityStatus]
      : 'neutral';
  const capabilityLabel =
    capabilityStatus !== undefined
      ? CAPABILITY_LABEL[capabilityStatus]
      : 'Not probed';

  const executorKey = summary?.executorKey ?? step.executorKey ?? '—';
  const executorLabel = summary?.executorLabel;
  const issueCodes = step.issueCodes;

  return (
    <Card accent={enablement.enabled}>
      <CardHeader>
        <div>
          <CardTitle>Run enablement</CardTitle>
          <CardDescription>
            Every field the resolver inspected before deciding whether the
            Run button should be enabled. No silent disables.
          </CardDescription>
        </div>
        {enablement.enabled ? (
          <Badge tone="success" variant="soft" withDot uppercase>
            Run enabled
          </Badge>
        ) : (
          <Badge tone="warning" variant="soft" withDot uppercase>
            Run disabled
          </Badge>
        )}
      </CardHeader>

      <CardSection label="Resolution">
        <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
          <DetailRow label="Phase" value={renderPhase(step.phase)} />
          <DetailRow label="Track" value={TRACK_LABEL[step.track]} />
          <DetailRow
            label="Execution type"
            value={EXECUTION_TYPE_LABEL[step.executionType]}
          />
          <DetailRow
            label="Executor key"
            value={
              <span className="font-mono text-2xs text-ink">{executorKey}</span>
            }
          />
          {executorLabel !== undefined ? (
            <DetailRow label="Executor label" value={executorLabel} />
          ) : null}
          <DetailRow
            label="Capability status"
            value={
              <Badge tone={capabilityTone} variant="soft" uppercase>
                {capabilityLabel}
              </Badge>
            }
          />
        </dl>
        <div className="mt-3 flex flex-col gap-1.5">
          <p className="text-2xs font-medium uppercase tracking-[0.14em] text-ink-subtle">
            Issue codes
          </p>
          {issueCodes.length === 0 ? (
            <p className="text-2xs text-ink-muted">
              No scanner issue codes attached to this step.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {issueCodes.map((code) => (
                <li key={code}>
                  <Badge tone="neutral" variant="outline">
                    <span className="font-mono text-2xs">{code}</span>
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardSection>

      {enablement.guidance !== undefined ? (
        <CardSection
          label={
            enablement.guidance.kind === 'manual-only'
              ? 'Manual guidance'
              : 'Future-support explanation'
          }
        >
          <div
            className={
              enablement.guidance.kind === 'manual-only'
                ? 'flex items-start gap-3 rounded-md border border-canvas-border bg-canvas-subtle-2/40 px-3 py-2.5'
                : 'flex items-start gap-3 rounded-md border border-info/40 bg-info-soft px-3 py-2.5'
            }
          >
            <span
              className={
                enablement.guidance.kind === 'manual-only'
                  ? 'mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink-muted/15 text-ink-muted'
                  : 'mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-info/20 text-info'
              }
            >
              <Icon
                name={enablement.guidance.kind === 'manual-only' ? 'help' : 'lock'}
                className="h-3 w-3"
              />
            </span>
            <p className="text-2xs leading-relaxed text-ink-muted">
              {enablement.guidance.message}
            </p>
          </div>
        </CardSection>
      ) : null}

      {!enablement.enabled && enablement.reasons.length > 0 ? (
        <CardSection label="Disabled reason">
          <ul className="space-y-1.5">
            {enablement.reasons.map((reason) => (
              <li
                key={reason}
                className="flex items-start gap-2 rounded-xs border border-warning/30 bg-warning-soft px-2.5 py-1.5 text-2xs leading-relaxed text-ink"
              >
                <Icon name="help" className="mt-px h-3 w-3 shrink-0" />
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </CardSection>
      ) : null}

      {summary?.capabilityWarnings !== undefined &&
      summary.capabilityWarnings.length > 0 ? (
        <CardSection label="Warnings">
          <ul className="space-y-1.5">
            {summary.capabilityWarnings.map((warning) => (
              <li
                key={warning}
                className="flex items-start gap-2 rounded-xs border border-warning/30 bg-warning-soft px-2.5 py-1.5 text-2xs leading-relaxed text-ink"
              >
                <Icon name="help" className="mt-px h-3 w-3 shrink-0" />
                <span>{warning}</span>
              </li>
            ))}
          </ul>
        </CardSection>
      ) : null}
    </Card>
  );
}

function DetailRow({
  label,
  value,
}: {
  readonly label: string;
  readonly value: ReactNode;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-2xs font-medium uppercase tracking-[0.14em] text-ink-subtle">
        {label}
      </dt>
      <dd className="text-xs text-ink">{value}</dd>
    </div>
  );
}

function renderPhase(phase: ReactMigrationPhase): string {
  return getReactMigrationPhaseLabel(phase);
}
