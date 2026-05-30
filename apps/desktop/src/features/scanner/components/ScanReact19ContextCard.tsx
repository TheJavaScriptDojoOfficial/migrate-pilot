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
  React19MigrationContext,
  React19PackageManager,
  React19SupportLevel,
  React19SupportStatus,
  ReactMigrationPhase,
  ReactMigrationTrack,
} from '@features/react19-migration';

/**
 * ScanReact19ContextCard — R2 step 2 surface for the React 19 migration
 * context and support eligibility.
 *
 * Renders one of two layouts:
 *
 *   - When the project is supported (React 16 / 17 / 18 with aligned
 *     react-dom), shows the source/target majors, the resolved migration
 *     track, and the recommended phase sequence.
 *   - When the project is unsupported / warning / unknown, shows a clear
 *     status banner with the support level, package manager, and the
 *     deterministic reason message — plus an explicit "plan generation
 *     allowed / blocked" indicator so the user knows whether the next
 *     workflow step is reachable.
 *
 * The card never renders an actionable plan — Planner V2 owns that
 * surface. This card is read-only foundational data.
 */
export interface ScanReact19ContextCardProps {
  readonly context?: React19MigrationContext;
  readonly status?: React19SupportStatus;
}

export function ScanReact19ContextCard({
  context,
  status,
}: ScanReact19ContextCardProps): JSX.Element | null {
  // Defensive: if a serialised pre-R2 report is loaded, neither field
  // will exist. Render nothing rather than a confusing empty card.
  if (status === undefined && context === undefined) return null;

  if (context !== undefined) {
    return (
      <SupportedContextCard
        context={context}
        {...(status !== undefined ? { status } : {})}
      />
    );
  }
  if (status !== undefined) {
    return <UnsupportedContextCard status={status} />;
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/* Supported layout                                                           */
/* -------------------------------------------------------------------------- */

interface SupportedContextCardProps {
  readonly context: React19MigrationContext;
  readonly status?: React19SupportStatus;
}

function SupportedContextCard({
  context,
  status,
}: SupportedContextCardProps): JSX.Element {
  const phaseCount = context.recommendedPhases.length;

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>React 19 migration context</CardTitle>
          <CardDescription>
            This is a React {context.sourceReactMajor} project. The planner
            will follow the {TRACK_LABEL[context.track]} track to React{' '}
            {context.targetReactMajor}.
          </CardDescription>
        </div>
        <Badge tone="success" variant="soft" withDot uppercase>
          Supported
        </Badge>
      </CardHeader>

      <CardSection>
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field
            label="Source React"
            value={context.sourceReactVersion}
            mono
            tone="info"
          />
          <Field
            label="Source major"
            value={`React ${context.sourceReactMajor}`}
            tone="info"
          />
          <Field
            label="Target React"
            value={`React ${context.targetReactMajor}`}
            tone="success"
          />
          <Field
            label="Migration track"
            value={TRACK_LABEL[context.track]}
            tone="accent"
            mono
          />
        </dl>
      </CardSection>

      <CardSection
        label={`Recommended phases (${phaseCount})`}
        trailing={
          <span className="text-2xs text-ink-subtle">
            {TRACK_PHASE_NOTE[context.track]}
          </span>
        }
      >
        <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {context.recommendedPhases.map((phase, idx) => (
            <PhaseChip key={phase} phase={phase} order={idx + 1} />
          ))}
        </ol>
      </CardSection>

      {status !== undefined ? (
        <CardSection label="Eligibility">
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field
              label="Support status"
              value={LEVEL_LABEL[status.status]}
              tone={LEVEL_TONE[status.status]}
              uppercase
            />
            <Field
              label="Plan generation"
              value={
                status.canGeneratePlan ? 'Allowed' : 'Blocked'
              }
              tone={status.canGeneratePlan ? 'success' : 'danger'}
              uppercase
            />
            <Field
              label="Package manager"
              value={PACKAGE_MANAGER_LABEL[
                status.packageManager ?? 'unknown'
              ]}
              tone={
                status.packageManager !== undefined &&
                status.packageManager !== 'unknown'
                  ? 'info'
                  : 'warning'
              }
              mono
            />
          </dl>
          <p className="mt-3 text-xs leading-relaxed text-ink-muted">
            {status.message}
          </p>
        </CardSection>
      ) : null}

      {status?.reactDomVersion !== undefined ? (
        <CardSection label="react-dom alignment">
          <p className="text-xs text-ink-muted">
            <span className="font-mono text-ink">react-dom</span> is declared
            at{' '}
            <span className="font-mono text-ink">{status.reactDomVersion}</span>
            {status.reactDomMajor !== undefined
              ? ` (major ${status.reactDomMajor})`
              : ''}
            . Majors agree with <span className="font-mono text-ink">react</span>
            .
          </p>
        </CardSection>
      ) : null}

      <CardSection>
        <p className="inline-flex items-center gap-1.5 text-2xs text-ink-subtle">
          <Icon name="shield" className="h-3 w-3 text-success" />
          Deterministic context — no AI involved. Plan generation is a later
          step.
        </p>
      </CardSection>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Unsupported layout                                                         */
/* -------------------------------------------------------------------------- */

interface UnsupportedContextCardProps {
  readonly status: React19SupportStatus;
}

function UnsupportedContextCard({
  status,
}: UnsupportedContextCardProps): JSX.Element {
  const tone = LEVEL_TONE[status.status];
  const headerLabel = LEVEL_BADGE_LABEL[status.status];
  const headerDescription = LEVEL_DESCRIPTION[status.status];
  const banner = LEVEL_BANNER_STYLE[status.status];

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>React 19 migration context</CardTitle>
          <CardDescription>{headerDescription}</CardDescription>
        </div>
        <Badge tone={tone} variant="soft" withDot uppercase>
          {headerLabel}
        </Badge>
      </CardHeader>

      <CardSection>
        <p
          className={cn(
            'rounded-md border px-3 py-2 text-xs leading-relaxed',
            banner,
          )}
        >
          {status.message}
        </p>
      </CardSection>

      <CardSection label="Detected">
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field
            label="react version"
            value={status.sourceReactVersion ?? 'not detected'}
            tone={status.sourceReactVersion ? 'warning' : 'danger'}
            mono
          />
          <Field
            label="react major"
            value={
              status.sourceReactMajor !== undefined
                ? `React ${status.sourceReactMajor}`
                : '—'
            }
            tone={status.sourceReactMajor !== undefined ? 'warning' : 'neutral'}
          />
          <Field
            label="react-dom version"
            value={status.reactDomVersion ?? 'not detected'}
            tone={status.reactDomVersion ? 'warning' : 'neutral'}
            mono
          />
          <Field
            label="react-dom major"
            value={
              status.reactDomMajor !== undefined
                ? `React ${status.reactDomMajor}`
                : '—'
            }
            tone={status.reactDomMajor !== undefined ? 'warning' : 'neutral'}
          />
          <Field
            label="Package manager"
            value={PACKAGE_MANAGER_LABEL[status.packageManager ?? 'unknown']}
            tone={
              status.packageManager !== undefined &&
              status.packageManager !== 'unknown'
                ? 'info'
                : 'warning'
            }
            mono
          />
          <Field label="Target React" value="React 19" tone="info" />
          <Field
            label="Plan generation"
            value={status.canGeneratePlan ? 'Allowed' : 'Blocked'}
            tone={status.canGeneratePlan ? 'success' : 'danger'}
            uppercase
          />
          <Field
            label="Status code"
            value={status.code}
            tone={tone}
            mono
            uppercase
          />
        </dl>
      </CardSection>

      <CardSection>
        <p className="inline-flex items-center gap-1.5 text-2xs text-ink-subtle">
          <Icon name="shield" className="h-3 w-3 text-warning" />
          {LEVEL_FOOTER[status.status]}
        </p>
      </CardSection>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* helpers                                                                    */
/* -------------------------------------------------------------------------- */

const TRACK_LABEL: Record<ReactMigrationTrack, string> = {
  'react-16-to-19': 'React 16 → 19',
  'react-17-to-19': 'React 17 → 19',
  'react-18-to-19': 'React 18 → 19',
};

const TRACK_PHASE_NOTE: Record<ReactMigrationTrack, string> = {
  'react-16-to-19': 'Routes through the React 18 bridge.',
  'react-17-to-19': 'Routes through the React 18 bridge.',
  'react-18-to-19': 'Skips the React 18 bridge.',
};

const PHASE_LABEL: Record<ReactMigrationPhase, string> = {
  preflight: 'Preflight',
  tooling: 'Tooling',
  'react-18-bridge': 'React 18 bridge',
  'api-compatibility': 'API compatibility',
  'jsx-transform': 'JSX transform',
  'react-19-upgrade': 'React 19 upgrade',
  'source-modernization': 'Source modernization',
  validation: 'Validation',
  'final-review': 'Final review',
};

const LEVEL_LABEL: Record<React19SupportLevel, string> = {
  supported: 'Supported',
  blocked: 'Blocked',
  warning: 'Warning',
  unknown: 'Unknown',
};

const LEVEL_BADGE_LABEL: Record<React19SupportLevel, string> = {
  supported: 'Supported',
  blocked: 'Blocked',
  warning: 'Not required',
  unknown: 'Needs review',
};

const LEVEL_TONE: Record<React19SupportLevel, BadgeTone> = {
  supported: 'success',
  blocked: 'danger',
  warning: 'warning',
  unknown: 'neutral',
};

const LEVEL_DESCRIPTION: Record<React19SupportLevel, string> = {
  supported:
    'This project is eligible for the React 19 migration pilot. Plan generation is unlocked.',
  blocked:
    'React 19 migration planning is blocked. Resolve the issue below before continuing.',
  warning:
    'React 19 migration planning is not required for this project. See the reason below for details.',
  unknown:
    'React 19 migration eligibility could not be determined safely. See the reason below.',
};

const LEVEL_FOOTER: Record<React19SupportLevel, string> = {
  supported:
    'Deterministic eligibility check — no AI involved. Continue to the React 19 migration plan when ready.',
  blocked:
    'Fix the React project setup, then re-run the scan to unblock the React 19 migration plan.',
  warning:
    'No migration is needed. You can pick a different React 16/17/18 project to use the pilot.',
  unknown:
    'Pin a standard semver range for the affected dependency, then re-run the scan.',
};

const LEVEL_BANNER_STYLE: Record<React19SupportLevel, string> = {
  supported: 'border-success/30 bg-success-soft text-success',
  blocked: 'border-danger/30 bg-danger-soft text-danger',
  warning: 'border-warning/30 bg-warning-soft text-warning',
  unknown: 'border-canvas-border-strong bg-canvas-overlay text-ink-muted',
};

const PACKAGE_MANAGER_LABEL: Record<React19PackageManager, string> = {
  npm: 'npm',
  yarn: 'yarn',
  pnpm: 'pnpm',
  bun: 'bun',
  unknown: 'not detected',
};

interface PhaseChipProps {
  readonly phase: ReactMigrationPhase;
  readonly order: number;
}

function PhaseChip({ phase, order }: PhaseChipProps): JSX.Element {
  return (
    <li
      className={cn(
        'flex items-center gap-2 rounded-md border border-canvas-border',
        'bg-canvas-subtle-2/40 px-3 py-2 text-xs text-ink',
      )}
    >
      <span className="font-mono text-2xs text-ink-subtle tabular-nums">
        {String(order).padStart(2, '0')}
      </span>
      <span className="font-mono text-xs text-ink-muted">·</span>
      <span className="truncate font-medium">{PHASE_LABEL[phase]}</span>
    </li>
  );
}

interface FieldProps {
  readonly label: string;
  readonly value: string;
  readonly tone?: BadgeTone;
  readonly mono?: boolean;
  readonly uppercase?: boolean;
}

function Field({
  label,
  value,
  tone = 'neutral',
  mono,
  uppercase,
}: FieldProps): JSX.Element {
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
