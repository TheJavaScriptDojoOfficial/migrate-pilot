import { Outlet } from 'react-router-dom';

import { ActivityRail } from '@shared/ui/ActivityRail';
import { Icon } from '@shared/ui/Icon';
import { SessionStatusBadge } from '@shared/ui/SessionStatusBadge';
import { StatusIndicator } from '@shared/ui/StatusIndicator';
import { WorkflowSidebar } from '@shared/ui/WorkflowSidebar';
import { APP_NAME, APP_VERSION } from '@shared/constants/app';
import { useWorkflowSteps } from '@shared/hooks/useWorkflowProgress';

/**
 * AppShell renders the persistent chrome of the app, following the
 * "IDE panel" layout from DESIGN.md:
 *
 *   [ Activity rail | Workflow sidebar | Title bar + main content + status footer ]
 *
 * Performance contract:
 *   - This component must remain lightweight; never hold streamed log,
 *     diff, or AI-output buffers. See docs/architecture/folder-structure.md.
 *   - Heavy children (Execution, DiffReview) own their own scroll regions
 *     so the shell stays mounted and stable across route changes.
 */
export function AppShell(): JSX.Element {
  return (
    <div className="flex h-full w-full overflow-hidden bg-canvas text-ink">
      <ActivityRail />
      <WorkflowSidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <TitleBar />
        <main className="min-w-0 flex-1 overflow-hidden bg-canvas">
          <div className="h-full w-full overflow-y-auto">
            <Outlet />
          </div>
        </main>
        <StatusBar />
      </div>
    </div>
  );
}

function TitleBar(): JSX.Element {
  const { activeStep } = useWorkflowSteps();

  return (
    <header className="flex h-11 shrink-0 items-center justify-between gap-4 border-b border-canvas-border bg-canvas-subtle-2 pl-5 pr-4">
      <div className="flex min-w-0 items-center gap-3">
        <span className="text-sm font-semibold tracking-tight text-ink">{APP_NAME}</span>
        <span className="rounded-xs border border-canvas-border bg-canvas-overlay px-1.5 py-0.5 font-mono text-[10px] text-ink-subtle">
          v{APP_VERSION}
        </span>

        <span className="hidden h-4 w-px bg-canvas-border md:block" aria-hidden />

        {activeStep ? (
          <span className="hidden min-w-0 items-center gap-2 text-2xs text-ink-subtle md:flex">
            <Icon
              name={activeStep.step.icon}
              className="h-3 w-3 shrink-0 text-accent"
            />
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-subtle">
              {activeStep.step.shortLabel}
            </span>
            <span className="hidden truncate text-xs text-ink-muted lg:inline">
              {activeStep.step.description}
            </span>
          </span>
        ) : null}
      </div>

      <div className="flex items-center gap-3 text-2xs text-ink-muted">
        <SessionStatusBadge />
        <span className="hidden h-4 w-px bg-canvas-border sm:block" aria-hidden />
        <span className="hidden items-center gap-1.5 sm:flex">
          <Icon name="shield" className="h-3 w-3 text-success" />
          Local-first
        </span>
      </div>
    </header>
  );
}

function StatusBar(): JSX.Element {
  return (
    <footer className="flex h-7 shrink-0 items-center justify-between border-t border-canvas-border bg-canvas-subtle px-4 text-2xs text-ink-subtle">
      <div className="flex items-center gap-4">
        <StatusIndicator status="idle" label="Idle" />
        <span className="hidden font-mono sm:inline">orchestrator: not started</span>
      </div>
      <div className="flex items-center gap-3 font-mono">
        <span>UTF-8</span>
        <span>LF</span>
        <span>react • typescript</span>
      </div>
    </footer>
  );
}
