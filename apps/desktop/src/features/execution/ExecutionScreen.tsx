import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { Badge } from '@shared/ui/Badge';
import { Card, CardDescription, CardHeader, CardTitle } from '@shared/ui/Card';
import { ErrorMessage } from '@shared/ui/ErrorMessage';
import { Icon } from '@shared/ui/Icon';
import { PageHeader } from '@shared/ui/PageHeader';
import { StatusIndicator } from '@shared/ui/StatusIndicator';
import { StepEyebrow } from '@shared/ui/StepEyebrow';
import { ROUTES } from '@shared/constants/routes';
import { runtimeConfig } from '@shared/config/runtime';

import {
  selectIsPlanApproved,
  selectPlan,
  useMigrationPlanStore,
} from '@features/migration-plan';
import { isWorkspaceCreationPlanStep } from '@features/migration-plan';
import {
  selectHasWorkspace,
  selectWorkspacePlanSnapshot,
  selectWorkspaceState,
  useWorkspaceSetupStore,
  validateWorkspaceState,
} from '@features/workspace';

import { ExecutionActionBar } from './components/ExecutionActionBar';
import { ExecutionBlockedState } from './components/ExecutionBlockedState';
import { ExecutionCapabilityCard } from './components/ExecutionCapabilityCard';
import { ExecutionLogPanel } from './components/ExecutionLogPanel';
import { ExecutionPlanStepList } from './components/ExecutionPlanStepList';
import { ExecutionResultCard } from './components/ExecutionResultCard';
import { ExecutionWorkspaceCard } from './components/ExecutionWorkspaceCard';
import {
  selectCapabilities,
  selectCapabilityFor,
  selectExecutionError,
  selectExecutionStatus,
  selectLatestRun,
  selectRunFor,
  selectSelectedStepId,
  selectStepStatuses,
  useExecutionEngineStore,
} from './hooks/useExecutionEngine';
import {
  ENGINE_STATUS_KIND,
  ENGINE_STATUS_LABEL,
} from './services/executionPresentationService';
import type { ExecutionStatus } from './types/execution.types';

/**
 * Step 6 — Execute migration (generic execution framework).
 *
 * Owns the execution state machine for the workflow:
 *
 *   no plan / no workspace      → blocked empty state; CTA back to required step
 *   plan + workspace, idle      → step list + workspace context
 *   step selected, ready        → capability card + run CTA
 *   running                     → capability + step list disabled, logs streaming
 *   completed                   → result card + logs + workflow `execute` complete
 *   failed                      → error message + retry action
 *
 * Architectural rules
 * -------------------
 *   - The screen never auto-navigates after a successful run.
 *   - When plan or workspace changes upstream, the engine resets so the
 *     user is forced to re-verify capability before running.
 *   - Steps are dispatched through their `execution` metadata
 *     (mode + executorKey + params). The screen NEVER inspects step ids
 *     to decide executability — only the executor registry does.
 */
export function ExecutionScreen(): JSX.Element {
  const navigate = useNavigate();

  const plan = useMigrationPlanStore(selectPlan);
  const isPlanApproved = useMigrationPlanStore(selectIsPlanApproved);
  const workspaceState = useWorkspaceSetupStore(selectWorkspaceState);
  const planSnapshot = useWorkspaceSetupStore(selectWorkspacePlanSnapshot);
  const hasWorkspace = useWorkspaceSetupStore(selectHasWorkspace);

  const status = useExecutionEngineStore(selectExecutionStatus);
  const selectedStepId = useExecutionEngineStore(selectSelectedStepId);
  const capabilities = useExecutionEngineStore(selectCapabilities);
  const stepStatuses = useExecutionEngineStore(selectStepStatuses);
  const latestRun = useExecutionEngineStore(selectLatestRun);
  const engineError = useExecutionEngineStore(selectExecutionError);
  const initializeFromPlanAndWorkspace = useExecutionEngineStore(
    (s) => s.initializeFromPlanAndWorkspace,
  );
  const markBlocked = useExecutionEngineStore((s) => s.markBlocked);
  const selectStep = useExecutionEngineStore((s) => s.selectStep);
  const checkCapability = useExecutionEngineStore((s) => s.checkCapability);
  const runSelectedStep = useExecutionEngineStore((s) => s.runSelectedStep);
  const retryStep = useExecutionEngineStore((s) => s.retryStep);
  const resetExecution = useExecutionEngineStore((s) => s.resetExecution);
  const clearIfPlanOrWorkspaceChanges = useExecutionEngineStore(
    (s) => s.clearIfPlanOrWorkspaceChanges,
  );

  // Phase R5 — Step 11/13: filter out any legacy "create workspace"
  // plan steps so the execution screen never offers them as runnable.
  // The current planner does not emit them, but old persisted plans
  // can still surface one and the workspace step itself is not part
  // of the execution contract.
  const executablePlanSteps = useMemo(() => {
    if (plan === undefined) return [];
    return plan.steps.filter((step) => !isWorkspaceCreationPlanStep(step));
  }, [plan]);

  // Phase R5 — Step 13/14: state-level workspace validation.
  // Even when `hasWorkspace` is true the persisted state may be
  // invalid (e.g. plan id no longer matches the active plan). The
  // validator runs synchronously off the persisted store; an async
  // filesystem probe could be added later without changing this
  // contract.
  const workspaceValidation = useMemo(
    () => validateWorkspaceState(workspaceState, plan?.id),
    [workspaceState, plan?.id],
  );
  const hasValidWorkspace =
    hasWorkspace && workspaceState !== undefined && workspaceValidation.valid;

  // Cross-store invariant: the engine is bound to (planId, workspacePath).
  // When either changes upstream we wipe the engine state so the user is
  // forced to re-verify capability before re-running.
  useEffect(() => {
    if (
      !isPlanApproved ||
      plan === undefined ||
      !hasValidWorkspace ||
      workspaceState === undefined
    ) {
      clearIfPlanOrWorkspaceChanges(undefined, undefined);
      markBlocked();
      return;
    }
    clearIfPlanOrWorkspaceChanges(plan.id, workspaceState.workspacePath);
    initializeFromPlanAndWorkspace({
      planId: plan.id,
      workspacePath: workspaceState.workspacePath,
      sourcePath: workspaceState.originalProjectPath,
      branchName: workspaceState.branchName,
      planSteps: executablePlanSteps.map((s) => ({
        id: s.id,
        title: s.title,
        ...(s.execution !== undefined ? { execution: s.execution } : {}),
      })),
    });
  }, [
    isPlanApproved,
    plan,
    hasValidWorkspace,
    workspaceState,
    executablePlanSteps,
    clearIfPlanOrWorkspaceChanges,
    initializeFromPlanAndWorkspace,
    markBlocked,
  ]);

  const isTauri = runtimeConfig.isTauri;
  const blockedReason: 'no-plan' | 'no-workspace' | 'invalid-workspace' | undefined =
    !isPlanApproved
      ? 'no-plan'
      : !hasWorkspace
        ? 'no-workspace'
        : !hasValidWorkspace
          ? 'invalid-workspace'
          : undefined;

  const selectedPlanStep = useMemo(() => {
    if (selectedStepId === undefined) return undefined;
    return executablePlanSteps.find((s) => s.id === selectedStepId);
  }, [executablePlanSteps, selectedStepId]);

  const selectedCapability = useExecutionEngineStore((s) =>
    selectCapabilityFor(s, selectedStepId),
  );
  const selectedRun = useExecutionEngineStore((s) =>
    selectRunFor(s, selectedStepId),
  );

  const canRun =
    isTauri &&
    blockedReason === undefined &&
    selectedPlanStep !== undefined &&
    selectedCapability?.executable === true &&
    status !== 'running';

  const canRetry =
    isTauri &&
    blockedReason === undefined &&
    selectedPlanStep !== undefined &&
    status === 'failed';

  const canReset =
    blockedReason === undefined && status !== 'blocked' && status !== 'running';

  const disabledRunReason = useMemo(() => {
    if (!isTauri) return 'Execution requires the Migrate Pilot desktop shell.';
    if (blockedReason !== undefined) return 'Resolve the blocked state first.';
    if (selectedPlanStep === undefined) return 'Select a step to run.';
    if (selectedCapability === undefined) {
      return 'Verify executor availability before running.';
    }
    if (!selectedCapability.executable) return selectedCapability.reason;
    return undefined;
  }, [isTauri, blockedReason, selectedPlanStep, selectedCapability]);

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        eyebrow={<StepEyebrow number={6} icon="play" label="Execute" />}
        title="Execute React 19 step"
        subtitle="Run one approved React 19 migration step at a time. Every action writes only inside the migration workspace; the original project stays read-only."
        meta={
          <HeaderMeta
            status={status}
            isTauri={isTauri}
            blockedReason={blockedReason}
          />
        }
        actions={
          <ExecutionActionBar
            status={status}
            canRun={canRun}
            canRetry={canRetry}
            canReset={canReset}
            {...(disabledRunReason !== undefined
              ? { disabledRunReason }
              : {})}
            {...(canRetry
              ? {}
              : { disabledRetryReason: 'Retry is available after a failed run.' })}
            onRun={() => {
              if (selectedPlanStep !== undefined) {
                void runSelectedStep({
                  id: selectedPlanStep.id,
                  title: selectedPlanStep.title,
                  ...(selectedPlanStep.execution !== undefined
                    ? { execution: selectedPlanStep.execution }
                    : {}),
                });
              }
            }}
            onRetry={() => {
              if (selectedPlanStep !== undefined) {
                void retryStep({
                  id: selectedPlanStep.id,
                  title: selectedPlanStep.title,
                  ...(selectedPlanStep.execution !== undefined
                    ? { execution: selectedPlanStep.execution }
                    : {}),
                });
              }
            }}
            onReset={resetExecution}
          />
        }
      />

      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
          {blockedReason !== undefined ? (
            <ExecutionBlockedState
              reason={blockedReason}
              {...(blockedReason === 'invalid-workspace'
                ? { invalidReasons: workspaceValidation.reasons }
                : {})}
              onGoToPlan={() => navigate(ROUTES.migrationPlan)}
              onGoToWorkspace={() => navigate(ROUTES.workspace)}
            />
          ) : !isTauri ? (
            <WebPreviewNotice />
          ) : workspaceState === undefined || plan === undefined ? null : (
            <>
              <ExecutionWorkspaceCard
                workspacePath={workspaceState.workspacePath}
                sourcePath={workspaceState.originalProjectPath}
                branchName={workspaceState.branchName}
                strategy={workspaceState.strategy}
                planId={workspaceState.planId}
                planTitle={planSnapshot?.title ?? plan.title}
                planTotalSteps={executablePlanSteps.length}
                track={planSnapshot?.track ?? plan.track}
                {...(workspaceState.packageManager !== undefined
                  ? { packageManager: workspaceState.packageManager }
                  : {})}
              />

              {engineError !== undefined && status !== 'failed' ? (
                <ErrorMessage
                  title="Execution engine error"
                  message={engineError.message}
                  {...(engineError.detail !== undefined
                    ? { detail: engineError.detail }
                    : {})}
                />
              ) : null}

              <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                <ExecutionPlanStepList
                  steps={executablePlanSteps}
                  capabilities={capabilities}
                  stepStatuses={stepStatuses}
                  selectedPlanStepId={selectedStepId}
                  disabled={status === 'running'}
                  onSelectStep={(planStepId) => selectStep(planStepId)}
                />

                <div className="flex flex-col gap-6">
                  {selectedPlanStep !== undefined ? (
                    <ExecutionCapabilityCard
                      step={selectedPlanStep}
                      capability={selectedCapability}
                      canVerify={
                        isTauri &&
                        status !== 'running' &&
                        selectedPlanStep.execution !== undefined
                      }
                      verifying={false}
                      onVerify={() => {
                        if (selectedPlanStep.execution === undefined) return;
                        void checkCapability({
                          id: selectedPlanStep.id,
                          title: selectedPlanStep.title,
                          execution: selectedPlanStep.execution,
                        });
                      }}
                    />
                  ) : (
                    <NoSelectionCard />
                  )}

                  {status === 'failed' && latestRun?.error !== undefined ? (
                    <ErrorMessage
                      title="Step execution failed"
                      message={latestRun.error.message}
                      {...(latestRun.error.detail !== undefined
                        ? { detail: latestRun.error.detail }
                        : {})}
                    />
                  ) : null}

                  {selectedRun !== undefined ? (
                    <ExecutionResultCard run={selectedRun} />
                  ) : null}

                  {selectedRun !== undefined ? (
                    <ExecutionLogPanel logs={selectedRun.logs} />
                  ) : status === 'running' ? (
                    <Card>
                      <CardHeader>
                        <div>
                          <CardTitle>Running scripted executor</CardTitle>
                          <CardDescription>
                            Logs are captured server-side and surfaced once the
                            command completes. Streaming will land in a future
                            milestone.
                          </CardDescription>
                        </div>
                        <StatusIndicator
                          status="running"
                          label="Running"
                          variant="chip"
                        />
                      </CardHeader>
                    </Card>
                  ) : null}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* tiny presentational helpers                                                */
/* -------------------------------------------------------------------------- */

function HeaderMeta({
  status,
  isTauri,
  blockedReason,
}: {
  readonly status: ExecutionStatus;
  readonly isTauri: boolean;
  readonly blockedReason: 'no-plan' | 'no-workspace' | 'invalid-workspace' | undefined;
}): JSX.Element {
  return (
    <>
      <Badge tone="success" variant="soft" withDot>
        Workspace-only
      </Badge>
      <Badge tone="neutral" variant="outline">
        No package install
      </Badge>
      <Badge tone="neutral" variant="outline">
        No commit
      </Badge>
      <StatusIndicator
        variant="chip"
        status={ENGINE_STATUS_KIND[status]}
        label={ENGINE_STATUS_LABEL[status]}
      />
      {blockedReason === 'no-plan' ? (
        <Badge tone="warning" variant="soft" withDot>
          Plan approval required
        </Badge>
      ) : blockedReason === 'no-workspace' ? (
        <Badge tone="warning" variant="soft" withDot>
          Workspace required
        </Badge>
      ) : blockedReason === 'invalid-workspace' ? (
        <Badge tone="danger" variant="soft" withDot>
          Workspace invalid
        </Badge>
      ) : null}
      {!isTauri ? (
        <Badge tone="warning" variant="soft" withDot>
          Web preview — disabled
        </Badge>
      ) : null}
    </>
  );
}

function NoSelectionCard(): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>No step selected</CardTitle>
          <CardDescription>
            Pick a step on the left to inspect executor availability and run
            it. Scripted execution is dispatched through the executor
            registry — only steps backed by a registered safe executor can
            run today.
          </CardDescription>
        </div>
      </CardHeader>
    </Card>
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
          <p className="text-xs font-semibold text-ink">
            Execution not available here
          </p>
          <p className="mt-1 text-xs leading-relaxed text-ink-muted">
            Migrate Pilot performs scripted migrations via the Tauri desktop
            shell. Run{' '}
            <code className="rounded-xs border border-canvas-border bg-canvas-subtle px-1 py-0.5 font-mono text-[11px] text-ink">
              npm run tauri:dev
            </code>{' '}
            inside <code className="font-mono text-[11px]">apps/desktop</code> to
            enable execution.
          </p>
        </div>
      </div>
    </Card>
  );
}
