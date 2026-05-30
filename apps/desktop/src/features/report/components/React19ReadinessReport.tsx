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
  React19ReadinessIssueItem,
  React19ReadinessOverallStatus,
  React19ReadinessPhaseCard,
  React19ReadinessPhaseStatus,
  React19ReadinessRecommendationItem,
  React19ReadinessReportViewModel,
  React19ReadinessRiskLevel,
  React19ValidationCommandItem,
} from '@features/react19-migration';
import type { ReactMigrationTrack } from '@features/react19-migration';

/**
 * React19ReadinessReport — R2 Step 5 primary report surface.
 *
 * Presents the deterministic React 16/17/18 → React 19 migration readiness
 * report derived from {@link React19ReadinessReportViewModel}. Replaces the
 * legacy node-sass-centric scan cards on the Step 3 report screen.
 */
export interface React19ReadinessReportProps {
  readonly viewModel: React19ReadinessReportViewModel;
}

export function React19ReadinessReport({
  viewModel,
}: React19ReadinessReportProps): JSX.Element {
  return (
    <div className="flex flex-col gap-6">
      <HeaderSummaryCard viewModel={viewModel} />
      <ReadinessOverviewCard viewModel={viewModel} />
      <PhaseReadinessSection phases={viewModel.phaseReadiness} />
      <BlockersSection items={viewModel.blockers} />
      <WarningsSection items={viewModel.warnings} />
      <RecommendationsSection items={viewModel.recommendations} />
      <ValidationCommandsSection commands={viewModel.validationCommands} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 1. Header summary                                                          */
/* -------------------------------------------------------------------------- */

function HeaderSummaryCard({
  viewModel,
}: {
  readonly viewModel: React19ReadinessReportViewModel;
}): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>React 19 Migration Readiness Report</CardTitle>
          <CardDescription>
            Deterministic migration readiness for{' '}
            <span className="font-semibold text-ink">
              {viewModel.projectName ?? 'this project'}
            </span>
            {viewModel.generatedAt !== undefined ? (
              <>
                {' '}
                · scanned{' '}
                <time dateTime={viewModel.generatedAt} title={viewModel.generatedAt}>
                  {new Date(viewModel.generatedAt).toLocaleString()}
                </time>
              </>
            ) : null}
          </CardDescription>
        </div>
        <OverallStatusBadge status={viewModel.overallStatus} />
      </CardHeader>

      <CardSection>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetaField
            label="Source React version"
            value={viewModel.sourceReactVersion ?? 'not detected'}
            tone={viewModel.sourceReactVersion ? 'info' : 'danger'}
            mono
          />
          <MetaField
            label="Target React version"
            value={viewModel.targetReactVersion}
            tone="success"
            mono
          />
          <MetaField
            label="Migration track"
            value={
              viewModel.migrationTrack !== undefined
                ? TRACK_LABEL[viewModel.migrationTrack]
                : 'not available'
            }
            tone={viewModel.migrationTrack ? 'accent' : 'warning'}
            mono
          />
          <MetaField
            label="Overall status"
            value={OVERALL_STATUS_LABEL[viewModel.overallStatus]}
            tone={OVERALL_STATUS_TONE[viewModel.overallStatus]}
            uppercase
          />
        </dl>
      </CardSection>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* 2. Readiness overview                                                      */
/* -------------------------------------------------------------------------- */

function ReadinessOverviewCard({
  viewModel,
}: {
  readonly viewModel: React19ReadinessReportViewModel;
}): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Readiness overview</CardTitle>
          <CardDescription>
            Score, risk, and plan-generation eligibility for this React 19 migration.
          </CardDescription>
        </div>
        <Badge
          tone={viewModel.canGeneratePlan ? 'success' : 'danger'}
          variant="soft"
          withDot
          uppercase
        >
          {viewModel.canGeneratePlan ? 'Can generate plan' : 'Cannot generate plan'}
        </Badge>
      </CardHeader>

      <CardSection>
        <div className="grid gap-4 sm:grid-cols-3">
          <ScoreTile score={viewModel.readinessScore} riskLevel={viewModel.riskLevel} />
          <OverviewStat
            label="Risk level"
            value={viewModel.riskLevel}
            tone={RISK_TONE[viewModel.riskLevel]}
            uppercase
          />
          <OverviewStat
            label="Plan generation"
            value={viewModel.canGeneratePlan ? 'Allowed' : 'Blocked'}
            tone={viewModel.canGeneratePlan ? 'success' : 'danger'}
            uppercase
          />
        </div>
      </CardSection>

      <CardSection label="Plan generation">
        <p className="text-xs leading-relaxed text-ink-muted">
          {viewModel.planGenerationExplanation}
        </p>
        {!viewModel.canGeneratePlan && viewModel.cannotGeneratePlanReasons.length > 0 ? (
          <ul className="mt-3 space-y-1.5">
            {viewModel.cannotGeneratePlanReasons.map((reason) => (
              <li
                key={reason}
                className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-xs text-danger"
              >
                <Icon name="cross" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </CardSection>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* 3. Phase readiness                                                         */
/* -------------------------------------------------------------------------- */

function PhaseReadinessSection({
  phases,
}: {
  readonly phases: readonly React19ReadinessPhaseCard[];
}): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Phase readiness</CardTitle>
          <CardDescription>
            Migration areas grouped by phase. Resolve blocked phases before generating a plan.
          </CardDescription>
        </div>
      </CardHeader>
      <CardSection>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {phases.map((phase) => (
            <PhaseCard key={phase.id} phase={phase} />
          ))}
        </ul>
      </CardSection>
    </Card>
  );
}

function PhaseCard({ phase }: { readonly phase: React19ReadinessPhaseCard }): JSX.Element {
  return (
    <li
      className={cn(
        'flex flex-col gap-2 rounded-md border px-3 py-2.5',
        phase.status === 'ready'
          ? 'border-canvas-border bg-canvas-subtle-2/40'
          : 'border-canvas-border bg-canvas-subtle-2/60',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-ink">{phase.title}</p>
        <Badge tone={PHASE_STATUS_TONE[phase.status]} variant="soft" uppercase>
          {PHASE_STATUS_LABEL[phase.status]}
        </Badge>
      </div>
      <p className="text-2xs leading-snug text-ink-muted">{phase.description}</p>
      <p className="text-2xs text-ink-subtle">
        {phase.issueCount === 0
          ? 'No related issues'
          : `${phase.issueCount} related issue${phase.issueCount === 1 ? '' : 's'}`}
      </p>
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/* 4–6. Issue sections                                                        */
/* -------------------------------------------------------------------------- */

function BlockersSection({
  items,
}: {
  readonly items: readonly React19ReadinessIssueItem[];
}): JSX.Element {
  return (
    <IssueSectionCard
      title="Blockers"
      description="Issues that must be resolved before React 19 migration planning can proceed safely."
      emptyLabel="No blockers found"
      items={items}
      tone="danger"
    />
  );
}

function WarningsSection({
  items,
}: {
  readonly items: readonly React19ReadinessIssueItem[];
}): JSX.Element {
  return (
    <IssueSectionCard
      title="Warnings"
      description="Non-blocking findings to review during migration planning and execution."
      emptyLabel="No warnings found"
      items={items}
      tone="warning"
    />
  );
}

function IssueSectionCard({
  title,
  description,
  emptyLabel,
  items,
  tone,
}: {
  readonly title: string;
  readonly description: string;
  readonly emptyLabel: string;
  readonly items: readonly React19ReadinessIssueItem[];
  readonly tone: 'danger' | 'warning';
}): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        {items.length > 0 ? (
          <Badge tone={tone} variant="soft" withDot>
            {items.length}
          </Badge>
        ) : (
          <Badge tone="success" variant="soft" withDot>
            Clear
          </Badge>
        )}
      </CardHeader>
      <CardSection>
        {items.length === 0 ? (
          <p className="flex items-center gap-2 text-xs text-ink-muted">
            <Icon name="check-circle" className="h-4 w-4 text-success" />
            {emptyLabel}
          </p>
        ) : (
          <ul className="space-y-2.5">
            {items.map((item, idx) => (
              <IssueRow key={`${item.code}-${idx}`} item={item} />
            ))}
          </ul>
        )}
      </CardSection>
    </Card>
  );
}

function IssueRow({ item }: { readonly item: React19ReadinessIssueItem }): JSX.Element {
  const style = ISSUE_SEVERITY_STYLE[item.severity];
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
          <p className="text-xs font-semibold text-ink">{item.label}</p>
          <Badge tone={style.tone} variant="soft" uppercase>
            {item.severity}
          </Badge>
          {item.packageName !== undefined ? (
            <span className="font-mono text-[10px] text-ink-faint">{item.packageName}</span>
          ) : null}
        </div>
        <p className="mt-1 text-xs leading-relaxed text-ink-muted">{item.message}</p>
        <p className="mt-1 text-2xs leading-snug text-ink-faint">
          <span className="text-ink-subtle">Recommended: </span>
          {item.recommendation}
        </p>
      </div>
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/* 7. Recommendations                                                         */
/* -------------------------------------------------------------------------- */

function RecommendationsSection({
  items,
}: {
  readonly items: readonly React19ReadinessRecommendationItem[];
}): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Recommendations</CardTitle>
          <CardDescription>
            Actionable next steps derived from compatibility findings and issue metadata.
          </CardDescription>
        </div>
      </CardHeader>
      <CardSection>
        {items.length === 0 ? (
          <p className="flex items-center gap-2 text-xs text-ink-muted">
            <Icon name="sparkles" className="h-4 w-4 text-ink-subtle" />
            No recommendations available
          </p>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => (
              <li
                key={item.id}
                className="rounded-md border border-canvas-border bg-canvas-subtle-2/40 px-3 py-2.5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-xs font-semibold text-ink">{item.label}</p>
                  <Badge tone={PRIORITY_TONE[item.priority]} variant="soft" uppercase>
                    {item.priority}
                  </Badge>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-ink-muted">{item.detail}</p>
              </li>
            ))}
          </ul>
        )}
      </CardSection>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* 8. Validation commands                                                     */
/* -------------------------------------------------------------------------- */

function ValidationCommandsSection({
  commands,
}: {
  readonly commands: readonly React19ValidationCommandItem[];
}): JSX.Element {
  const missing = commands.filter((c) => !c.present);

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Validation commands</CardTitle>
          <CardDescription>
            Package scripts detected for migration validation gates. Missing scripts are flagged
            as warnings — not successful checks.
          </CardDescription>
        </div>
      </CardHeader>
      <CardSection>
        <ul className="grid gap-2 sm:grid-cols-2">
          {commands.map((cmd) => (
            <ValidationCommandRow key={cmd.scriptName} command={cmd} />
          ))}
        </ul>
      </CardSection>
      {missing.length > 0 ? (
        <CardSection label="Missing validation scripts">
          <ul className="space-y-1.5">
            {missing.map((cmd) => (
              <li
                key={`missing-${cmd.scriptName}`}
                className="flex items-center gap-2 text-xs text-warning"
              >
                <Icon name="help" className="h-3.5 w-3.5 shrink-0" />
                <span>
                  No <span className="font-mono">{cmd.scriptName}</span> script — expected{' '}
                  <span className="font-mono text-ink-muted">{cmd.command}</span>
                </span>
              </li>
            ))}
          </ul>
        </CardSection>
      ) : null}
    </Card>
  );
}

function ValidationCommandRow({
  command,
}: {
  readonly command: React19ValidationCommandItem;
}): JSX.Element {
  const tone: BadgeTone = command.present
    ? 'success'
    : command.importance === 'critical'
      ? 'danger'
      : command.importance === 'recommended'
        ? 'warning'
        : 'neutral';

  return (
    <li
      className={cn(
        'flex items-center justify-between gap-3 rounded-md border px-3 py-2.5',
        command.present
          ? 'border-canvas-border bg-canvas-subtle-2/40'
          : 'border-dashed border-warning/40 bg-warning-soft/20',
      )}
    >
      <div className="min-w-0">
        <Badge tone={tone} variant="soft" uppercase>
          {command.scriptName}
        </Badge>
        <p className="mt-1 truncate font-mono text-2xs text-ink-muted">{command.command}</p>
      </div>
      <Icon
        name={command.present ? 'check' : 'cross'}
        className={cn('h-4 w-4 shrink-0', command.present ? 'text-success' : 'text-warning')}
      />
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/* Shared helpers                                                             */
/* -------------------------------------------------------------------------- */

const TRACK_LABEL: Record<ReactMigrationTrack, string> = {
  'react-16-to-19': 'react-16-to-19',
  'react-17-to-19': 'react-17-to-19',
  'react-18-to-19': 'react-18-to-19',
};

const OVERALL_STATUS_LABEL: Record<React19ReadinessOverallStatus, string> = {
  ready: 'Ready',
  blocked: 'Blocked',
  warning: 'Review',
  unknown: 'Unknown',
};

const OVERALL_STATUS_TONE: Record<React19ReadinessOverallStatus, BadgeTone> = {
  ready: 'success',
  blocked: 'danger',
  warning: 'warning',
  unknown: 'neutral',
};

const RISK_TONE: Record<React19ReadinessRiskLevel, BadgeTone> = {
  low: 'success',
  medium: 'warning',
  high: 'danger',
};

const PHASE_STATUS_LABEL: Record<React19ReadinessPhaseStatus, string> = {
  ready: 'Ready',
  warning: 'Review',
  blocked: 'Blocked',
  unknown: 'Unknown',
};

const PHASE_STATUS_TONE: Record<React19ReadinessPhaseStatus, BadgeTone> = {
  ready: 'success',
  warning: 'warning',
  blocked: 'danger',
  unknown: 'neutral',
};

const PRIORITY_TONE: Record<React19ReadinessRecommendationItem['priority'], BadgeTone> = {
  high: 'danger',
  medium: 'warning',
  low: 'neutral',
};

const SCORE_BORDER: Record<React19ReadinessRiskLevel, string> = {
  low: 'border-success/40',
  medium: 'border-warning/40',
  high: 'border-danger/40',
};

function OverallStatusBadge({
  status,
}: {
  readonly status: React19ReadinessOverallStatus;
}): JSX.Element {
  return (
    <Badge tone={OVERALL_STATUS_TONE[status]} variant="soft" withDot uppercase>
      {OVERALL_STATUS_LABEL[status]}
    </Badge>
  );
}

function MetaField({
  label,
  value,
  tone,
  mono,
  uppercase,
}: {
  readonly label: string;
  readonly value: string;
  readonly tone: BadgeTone;
  readonly mono?: boolean;
  readonly uppercase?: boolean;
}): JSX.Element {
  return (
    <div className="min-w-0">
      <dt className="text-2xs font-medium uppercase tracking-[0.14em] text-ink-subtle">
        {label}
      </dt>
      <dd className="mt-1">
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

function ScoreTile({
  score,
  riskLevel,
}: {
  readonly score: number;
  readonly riskLevel: React19ReadinessRiskLevel;
}): JSX.Element {
  return (
    <div
      className={cn(
        'flex items-baseline gap-3 rounded-md border bg-canvas-subtle-2/40 px-4 py-3',
        SCORE_BORDER[riskLevel],
      )}
    >
      <span className="font-mono text-3xl font-semibold tabular-nums text-ink">{score}</span>
      <span className="font-mono text-base text-ink-subtle">/100</span>
      <span className="ml-auto text-2xs font-medium uppercase tracking-[0.14em] text-ink-subtle">
        Readiness
      </span>
    </div>
  );
}

function OverviewStat({
  label,
  value,
  tone,
  uppercase,
}: {
  readonly label: string;
  readonly value: string;
  readonly tone: BadgeTone;
  readonly uppercase?: boolean;
}): JSX.Element {
  return (
    <div className="rounded-md border border-canvas-border bg-canvas-subtle-2/40 px-4 py-3">
      <p className="text-2xs font-medium uppercase tracking-[0.14em] text-ink-subtle">{label}</p>
      <div className="mt-2">
        <Badge tone={tone} variant="soft" {...(uppercase ? { uppercase: true } : {})}>
          {value}
        </Badge>
      </div>
    </div>
  );
}

const ISSUE_SEVERITY_STYLE: Record<
  React19ReadinessIssueItem['severity'],
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
