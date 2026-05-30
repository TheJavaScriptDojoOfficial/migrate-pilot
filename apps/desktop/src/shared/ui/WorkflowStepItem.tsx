import { Link } from 'react-router-dom';

import { Icon, type IconName } from '@shared/ui/Icon';
import type { WorkflowStepStatus } from '@shared/constants/workflow';
import { cn } from '@shared/utils/cn';

/**
 * WorkflowStepItem — one row in the WorkflowSidebar.
 *
 * Visually communicates four statuses while keeping the row chrome
 * consistent so the eye can scan the sidebar quickly:
 *
 *   - `completed` — success-tinted icon tile + check glyph. Navigable.
 *   - `active`    — accent left-edge bar, accent icon tile. Navigable.
 *   - `upcoming`  — neutral tile, slightly muted. Navigable.
 *   - `locked`    — dimmed; rendered as a non-interactive `<div>` with
 *                   a `lock` glyph so the user understands a prior step
 *                   must complete first.
 *
 * Kept small on purpose: the parent (WorkflowSidebar) owns layout and
 * data wiring; this component owns presentation only.
 */
export interface WorkflowStepItemProps {
  readonly index: number;
  readonly label: string;
  readonly shortLabel: string;
  readonly icon: IconName;
  readonly path: string;
  readonly status: WorkflowStepStatus;
}

export function WorkflowStepItem({
  index,
  label,
  shortLabel,
  icon,
  path,
  status,
}: WorkflowStepItemProps): JSX.Element {
  const stepNumber = String(index + 1).padStart(2, '0');

  const isActive = status === 'active';
  const isCompleted = status === 'completed';
  const isLocked = status === 'locked';

  const containerClasses = cn(
    'group relative flex items-center gap-3 rounded-md py-2 pl-4 pr-3',
    'text-sm transition-colors duration-150 ease-out-quint',
    'focus-visible:outline-none focus-visible:shadow-focus',
    isActive && 'bg-canvas-raised text-ink',
    isCompleted && 'text-ink hover:bg-canvas-raised/60',
    status === 'upcoming' && 'text-ink-muted hover:bg-canvas-raised/60 hover:text-ink',
    isLocked && 'cursor-not-allowed text-ink-faint',
  );

  const inner = (
    <>
      {/* Left-edge accent — DESIGN.md "Active States". */}
      <span
        aria-hidden
        className={cn(
          'absolute inset-y-1.5 left-0 w-0.5 rounded-r-md transition-colors',
          isActive ? 'bg-accent' : 'bg-transparent',
        )}
      />

      <StepIconTile icon={icon} status={status} />

      <span className="flex min-w-0 flex-1 flex-col">
        <span
          className={cn(
            'text-2xs font-medium uppercase tracking-[0.12em]',
            isActive && 'text-accent',
            isCompleted && 'text-success',
            status === 'upcoming' && 'text-ink-subtle',
            isLocked && 'text-ink-faint',
          )}
        >
          {shortLabel}
        </span>
        <span
          className={cn(
            'truncate text-xs font-medium tracking-tight',
            isActive ? 'text-ink' : isLocked ? 'text-ink-faint' : 'text-ink-muted',
          )}
        >
          {label}
        </span>
      </span>

      <StepTrailingMarker status={status} stepNumber={stepNumber} />
    </>
  );

  if (isLocked) {
    return (
      <div
        aria-disabled="true"
        title="Complete the previous step first"
        className={containerClasses}
      >
        {inner}
      </div>
    );
  }

  return (
    <Link to={path} aria-current={isActive ? 'page' : undefined} className={containerClasses}>
      {inner}
    </Link>
  );
}

function StepIconTile({
  icon,
  status,
}: {
  readonly icon: IconName;
  readonly status: WorkflowStepStatus;
}): JSX.Element {
  if (status === 'completed') {
    return (
      <span
        aria-hidden
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xs border border-success/40 bg-success/15 text-success"
      >
        <Icon name="check" className="h-3.5 w-3.5" strokeWidth={2} />
      </span>
    );
  }

  if (status === 'active') {
    return (
      <span
        aria-hidden
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xs border border-accent/40 bg-accent/15 text-accent"
      >
        <Icon name={icon} className="h-3.5 w-3.5" />
      </span>
    );
  }

  if (status === 'locked') {
    return (
      <span
        aria-hidden
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xs border border-canvas-border bg-canvas-subtle text-ink-faint"
      >
        <Icon name="lock" className="h-3 w-3" />
      </span>
    );
  }

  return (
    <span
      aria-hidden
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xs border border-canvas-border bg-canvas-subtle text-ink-subtle group-hover:text-ink-muted"
    >
      <Icon name={icon} className="h-3.5 w-3.5" />
    </span>
  );
}

function StepTrailingMarker({
  status,
  stepNumber,
}: {
  readonly status: WorkflowStepStatus;
  readonly stepNumber: string;
}): JSX.Element {
  if (status === 'active') {
    return (
      <span
        aria-hidden
        className="flex items-center gap-1 font-mono text-[10px] tabular-nums text-ink-subtle"
      >
        <span className="h-1.5 w-1.5 animate-pulse-soft rounded-full bg-accent" />
        now
      </span>
    );
  }

  return (
    <span
      aria-hidden
      className={cn(
        'font-mono text-[10px] tabular-nums',
        status === 'locked' ? 'text-ink-faint' : 'text-ink-subtle',
      )}
    >
      {stepNumber}
    </span>
  );
}
