import { Badge } from '@shared/ui/Badge';
import { Button } from '@shared/ui/Button';
import { Card, CardDescription, CardHeader, CardTitle } from '@shared/ui/Card';
import { EmptyState } from '@shared/ui/EmptyState';
import { Icon } from '@shared/ui/Icon';
import { PageHeader } from '@shared/ui/PageHeader';
import { StepEyebrow } from '@shared/ui/StepEyebrow';

/**
 * Step 7 — Diff Review.
 *
 * File-level diff browser. The UI must list changed files first, then load
 * individual file diffs on demand. Large diffs are virtualised and may be
 * collapsed by default.
 */
export function DiffReviewScreen(): JSX.Element {
  return (
    <div className="flex h-full flex-col">
      <PageHeader
        eyebrow={<StepEyebrow number={7} icon="diff" label="Diff" />}
        title="Diff review"
        subtitle="Review what changed in the workspace before committing the step. The original repository is untouched."
        actions={
          <>
            <Button variant="ghost" size="sm" leadingIcon={<Icon name="sparkles" />} disabled>
              Request AI fix
            </Button>
            <Button variant="secondary" size="md" disabled>
              Reject
            </Button>
            <Button
              size="md"
              leadingIcon={<Icon name="check" />}
              disabled
            >
              Approve &amp; commit
            </Button>
          </>
        }
        meta={
          <>
            <Badge tone="neutral" variant="outline">
              0 files
            </Badge>
            <Badge tone="success" variant="soft">
              +0
            </Badge>
            <Badge tone="danger" variant="soft">
              −0
            </Badge>
          </>
        }
      />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside className="flex w-72 shrink-0 flex-col border-r border-canvas-border bg-canvas-subtle-2">
          <div className="flex items-center justify-between border-b border-canvas-border px-4 py-3">
            <p className="text-2xs font-medium uppercase tracking-[0.14em] text-ink-subtle">
              Changed files
            </p>
            <span className="font-mono text-2xs text-ink-faint">0</span>
          </div>
          <div className="flex-1 overflow-y-auto px-3 py-3 text-xs text-ink-subtle">
            <div className="rounded-md border border-dashed border-canvas-border bg-canvas-subtle/60 px-3 py-6 text-center">
              <p className="text-xs text-ink-subtle">No files yet.</p>
              <p className="mt-1 text-2xs text-ink-faint">
                Diffs appear after a step executes.
              </p>
            </div>
          </div>
        </aside>

        <section className="flex-1 overflow-y-auto px-8 py-6">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>File diff</CardTitle>
                  <CardDescription>
                    Select a file from the left panel to load its diff on demand. Large diffs
                    are virtualised and may be collapsed by default.
                  </CardDescription>
                </div>
              </CardHeader>

              <EmptyState
                icon="diff"
                title="Nothing to review"
                description="Diffs from the active step will appear here once execution completes."
              />
            </Card>
          </div>
        </section>
      </div>
    </div>
  );
}
