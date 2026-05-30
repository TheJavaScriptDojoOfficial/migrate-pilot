import { NavLink } from 'react-router-dom';

import { WORKFLOW_STEPS } from '@shared/constants/workflow';
import { APP_TAGLINE } from '@shared/constants/app';
import { cn } from '@shared/utils/cn';

/**
 * Persistent left-rail workflow navigator.
 *
 * Reads only route metadata - never holds session, log, or diff data.
 * Active state is computed by NavLink to keep this component cheap and
 * stable across re-renders elsewhere in the tree.
 */
export function WorkflowSidebar(): JSX.Element {
  return (
    <aside
      aria-label="Migration workflow"
      className="flex w-64 shrink-0 flex-col border-r border-canvas-border bg-canvas-subtle"
    >
      <div className="border-b border-canvas-border px-4 py-3">
        <p className="text-2xs uppercase tracking-widest text-ink-subtle">Workflow</p>
        <p className="mt-1 text-xs text-ink-muted">{APP_TAGLINE}</p>
      </div>

      <nav className="flex-1 overflow-y-auto py-2">
        <ul className="space-y-0.5 px-2">
          {WORKFLOW_STEPS.map((step) => (
            <li key={step.id}>
              <NavLink
                to={step.path}
                className={({ isActive }) =>
                  cn(
                    'flex flex-col gap-0.5 rounded-md px-3 py-2 text-sm transition-colors',
                    isActive
                      ? 'bg-canvas-raised text-ink ring-1 ring-canvas-border'
                      : 'text-ink-muted hover:bg-canvas-raised hover:text-ink',
                  )
                }
              >
                <span className="text-2xs uppercase tracking-wider text-ink-subtle">
                  {step.shortLabel}
                </span>
                <span className="font-medium tracking-tight">{step.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="border-t border-canvas-border px-4 py-3 text-2xs text-ink-subtle">
        <p>Original project is read-only.</p>
        <p>All edits live in a Git worktree.</p>
      </div>
    </aside>
  );
}
