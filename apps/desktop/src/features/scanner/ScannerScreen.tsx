import { PageHeader } from '@shared/ui/PageHeader';
import { Card, CardDescription, CardHeader, CardTitle } from '@shared/ui/Card';
import { StatusIndicator } from '@shared/ui/StatusIndicator';
import { EmptyState } from '@shared/ui/EmptyState';

/**
 * Step 2 - Scan Progress.
 *
 * Streams scanner progress from the orchestrator. The UI must not buffer
 * the entire file tree - it should render lightweight progress indicators
 * and rely on the eventual ScanReport for details.
 */
export function ScannerScreen(): JSX.Element {
  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Scanning project"
        subtitle="Inspecting source files, dependencies and build configuration."
        actions={<StatusIndicator status="idle" label="Idle" />}
      />

      <div className="flex-1 space-y-4 overflow-y-auto p-6">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Scan phases</CardTitle>
              <CardDescription>
                Cheap metadata scan first, then deeper AST scan once the project is accepted.
              </CardDescription>
            </div>
          </CardHeader>

          <ul className="space-y-2 text-xs text-ink-muted">
            <li className="flex items-center justify-between">
              <span>Detect package manager + build tool</span>
              <StatusIndicator status="pending" />
            </li>
            <li className="flex items-center justify-between">
              <span>Read dependency graph</span>
              <StatusIndicator status="pending" />
            </li>
            <li className="flex items-center justify-between">
              <span>Walk source tree (excluding node_modules)</span>
              <StatusIndicator status="pending" />
            </li>
            <li className="flex items-center justify-between">
              <span>Risk analysis</span>
              <StatusIndicator status="pending" />
            </li>
          </ul>
        </Card>

        <EmptyState
          title="Scanner not started"
          description="Once a project is selected, scan results will stream incrementally here."
        />
      </div>
    </div>
  );
}
