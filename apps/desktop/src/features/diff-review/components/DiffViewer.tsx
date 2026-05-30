import { Badge } from '@shared/ui/Badge';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@shared/ui/Card';
import { EmptyState } from '@shared/ui/EmptyState';
import { cn } from '@shared/utils/cn';

import {
  FILE_STATUS_LABEL,
  FILE_STATUS_TONE,
  classifyDiffLine,
  type DiffLineKind,
} from '../services/diffReviewPresentationService';
import type { DiffFile } from '../types/diffReview.types';

/**
 * DiffViewer — unified-diff renderer for a single selected file.
 *
 * Pure presentation. The screen owns selection state.
 *
 * Rendering strategy:
 *   - The diff text comes pre-truncated from the Rust loader (capped at
 *     256 KB per file).
 *   - We split on newlines and classify each line so lines can be tinted
 *     by kind without dragging in a syntax highlighter.
 *   - Header/hunk lines render with subtle backgrounds; addition /
 *     deletion / context lines render with monospaced foreground tints.
 */
export interface DiffViewerProps {
  readonly file: DiffFile | undefined;
}

export function DiffViewer({ file }: DiffViewerProps): JSX.Element {
  if (file === undefined) {
    return (
      <Card>
        <CardHeader>
          <div>
            <CardTitle>File diff</CardTitle>
            <CardDescription>
              Select a file from the left panel to load its diff. Large diffs
              are capped at 256 KB per file and the UI surfaces a Truncated
              badge in that case.
            </CardDescription>
          </div>
        </CardHeader>
        <EmptyState
          icon="diff"
          title="Nothing selected"
          description="Pick a changed file to inspect its diff."
        />
      </Card>
    );
  }

  if (file.isBinary === true) {
    return (
      <Card>
        <CardHeader>
          <div>
            <CardTitle className="break-all font-mono">{file.path}</CardTitle>
            <CardDescription>
              Binary diff. Migrate Pilot does not render binary content. The
              file change is recorded but no textual diff is available.
            </CardDescription>
          </div>
          <FileBadges file={file} />
        </CardHeader>
        <EmptyState
          icon="diff"
          title="Binary file"
          description="Use your editor or version control client to inspect this file."
        />
      </Card>
    );
  }

  const lines = file.diffText.length === 0 ? [] : file.diffText.split('\n');

  return (
    <Card>
      <CardHeader>
        <div className="min-w-0">
          <CardTitle className="break-all font-mono">{file.path}</CardTitle>
          <CardDescription>
            {file.tooLarge === true
              ? 'Diff capped at 256 KB. The full diff lives in the workspace; use your editor to view the rest.'
              : 'Unified diff produced by `git diff -- <file>` against the workspace baseline.'}
          </CardDescription>
        </div>
        <FileBadges file={file} />
      </CardHeader>

      {lines.length === 0 ? (
        <EmptyState
          icon="diff"
          title="No diff content"
          description="`git diff` returned no textual output for this file."
        />
      ) : (
        <pre
          className="max-h-[60vh] overflow-auto rounded-xs border border-canvas-border bg-canvas-subtle px-0 py-2 font-mono text-2xs leading-snug"
          aria-label={`Diff for ${file.path}`}
        >
          {lines.map((line, index) => (
            <DiffLine key={index} line={line} kind={classifyDiffLine(line)} />
          ))}
        </pre>
      )}
    </Card>
  );
}

function FileBadges({ file }: { readonly file: DiffFile }): JSX.Element {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      <Badge tone={FILE_STATUS_TONE[file.status]} variant="soft" uppercase>
        {FILE_STATUS_LABEL[file.status]}
      </Badge>
      <Badge tone="success" variant="soft">
        +{file.additions}
      </Badge>
      <Badge tone="danger" variant="soft">
        −{file.deletions}
      </Badge>
      {file.tooLarge === true ? (
        <Badge tone="warning" variant="outline" uppercase>
          Truncated
        </Badge>
      ) : null}
    </div>
  );
}

const KIND_CLASSES: Record<DiffLineKind, string> = {
  header: 'bg-canvas-overlay text-ink-muted',
  hunk: 'bg-info-soft text-info',
  addition: 'bg-success-soft text-success',
  deletion: 'bg-danger-soft text-danger',
  context: 'text-ink-subtle',
};

function DiffLine({
  line,
  kind,
}: {
  readonly line: string;
  readonly kind: DiffLineKind;
}): JSX.Element {
  return (
    <div className={cn('whitespace-pre px-3', KIND_CLASSES[kind])}>
      {line.length === 0 ? '\u00A0' : line}
    </div>
  );
}
