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
import { formatDurationMs } from '@shared/utils/format';

import type {
  ScanProjectInfo,
  ScanReport,
  ScanRiskLevel,
} from '../types/scanner.types';

/**
 * ScanSummaryCard — top-of-report card combining the readiness score, risk
 * level, project identity, and high-level metadata. Designed to give the
 * user a "headline" view before they drill into individual sections.
 */
export interface ScanSummaryCardProps {
  readonly report: ScanReport;
}

export function ScanSummaryCard({ report }: ScanSummaryCardProps): JSX.Element {
  const { projectInfo, risks, dependencies } = report;

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Readiness summary</CardTitle>
          <CardDescription>
            Headline figures from the deterministic scan. Generated{' '}
            <time dateTime={report.generatedAt} title={report.generatedAt}>
              {new Date(report.generatedAt).toLocaleString()}
            </time>
            .
          </CardDescription>
        </div>
        <RiskLevelPill level={risks.level} />
      </CardHeader>

      <CardSection>
        <div className="grid gap-4 sm:grid-cols-3">
          <ScoreTile score={risks.score} level={risks.level} />
          <SummaryStat
            label="Risk level"
            value={risks.level}
            tone={LEVEL_TONE[risks.level]}
            uppercase
          />
          <SummaryStat
            label="Complexity"
            value={projectInfo.complexity}
            tone={
              projectInfo.complexity === 'large'
                ? 'warning'
                : projectInfo.complexity === 'medium'
                  ? 'info'
                  : 'success'
            }
            uppercase
          />
        </div>
      </CardSection>

      <CardSection label="Project">
        <dl className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" value={projectInfo.name} />
          <Field label="Selected path" value={projectInfo.path} mono />
          <Field
            label="React version"
            value={dependencies.reactVersion ?? 'not detected'}
            tone={dependencies.reactVersion ? 'success' : 'danger'}
            mono
          />
          <Field
            label="React DOM"
            value={dependencies.reactDomVersion ?? '—'}
            tone={dependencies.reactDomVersion ? 'success' : 'neutral'}
            mono
          />
          <Field
            label="Package manager"
            value={dependencies.packageManager}
            tone={dependencies.packageManager === 'unknown' ? 'warning' : 'info'}
            uppercase
          />
          <Field
            label="TypeScript"
            value={projectInfo.hasTypeScript ? 'present' : 'not present'}
            tone={projectInfo.hasTypeScript ? 'success' : 'warning'}
          />
          <Field
            label="Git repository"
            value={projectInfo.isGitRepository ? 'detected' : 'not detected'}
            tone={projectInfo.isGitRepository ? 'success' : 'warning'}
          />
          <Field
            label="Current branch"
            value={projectInfo.currentBranch ?? '—'}
            mono
            tone={projectInfo.currentBranch ? 'info' : 'neutral'}
            icon={
              projectInfo.currentBranch ? (
                <Icon name="git-branch" className="h-3 w-3" />
              ) : null
            }
          />
        </dl>
      </CardSection>

      <CardSection>
        <div className="flex flex-wrap items-center gap-3 text-2xs text-ink-subtle">
          <span className="inline-flex items-center gap-1.5">
            <Icon name="shield" className="h-3 w-3 text-success" />
            Read-only scan
          </span>
          <span className="h-3 w-px bg-canvas-border" aria-hidden />
          <span>
            Scanned in{' '}
            <span className="font-mono text-ink">
              {formatDurationMs(projectInfo.durationMs)}
            </span>
          </span>
          <span className="h-3 w-px bg-canvas-border" aria-hidden />
          <span>
            Git status:{' '}
            <span className="font-mono text-ink-muted uppercase tracking-[0.08em]">
              {projectInfo.gitClean}
            </span>
          </span>
        </div>
      </CardSection>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* helpers                                                                    */
/* -------------------------------------------------------------------------- */

const LEVEL_TONE: Record<ScanRiskLevel, BadgeTone> = {
  low: 'success',
  medium: 'warning',
  high: 'danger',
};

function RiskLevelPill({ level }: { level: ScanRiskLevel }): JSX.Element {
  return (
    <Badge tone={LEVEL_TONE[level]} variant="soft" withDot uppercase>
      {level} risk
    </Badge>
  );
}

interface ScoreTileProps {
  readonly score: number;
  readonly level: ScanRiskLevel;
}

function ScoreTile({ score, level }: ScoreTileProps): JSX.Element {
  return (
    <div
      className={cn(
        'flex items-baseline gap-3 rounded-md border bg-canvas-subtle-2/40 px-4 py-3',
        TILE_BORDER[level],
      )}
    >
      <span className="font-mono text-3xl font-semibold tabular-nums text-ink">
        {score}
      </span>
      <span className="font-mono text-base text-ink-subtle">/100</span>
      <span className="ml-auto text-2xs font-medium uppercase tracking-[0.14em] text-ink-subtle">
        Readiness
      </span>
    </div>
  );
}

const TILE_BORDER: Record<ScanRiskLevel, string> = {
  low: 'border-success/40',
  medium: 'border-warning/40',
  high: 'border-danger/40',
};

interface SummaryStatProps {
  readonly label: string;
  readonly value: string;
  readonly tone: BadgeTone;
  readonly uppercase?: boolean;
}

function SummaryStat({
  label,
  value,
  tone,
  uppercase,
}: SummaryStatProps): JSX.Element {
  return (
    <div className="rounded-md border border-canvas-border bg-canvas-subtle-2/40 px-4 py-3">
      <p className="text-2xs font-medium uppercase tracking-[0.14em] text-ink-subtle">
        {label}
      </p>
      <div className="mt-2">
        <Badge tone={tone} variant="soft" {...(uppercase ? { uppercase: true } : {})}>
          {value}
        </Badge>
      </div>
    </div>
  );
}

interface FieldProps {
  readonly label: string;
  readonly value: string;
  readonly tone?: BadgeTone;
  readonly mono?: boolean;
  readonly uppercase?: boolean;
  readonly icon?: React.ReactNode;
}

function Field({
  label,
  value,
  tone = 'neutral',
  mono,
  uppercase,
  icon,
}: FieldProps): JSX.Element {
  return (
    <div className="min-w-0">
      <dt className="text-2xs font-medium uppercase tracking-[0.14em] text-ink-subtle">
        {label}
      </dt>
      <dd className="mt-1 flex items-center gap-1.5">
        {icon}
        <Badge
          tone={tone}
          variant="soft"
          {...(uppercase ? { uppercase: true } : {})}
          className={cn('max-w-full truncate', mono ? 'font-mono' : undefined)}
          title={value}
        >
          {value}
        </Badge>
      </dd>
    </div>
  );
}

export { LEVEL_TONE as SCAN_LEVEL_TONE };
export type { ScanProjectInfo };
