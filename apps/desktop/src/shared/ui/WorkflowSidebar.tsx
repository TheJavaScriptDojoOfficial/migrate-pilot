import { Icon } from '@shared/ui/Icon';
import { WorkflowStepItem } from '@shared/ui/WorkflowStepItem';
import { APP_TAGLINE } from '@shared/constants/app';
import { useWorkflowSteps } from '@shared/hooks/useWorkflowProgress';

/**
 * Persistent workflow navigator.
 *
 * Layout (DESIGN.md "IDE panels"):
 *   - Header  — section label + tagline
 *   - List    — numbered, icon-led nav items. Each item renders one of four
 *               visual statuses (completed / active / upcoming / locked) so
 *               the user can see at a glance where they are in the journey.
 *   - Footer  — context guardrails ("project is read-only") to keep the
 *               user's mental model aligned with the orchestrator's safety
 *               contract.
 *
 * This component reads only route metadata + mocked workflow progress.
 * It must never hold session, log, or diff data so it stays stable across
 * re-renders elsewhere.
 */
export function WorkflowSidebar(): JSX.Element {
  const { steps } = useWorkflowSteps();
  const completedCount = steps.filter((s) => s.status === 'completed').length;

  return (
    <aside
      aria-label="Migration workflow"
      className="flex w-72 shrink-0 flex-col border-r border-canvas-border bg-canvas-subtle-2"
    >
      <div className="border-b border-canvas-border px-5 py-4">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-2xs font-semibold uppercase tracking-[0.18em] text-ink-subtle">
            Workflow
          </p>
          <p
            aria-label={`${completedCount} of ${steps.length} steps completed`}
            className="font-mono text-[10px] tabular-nums text-ink-subtle"
          >
            {completedCount.toString().padStart(2, '0')}/
            {steps.length.toString().padStart(2, '0')}
          </p>
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">{APP_TAGLINE}</p>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ol className="flex flex-col gap-1">
          {steps.map(({ step, status, index }) => (
            <li key={step.id}>
              <WorkflowStepItem
                index={index}
                label={step.label}
                shortLabel={step.shortLabel}
                icon={step.icon}
                path={step.path}
                status={status}
              />
            </li>
          ))}
        </ol>
      </nav>

      <div className="border-t border-canvas-border bg-canvas px-5 py-3 text-2xs leading-relaxed text-ink-subtle">
        <p className="flex items-center gap-1.5 text-ink-muted">
          <Icon name="shield" className="h-3 w-3 text-success" />
          <span className="font-medium uppercase tracking-[0.12em] text-ink-subtle">
            Safety contract
          </span>
        </p>
        <p className="mt-1.5">Original project is read-only.</p>
        <p>All edits live in a Git worktree.</p>
      </div>
    </aside>
  );
}
