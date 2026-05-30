import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { Badge } from '@shared/ui/Badge';
import { Button } from '@shared/ui/Button';
import {
  Card,
  CardDescription,
  CardHeader,
  CardSection,
  CardTitle,
} from '@shared/ui/Card';
import { EmptyState } from '@shared/ui/EmptyState';
import { ErrorMessage } from '@shared/ui/ErrorMessage';
import { Icon } from '@shared/ui/Icon';
import { PageHeader } from '@shared/ui/PageHeader';
import { StatusIndicator } from '@shared/ui/StatusIndicator';
import { StepEyebrow } from '@shared/ui/StepEyebrow';
import { ROUTES } from '@shared/constants/routes';

import type { React19SupportStatus } from '@features/react19-migration';
import {
  selectScanReport,
  selectScanStatus,
  useProjectScannerStore,
} from '@features/scanner';

import { MigrationPlanActionBar } from './components/MigrationPlanActionBar';
import { MigrationPlanEmptyState } from './components/MigrationPlanEmptyState';
import { MigrationPlanRecommendations } from './components/MigrationPlanRecommendations';
import { MigrationPlanRiskPanel } from './components/MigrationPlanRiskPanel';
import { MigrationPlanStepList } from './components/MigrationPlanStepList';
import { MigrationPlanSummaryCard } from './components/MigrationPlanSummaryCard';
import {
  PLAN_STATUS_KIND,
  PLAN_STATUS_LABEL,
} from './components/migrationPlanPresentation';
import {
  selectPlan,
  selectPlanError,
  selectPlanStatus,
  useMigrationPlanStore,
} from './hooks/useMigrationPlan';

/**
 * Step 4 — Migration Plan (Milestone 4).
 *
 * Owns the plan state machine for the workflow:
 *
 *   no scan report     → blocked empty state; CTA back to scanner
 *   scan ready, idle   → "Generate Migration Plan" CTA + scan summary card
 *   generating         → short loading state (no fake AI wording)
 *   generated (draft)  → summary + steps + risks + recommendations + approve CTA
 *   approved           → same view, locked + "Continue to Workspace" CTA
 *   failed             → error message + retry action
 *
 * UX rules:
 *   - Approval is explicit; the screen never auto-navigates after approval.
 *   - When the upstream ScanReport changes (or is reset), any existing plan
 *     is invalidated and the user is forced to re-generate.
 */
export function MigrationPlanScreen(): JSX.Element {
  const navigate = useNavigate();

  const scanStatus = useProjectScannerStore(selectScanStatus);
  const scanReport = useProjectScannerStore(selectScanReport);

  const planStatus = useMigrationPlanStore(selectPlanStatus);
  const plan = useMigrationPlanStore(selectPlan);
  const planError = useMigrationPlanStore(selectPlanError);
  const generatePlan = useMigrationPlanStore((s) => s.generatePlan);
  const approvePlan = useMigrationPlanStore((s) => s.approvePlan);
  const resetPlan = useMigrationPlanStore((s) => s.resetPlan);
  const clearPlanIfScanChanges = useMigrationPlanStore(
    (s) => s.clearPlanIfScanChanges,
  );

  const hasScanReport = scanStatus === 'completed' && scanReport !== undefined;
  const isApproved = planStatus === 'approved';
  const isDraft = planStatus === 'generated';

  // R2 step 2 — plan generation gate. The scanner now emits a structured
  // `react19SupportStatus.canGeneratePlan`; if it is `false`, the entire
  // plan-generation pathway must be refused. Pre-R2 reports do not carry
  // the field — those are treated as allowed for backwards compatibility.
  const supportStatus = scanReport?.react19SupportStatus;
  const isPlanGenerationGated =
    supportStatus !== undefined && supportStatus.canGeneratePlan === false;
  const gateReason = supportStatus?.message;

  // Invalidate the plan if the upstream ScanReport changes. This effect
  // is the single source of truth for the cross-store invariant: a plan is
  // only valid for the ScanReport id it was generated from.
  useEffect(() => {
    clearPlanIfScanChanges(scanReport?.id);
  }, [scanReport?.id, clearPlanIfScanChanges]);

  const canGenerate =
    hasScanReport && planStatus !== 'generating' && !isPlanGenerationGated;
  const canApprove = isDraft && plan !== undefined;
  const canContinue = isApproved;

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        eyebrow={<StepEyebrow number={4} icon="plan" label="Plan" />}
        title="React 19 migration plan"
        subtitle="Deterministic, rule-based React 19 migration plan generated from the compatibility scan. Review the steps below, then approve to unlock workspace creation."
        meta={
          <HeaderMeta
            planStatus={planStatus}
            hasScanReport={hasScanReport}
          />
        }
        actions={
          <MigrationPlanActionBar
            status={planStatus}
            canGenerate={canGenerate}
            canApprove={canApprove}
            canContinue={canContinue}
            {...(canGenerate
              ? {}
              : {
                  disabledGenerateReason: !hasScanReport
                    ? 'A completed scan report is required to generate a plan.'
                    : isPlanGenerationGated
                      ? (gateReason ??
                        'Plan generation is blocked because this project is not eligible for the React 19 migration pilot.')
                      : 'Plan generation is already in progress.',
                })}
            {...(canApprove
              ? {}
              : {
                  disabledApproveReason: !hasScanReport
                    ? 'Run the scanner first.'
                    : planStatus === 'idle'
                      ? 'Generate the plan before approving.'
                      : isApproved
                        ? 'Plan is already approved.'
                        : 'Plan must be generated and ready before approval.',
                })}
            {...(canContinue
              ? {}
              : {
                  disabledContinueReason:
                    'Approve the plan to unlock the workspace step.',
                })}
            onGenerate={() => {
              if (scanReport !== undefined) {
                void generatePlan(scanReport);
              }
            }}
            onApprove={approvePlan}
            onReset={resetPlan}
            onContinue={() => navigate(ROUTES.workspace)}
          />
        }
      />

      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="mx-auto flex max-w-5xl flex-col gap-6">
          {!hasScanReport ? (
            <MigrationPlanEmptyState
              onGoToScanner={() => navigate(ROUTES.scanner)}
            />
          ) : isPlanGenerationGated && supportStatus !== undefined ? (
            <BlockedByEligibilityState
              status={supportStatus}
              onGoToScanner={() => navigate(ROUTES.scanner)}
            />
          ) : planStatus === 'idle' ? (
            <IdleState
              projectName={scanReport.projectInfo.name}
              onGenerate={() => void generatePlan(scanReport)}
            />
          ) : planStatus === 'generating' ? (
            <GeneratingState />
          ) : planStatus === 'failed' ? (
            <FailedState
              message={planError?.message ?? 'Plan generation failed for an unknown reason.'}
              onRetry={() => void generatePlan(scanReport)}
            />
          ) : (planStatus === 'generated' || planStatus === 'approved') &&
            plan !== undefined ? (
            <GeneratedView
              isApproved={planStatus === 'approved'}
              plan={plan}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* states                                                                     */
/* -------------------------------------------------------------------------- */

interface IdleStateProps {
  readonly projectName: string;
  readonly onGenerate: () => void;
}

function IdleState({ projectName, onGenerate }: IdleStateProps): JSX.Element {
  return (
    <>
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Ready to generate the React 19 migration plan</CardTitle>
            <CardDescription>
              React 19 compatibility scan complete for{' '}
              <span className="font-semibold text-ink">{projectName}</span>. Generating
              the plan reads the scan report and emits a deterministic, rule-based
              React 19 migration plan tailored to this project.
            </CardDescription>
          </div>
          <Badge tone="success" variant="soft" withDot>
            Read-only — no AI, no installs
          </Badge>
        </CardHeader>

        <CardSection>
          <ul className="grid gap-2 text-xs text-ink-muted sm:grid-cols-2">
            <Bullet>Foundation-first, React-major-aware strategy.</Bullet>
            <Bullet>Each step has explicit risk, category, and rationale.</Bullet>
            <Bullet>Validation commands come from your package.json scripts.</Bullet>
            <Bullet>Approval is required before workspace creation.</Bullet>
          </ul>
        </CardSection>

        <div className="mt-4 flex flex-col items-start gap-3">
          <p className="text-xs leading-relaxed text-ink-muted">
            React 19 plan generation is local and deterministic. No AI provider is
            contacted, no file is modified, and no command is executed. This screen
            is the human checkpoint between analysis and any project mutation.
          </p>
          <Button
            size="md"
            leadingIcon={<Icon name="plan" />}
            onClick={onGenerate}
          >
            Generate React 19 migration plan
          </Button>
        </div>
      </Card>

      <PlanGuide />
    </>
  );
}

/**
 * Rendered when the scanner has completed but the project's React 19
 * support status forbids plan generation (missing package.json, no
 * package manager, unsupported React major, unparseable versions, etc.).
 *
 * The screen never tries to "soften" the block — the planner is a
 * one-way gate and we want the user to fix the underlying issue and
 * re-run the scan rather than chase a phantom plan.
 */
function BlockedByEligibilityState({
  status,
  onGoToScanner,
}: {
  readonly status: React19SupportStatus;
  readonly onGoToScanner: () => void;
}): JSX.Element {
  const tone =
    status.status === 'warning'
      ? 'warning'
      : status.status === 'unknown'
        ? 'neutral'
        : 'danger';
  const title =
    status.status === 'warning'
      ? 'React 19 migration is not required for this project'
      : status.status === 'unknown'
        ? 'React 19 migration eligibility could not be determined'
        : 'React 19 migration plan is blocked';
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{title}</CardTitle>
          <CardDescription>
            Plan generation is gated by the deterministic React 19
            eligibility check from the readiness report. Fix the
            underlying issue and re-run the scan to unlock the plan.
          </CardDescription>
        </div>
        <Badge tone={tone} variant="soft" withDot uppercase>
          {status.status === 'warning'
            ? 'Not required'
            : status.status === 'unknown'
              ? 'Needs review'
              : 'Blocked'}
        </Badge>
      </CardHeader>
      <CardSection>
        <p className="rounded-md border border-canvas-border bg-canvas-overlay px-3 py-2 text-xs leading-relaxed text-ink">
          {status.message}
        </p>
      </CardSection>
      <CardSection label="Detected">
        <ul className="grid gap-1 text-xs text-ink-muted sm:grid-cols-2">
          <DetectedRow
            label="react"
            value={status.sourceReactVersion ?? 'not detected'}
          />
          <DetectedRow
            label="react-dom"
            value={status.reactDomVersion ?? 'not detected'}
          />
          <DetectedRow
            label="React major"
            value={
              status.sourceReactMajor !== undefined
                ? `React ${status.sourceReactMajor}`
                : '—'
            }
          />
          <DetectedRow
            label="Package manager"
            value={status.packageManager ?? 'not detected'}
          />
        </ul>
      </CardSection>
      <div className="mt-4 flex items-center gap-2">
        <Button
          variant="secondary"
          size="md"
          leadingIcon={<Icon name="scan" />}
          onClick={onGoToScanner}
        >
          Back to scanner
        </Button>
        <span className="text-2xs text-ink-subtle">
          Plan generation stays disabled until {`canGeneratePlan`} is true.
        </span>
      </div>
    </Card>
  );
}

function DetectedRow({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}): JSX.Element {
  return (
    <li className="flex items-center justify-between gap-3 rounded-md border border-canvas-border bg-canvas-subtle px-3 py-1.5">
      <span className="text-2xs uppercase tracking-[0.14em] text-ink-subtle">
        {label}
      </span>
      <span className="truncate font-mono text-xs text-ink">{value}</span>
    </li>
  );
}

function PlanGuide(): JSX.Element {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card tone="subtle">
        <CardHeader>
          <div>
            <CardTitle>What the React 19 planner produces</CardTitle>
            <CardDescription>
              Deterministic rules — no AI involved at this step.
            </CardDescription>
          </div>
        </CardHeader>
        <ul className="grid gap-2 text-xs text-ink-muted sm:grid-cols-2">
          <Bullet>Workspace setup step (always first).</Bullet>
          <Bullet>Preflight + tooling phase steps.</Bullet>
          <Bullet>React 18 bridge (React 16/17 sources only).</Bullet>
          <Bullet>React 19 API-compatibility fixes.</Bullet>
          <Bullet>JSX transform / TypeScript alignment.</Bullet>
          <Bullet>React 19 upgrade (react, react-dom, types).</Bullet>
          <Bullet>Source modernization (where safe).</Bullet>
          <Bullet>Final validation + React 19 summary report.</Bullet>
        </ul>
      </Card>
      <Card tone="subtle">
        <CardHeader>
          <div>
            <CardTitle>What this step won't do</CardTitle>
            <CardDescription>
              Out of scope for Milestone 4 — React 19 planning only.
            </CardDescription>
          </div>
        </CardHeader>
        <ul className="space-y-2 text-xs text-ink-muted">
          <Lock>Create the migration workspace.</Lock>
          <Lock>Create Git branches or worktrees.</Lock>
          <Lock>Run npm / yarn / pnpm / bun commands.</Lock>
          <Lock>Call any AI provider.</Lock>
          <Lock>Modify the selected project in any way.</Lock>
        </ul>
      </Card>
    </div>
  );
}

function GeneratingState(): JSX.Element {
  return (
    <>
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Generating React 19 migration plan</CardTitle>
            <CardDescription>
              Running the deterministic rule engine over the React 19 compatibility
              scan. This step never contacts an AI provider and never touches the
              filesystem.
            </CardDescription>
          </div>
          <StatusIndicator status="running" label="Generating" variant="chip" />
        </CardHeader>
        <ul className="divide-y divide-canvas-border">
          <PhaseRow
            index={1}
            title="Resolve project context"
            hint="Read scan report, derive complexity + risk"
            status="success"
          />
          <PhaseRow
            index={2}
            title="Apply foundation-first rules"
            hint="Workspace, dependencies, TypeScript foundation"
            status="running"
          />
          <PhaseRow
            index={3}
            title="Apply conversion + modernisation rules"
            hint="Utilities, components, lifecycle, ReactDOM.render"
            status="running"
          />
          <PhaseRow
            index={4}
            title="Attach validation + final report"
            hint="Compose plan summary, risk, recommendations"
            status="pending"
          />
        </ul>
      </Card>
      <EmptyState
        icon="plan"
        fullWidth
        title="Generating React 19 migration plan"
        description="This typically completes in well under a second. The generator is pure JavaScript over the in-memory React 19 compatibility scan report."
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
      <ErrorMessage title="React 19 plan generation failed" message={message} />
      <Card tone="subtle">
        <CardHeader>
          <div>
            <CardTitle>Try again</CardTitle>
            <CardDescription>
              The generator is deterministic and idempotent — re-running it is
              always safe and never modifies the project.
            </CardDescription>
          </div>
        </CardHeader>
        <Button size="md" leadingIcon={<Icon name="plan" />} onClick={onRetry}>
          Retry React 19 plan generation
        </Button>
      </Card>
    </>
  );
}

function GeneratedView({
  isApproved,
  plan,
}: {
  readonly isApproved: boolean;
  readonly plan: NonNullable<
    ReturnType<typeof useMigrationPlanStore.getState>['plan']
  >;
}): JSX.Element {
  return (
    <>
      {isApproved ? <ApprovedBanner /> : null}
      <MigrationPlanSummaryCard plan={plan} />
      <MigrationPlanRiskPanel plan={plan} />
      <MigrationPlanStepList steps={plan.steps} locked={isApproved} />
      <MigrationPlanRecommendations plan={plan} />
    </>
  );
}

function ApprovedBanner(): JSX.Element {
  return (
    <div className="flex items-start gap-3 rounded-md border border-success/40 bg-success-soft px-4 py-3">
      <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success/20 text-success">
        <Icon name="check" className="h-3 w-3" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-success">React 19 migration plan approved</p>
        <p className="mt-1 text-xs leading-relaxed text-ink-muted">
          Editing actions are locked. The workspace step is now unlocked in the
          workflow sidebar — continue when you are ready. The original project
          is still untouched.
        </p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* header meta + tiny helpers                                                 */
/* -------------------------------------------------------------------------- */

function HeaderMeta({
  planStatus,
  hasScanReport,
}: {
  readonly planStatus: ReturnType<typeof useMigrationPlanStore.getState>['status'];
  readonly hasScanReport: boolean;
}): JSX.Element {
  return (
    <>
      <Badge tone="success" variant="soft" withDot>
        Deterministic
      </Badge>
      <Badge tone="neutral" variant="outline">
        Rule-based
      </Badge>
      <StatusIndicator
        variant="chip"
        status={PLAN_STATUS_KIND[planStatus]}
        label={PLAN_STATUS_LABEL[planStatus]}
      />
      {!hasScanReport ? (
        <Badge tone="warning" variant="soft" withDot>
          Scan required
        </Badge>
      ) : null}
    </>
  );
}

interface PhaseRowProps {
  readonly index: number;
  readonly title: string;
  readonly hint: string;
  readonly status: 'idle' | 'pending' | 'running' | 'success' | 'warning' | 'error';
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
