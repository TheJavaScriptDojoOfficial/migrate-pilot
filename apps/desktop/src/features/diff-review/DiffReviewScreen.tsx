import { PageHeader } from '@shared/ui/PageHeader';
import { Card, CardDescription, CardHeader, CardTitle } from '@shared/ui/Card';
import { Button } from '@shared/ui/Button';
import { EmptyState } from '@shared/ui/EmptyState';

/**
 * Step 7 - Diff Review.
 *
 * File-level diff browser. The UI must list changed files first, then load
 * individual file diffs on demand. Large diffs are virtualised and may be
 * collapsed by default.
 */
export function DiffReviewScreen(): JSX.Element {
  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Diff review"
        subtitle="Review what changed in the workspace before committing the step."
        actions={
          <>
            <Button variant="ghost" disabled>
              Request AI fix
            </Button>
            <Button variant="secondary" disabled>
              Reject
            </Button>
            <Button disabled>Approve &amp; commit</Button>
          </>
        }
      />

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-72 shrink-0 border-r border-canvas-border bg-canvas-subtle p-4 text-xs text-ink-muted">
          <p className="text-2xs uppercase tracking-wider text-ink-subtle">Changed files</p>
          <p className="mt-2">No files yet.</p>
        </aside>

        <section className="flex-1 space-y-4 overflow-y-auto p-6">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>File diff</CardTitle>
                <CardDescription>
                  Select a file from the left panel to load its diff on demand.
                </CardDescription>
              </div>
            </CardHeader>
            <EmptyState
              title="Nothing to review"
              description="Diffs from the active step will appear here once execution completes."
            />
          </Card>
        </section>
      </div>
    </div>
  );
}
