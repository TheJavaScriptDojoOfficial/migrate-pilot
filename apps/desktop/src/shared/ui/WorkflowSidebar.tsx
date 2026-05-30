import { NavLink } from 'react-router-dom';

import { Icon } from '@shared/ui/Icon';
import { WORKFLOW_STEPS } from '@shared/constants/workflow';
import { APP_TAGLINE } from '@shared/constants/app';
import { cn } from '@shared/utils/cn';

/**
 * Persistent workflow navigator.
 *
 * Layout (DESIGN.md "IDE panels"):
 *   - Header  — section label + tagline
 *   - List    — numbered, icon-led nav items. Active item gets a left-edge
 *               2px accent bar (per "Active States" in DESIGN.md) and a
 *               raised tonal background.
 *   - Footer  — context guardrails ("project is read-only") to keep the
 *               user's mental model aligned with the orchestrator's safety
 *               contract.
 *
 * This component reads only route metadata. It must never hold session,
 * log, or diff data so it stays stable across re-renders elsewhere.
 */
export function WorkflowSidebar(): JSX.Element {
  return (
    <aside
      aria-label="Migration workflow"
      className="flex w-72 shrink-0 flex-col border-r border-canvas-border bg-canvas-subtle-2"
    >
      <div className="border-b border-canvas-border px-5 py-4">
        <p className="text-2xs font-semibold uppercase tracking-[0.18em] text-ink-subtle">
          Workflow
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">{APP_TAGLINE}</p>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ol className="flex flex-col gap-1">
          {WORKFLOW_STEPS.map((step, idx) => (
            <li key={step.id}>
              <NavLink
                to={step.path}
                className={({ isActive }) =>
                  cn(
                    'group relative flex items-center gap-3 rounded-md py-2 pl-4 pr-3',
                    'text-sm transition-colors duration-150 ease-out-quint',
                    'focus-visible:outline-none focus-visible:shadow-focus',
                    isActive
                      ? 'bg-canvas-raised text-ink'
                      : 'text-ink-muted hover:bg-canvas-raised/60 hover:text-ink',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {/* Left-edge accent — DESIGN.md "Active States". */}
                    <span
                      aria-hidden
                      className={cn(
                        'absolute inset-y-1.5 left-0 w-0.5 rounded-r-md transition-colors',
                        isActive ? 'bg-accent' : 'bg-transparent',
                      )}
                    />

                    {/* Step icon tile. */}
                    <span
                      className={cn(
                        'flex h-7 w-7 shrink-0 items-center justify-center rounded-xs border transition-colors',
                        isActive
                          ? 'border-accent/40 bg-accent/15 text-accent'
                          : 'border-canvas-border bg-canvas-subtle text-ink-subtle group-hover:text-ink-muted',
                      )}
                    >
                      <Icon name={step.icon} className="h-3.5 w-3.5" />
                    </span>

                    <span className="flex min-w-0 flex-1 flex-col">
                      <span
                        className={cn(
                          'text-2xs font-medium uppercase tracking-[0.12em]',
                          isActive ? 'text-accent' : 'text-ink-subtle',
                        )}
                      >
                        {step.shortLabel}
                      </span>
                      <span
                        className={cn(
                          'truncate text-xs font-medium tracking-tight',
                          isActive ? 'text-ink' : 'text-ink-muted',
                        )}
                      >
                        {step.label}
                      </span>
                    </span>

                    <span
                      aria-hidden
                      className={cn(
                        'font-mono text-[10px] tabular-nums',
                        isActive ? 'text-ink-subtle' : 'text-ink-faint',
                      )}
                    >
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                  </>
                )}
              </NavLink>
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
