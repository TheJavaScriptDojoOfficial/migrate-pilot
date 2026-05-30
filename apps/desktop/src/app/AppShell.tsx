import { Outlet } from 'react-router-dom';

import { WorkflowSidebar } from '@shared/ui/WorkflowSidebar';
import { APP_NAME, APP_VERSION } from '@shared/constants/app';

/**
 * AppShell renders the persistent chrome of the app:
 *   - Left: workflow sidebar (step navigation)
 *   - Top: thin status bar (app name + version + session indicator)
 *   - Main: routed content area
 *
 * Heavy / streaming content (logs, diffs) must NOT be rendered or held
 * by AppShell to keep re-renders cheap. See docs/architecture/folder-structure.md.
 */
export function AppShell(): JSX.Element {
  return (
    <div className="flex h-full w-full flex-col bg-canvas text-ink">
      <header className="flex h-10 shrink-0 items-center justify-between border-b border-canvas-border bg-canvas-subtle px-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold tracking-tight">{APP_NAME}</span>
          <span className="text-2xs text-ink-subtle">v{APP_VERSION}</span>
        </div>
        <div className="flex items-center gap-3 text-2xs text-ink-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden />
            Local-first
          </span>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <WorkflowSidebar />
        <main className="min-w-0 flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
