import { Badge } from '@shared/ui/Badge';
import { Icon } from '@shared/ui/Icon';
import { cn } from '@shared/utils/cn';

import type { MigrationStep } from '@features/migration-plan';

import {
  STEP_STATUS_ICON,
  STEP_STATUS_LABEL,
  STEP_STATUS_TONE,
} from '../services/executionPresentationService';
import type {
  ExecutionCapability,
  ExecutionStepStatus,
} from '../types/execution.types';

/**
 * ExecutionStepCard — single row in the executable-step list.
 *
 * Visual model is "left-rail step number + central content + right-rail
 * status badges". The card is selectable: clicking emits `onSelect` so
 * the parent screen can update the active selection. Disabled while the
 * engine is running.
 */
export interface ExecutionStepCardProps {
  readonly step: MigrationStep;
  readonly status: ExecutionStepStatus;
  readonly capability: ExecutionCapability | undefined;
  readonly selected: boolean;
  readonly disabled: boolean;
  readonly onSelect: () => void;
}

export function ExecutionStepCard({
  step,
  status,
  capability,
  selected,
  disabled,
  onSelect,
}: ExecutionStepCardProps): JSX.Element {
  const isExecutable = capability?.executable === true;
  const isUnsupported = status === 'unsupported';

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        'flex w-full items-start gap-3 rounded-md border px-3 py-2.5 text-left transition-colors duration-150',
        selected
          ? 'border-accent/60 bg-accent/5'
          : 'border-canvas-border bg-canvas-subtle-2/40 hover:border-canvas-border-strong hover:bg-canvas-overlay',
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
      )}
    >
      <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-canvas-border bg-canvas-overlay font-mono text-2xs tabular-nums text-ink">
        {String(step.order).padStart(2, '0')}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="truncate text-xs font-semibold text-ink">{step.title}</p>
          {isExecutable ? (
            <Badge tone="success" variant="soft" uppercase>
              Executable
            </Badge>
          ) : isUnsupported ? (
            <Badge tone="warning" variant="soft" uppercase>
              Unsupported
            </Badge>
          ) : null}
        </div>
        <p className="clamp-2 mt-1 text-2xs leading-relaxed text-ink-muted">
          {step.description}
        </p>
      </div>

      <Badge tone={STEP_STATUS_TONE[status]} variant="soft" withDot uppercase>
        <Icon name={STEP_STATUS_ICON[status]} className="h-3 w-3" />
        {STEP_STATUS_LABEL[status]}
      </Badge>
    </button>
  );
}
