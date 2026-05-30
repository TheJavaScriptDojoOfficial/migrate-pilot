import { Badge, type BadgeTone } from '@shared/ui/Badge';
import {
  Card,
  CardDescription,
  CardHeader,
  CardSection,
  CardTitle,
} from '@shared/ui/Card';
import { Icon } from '@shared/ui/Icon';
import { cn } from '@shared/utils/cn';

import type {
  DeprecatedLifecycleUsage,
  SourceAnalysisReport,
} from '../types/scanner.types';

/**
 * ScanSourceAnalysisCard — file inventory + heuristic indicators detected
 * during the source-tree walk.
 */
export interface ScanSourceAnalysisCardProps {
  readonly source: SourceAnalysisReport;
}

export function ScanSourceAnalysisCard({
  source,
}: ScanSourceAnalysisCardProps): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Source analysis</CardTitle>
          <CardDescription>
            Read-only walk of the project tree. Heavy folders (node_modules, dist,
            build, coverage, .git, .next, out, target) are skipped.
          </CardDescription>
        </div>
        {source.truncated ? (
          <Badge tone="warning" variant="soft" withDot>
            Truncated at file limit
          </Badge>
        ) : (
          <Badge tone="neutral" variant="outline">
            {source.totalFilesScanned.toLocaleString()} files
          </Badge>
        )}
      </CardHeader>

      <CardSection label="File counts">
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <CountTile label=".js" value={source.jsFiles} tone="warning" />
          <CountTile label=".jsx" value={source.jsxFiles} tone="warning" />
          <CountTile label=".ts" value={source.tsFiles} tone="success" />
          <CountTile label=".tsx" value={source.tsxFiles} tone="success" />
          <CountTile label="styles" value={source.styleFiles} tone="info" />
          <CountTile label=".json" value={source.jsonFiles} tone="neutral" />
        </div>
      </CardSection>

      <CardSection label="Heuristic indicators">
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <IndicatorTile
            label="Class components"
            value={source.classComponentIndicators}
            tone={source.classComponentIndicators > 0 ? 'warning' : 'success'}
          />
          <IndicatorTile
            label="ReactDOM.render"
            value={source.reactDomRenderUsages}
            tone={source.reactDomRenderUsages > 0 ? 'warning' : 'success'}
          />
          <IndicatorTile
            label="Legacy context API"
            value={source.legacyContextIndicators}
            tone={source.legacyContextIndicators > 0 ? 'warning' : 'success'}
          />
          <IndicatorTile
            label="Router usage"
            value={source.routerUsageIndicators}
            tone={source.routerUsageIndicators > 0 ? 'info' : 'neutral'}
          />
        </dl>
      </CardSection>

      {source.deprecatedLifecycleIndicators.length > 0 ? (
        <CardSection label="Deprecated lifecycle methods">
          <ul className="space-y-2">
            {source.deprecatedLifecycleIndicators.map((entry) => (
              <LifecycleRow key={entry.method} entry={entry} />
            ))}
          </ul>
        </CardSection>
      ) : null}

      <CardSection label="Folders">
        <FolderColumns
          scanned={source.scannedDirectories}
          skipped={source.skippedDirectories}
        />
      </CardSection>

      {source.filesSkippedTooLarge > 0 ? (
        <CardSection>
          <p className="flex items-center gap-2 text-2xs text-ink-subtle">
            <Icon name="help" className="h-3 w-3 text-warning" />
            {source.filesSkippedTooLarge} file{source.filesSkippedTooLarge === 1 ? '' : 's'} exceeded the per-file size cap
            and were not content-scanned (counted only).
          </p>
        </CardSection>
      ) : null}
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* helpers                                                                    */
/* -------------------------------------------------------------------------- */

interface CountTileProps {
  readonly label: string;
  readonly value: number;
  readonly tone: BadgeTone;
}

function CountTile({ label, value, tone }: CountTileProps): JSX.Element {
  return (
    <div className="rounded-md border border-canvas-border bg-canvas-subtle-2/40 px-3 py-2.5">
      <p className="text-2xs font-medium uppercase tracking-[0.14em] text-ink-subtle">
        {label}
      </p>
      <p className="mt-1 flex items-baseline gap-2">
        <span className="font-mono text-base font-semibold tabular-nums text-ink">
          {value.toLocaleString()}
        </span>
        {value > 0 ? (
          <Badge tone={tone} variant="soft" uppercase>
            {tone === 'warning' ? 'modernize' : tone === 'success' ? 'modern' : 'asset'}
          </Badge>
        ) : null}
      </p>
    </div>
  );
}

interface IndicatorTileProps {
  readonly label: string;
  readonly value: number;
  readonly tone: BadgeTone;
}

function IndicatorTile({
  label,
  value,
  tone,
}: IndicatorTileProps): JSX.Element {
  return (
    <div
      className={cn(
        'rounded-md border bg-canvas-subtle-2/40 px-3 py-2.5',
        value > 0 && tone === 'warning'
          ? 'border-warning/40'
          : 'border-canvas-border',
      )}
    >
      <p className="text-2xs font-medium uppercase tracking-[0.14em] text-ink-subtle">
        {label}
      </p>
      <p className="mt-1 flex items-center gap-2">
        <span className="font-mono text-base font-semibold tabular-nums text-ink">
          {value.toLocaleString()}
        </span>
        <span className="text-2xs text-ink-muted">
          {value > 0 ? 'file matches' : 'none detected'}
        </span>
      </p>
    </div>
  );
}

function LifecycleRow({
  entry,
}: {
  readonly entry: DeprecatedLifecycleUsage;
}): JSX.Element {
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-warning/30 bg-warning-soft px-3 py-2">
      <div className="min-w-0">
        <Badge tone="warning" variant="soft" className="font-mono">
          {entry.method}
        </Badge>
        {entry.exampleFile ? (
          <p className="mt-1 truncate font-mono text-2xs text-ink-muted" title={entry.exampleFile}>
            e.g. {entry.exampleFile}
          </p>
        ) : null}
      </div>
      <span className="font-mono text-xs text-ink">
        {entry.fileCount} file{entry.fileCount === 1 ? '' : 's'}
      </span>
    </li>
  );
}

function FolderColumns({
  scanned,
  skipped,
}: {
  readonly scanned: readonly string[];
  readonly skipped: readonly string[];
}): JSX.Element {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <FolderColumn
        label="Scanned"
        items={scanned}
        emptyLabel="No top-level entries scanned."
        tone="info"
      />
      <FolderColumn
        label="Skipped"
        items={skipped}
        emptyLabel="No heavy folders found at the project root."
        tone="neutral"
      />
    </div>
  );
}

function FolderColumn({
  label,
  items,
  emptyLabel,
  tone,
}: {
  readonly label: string;
  readonly items: readonly string[];
  readonly emptyLabel: string;
  readonly tone: BadgeTone;
}): JSX.Element {
  return (
    <div className="min-w-0 rounded-md border border-canvas-border bg-canvas-subtle-2/40 px-3 py-2.5">
      <p className="text-2xs font-medium uppercase tracking-[0.14em] text-ink-subtle">
        {label} ({items.length})
      </p>
      {items.length === 0 ? (
        <p className="mt-1 text-2xs text-ink-faint">{emptyLabel}</p>
      ) : (
        <ul className="mt-1.5 flex flex-wrap gap-1.5">
          {items.map((item) => (
            <li key={item}>
              <Badge tone={tone} variant="soft" className="font-mono">
                {item}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
