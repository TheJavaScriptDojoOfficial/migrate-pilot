import { Badge, type BadgeTone } from '@shared/ui/Badge';
import { Icon } from '@shared/ui/Icon';
import { cn } from '@shared/utils/cn';

import type { MigrationStep } from '@features/migration-plan';

import { getExecutorEntry } from '../services/executorRegistry';
import {
  STEP_STATUS_ICON,
  STEP_STATUS_LABEL,
  STEP_STATUS_TONE,
} from '../services/executionPresentationService';
import type {
  ExecutionCapability,
  ExecutionCapabilityBadge,
  ExecutionStepStatus,
} from '../types/execution.types';

/**
 * ExecutionStepCard — single row in the executable-step list.
 *
 * Visual model is "left-rail step number + central content + right-rail
 * status badges". The card is selectable: clicking emits `onSelect` so
 * the parent screen can update the active selection. Disabled while the
 * engine is running.
 *
 * The capability badge is computed from `capability.badge`, NOT from the
 * step id. This keeps the step card honest about why a step cannot run:
 * "Manual step", "AI executor not available yet", "Unsupported executor",
 * "Missing execution metadata", or the executor's friendly label.
 */
export interface ExecutionStepCardProps {
  readonly step: MigrationStep;
  readonly status: ExecutionStepStatus;
  readonly capability: ExecutionCapability | undefined;
  readonly selected: boolean;
  readonly disabled: boolean;
  readonly onSelect: () => void;
}

interface CapabilityBadgeView {
  readonly tone: BadgeTone;
  readonly label: string;
}

const FALLBACK_BADGE: CapabilityBadgeView = {
  tone: 'neutral',
  label: 'Capability not verified',
};

export function ExecutionStepCard({
  step,
  status,
  capability,
  selected,
  disabled,
  onSelect,
}: ExecutionStepCardProps): JSX.Element {
  const capabilityBadge = computeCapabilityBadge(step, capability);

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
          {capabilityBadge !== undefined ? (
            <Badge tone={capabilityBadge.tone} variant="soft" uppercase>
              {capabilityBadge.label}
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

function computeCapabilityBadge(
  step: MigrationStep,
  capability: ExecutionCapability | undefined,
): CapabilityBadgeView | undefined {
  if (capability !== undefined) {
    return badgeForCapability(capability.badge, capability.executable, capability.executorKey);
  }

  // No capability cached yet — fall back to the step's own execution
  // metadata so the row still renders an honest label.
  const execution = step.execution;
  if (execution === undefined) {
    return BADGE_BY_KIND['missing-metadata'];
  }
  if (execution.mode === 'manual') return BADGE_BY_KIND['manual'];
  if (execution.mode === 'validation') return BADGE_BY_KIND['validation'];
  if (execution.mode === 'ai') return BADGE_BY_KIND['ai-not-available'];
  const entry = getExecutorEntry(execution.executorKey);
  if (entry === undefined || !entry.supported) {
    return BADGE_BY_KIND['unsupported-executor'];
  }
  return FALLBACK_BADGE;
}

function badgeForCapability(
  badge: ExecutionCapabilityBadge,
  executable: boolean,
  executorKey: string | undefined,
): CapabilityBadgeView {
  if (badge === 'executable' || executable) {
    const entry = getExecutorEntry(executorKey);
    return {
      tone: 'success',
      label: entry !== undefined ? `Executable: ${entry.label}` : 'Executable',
    };
  }
  if (badge === 'scripted-unverified') {
    const entry = getExecutorEntry(executorKey);
    return {
      tone: 'info',
      label:
        entry !== undefined ? `Scripted: ${entry.label}` : 'Scripted executor',
    };
  }
  return BADGE_BY_KIND[badge];
}

const BADGE_BY_KIND: Record<ExecutionCapabilityBadge, CapabilityBadgeView> = {
  executable: { tone: 'success', label: 'Executable' },
  'scripted-unverified': { tone: 'info', label: 'Scripted executor' },
  manual: { tone: 'neutral', label: 'Manual only' },
  validation: { tone: 'neutral', label: 'Validation only' },
  'ai-not-available': { tone: 'warning', label: 'AI step not available yet' },
  'unsupported-executor': { tone: 'warning', label: 'Unsupported executor' },
  'missing-metadata': { tone: 'warning', label: 'Missing execution metadata' },
};
