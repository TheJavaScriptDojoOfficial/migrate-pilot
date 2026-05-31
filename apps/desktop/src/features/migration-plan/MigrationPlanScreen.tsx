import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { Badge, type BadgeTone } from '@shared/ui/Badge';
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

import {
  REACT_19_CANONICAL_PHASE_ORDER,
  getReactMigrationPhaseDescription,
  getReactMigrationPhaseLabel,
  resolveReact19PlanGenerationGate,
  type ReactMigrationPhase,
} from '@features/react19-migration';
import {
  selectScanReport,
  selectScanStatus,
  useProjectScannerStore,
  type ScanReport,
} from '@features/scanner';

import { MigrationPlanActionBar } from './components/MigrationPlanActionBar';
import { MigrationPlanStepCard } from './components/MigrationPlanStepCard';
import {
  CAPABILITY_LABEL,
  CAPABILITY_TONE,
  EXECUTION_TYPE_LABEL,
  PLAN_QUALITY_STATUS_LABEL,
  PLAN_QUALITY_STATUS_TONE,
  PLAN_STATUS_KIND,
  PLAN_STATUS_LABEL,
} from './components/migrationPlanPresentation';
import {
  compareMigrationPlanStepsByCanonicalOrder,
  isExecutableMigrationPlanStep,
  type MigrationPlanStepV2,
  type MigrationPlanStepV2Capability,
  type PlanQualityStatus,
} from './types/migrationPlan.types';
import { resolvePlanQualityStatus } from './services/migrationPlanQualityService';
import {
  resolvePlanApprovalGate,
  type PlanApprovalGate,
} from './services/migrationPlanApprovalService';
import {
  selectPlan,
  selectPlanError,
  selectPlanStatus,
  useMigrationPlanStore,
} from './hooks/useMigrationPlan';

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
  const planGate =
    scanReport !== undefined
      ? resolveReact19PlanGenerationGate(scanReport)
      : undefined;
  const gateBlocked = planGate !== undefined && !planGate.canGeneratePlan;

  useEffect(() => {
    clearPlanIfScanChanges(scanReport?.id);
  }, [scanReport?.id, clearPlanIfScanChanges]);

  const executableSteps =
    plan?.steps.filter((step) => isExecutableMigrationPlanStep(step)) ?? [];

  // R5 Step 16 — Approval Rules. Centralised in
  // `resolvePlanApprovalGate` so the action bar copy, the disabled
  // state, and the store's defensive guard all share the same rules.
  const approvalGate: PlanApprovalGate = resolvePlanApprovalGate({
    plan,
    planStatus,
    planGenerationGate: planGate ?? {
      canGeneratePlan: false,
      reasons: ['A completed React 19 compatibility scan is required.'],
    },
  });
  const canApprove = approvalGate.canApprove;
  const canContinue = planStatus === 'approved';
  const canGenerate = hasScanReport && planStatus !== 'generating' && !gateBlocked;

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        eyebrow={<StepEyebrow number={4} icon="plan" label="Plan" />}
        title="React 19 migration plan"
        subtitle="Generate a deterministic React 19 migration plan from scan context, risk engine phases, and validation capabilities. Review and approve to continue to workspace setup."
        meta={
          <>
            <Badge tone="success" variant="soft" withDot>
              React 19 specific
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
                    ? 'A completed scan report is required.'
                    : gateBlocked
                      ? (planGate?.reasons[0] ?? planGate?.explanation)
                      : 'Generation is already in progress.',
                })}
            {...(canApprove
              ? {}
              : {
                  disabledApproveReason: !hasScanReport
                    ? 'Run scan first.'
                    : (approvalGate.reasons[0]?.message ??
                      'Plan must be ready before approval.'),
                })}
            {...(canContinue
              ? {}
              : {
                  disabledContinueReason:
                    'Approve the plan to continue to Step 05 Workspace.',
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
        <div className="mx-auto flex max-w-6xl flex-col gap-6">
          {!hasScanReport ? (
            <EmptyState
              icon="plan"
              fullWidth
              title="Run a project scan before generating a React 19 migration plan."
              description="Step 04 relies on the completed scan report, React 19 migration context, and risk engine output."
              action={
                <Button
                  variant="secondary"
                  size="md"
                  leadingIcon={<Icon name="scan" />}
                  onClick={() => navigate(ROUTES.scanner)}
                >
                  Go to scanner
                </Button>
              }
            />
          ) : gateBlocked && planGate !== undefined ? (
            <BlockedGateState
              planGate={planGate}
              scanReport={scanReport}
              onGoToScanner={() => navigate(ROUTES.scanner)}
            />
          ) : planStatus === 'idle' ? (
            <IdlePlanState
              projectName={scanReport.projectInfo.name}
              onGenerate={() => void generatePlan(scanReport)}
            />
          ) : planStatus === 'generating' ? (
            <GeneratingPlanState />
          ) : planStatus === 'error' ? (
            <ErrorMessage
              title="React 19 plan generation failed"
              message={planError?.message ?? 'Unknown planner error.'}
            />
          ) : plan !== undefined ? (
            <>
              <PlanHeaderCard
                plan={plan}
                planStatus={planStatus}
                executableStepCount={executableSteps.length}
              />
              <WorkspacePrerequisiteCallout />
              <PlanQualityCard
                plan={plan}
                planStatus={planStatus}
                executableStepCount={executableSteps.length}
              />
              <ApprovalGateCard
                approvalGate={approvalGate}
                planStatus={planStatus}
              />
              <PlanSummaryCard plan={plan} />
              <PhaseBreakdownCard plan={plan} />
              <PhaseGroupedStepsCard plan={plan} planStatus={planStatus} />
              <SkippedPhasesCard plan={plan} />
              <BlockedReasonsCard plan={plan} />
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function IdlePlanState({
  projectName,
  onGenerate,
}: {
  readonly projectName: string;
  readonly onGenerate: () => void;
}): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Generate React 19 migration plan V2</CardTitle>
          <CardDescription>
            Scan completed for <span className="font-semibold text-ink">{projectName}</span>. Generate a track-aware React 19 plan using migration context + risk engine phases + validation capabilities.
          </CardDescription>
        </div>
        <Badge tone="success" variant="soft" withDot>
          Deterministic
        </Badge>
      </CardHeader>
      <CardSection>
        <ul className="grid gap-2 text-xs text-ink-muted sm:grid-cols-2">
          <li>Includes source major, track, phase strategy, and validation strategy.</li>
          <li>Uses `react19RiskEngine.items/byPhase/summary` for step generation.</li>
          <li>React 16/17 includes bridge; React 18 bridge is skipped with reason.</li>
          <li>No workspace-creation executable step in this plan.</li>
        </ul>
      </CardSection>
      <Button size="md" leadingIcon={<Icon name="plan" />} onClick={onGenerate}>
        Generate React 19 migration plan
      </Button>
    </Card>
  );
}

function GeneratingPlanState(): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Generating React 19 plan</CardTitle>
          <CardDescription>
            Building phase-ordered steps from migration context and risk engine output.
          </CardDescription>
        </div>
        <StatusIndicator status="running" label="Generating" variant="chip" />
      </CardHeader>
    </Card>
  );
}

function BlockedGateState({
  planGate,
  scanReport,
  onGoToScanner,
}: {
  readonly planGate: ReturnType<typeof resolveReact19PlanGenerationGate>;
  readonly scanReport: ScanReport;
  readonly onGoToScanner: () => void;
}): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>React 19 plan generation is blocked</CardTitle>
          <CardDescription>
            The shared React 19 eligibility gate rejected this scan report. No fallback generic modernization plan is generated.
          </CardDescription>
        </div>
        <Badge tone="danger" variant="soft" withDot uppercase>
          Blocked
        </Badge>
      </CardHeader>
      <CardSection>
        <ul className="space-y-2">
          {planGate.reasons.map((reason) => (
            <li
              key={reason}
              className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-xs text-danger"
            >
              {reason}
            </li>
          ))}
        </ul>
      </CardSection>
      <CardSection label="Detected context">
        <ul className="grid gap-2 text-xs text-ink-muted sm:grid-cols-2">
          <li>react: {scanReport.dependencies.reactVersion ?? 'not detected'}</li>
          <li>react-dom: {scanReport.dependencies.reactDomVersion ?? 'not detected'}</li>
          <li>major: {scanReport.dependencies.reactMajor ?? 'unknown'}</li>
          <li>package manager: {scanReport.dependencies.packageManager}</li>
        </ul>
      </CardSection>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="md"
          leadingIcon={<Icon name="scan" />}
          onClick={onGoToScanner}
        >
          Back to scanner
        </Button>
      </div>
    </Card>
  );
}

function PlanHeaderCard({
  plan,
  planStatus,
  executableStepCount,
}: {
  readonly plan: NonNullable<ReturnType<typeof useMigrationPlanStore.getState>['plan']>;
  readonly planStatus: ReturnType<typeof useMigrationPlanStore.getState>['status'];
  readonly executableStepCount: number;
}): JSX.Element {
  const statusTone: BadgeTone =
    planStatus === 'approved'
      ? 'success'
      : planStatus === 'blocked'
        ? 'danger'
        : 'info';

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>React 19 Migration Plan</CardTitle>
          <CardDescription>{plan.summaryText}</CardDescription>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge tone={statusTone} variant="soft" withDot uppercase>
            {planStatus}
          </Badge>
          <Badge tone="neutral" variant="outline">
            Source {plan.sourceReactVersion}
          </Badge>
          <Badge tone="neutral" variant="outline">
            Target {plan.targetReactVersion}
          </Badge>
          <Badge tone="accent" variant="soft">
            {plan.track}
          </Badge>
        </div>
      </CardHeader>
      <CardSection>
        <div className="grid gap-3 text-xs sm:grid-cols-3">
          <Stat label="Strategy" value="React 19 foundation-first" />
          <Stat label="Total steps" value={`${plan.steps.length}`} />
          <Stat label="Executable steps" value={`${executableStepCount}`} />
          <Stat label="Highest risk" value={plan.highestRisk} />
          <Stat label="Source major" value={`${plan.sourceMajor}`} />
          <Stat label="Plan status" value={plan.canExecute ? 'ready' : 'blocked'} />
        </div>
      </CardSection>
    </Card>
  );
}

function PlanSummaryCard({
  plan,
}: {
  readonly plan: NonNullable<ReturnType<typeof useMigrationPlanStore.getState>['plan']>;
}): JSX.Element {
  const bridgeSkip = plan.skippedPhases.find((phase) => phase.phase === 'react-18-bridge');
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Plan summary</CardTitle>
          <CardDescription>
            Why this plan exists, what data generated it, and how validation gates are attached.
          </CardDescription>
        </div>
      </CardHeader>
      <CardSection>
        <ul className="space-y-2 text-xs text-ink-muted">
          <li>
            Generated from `scanReport.react19MigrationContext` + `react19RiskEngine.items/byPhase/summary`.
          </li>
          <li>
            Bridge handling:{' '}
            {bridgeSkip === undefined
              ? 'React 18 bridge is required before full React 19 upgrade.'
              : bridgeSkip.reason}
          </li>
          <li>
            Validation strategy: baseline ({plan.validationStrategy.baselineCommands.length}),
            per-step ({plan.validationStrategy.perStepCommands.length}), final ({plan.validationStrategy.finalCommands.length}).
          </li>
          <li>
            Missing validation commands: {plan.validationStrategy.missingCommands.join(', ') || 'none'}.
          </li>
        </ul>
      </CardSection>
    </Card>
  );
}

/**
 * Plan quality card (R5 Step 13 + Step 14).
 *
 * Renders the V2 `PlanQualityStatus` summary at the top of the plan
 * detail view so reviewers can answer four questions instantly:
 *   1. Is the plan good / needs-review / blocked overall?
 *   2. What does the step capability mix look like?
 *   3. Which contract holes (missing executor key, missing validation
 *      commands, manual fallbacks) are still open?
 *   4. Which run gates (approval, workspace, post-run validation)
 *      will fire during execution?
 *
 * The single source of truth for the verdict is
 * {@link resolvePlanQualityStatus} — this card never re-implements the
 * status rules.
 */
function PlanQualityCard({
  plan,
  planStatus,
  executableStepCount,
}: {
  readonly plan: NonNullable<ReturnType<typeof useMigrationPlanStore.getState>['plan']>;
  readonly planStatus: ReturnType<typeof useMigrationPlanStore.getState>['status'];
  readonly executableStepCount: number;
}): JSX.Element {
  const capabilityCounts = countCapabilities(plan.steps);
  const quality = resolvePlanQualityStatus(plan, planStatus);
  const approvalGateCount = plan.steps.filter(
    (step) => step.requiresApprovalBeforeRun,
  ).length;
  const workspaceRequiredCount = plan.steps.filter(
    (step) => step.requiresWorkspace,
  ).length;
  const validationAfterRunCount = plan.steps.filter(
    (step) => step.requiresValidationAfterRun,
  ).length;

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Plan quality</CardTitle>
          <CardDescription>
            What the executor can actually run today, where human review is
            required, and which contract holes the planner still has open.
          </CardDescription>
        </div>
        <Badge
          tone={PLAN_QUALITY_STATUS_TONE[quality.status]}
          variant="soft"
          withDot
          uppercase
        >
          {PLAN_QUALITY_STATUS_LABEL[quality.status]}
        </Badge>
      </CardHeader>

      <CardSection label="Plan quality summary">
        <div className="grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-3">
          <Stat
            label="Executable steps"
            value={`${quality.executableSteps} / ${plan.steps.length}`}
          />
          <Stat label="Manual steps" value={`${quality.manualSteps}`} />
          <Stat label="Unsupported steps" value={`${quality.unsupportedSteps}`} />
          <Stat label="Blocked steps" value={`${quality.blockedSteps}`} />
          <Stat
            label="Missing executor keys"
            value={`${quality.missingExecutorKeys}`}
          />
          <Stat
            label="Missing validation cmds"
            value={`${quality.missingValidationCommands}`}
          />
        </div>
      </CardSection>

      {quality.notes.length > 0 ? (
        <CardSection label="Notes">
          <PlanQualityNotes quality={quality} />
        </CardSection>
      ) : null}

      <CardSection label="Step capability mix">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              'available',
              'not-yet-supported',
              'manual-only',
              'blocked',
            ] as const
          ).map((capability) => (
            <CapabilityTile
              key={capability}
              capability={capability}
              count={capabilityCounts[capability]}
            />
          ))}
        </div>
      </CardSection>

      <CardSection label="Run requirements">
        <div className="grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Executable now"
            value={`${executableStepCount} / ${plan.steps.length}`}
          />
          <Stat
            label="Approval gates"
            value={`${approvalGateCount} / ${plan.steps.length}`}
          />
          <Stat
            label="Workspace required"
            value={`${workspaceRequiredCount} / ${plan.steps.length}`}
          />
          <Stat
            label="Validation-after-run"
            value={`${validationAfterRunCount} / ${plan.steps.length}`}
          />
        </div>
      </CardSection>
    </Card>
  );
}

/**
 * Render the contract-defined `notes[]` from `PlanQualityStatus`.
 *
 * Notes are already deduplicated and prioritised by
 * {@link resolvePlanQualityStatus}; this component is purely
 * presentational so the rules stay testable as a pure function.
 */
function PlanQualityNotes({
  quality,
}: {
  readonly quality: PlanQualityStatus;
}): JSX.Element {
  const tone: BadgeTone = PLAN_QUALITY_STATUS_TONE[quality.status];
  return (
    <ul className="space-y-1.5">
      {quality.notes.map((note) => (
        <li
          key={note}
          className="flex items-start gap-2 rounded-xs border border-canvas-border bg-canvas-subtle-2/40 px-2.5 py-1.5 text-xs leading-relaxed text-ink-muted"
        >
          <Badge tone={tone} variant="soft" uppercase>
            {PLAN_QUALITY_STATUS_LABEL[quality.status]}
          </Badge>
          <span className="mt-px">{note}</span>
        </li>
      ))}
    </ul>
  );
}

interface CapabilityCounts {
  readonly available: number;
  readonly 'not-yet-supported': number;
  readonly 'manual-only': number;
  readonly blocked: number;
}

function countCapabilities(
  steps: readonly MigrationPlanStepV2[],
): CapabilityCounts {
  const counts: Record<MigrationPlanStepV2Capability, number> = {
    available: 0,
    'not-yet-supported': 0,
    'manual-only': 0,
    blocked: 0,
  };
  for (const step of steps) {
    counts[step.capability] += 1;
  }
  return counts;
}

function CapabilityTile({
  capability,
  count,
}: {
  readonly capability: MigrationPlanStepV2Capability;
  readonly count: number;
}): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-canvas-border bg-canvas-subtle-2/40 px-3 py-2">
      <div>
        <p className="text-2xs uppercase tracking-[0.12em] text-ink-subtle">
          {CAPABILITY_LABEL[capability]}
        </p>
        <p className="mt-1 font-mono text-sm font-semibold tabular-nums text-ink">
          {count}
        </p>
      </div>
      <Badge tone={CAPABILITY_TONE[capability]} variant="soft" withDot uppercase>
        {capability}
      </Badge>
    </div>
  );
}

/**
 * Enhanced phase breakdown (R5 Step 13).
 *
 * Each phase tile now exposes the V2 contract fields the user cares
 * about per phase: step count, highest risk, capability mix, approval
 * gate count, and the validation commands the planner attached.
 */
function PhaseBreakdownCard({
  plan,
}: {
  readonly plan: NonNullable<ReturnType<typeof useMigrationPlanStore.getState>['plan']>;
}): JSX.Element {
  const phaseData = buildPhaseData(plan);
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Phase breakdown</CardTitle>
          <CardDescription>
            Planner V2 groups steps by the canonical React 19 phase order.
            Empty phases are surfaced too so you can see which parts of the
            migration the planner decided to skip.
          </CardDescription>
        </div>
      </CardHeader>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {phaseData.map((data) => (
          <PhaseBreakdownTile key={data.phase} data={data} />
        ))}
      </div>
    </Card>
  );
}

interface PhaseData {
  readonly phase: ReactMigrationPhase;
  readonly canonicalOrder: number;
  readonly totalSteps: number;
  readonly highestRisk: MigrationPlanStepV2['risk'];
  readonly executionTypes: readonly MigrationPlanStepV2['executionType'][];
  readonly capabilityCounts: CapabilityCounts;
  readonly approvalGateCount: number;
  readonly validationCommands: readonly string[];
}

function buildPhaseData(
  plan: NonNullable<ReturnType<typeof useMigrationPlanStore.getState>['plan']>,
): readonly PhaseData[] {
  return REACT_19_CANONICAL_PHASE_ORDER.map((phase, index) => {
    const phaseSteps = plan.steps.filter((step) => step.phase === phase);
    const phaseSummary = plan.phaseSummary[phase];
    const validationCommands = Array.from(
      new Set(phaseSteps.flatMap((step) => step.validationCommands)),
    );
    return {
      phase,
      canonicalOrder: index,
      totalSteps: phaseSummary.totalSteps,
      highestRisk: phaseSummary.highestRisk,
      executionTypes: phaseSummary.executionTypes,
      capabilityCounts: countCapabilities(phaseSteps),
      approvalGateCount: phaseSteps.filter(
        (step) => step.requiresApprovalBeforeRun,
      ).length,
      validationCommands,
    };
  });
}

function PhaseBreakdownTile({ data }: { readonly data: PhaseData }): JSX.Element {
  const status =
    data.totalSteps === 0
      ? 'skipped'
      : data.capabilityCounts.blocked > 0
        ? 'blocked'
        : data.highestRisk === 'high'
          ? 'attention'
          : 'ready';
  const statusTone: BadgeTone =
    status === 'blocked'
      ? 'danger'
      : status === 'attention'
        ? 'warning'
        : status === 'ready'
          ? 'success'
          : 'neutral';

  return (
    <div className="flex flex-col gap-2 rounded-md border border-canvas-border bg-canvas-subtle-2/40 px-3 py-2">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-mono text-2xs uppercase tracking-[0.12em] text-ink-subtle">
            #{String(data.canonicalOrder + 1).padStart(2, '0')}
          </p>
          <p className="text-xs font-semibold text-ink">
            {getReactMigrationPhaseLabel(data.phase)}
          </p>
        </div>
        <Badge tone={statusTone} variant="soft" uppercase>
          {status}
        </Badge>
      </div>

      <p className="text-2xs leading-relaxed text-ink-subtle">
        {getReactMigrationPhaseDescription(data.phase)}
      </p>

      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone="neutral" variant="outline" className="font-mono">
          {data.totalSteps} step{data.totalSteps === 1 ? '' : 's'}
        </Badge>
        {data.totalSteps > 0 ? (
          <>
            <Badge tone={riskTone(data.highestRisk)} variant="soft" withDot uppercase>
              {data.highestRisk} risk
            </Badge>
            {data.approvalGateCount > 0 ? (
              <Badge tone="accent" variant="soft" uppercase>
                {data.approvalGateCount} approval{data.approvalGateCount === 1 ? '' : 's'}
              </Badge>
            ) : null}
          </>
        ) : null}
      </div>

      {data.totalSteps > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {data.executionTypes.map((executionType) => (
            <Badge
              key={executionType}
              tone="neutral"
              variant="outline"
              className="font-mono"
            >
              {EXECUTION_TYPE_LABEL[executionType]}
            </Badge>
          ))}
        </div>
      ) : null}

      {data.totalSteps > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              'available',
              'not-yet-supported',
              'manual-only',
              'blocked',
            ] as const
          )
            .filter((capability) => data.capabilityCounts[capability] > 0)
            .map((capability) => (
              <Badge
                key={capability}
                tone={CAPABILITY_TONE[capability]}
                variant="soft"
                uppercase
              >
                {data.capabilityCounts[capability]} {CAPABILITY_LABEL[capability].toLowerCase()}
              </Badge>
            ))}
        </div>
      ) : null}

      {data.validationCommands.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="text-2xs uppercase tracking-[0.12em] text-ink-subtle">
            Validation
          </p>
          {data.validationCommands.map((command) => (
            <Badge
              key={`phase-validation:${data.phase}:${command}`}
              tone="info"
              variant="soft"
              className="font-mono"
            >
              {command}
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Phase-grouped step list (R5 Step 13).
 *
 * Steps are bucketed by canonical phase so the user can review one
 * phase at a time. Each step row is rendered by
 * {@link MigrationPlanStepCard}, which owns the dense V2 contract
 * presentation (capability, execution type, blocked reason, executor,
 * commands, requirements, rollback, …).
 */
function PhaseGroupedStepsCard({
  plan,
  planStatus,
}: {
  readonly plan: NonNullable<ReturnType<typeof useMigrationPlanStore.getState>['plan']>;
  readonly planStatus: ReturnType<typeof useMigrationPlanStore.getState>['status'];
}): JSX.Element {
  const grouped = groupStepsByPhase(plan.steps);
  const locked = planStatus === 'approved';
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Plan steps</CardTitle>
          <CardDescription>
            Ordered by canonical phase. Expand "Execution details" on any
            step to see executor key, commands, expected changed files,
            issue codes, run requirements, and rollback strategy.
          </CardDescription>
        </div>
        <Badge tone="info" variant="outline">
          {plan.steps.length} step{plan.steps.length === 1 ? '' : 's'}
        </Badge>
      </CardHeader>

      {plan.steps.length === 0 ? (
        <p className="text-xs text-ink-muted">No steps were generated.</p>
      ) : (
        <div className="space-y-5">
          {grouped.map(({ phase, steps }) => (
            <PhaseStepGroup
              key={phase}
              phase={phase}
              steps={steps}
              locked={locked}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

interface PhaseStepGroupEntry {
  readonly phase: ReactMigrationPhase;
  readonly steps: readonly MigrationPlanStepV2[];
}

function groupStepsByPhase(
  steps: readonly MigrationPlanStepV2[],
): readonly PhaseStepGroupEntry[] {
  const sorted = [...steps].sort(compareMigrationPlanStepsByCanonicalOrder);
  return REACT_19_CANONICAL_PHASE_ORDER.map((phase) => ({
    phase,
    steps: sorted.filter((step) => step.phase === phase),
  })).filter((entry) => entry.steps.length > 0);
}

function PhaseStepGroup({
  phase,
  steps,
  locked,
}: {
  readonly phase: ReactMigrationPhase;
  readonly steps: readonly MigrationPlanStepV2[];
  readonly locked: boolean;
}): JSX.Element {
  const capabilityCounts = countCapabilities(steps);
  return (
    <section>
      <header className="mb-2 flex flex-wrap items-center gap-2 border-b border-canvas-border pb-1.5">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink">
          {getReactMigrationPhaseLabel(phase)}
        </p>
        <Badge tone="neutral" variant="outline" className="font-mono">
          {steps.length} step{steps.length === 1 ? '' : 's'}
        </Badge>
        {(
          [
            'available',
            'not-yet-supported',
            'manual-only',
            'blocked',
          ] as const
        )
          .filter((capability) => capabilityCounts[capability] > 0)
          .map((capability) => (
            <Badge
              key={`phase-group-cap:${phase}:${capability}`}
              tone={CAPABILITY_TONE[capability]}
              variant="soft"
              uppercase
            >
              {capabilityCounts[capability]} {CAPABILITY_LABEL[capability].toLowerCase()}
            </Badge>
          ))}
      </header>
      <ol className="space-y-3">
        {steps.map((step) => (
          <MigrationPlanStepCard
            key={step.id}
            step={step}
            {...(locked ? { locked: true } : {})}
          />
        ))}
      </ol>
    </section>
  );
}

function SkippedPhasesCard({
  plan,
}: {
  readonly plan: NonNullable<ReturnType<typeof useMigrationPlanStore.getState>['plan']>;
}): JSX.Element | null {
  if (plan.skippedPhases.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Skipped phases</CardTitle>
          <CardDescription>Planner V2 records non-required phases with explicit reasons.</CardDescription>
        </div>
      </CardHeader>
      <ul className="space-y-2">
        {plan.skippedPhases.map((phase) => (
          <li
            key={`${phase.phase}:${phase.reason}`}
            className="rounded-md border border-canvas-border bg-canvas-subtle-2/40 px-3 py-2 text-xs text-ink-muted"
          >
            <span className="font-semibold text-ink">
              {getReactMigrationPhaseLabel(phase.phase)}
            </span>{' '}
            skipped — {phase.reason}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function BlockedReasonsCard({
  plan,
}: {
  readonly plan: NonNullable<ReturnType<typeof useMigrationPlanStore.getState>['plan']>;
}): JSX.Element | null {
  if (plan.blockedReasons.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Blocked reasons</CardTitle>
          <CardDescription>
            Plan approval and execution remain disabled until these blockers are resolved.
          </CardDescription>
        </div>
      </CardHeader>
      <ul className="space-y-2">
        {plan.blockedReasons.map((reason) => (
          <li
            key={reason}
            className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-xs text-danger"
          >
            {reason}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Stat({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}): JSX.Element {
  return (
    <div className="rounded-md border border-canvas-border bg-canvas-subtle-2/40 px-3 py-2">
      <p className="text-2xs uppercase tracking-[0.12em] text-ink-subtle">{label}</p>
      <p className="mt-1 text-xs font-semibold text-ink">{value}</p>
    </div>
  );
}

function riskTone(risk: 'high' | 'medium' | 'low'): BadgeTone {
  if (risk === 'high') return 'danger';
  if (risk === 'medium') return 'warning';
  return 'success';
}

/**
 * R5 Step 16 — Approval Gate card.
 *
 * Renders the verdict from {@link resolvePlanApprovalGate}: when
 * approval is blocked the card lists every blocking reason so the
 * reviewer knows exactly which contract hole / blocker prevents the
 * "Approve plan" button from firing. When approval is allowed but the
 * plan still has manual / not-yet-supported follow-ups, the card calls
 * out that approval is permitted but those steps will require manual
 * handling later (per the Step 16 needs-review allowance).
 */
function ApprovalGateCard({
  approvalGate,
  planStatus,
}: {
  readonly approvalGate: PlanApprovalGate;
  readonly planStatus: ReturnType<typeof useMigrationPlanStore.getState>['status'];
}): JSX.Element {
  const tone: BadgeTone = approvalGate.canApprove
    ? approvalGate.needsReview
      ? 'warning'
      : 'success'
    : 'danger';
  const label = approvalGate.canApprove
    ? approvalGate.needsReview
      ? 'Approval allowed — needs review'
      : 'Approval allowed'
    : 'Approval blocked';
  const continueHint =
    planStatus === 'approved'
      ? 'Plan approved — continue to Step 05 Workspace.'
      : approvalGate.canApprove
        ? 'Approving the plan unlocks Step 05 Workspace. Plan approval does not start execution.'
        : 'Resolve every blocker below to enable plan approval.';

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Approval gate</CardTitle>
          <CardDescription>{continueHint}</CardDescription>
        </div>
        <Badge tone={tone} variant="soft" withDot uppercase>
          {label}
        </Badge>
      </CardHeader>

      {approvalGate.reasons.length > 0 ? (
        <CardSection label="Blocking reasons">
          <ul className="space-y-1.5">
            {approvalGate.reasons.map((reason) => (
              <li
                key={`${reason.code}:${reason.message}`}
                className="flex items-start gap-2 rounded-xs border border-danger/30 bg-danger-soft px-2.5 py-1.5 text-xs leading-relaxed text-danger"
              >
                <Icon name="help" className="mt-px h-3 w-3 shrink-0" />
                <div>
                  <p className="font-mono text-2xs uppercase tracking-[0.12em] opacity-80">
                    {reason.code}
                  </p>
                  <p className="mt-0.5 text-ink-muted">{reason.message}</p>
                </div>
              </li>
            ))}
          </ul>
        </CardSection>
      ) : null}

      {approvalGate.canApprove && approvalGate.needsReview ? (
        <CardSection label="Manual follow-ups">
          <p className="rounded-xs border border-warning/30 bg-warning-soft px-2.5 py-1.5 text-xs leading-relaxed text-warning">
            Plan approval is permitted, but some steps are{' '}
            <span className="font-semibold">manual</span> or{' '}
            <span className="font-semibold">not yet supported</span>. The
            workspace and execution screens will refuse to auto-run them; you
            will need to handle them manually later.
          </p>
        </CardSection>
      ) : null}
    </Card>
  );
}

/**
 * R5 Step 12 — Workspace creation must NOT be a plan step.
 *
 * The migration workspace is owned by Step 05 of the workflow, not by
 * the plan executor. The planner deliberately omits any "Create safe
 * migration workspace" plan step; this callout surfaces the
 * prerequisite to the user so they understand approval routes them to
 * Step 05 before any execution can happen.
 */
function WorkspacePrerequisiteCallout(): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Workspace prerequisite</CardTitle>
          <CardDescription>
            Plan execution runs against a Git worktree workspace, not your
            source project. Create and confirm a migration workspace in
            Step 05 before executing any plan step.
          </CardDescription>
        </div>
        <Badge tone="info" variant="soft" withDot uppercase>
          Step 05 owns workspace
        </Badge>
      </CardHeader>
      <CardSection>
        <ul className="grid gap-2 text-xs text-ink-muted sm:grid-cols-2">
          <li>
            Plan steps never include a "Create safe migration workspace"
            executable step — workspace setup is handled by the workspace
            screen.
          </li>
          <li>
            Approving the plan unlocks Step 05 Workspace, then Step 06
            Execute. Plan approval does not start execution.
          </li>
          <li>
            Every executable step declares "Workspace required" so the
            execution engine refuses to run before the workspace exists.
          </li>
          <li>
            Validation-only and manual review steps still expect the
            workspace to be present so commands run from a known state.
          </li>
        </ul>
      </CardSection>
    </Card>
  );
}
