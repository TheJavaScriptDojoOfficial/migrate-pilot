import { Badge } from '@shared/ui/Badge';
import { cn } from '@shared/utils/cn';

import {
  FILE_STATUS_LABEL,
  FILE_STATUS_TONE,
} from '../services/diffReviewPresentationService';
import type { DiffFile } from '../types/diffReview.types';

/**
 * DiffChangedFilesList — left-rail file selector for the diff browser.
 *
 * Renders one row per changed file with the file status, additions, and
 * deletions. Uses semantic `<button>`s so keyboard users can navigate
 * between files with Tab.
 */
export interface DiffChangedFilesListProps {
  readonly files: readonly DiffFile[];
  readonly selectedFilePath: string | undefined;
  readonly disabled: boolean;
  readonly onSelectFile: (path: string) => void;
}

export function DiffChangedFilesList({
  files,
  selectedFilePath,
  disabled,
  onSelectFile,
}: DiffChangedFilesListProps): JSX.Element {
  if (files.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-canvas-border bg-canvas-subtle/60 px-3 py-6 text-center">
        <p className="text-xs text-ink-subtle">No changed files.</p>
        <p className="mt-1 text-2xs text-ink-faint">
          The executor reported no file changes for this run.
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-1">
      {files.map((file) => {
        const isSelected = file.path === selectedFilePath;
        return (
          <li key={file.path}>
            <button
              type="button"
              onClick={() => onSelectFile(file.path)}
              disabled={disabled}
              className={cn(
                'flex w-full flex-col gap-1.5 rounded-md border px-3 py-2 text-left transition-colors',
                'focus-visible:outline-none focus-visible:shadow-focus',
                isSelected
                  ? 'border-accent/60 bg-canvas-overlay'
                  : 'border-canvas-border bg-canvas-subtle/60 hover:border-canvas-border-strong hover:bg-canvas-overlay',
                disabled && 'cursor-not-allowed opacity-60',
              )}
              aria-pressed={isSelected}
            >
              <div className="flex items-start justify-between gap-2">
                <code className="block break-all font-mono text-xs text-ink">
                  {file.path}
                </code>
                <Badge
                  tone={FILE_STATUS_TONE[file.status]}
                  variant="soft"
                  uppercase
                  className="shrink-0"
                >
                  {FILE_STATUS_LABEL[file.status]}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-2xs">
                <span className="font-mono text-success">
                  +{file.additions}
                </span>
                <span className="font-mono text-danger">
                  −{file.deletions}
                </span>
                {file.isBinary === true ? (
                  <Badge tone="warning" variant="outline" uppercase>
                    Binary
                  </Badge>
                ) : null}
                {file.tooLarge === true ? (
                  <Badge tone="warning" variant="outline" uppercase>
                    Truncated
                  </Badge>
                ) : null}
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
