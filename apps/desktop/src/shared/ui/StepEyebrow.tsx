import { Icon, type IconName } from '@shared/ui/Icon';

/**
 * Small eyebrow used inside PageHeader to show the workflow step number,
 * icon, and a short label. Keeps screen headers visually anchored to
 * the same step shown as active in the WorkflowSidebar.
 */
export interface StepEyebrowProps {
  number: number;
  icon: IconName;
  label: string;
}

export function StepEyebrow({ number, icon, label }: StepEyebrowProps): JSX.Element {
  return (
    <span className="inline-flex items-center gap-2 rounded-xs border border-canvas-border bg-canvas-subtle-2 px-2 py-0.5">
      <Icon name={icon} className="h-3 w-3 text-accent" />
      <span className="font-mono text-[10px] tabular-nums text-ink-subtle">
        {String(number).padStart(2, '0')}
      </span>
      <span className="text-2xs font-medium text-ink-muted">{label}</span>
    </span>
  );
}
