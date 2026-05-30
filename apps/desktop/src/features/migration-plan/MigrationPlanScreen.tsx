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
  getReactMigrationPhaseLabel,
  resolveReact19PlanGenerationGate,
} from '@features/react19-migration';
import {
  selectScanReport,
  selectScanStatus,
  useProjectScannerStore,
  type ScanReport,
} from '@features/scanner';

import { MigrationPlanActionBar } from './components/MigrationPlanActionBar';
import {
  PLAN_STATUS_KIND,
  PLAN_STATUS_LABEL,
} from './components/migrationPlanPresentation';
import { isExecutableMigrationPlanStep } from './types/migrationPlan.types';
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
  const canApprove =
    planStatus === 'ready' &&
    plan !== undefined &&
    plan.canExecute &&
    executableSteps.length > 0 &&
    !gateBlocked;
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
                    : gateBlocked
                      ? 'React 19 eligibility gate blocks plan approval.'
                      : planStatus === 'blocked'
                        ? 'Plan is blocked. Resolve blocked reasons first.'
                        : 'Plan must be ready and executable before approval.',
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
              <PlanSummaryCard plan={plan} />
              <PhaseBreakdownCard plan={plan} />
              <PlanStepsCard plan={plan} />
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

function PhaseBreakdownCard({
  plan,
}: {
  readonly plan: NonNullable<ReturnType<typeof useMigrationPlanStore.getState>['plan']>;
}): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Phase breakdown</CardTitle>
          <CardDescription>Planner V2 groups steps by React 19 migration phase.</CardDescription>
        </div>
      </CardHeader>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {REACT_19_CANONICAL_PHASE_ORDER.map((phase) => {
          const phaseSummary = plan.phaseSummary[phase];
          const status =
            phaseSummary.totalSteps === 0 ? 'skipped' : phaseSummary.highestRisk === 'high' ? 'blocked' : 'ready';
          return (
            <div
              key={phase}
              className="rounded-md border border-canvas-border bg-canvas-subtle-2/40 px-3 py-2"
            >
              <p className="text-xs font-semibold text-ink">
                {getReactMigrationPhaseLabel(phase)}
              </p>
              <p className="mt-1 text-2xs text-ink-subtle">
                Steps: {phaseSummary.totalSteps} · Highest risk: {phaseSummary.highestRisk}
              </p>
              <p className="mt-1 text-2xs text-ink-subtle">
                Execution: {phaseSummary.executionTypes.join(', ') || 'n/a'}
              </p>
              <Badge
                tone={status === 'blocked' ? 'danger' : status === 'ready' ? 'success' : 'neutral'}
                variant="soft"
                className="mt-2"
                uppercase
              >
                {status}
              </Badge>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function PlanStepsCard({
  plan,
}: {
  readonly plan: NonNullable<ReturnType<typeof useMigrationPlanStore.getState>['plan']>;
}): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Plan steps</CardTitle>
          <CardDescription>
            Ordered executable and prerequisite steps generated from risk engine evidence.
          </CardDescription>
        </div>
      </CardHeader>
      {plan.steps.length === 0 ? (
        <p className="text-xs text-ink-muted">No steps were generated.</p>
      ) : (
        <ol className="space-y-3">
          {plan.steps.map((step) => (
            <li
              key={step.id}
              className="rounded-md border border-canvas-border bg-canvas-subtle-2/40 px-4 py-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="neutral" variant="outline" className="font-mono">
                  {String(step.order).padStart(2, '0')}
                </Badge>
                <p className="text-xs font-semibold text-ink">{step.title}</p>
                <Badge tone={riskTone(step.risk)} variant="soft" withDot uppercase>
                  {step.risk}
                </Badge>
                <Badge tone="neutral" variant="outline">
                  {getReactMigrationPhaseLabel(step.phase)}
                </Badge>
                <Badge tone="neutral" variant="outline">
                  {step.track}
                </Badge>
                <Badge tone="info" variant="outline">
                  {step.executionType}
                </Badge>
                <Badge
                  tone={
                    step.capability === 'available'
                      ? 'success'
                      : step.capability === 'not-yet-supported'
                        ? 'warning'
                        : step.capability === 'blocked'
                          ? 'danger'
                          : 'neutral'
                  }
                  variant="soft"
                  uppercase
                >
                  {step.capability}
                </Badge>
                <Badge
                  tone={step.requiresApprovalBeforeRun ? 'warning' : 'success'}
                  variant="soft"
                  uppercase
                >
                  {step.requiresApprovalBeforeRun ? 'Approval required' : 'No approval gate'}
                </Badge>
              </div>
              <p className="mt-2 text-xs text-ink-muted">{step.description}</p>
              <p className="mt-2 text-2xs text-ink-subtle">
                Reason: {step.reason}
              </p>
              <p className="mt-1 text-2xs text-ink-subtle">
                Executor: {step.executorKey ?? 'manual-only (no executor)'}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(step.validationCommands ?? []).map((command) => (
                  <Badge key={command} tone="info" variant="soft" className="font-mono">
                    {command}
                  </Badge>
                ))}
              </div>
              <div className="mt-2 text-2xs text-ink-subtle">
                Issue codes: {step.issueCodes.join(', ') || 'none'}
              </div>
              <div className="mt-1 text-2xs text-ink-subtle">
                Change scope: {(step.expectedChangeScope ?? []).join(' · ') || 'n/a'}
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
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
