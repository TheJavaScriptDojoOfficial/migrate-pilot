import { Button } from '@shared/ui/Button';
import { Card, CardDescription, CardHeader, CardTitle } from '@shared/ui/Card';
import { Icon } from '@shared/ui/Icon';
import { StatusIndicator, type StatusKind } from '@shared/ui/StatusIndicator';
import { cn } from '@shared/utils/cn';

import type { ProjectValidationStatus } from '../types/projectSelection.types';

/**
 * ProjectPickerCard — the primary CTA for Milestone 2.
 *
 * Renders the "Select Project Folder" action and, once a folder is picked,
 * a compact path display with a "change" affordance. Status feedback is
 * driven entirely by props so the component stays presentational.
 */
export interface ProjectPickerCardProps {
  readonly status: ProjectValidationStatus;
  readonly currentPath?: string;
  readonly disabled?: boolean;
  readonly onSelectFolder: () => void;
  readonly onClear: () => void;
}

export function ProjectPickerCard({
  status,
  currentPath,
  disabled,
  onSelectFolder,
  onClear,
}: ProjectPickerCardProps): JSX.Element {
  const isBusy = status === 'selecting' || status === 'validating';
  const hasPath = Boolean(currentPath);

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Select project folder</CardTitle>
          <CardDescription>
            Migrate Pilot opens a native folder picker and reads only the files needed to
            verify a React project. The folder is never modified.
          </CardDescription>
        </div>
        <StatusBadge status={status} />
      </CardHeader>

      {hasPath ? (
        <div className="space-y-3">
          <PathRow path={currentPath ?? ''} />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              leadingIcon={<Icon name="folder" />}
              onClick={onSelectFolder}
              loading={isBusy}
              disabled={disabled || isBusy}
            >
              Choose a different folder
            </Button>
            <Button
              size="sm"
              variant="ghost"
              leadingIcon={<Icon name="cross" />}
              onClick={onClear}
              disabled={disabled || isBusy}
            >
              Clear selection
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-start gap-3">
          <p className="text-xs leading-relaxed text-ink-muted">
            Pick a local folder containing a React project. We'll detect the package
            manager, React version, TypeScript status, scripts, and Git status before
            unlocking the next step.
          </p>
          <Button
            size="md"
            leadingIcon={<Icon name="folder" />}
            onClick={onSelectFolder}
            loading={isBusy}
            disabled={disabled || isBusy}
          >
            Select project folder…
          </Button>
        </div>
      )}
    </Card>
  );
}

function PathRow({ path }: { path: string }): JSX.Element {
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-md border border-canvas-border',
        'bg-canvas-subtle px-3 py-2',
      )}
    >
      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-canvas-border bg-canvas-overlay text-ink-subtle">
        <Icon name="folder" className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-2xs font-medium uppercase tracking-[0.14em] text-ink-subtle">
          Selected path
        </p>
        <p className="truncate font-mono text-xs text-ink" title={path}>
          {path}
        </p>
      </div>
    </div>
  );
}

const STATUS_TO_KIND: Record<ProjectValidationStatus, StatusKind> = {
  idle: 'idle',
  selecting: 'pending',
  validating: 'running',
  valid: 'success',
  invalid: 'error',
  error: 'error',
};

const STATUS_LABEL: Record<ProjectValidationStatus, string> = {
  idle: 'Awaiting folder',
  selecting: 'Picker open',
  validating: 'Validating',
  valid: 'Valid React project',
  invalid: 'Invalid project',
  error: 'Read failed',
};

function StatusBadge({ status }: { status: ProjectValidationStatus }): JSX.Element {
  return (
    <StatusIndicator
      status={STATUS_TO_KIND[status]}
      label={STATUS_LABEL[status]}
      variant="chip"
    />
  );
}
