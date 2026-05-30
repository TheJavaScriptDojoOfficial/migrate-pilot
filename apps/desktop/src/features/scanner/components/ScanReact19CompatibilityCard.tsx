import { Badge, type BadgeTone } from '@shared/ui/Badge';
import {
  Card,
  CardDescription,
  CardHeader,
  CardSection,
  CardTitle,
} from '@shared/ui/Card';
import { Icon, type IconName } from '@shared/ui/Icon';
import { cn } from '@shared/utils/cn';

import type {
  React19CompatibilityCategory,
  React19CompatibilityCategoryReport,
  React19CompatibilityCategoryStatus,
  React19CompatibilityIssue,
  React19CompatibilityReport,
  React19CompatibilitySeverity,
} from '@features/react19-migration';

/**
 * ScanReact19CompatibilityCard — R2 Step 3 surface for the broader React 19
 * compatibility report.
 *
 * Replaces the historical `node-sass`-centric framing with a generic React 19
 * readiness scan covering React/React-DOM versions, build tooling,
 * deprecated APIs / lifecycle methods, component patterns (findDOMNode,
 * string refs, legacy context, class density), routing, testing, deprecated
 * dependencies, peer dependency risks, Sass/SCSS, package manager and
 * lockfile health, and validation script availability.
 *
 * Pure render component — receives the deterministic
 * {@link React19CompatibilityReport} from the scanner service and renders a
 * summary, the per-category roll-up, the top blockers/high risks, and the
 * detected validation surface. No mutation, no side effects.
 */
export interface ScanReact19CompatibilityCardProps {
  readonly report: React19CompatibilityReport;
}

export function ScanReact19CompatibilityCard({
  report,
}: ScanReact19CompatibilityCardProps): JSX.Element {
  const { summary, categories, issues, signals } = report;
  const topIssues = pickTopIssues(issues, 6);

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>React 19 compatibility</CardTitle>
          <CardDescription>
            Deterministic compatibility scan across React versions, build
            tooling, deprecated APIs, dependencies, and validation surface.
          </CardDescription>
        </div>
        <SummaryBadges summary={summary} />
      </CardHeader>

      <CardSection label="Severity counts">
        <SeverityCounts summary={summary} />
      </CardSection>

      <CardSection label="Categories">
        <CategoryGrid categories={categories} />
      </CardSection>

      {topIssues.length > 0 ? (
        <CardSection label={`Top issues (${topIssues.length})`}>
          <IssueList issues={topIssues} />
        </CardSection>
      ) : (
        <CardSection label="Top issues">
          <p className="flex items-center gap-2 text-xs text-ink-muted">
            <Icon name="check-circle" className="h-4 w-4 text-success" />
            The compatibility scan did not surface any blocking or high-risk
            findings.
          </p>
        </CardSection>
      )}

      <CardSection label="Validation commands">
        <ValidationCommandRow report={report} />
      </CardSection>

      <CardSection>
        <p className="inline-flex items-center gap-1.5 text-2xs text-ink-subtle">
          <Icon name="shield" className="h-3 w-3 text-success" />
          Deterministic scan — no AI involved. Detected{' '}
          {signals.lockFiles.length > 0
            ? `lockfile${signals.lockFiles.length === 1 ? '' : 's'}: ${signals.lockFiles.join(', ')}`
            : 'no lockfiles'}
          .
        </p>
      </CardSection>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Summary                                                                    */
/* -------------------------------------------------------------------------- */

function SummaryBadges({
  summary,
}: {
  readonly summary: React19CompatibilityReport['summary'];
}): JSX.Element {
  if (summary.totalIssues === 0) {
    return (
      <Badge tone="success" variant="soft" withDot uppercase>
        No issues
      </Badge>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {summary.blockerCount > 0 ? (
        <Badge tone="danger" variant="soft" withDot uppercase>
          {summary.blockerCount} blocker{summary.blockerCount === 1 ? '' : 's'}
        </Badge>
      ) : null}
      {summary.highCount > 0 ? (
        <Badge tone="warning" variant="soft" withDot uppercase>
          {summary.highCount} high
        </Badge>
      ) : null}
      {summary.mediumCount > 0 ? (
        <Badge tone="info" variant="soft" withDot uppercase>
          {summary.mediumCount} med
        </Badge>
      ) : null}
      {summary.lowCount > 0 ? (
        <Badge tone="neutral" variant="soft" withDot uppercase>
          {summary.lowCount} low
        </Badge>
      ) : null}
      {summary.infoCount > 0 ? (
        <Badge tone="neutral" variant="outline" uppercase>
          {summary.infoCount} info
        </Badge>
      ) : null}
    </div>
  );
}

function SeverityCounts({
  summary,
}: {
  readonly summary: React19CompatibilityReport['summary'];
}): JSX.Element {
  const items: ReadonlyArray<{
    readonly label: string;
    readonly value: number;
    readonly tone: BadgeTone;
  }> = [
    { label: 'Blockers', value: summary.blockerCount, tone: 'danger' },
    { label: 'High', value: summary.highCount, tone: 'warning' },
    { label: 'Medium', value: summary.mediumCount, tone: 'info' },
    { label: 'Low', value: summary.lowCount, tone: 'neutral' },
    { label: 'Info', value: summary.infoCount, tone: 'neutral' },
  ];
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      {items.map((item) => (
        <li
          key={item.label}
          className="flex items-center justify-between gap-3 rounded-md border border-canvas-border bg-canvas-subtle-2/40 px-3 py-2"
        >
          <span className="text-2xs font-medium uppercase tracking-[0.14em] text-ink-subtle">
            {item.label}
          </span>
          <Badge tone={item.tone} variant="soft" className="font-mono tabular-nums">
            {item.value}
          </Badge>
        </li>
      ))}
    </ul>
  );
}

/* -------------------------------------------------------------------------- */
/* Categories                                                                 */
/* -------------------------------------------------------------------------- */

const CATEGORY_LABEL: Record<React19CompatibilityCategory, string> = {
  'react-version': 'React version',
  'react-dom-version': 'React DOM',
  'build-tool': 'Build tool',
  'typescript-readiness': 'TypeScript readiness',
  'jsx-transform': 'JSX transform',
  'deprecated-react-api': 'Deprecated React APIs',
  'deprecated-lifecycle': 'Deprecated lifecycles',
  'component-patterns': 'Component patterns',
  routing: 'Routing',
  testing: 'Testing',
  dependencies: 'Dependencies',
  'peer-dependencies': 'Peer dependencies',
  'sass-scss': 'Sass / SCSS',
  'package-manager': 'Package manager',
  validation: 'Validation',
};

const CATEGORY_STATUS_TONE: Record<React19CompatibilityCategoryStatus, BadgeTone> = {
  clean: 'success',
  info: 'neutral',
  warning: 'info',
  risk: 'warning',
  blocker: 'danger',
};

const CATEGORY_STATUS_LABEL: Record<React19CompatibilityCategoryStatus, string> = {
  clean: 'OK',
  info: 'Info',
  warning: 'Review',
  risk: 'Risk',
  blocker: 'Blocker',
};

function CategoryGrid({
  categories,
}: {
  readonly categories: readonly React19CompatibilityCategoryReport[];
}): JSX.Element {
  return (
    <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {categories.map((c) => (
        <CategoryRow key={c.category} report={c} />
      ))}
    </ul>
  );
}

function CategoryRow({
  report,
}: {
  readonly report: React19CompatibilityCategoryReport;
}): JSX.Element {
  const { category, status, issueCount, topIssue } = report;
  const tone = CATEGORY_STATUS_TONE[status];
  return (
    <li
      className={cn(
        'flex flex-col gap-1.5 rounded-md border px-3 py-2.5',
        status === 'clean'
          ? 'border-canvas-border bg-canvas-subtle-2/40'
          : 'border-canvas-border bg-canvas-subtle-2/60',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-medium text-ink">
          {CATEGORY_LABEL[category]}
        </span>
        <Badge tone={tone} variant="soft" uppercase>
          {CATEGORY_STATUS_LABEL[status]}
        </Badge>
      </div>
      <div className="flex items-center justify-between gap-2 text-2xs text-ink-muted">
        <span>
          {issueCount === 0
            ? 'No issues'
            : `${issueCount} issue${issueCount === 1 ? '' : 's'}`}
        </span>
        {topIssue !== undefined ? (
          <span className="truncate font-mono text-[10px] text-ink-faint" title={topIssue.code}>
            {topIssue.code}
          </span>
        ) : null}
      </div>
      {topIssue !== undefined ? (
        <p
          className="truncate text-2xs leading-snug text-ink-muted"
          title={topIssue.title}
        >
          {topIssue.title}
        </p>
      ) : null}
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/* Issue list                                                                 */
/* -------------------------------------------------------------------------- */

const SEVERITY_RANK: Record<React19CompatibilitySeverity, number> = {
  blocker: 5,
  high: 4,
  medium: 3,
  low: 2,
  info: 1,
};

function pickTopIssues(
  issues: readonly React19CompatibilityIssue[],
  limit: number,
): readonly React19CompatibilityIssue[] {
  return [...issues]
    .filter((i) => i.severity === 'blocker' || i.severity === 'high')
    .sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity])
    .slice(0, limit);
}

const SEVERITY_STYLE: Record<
  React19CompatibilitySeverity,
  { icon: IconName; iconClass: string; bg: string; ring: string; tone: BadgeTone }
> = {
  blocker: {
    icon: 'cross',
    iconClass: 'text-danger',
    bg: 'bg-danger/15',
    ring: 'ring-1 ring-inset ring-danger/30',
    tone: 'danger',
  },
  high: {
    icon: 'help',
    iconClass: 'text-warning',
    bg: 'bg-warning/15',
    ring: 'ring-1 ring-inset ring-warning/30',
    tone: 'warning',
  },
  medium: {
    icon: 'help',
    iconClass: 'text-info',
    bg: 'bg-info/15',
    ring: 'ring-1 ring-inset ring-info/30',
    tone: 'info',
  },
  low: {
    icon: 'sparkles',
    iconClass: 'text-info',
    bg: 'bg-info/10',
    ring: 'ring-1 ring-inset ring-info/30',
    tone: 'info',
  },
  info: {
    icon: 'sparkles',
    iconClass: 'text-ink-subtle',
    bg: 'bg-canvas-overlay',
    ring: 'ring-1 ring-inset ring-canvas-border-strong',
    tone: 'neutral',
  },
};

function IssueList({
  issues,
}: {
  readonly issues: readonly React19CompatibilityIssue[];
}): JSX.Element {
  return (
    <ul className="space-y-2.5">
      {issues.map((issue, idx) => (
        <IssueRow key={`${issue.code}-${idx}`} issue={issue} />
      ))}
    </ul>
  );
}

function IssueRow({
  issue,
}: {
  readonly issue: React19CompatibilityIssue;
}): JSX.Element {
  const style = SEVERITY_STYLE[issue.severity];
  return (
    <li className="flex items-start gap-3 rounded-md border border-canvas-border bg-canvas-subtle-2/40 px-3 py-2.5">
      <span
        className={cn(
          'mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full',
          style.bg,
          style.ring,
        )}
      >
        <Icon name={style.icon} className={cn('h-3 w-3', style.iconClass)} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-semibold text-ink">{issue.title}</p>
          <Badge tone={style.tone} variant="soft" uppercase>
            {issue.severity}
          </Badge>
          <span className="font-mono text-[10px] uppercase tracking-wider text-ink-faint">
            {issue.code}
          </span>
          {issue.packageName !== undefined ? (
            <span
              className="font-mono text-[10px] text-ink-faint"
              title={issue.packageName}
            >
              {issue.packageName}
              {issue.currentVersion !== undefined
                ? `@${issue.currentVersion}`
                : ''}
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-xs leading-relaxed text-ink-muted">
          {issue.message}
        </p>
        <p className="mt-1 text-2xs leading-snug text-ink-faint">
          <span className="text-ink-subtle">Recommended: </span>
          {issue.recommendation}
        </p>
        {issue.filePaths !== undefined && issue.filePaths.length > 0 ? (
          <ul className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {issue.filePaths.slice(0, 5).map((p) => (
              <li key={p}>
                <Badge tone="neutral" variant="soft" className="max-w-full truncate font-mono">
                  {p}
                </Badge>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/* Validation commands                                                        */
/* -------------------------------------------------------------------------- */

function ValidationCommandRow({
  report,
}: {
  readonly report: React19CompatibilityReport;
}): JSX.Element {
  const { signals } = report;
  const items: ReadonlyArray<{
    readonly label: string;
    readonly present: boolean;
    readonly importance: 'critical' | 'recommended' | 'optional';
  }> = [
    { label: 'build', present: signals.hasBuildScript, importance: 'critical' },
    { label: 'test', present: signals.hasTestScript, importance: 'recommended' },
    { label: 'lint', present: signals.hasLintScript, importance: 'recommended' },
    { label: 'typecheck', present: signals.hasTypecheckScript, importance: 'optional' },
  ];

  return (
    <ul className="grid gap-2 sm:grid-cols-4">
      {items.map((item) => {
        const tone: BadgeTone = item.present
          ? 'success'
          : item.importance === 'critical'
            ? 'danger'
            : item.importance === 'recommended'
              ? 'warning'
              : 'neutral';
        return (
          <li
            key={item.label}
            className={cn(
              'flex items-center justify-between gap-3 rounded-md border px-3 py-2',
              item.present
                ? 'border-canvas-border bg-canvas-subtle-2/40'
                : 'border-dashed border-canvas-border bg-canvas-subtle/30',
            )}
          >
            <Badge tone={tone} variant="soft" uppercase>
              {item.label}
            </Badge>
            <Icon
              name={item.present ? 'check' : 'cross'}
              className={cn('h-3.5 w-3.5', item.present ? 'text-success' : 'text-ink-faint')}
            />
          </li>
        );
      })}
    </ul>
  );
}