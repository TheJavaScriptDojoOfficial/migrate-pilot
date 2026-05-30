import { useNavigate } from 'react-router-dom';

import { Badge } from '@shared/ui/Badge';
import { Button } from '@shared/ui/Button';
import { Card, CardDescription, CardHeader, CardTitle } from '@shared/ui/Card';
import { EmptyState } from '@shared/ui/EmptyState';
import { ErrorMessage } from '@shared/ui/ErrorMessage';
import { Icon } from '@shared/ui/Icon';
import { PageHeader } from '@shared/ui/PageHeader';
import { StatusIndicator, type StatusKind } from '@shared/ui/StatusIndicator';
import { StepEyebrow } from '@shared/ui/StepEyebrow';
import { ROUTES } from '@shared/constants/routes';
import { runtimeConfig } from '@shared/config/runtime';
import { useSessionStore } from '@shared/hooks/useSessionState';

import { ScanActionBar } from './components/ScanActionBar';
import { ScanDependencyCard } from './components/ScanDependencyCard';
import { ScanReact19CompatibilityCard } from './components/ScanReact19CompatibilityCard';
import { ScanReact19ContextCard } from './components/ScanReact19ContextCard';
import { ScanRecommendations } from './components/ScanRecommendations';
import { ScanRiskCard } from './components/ScanRiskCard';
import { ScanSourceAnalysisCard } from './components/ScanSourceAnalysisCard';
import { ScanSummaryCard } from './components/ScanSummaryCard';
import {
  selectCanGenerateMigrationPlan,
  selectScanReport,
  useProjectScannerStore,
} from './hooks/useProjectScanner';
import type { ScanStatus } from './types/scanner.types';

/**
 * Step 2 — Scanner + Readiness Report (Milestone 3).
 *
 * Owns the full scanner state machine for the workflow:
 *
 *   no project   → empty state with CTA back to selection
 *   project ok   → "Run scan" CTA (idle)
 *   scanning     → progress-style messaging
 *   completed    → readiness report (summary + risk + dependencies +
 *                  source analysis + recommendations)
 *   failed       → error message + retry action
 *
 * UX rules:
 *   - The "Continue to Migration Plan" affordance is visible at all times
 *     so the user knows where the flow is heading, but only enabled when a
 *     scan has completed successfully.
 *   - We never auto-navigate. The user always confirms with an explicit
 *     click. Trust > delight.
 */
export function ScannerScreen(): JSX.Element {
  const navigate = useNavigate();
  const project = useSessionStore((s) => s.project);

  const status = useProjectScannerStore((s) => s.status);
  const report = useProjectScannerStore(selectScanReport);
  const error = useProjectScannerStore((s) => s.error);
  const scan = useProjectScannerStore((s) => s.scan);
  const reset = useProjectScannerStore((s) => s.reset);
  const canGeneratePlan = useProjectScannerStore(selectCanGenerateMigrationPlan);

  const hasProject = project !== undefined;
  const canScan = hasProject && runtimeConfig.isTauri;
  const canContinue =
    status === 'completed' && report !== undefined && canGeneratePlan;

  const continueDisabledReason = !hasProject
    ? 'Select a project on the previous step before scanning.'
    : !runtimeConfig.isTauri
      ? 'The scanner requires the Migrate Pilot desktop shell.'
      : status === 'completed' && report !== undefined && !canGeneratePlan
        ? (report.react19ReadinessReport?.planGenerationExplanation ??
          'Plan generation is blocked until React 19 migration eligibility is resolved.')
        : undefined;

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        eyebrow={<StepEyebrow number={2} icon="scan" label="Scan" />}
        title="React 19 compatibility scan"
        subtitle="Deterministic, read-only analysis of the selected React 16/17/18 project. Produces a React 19 readiness report you can review before approving any migration step."
        meta={<HeaderMeta status={status} hasProject={hasProject} />}
        actions={
          <ScanActionBar
            status={status}
            canScan={canScan}
            canContinue={canContinue}
            {...(continueDisabledReason !== undefined
              ? { disabledReason: continueDisabledReason }
              : {})}
            onScan={() => void scan()}
            onReset={reset}
            onContinue={() => navigate(ROUTES.migrationPlan)}
          />
        }
      />

      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="mx-auto flex max-w-5xl flex-col gap-6">
          {!hasProject ? (
            <NoProjectState onGoBack={() => navigate(ROUTES.projectSelection)} />
          ) : !runtimeConfig.isTauri ? (
            <WebPreviewNotice />
          ) : status === 'idle' ? (
            <IdleState
              projectName={project.name}
              projectPath={project.path}
              onScan={() => void scan()}
            />
          ) : status === 'scanning' ? (
            <ScanningState projectName={project.name} />
          ) : status === 'failed' ? (
            <FailedState
              message={error?.message ?? 'Scan failed for an unknown reason.'}
              onRetry={() => void scan()}
            />
          ) : status === 'completed' && report !== undefined ? (
            <CompletedReport report={report} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* states                                                                     */
/* -------------------------------------------------------------------------- */

function NoProjectState({
  onGoBack,
}: {
  readonly onGoBack: () => void;
}): JSX.Element {
  return (
    <EmptyState
      icon="folder"
      fullWidth
      title="No project selected yet"
      description="Pick a local React 16/17/18 project on Step 1 to enable the React 19 compatibility scan. The scan never modifies the selected folder."
      action={
        <Button
          variant="secondary"
          size="md"
          leadingIcon={<Icon name="folder" />}
          onClick={onGoBack}
        >
          Go to project selection
        </Button>
      }
    />
  );
}

function WebPreviewNotice(): JSX.Element {
  return (
    <Card tone="subtle">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-warning/15 text-warning">
          <Icon name="help" className="h-3 w-3" />
        </span>
        <div>
          <p className="text-xs font-semibold text-ink">Scanner not available here</p>
          <p className="mt-1 text-xs leading-relaxed text-ink-muted">
            Migrate Pilot runs the scanner via the Tauri desktop shell. Run{' '}
            <code className="rounded-xs border border-canvas-border bg-canvas-subtle px-1 py-0.5 font-mono text-[11px] text-ink">
              npm run tauri:dev
            </code>{' '}
            inside <code className="font-mono text-[11px]">apps/desktop</code> to enable
            project scanning.
          </p>
        </div>
      </div>
    </Card>
  );
}

interface IdleStateProps {
  readonly projectName: string;
  readonly projectPath: string;
  readonly onScan: () => void;
}

function IdleState({
  projectName,
  projectPath,
  onScan,
}: IdleStateProps): JSX.Element {
  return (
    <>
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Ready to scan for React 19 readiness</CardTitle>
            <CardDescription>
              Project <span className="font-semibold text-ink">{projectName}</span> is
              selected. Run the deterministic React 19 compatibility scan to produce a
              readiness report.
            </CardDescription>
          </div>
          <Badge tone="success" variant="soft" withDot>
            Read-only safe
          </Badge>
        </CardHeader>
        <p className="break-all rounded-md border border-canvas-border bg-canvas-subtle px-3 py-2 font-mono text-xs text-ink-muted">
          {projectPath}
        </p>
        <div className="mt-4 flex flex-col items-start gap-3">
          <p className="text-xs leading-relaxed text-ink-muted">
            The React 19 compatibility scan walks the project tree (skipping
            node_modules, dist, build, coverage, .git, .next, out, target), reads
            package.json, and produces heuristic indicators for class components,
            deprecated lifecycle methods, and ReactDOM.render — all signals that
            inform the React 19 migration plan. No npm / git / build commands run.
          </p>
          <Button
            size="md"
            leadingIcon={<Icon name="scan" />}
            onClick={onScan}
          >
            Run React 19 compatibility scan
          </Button>
        </div>
      </Card>
      <ScanGuide />
    </>
  );
}

function ScanGuide(): JSX.Element {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card tone="subtle">
        <CardHeader>
          <div>
            <CardTitle>What the React 19 scan detects</CardTitle>
            <CardDescription>
              Deterministic signals — never AI-driven at this step.
            </CardDescription>
          </div>
        </CardHeader>
        <ul className="grid gap-2 text-xs text-ink-muted sm:grid-cols-2">
          <Bullet>React / React DOM versions (and source major)</Bullet>
          <Bullet>react-scripts version</Bullet>
          <Bullet>Package manager + lockfiles</Bullet>
          <Bullet>Deprecated / React-19-incompatible packages</Bullet>
          <Bullet>Routing / state / testing libs</Bullet>
          <Bullet>build / test / lint / typecheck scripts</Bullet>
          <Bullet>JS / JSX / TS / TSX file counts</Bullet>
          <Bullet>Deprecated lifecycle methods</Bullet>
          <Bullet>Class component indicators</Bullet>
          <Bullet>ReactDOM.render &amp; legacy context usage</Bullet>
        </ul>
      </Card>
      <Card tone="subtle">
        <CardHeader>
          <div>
            <CardTitle>What the scanner won't do</CardTitle>
            <CardDescription>
              Run later in the React 19 migration workflow with explicit user approval.
            </CardDescription>
          </div>
        </CardHeader>
        <ul className="space-y-2 text-xs text-ink-muted">
          <Lock>Run npm / yarn / pnpm install</Lock>
          <Lock>Run build / test / lint commands</Lock>
          <Lock>Run any AI / LLM call</Lock>
          <Lock>Modify package.json or any source file</Lock>
          <Lock>Generate the React 19 migration plan</Lock>
        </ul>
      </Card>
    </div>
  );
}

function ScanningState({
  projectName,
}: {
  readonly projectName: string;
}): JSX.Element {
  return (
    <>
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Running React 19 compatibility scan on {projectName}</CardTitle>
            <CardDescription>
              The deterministic walker is running. UI stays responsive — heavy IO is
              off the main thread.
            </CardDescription>
          </div>
          <StatusIndicator status="running" label="Scanning" variant="chip" />
        </CardHeader>
        <ul className="divide-y divide-canvas-border">
          <PhaseRow
            index={1}
            title="Resolve project root"
            hint="Canonicalise the path; verify it is a directory"
            status="success"
          />
          <PhaseRow
            index={2}
            title="Read package.json + lockfiles"
            hint="Capped at 1 MB; never written"
            status="running"
          />
          <PhaseRow
            index={3}
            title="Walk source tree"
            hint="Skips node_modules, dist, build, coverage, .git, .next, out, target"
            status="running"
          />
          <PhaseRow
            index={4}
            title="Risk + recommendation analysis"
            hint="Pure functions over scanner output — no AI yet"
            status="pending"
          />
        </ul>
      </Card>
      <EmptyState
        icon="scan"
        fullWidth
        title="React 19 compatibility scan in progress"
        description="This typically completes in a few seconds. Larger repositories are bounded by deterministic file-count and size limits to keep the UI responsive."
      />
    </>
  );
}

function FailedState({
  message,
  onRetry,
}: {
  readonly message: string;
  readonly onRetry: () => void;
}): JSX.Element {
  return (
    <>
      <ErrorMessage
        title="React 19 compatibility scan failed"
        message={message}
      />
      <Card tone="subtle">
        <CardHeader>
          <div>
            <CardTitle>Try again</CardTitle>
            <CardDescription>
              Failures are usually transient (path access changed, dialog cancelled,
              IPC dropped). Re-running is safe — the scanner does not modify the
              project.
            </CardDescription>
          </div>
        </CardHeader>
        <Button
          size="md"
          leadingIcon={<Icon name="scan" />}
          onClick={onRetry}
        >
          Retry React 19 scan
        </Button>
      </Card>
    </>
  );
}

function CompletedReport({
  report,
}: {
  readonly report: NonNullable<
    ReturnType<typeof useProjectScannerStore.getState>['report']
  >;
}): JSX.Element {
  return (
    <>
      <ScanSummaryCard report={report} />
      <ScanReact19ContextCard
        {...(report.react19MigrationContext !== undefined
          ? { context: report.react19MigrationContext }
          : {})}
        {...(report.react19SupportStatus !== undefined
          ? { status: report.react19SupportStatus }
          : {})}
      />
      {report.react19CompatibilityReport !== undefined ? (
        <ScanReact19CompatibilityCard
          report={report.react19CompatibilityReport}
        />
      ) : null}
      <ScanRiskCard risks={report.risks} />
      <ScanDependencyCard
        dependencies={report.dependencies}
        scripts={report.scripts}
      />
      <ScanSourceAnalysisCard source={report.sourceAnalysis} />
      <ScanRecommendations recommendations={report.recommendations} />
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* tiny presentational helpers                                                */
/* -------------------------------------------------------------------------- */

function HeaderMeta({
  status,
  hasProject,
}: {
  readonly status: ScanStatus;
  readonly hasProject: boolean;
}): JSX.Element {
  return (
    <>
      <Badge tone="success" variant="soft" withDot>
        Read-only safe
      </Badge>
      <Badge tone="neutral" variant="outline">
        Deterministic
      </Badge>
      <StatusIndicator
        variant="chip"
        status={STATUS_TO_KIND[status]}
        label={STATUS_LABEL[status]}
      />
      {!hasProject ? (
        <Badge tone="warning" variant="soft" withDot>
          No project selected
        </Badge>
      ) : null}
      {!runtimeConfig.isTauri ? (
        <Badge tone="warning" variant="soft" withDot>
          Web preview — scanner disabled
        </Badge>
      ) : null}
    </>
  );
}

const STATUS_TO_KIND: Record<ScanStatus, StatusKind> = {
  idle: 'idle',
  scanning: 'running',
  completed: 'success',
  failed: 'error',
};

const STATUS_LABEL: Record<ScanStatus, string> = {
  idle: 'Idle',
  scanning: 'Scanning for React 19 readiness',
  completed: 'React 19 scan complete',
  failed: 'React 19 scan failed',
};

interface PhaseRowProps {
  readonly index: number;
  readonly title: string;
  readonly hint: string;
  readonly status: StatusKind;
}

function PhaseRow({ index, title, hint, status }: PhaseRowProps): JSX.Element {
  return (
    <li className="flex items-center justify-between gap-4 py-3 first:pt-1 last:pb-1">
      <div className="flex items-center gap-3">
        <span className="flex h-6 w-6 items-center justify-center rounded-xs border border-canvas-border bg-canvas-subtle font-mono text-[10px] tabular-nums text-ink-subtle">
          {index}
        </span>
        <div>
          <p className="text-xs font-medium text-ink">{title}</p>
          <p className="text-2xs text-ink-subtle">{hint}</p>
        </div>
      </div>
      <StatusIndicator status={status} variant="chip" />
    </li>
  );
}

function Bullet({ children }: { readonly children: React.ReactNode }): JSX.Element {
  return (
    <li className="flex items-start gap-2">
      <Icon name="check" className="mt-0.5 h-3 w-3 shrink-0 text-success" />
      <span>{children}</span>
    </li>
  );
}

function Lock({ children }: { readonly children: React.ReactNode }): JSX.Element {
  return (
    <li className="flex items-start gap-2">
      <Icon name="lock" className="mt-0.5 h-3 w-3 shrink-0 text-ink-faint" />
      <span>{children}</span>
    </li>
  );
}
