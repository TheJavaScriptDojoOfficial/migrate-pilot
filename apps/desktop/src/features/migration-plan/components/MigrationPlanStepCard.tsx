import { Badge } from '@shared/ui/Badge';
import { Icon } from '@shared/ui/Icon';
import { cn } from '@shared/utils/cn';
import { getReactMigrationPhaseLabel } from '@features/react19-migration';

import type { MigrationStep } from '../types/migrationPlan.types';

import {
  RISK_TONE,
  STEP_STATUS_TONE,
} from './migrationPlanPresentation';

/**
 * MigrationPlanStepCard — single step row.
 *
 * The visual model is "left-rail step number + central content + right-rail
 * risk/approval pills". The card stays dense but readable: anything that
 * is not strictly required to scan the plan is downgraded to small text.
 */
export interface MigrationPlanStepCardProps {
  readonly step: MigrationStep;
  readonly locked?: boolean;
}

export function MigrationPlanStepCard({
  step,
  locked,
}: MigrationPlanStepCardProps): JSX.Element {
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
          {step.requiresApprovalBeforeRun ? (
            <Badge tone="accent" variant="soft" uppercase>
              <Icon name="check-circle" className="h-3 w-3" />
              Human approval
            </Badge>
          ) : (
            <Badge tone="success" variant="soft" uppercase>
              No approval gate
            </Badge>
          )}
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
            {step.requiresValidationAfterRun ? 'Post-run validation required' : 'No post-run validation'}
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

        {step.expectedChangedFiles !== undefined && step.expectedChangedFiles.length > 0 ? (
          <DetailRow label="Expected files">
            {step.expectedChangedFiles.map((f) => (
              <Badge key={f} tone="neutral" variant="soft" className="font-mono">
                {f}
              </Badge>
            ))}
          </DetailRow>
        ) : null}

        {step.validationCommands !== undefined && step.validationCommands.length > 0 ? (
          <DetailRow label="Validation">
            {step.validationCommands.map((cmd) => (
              <Badge key={cmd} tone="info" variant="soft" className="font-mono">
                {cmd}
              </Badge>
            ))}
          </DetailRow>
        ) : null}

        <DetailRow label="Executor">
          <Badge tone="info" variant="outline" className="font-mono">
            {step.executorKey ?? 'manual-only'}
          </Badge>
        </DetailRow>
      </div>
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/* helpers                                                                    */
/* -------------------------------------------------------------------------- */

function StepNumber({ order }: { readonly order: number }): JSX.Element {
  return (
    <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-canvas-border bg-canvas-overlay font-mono text-xs tabular-nums text-ink">
      {String(order).padStart(2, '0')}
    </span>
  );
}

interface DetailRowProps {
  readonly label: string;
  readonly children: React.ReactNode;
}

function DetailRow({ label, children }: DetailRowProps): JSX.Element {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <p className="text-2xs uppercase tracking-[0.12em] text-ink-subtle">{label}</p>
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
    </div>
  );
}
