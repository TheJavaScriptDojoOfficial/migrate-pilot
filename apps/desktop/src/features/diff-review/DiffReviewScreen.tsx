import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { Badge } from '@shared/ui/Badge';
import { Card } from '@shared/ui/Card';
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
import {
  selectHasWorkspace,
  selectWorkspaceResult,
  useWorkspaceSetupStore,
} from '@features/workspace';
import {
  selectLatestRun,
  useExecutionEngineStore,
} from '@features/execution';

import { DiffChangedFilesList } from './components/DiffChangedFilesList';
import { DiffReviewActionBar } from './components/DiffReviewActionBar';
import { DiffReviewBlockedState } from './components/DiffReviewBlockedState';
import { DiffReviewDecisionCard } from './components/DiffReviewDecisionCard';
import { DiffReviewErrorState } from './components/DiffReviewErrorState';
import { DiffReviewSummaryCard } from './components/DiffReviewSummaryCard';
import { DiffStatsCard } from './components/DiffStatsCard';
import { DiffViewer } from './components/DiffViewer';
import {
  selectDiffReviewError,
  selectDiffReviewSession,
  selectDiffReviewStatus,
  selectSelectedDiffFile,
  useDiffReviewStore,
} from './hooks/useDiffReview';
import {
  REVIEW_STATUS_KIND,
  REVIEW_STATUS_LABEL,
} from './services/diffReviewPresentationService';
import type { DiffReviewStatus } from './types/diffReview.types';

/**
 * Step 7 — Diff Review (Milestone 7).
 *
 * Owns the diff review state machine for the workflow:
 *
 *   no plan / no workspace / no execution run  → blocked empty state
 *   prerequisites met, idle                    → load diff CTA
 *   loading                                    → loading indicator
 *   ready                                      → file list + viewer + actions
 *   approving                                  → action bar busy spinner
 *   approved                                   → decision card + onward CTA
 *   rejecting                                  → action bar busy spinner
 *   rejected                                   → decision card + reverted files
 *   failed                                     → error banner + retry actions
 *
 * UX rules:
 *   - The screen never auto-navigates after approval/rejection.
 *   - When the upstream execution run, plan id, or workspace path
 *     changes, the diff review store wipes itself so the user is forced
 *     to load the diff for the new run.
 *   - Approval only records the decision. No commit, no validation, no
 *     package install happens here.
 */
export function DiffReviewScreen(): JSX.Element {
  const navigate = useNavigate();

  const plan = useMigrationPlanStore(selectPlan);
  const isPlanApproved = useMigrationPlanStore(selectIsPlanApproved);
  const workspaceResult = useWorkspaceSetupStore(selectWorkspaceResult);
  const hasWorkspace = useWorkspaceSetupStore(selectHasWorkspace);
  const latestRun = useExecutionEngineStore(selectLatestRun);

  const status = useDiffReviewStore(selectDiffReviewStatus);
  const session = useDiffReviewStore(selectDiffReviewSession);
  const error = useDiffReviewStore(selectDiffReviewError);
  const selectedFile = useDiffReviewStore(selectSelectedDiffFile);
  const initializeFromExecution = useDiffReviewStore(
    (s) => s.initializeFromExecution,
  );
  const markBlocked = useDiffReviewStore((s) => s.markBlocked);
  const loadDiff = useDiffReviewStore((s) => s.loadDiff);
  const selectFile = useDiffReviewStore((s) => s.selectFile);
  const approveDiff = useDiffReviewStore((s) => s.approveDiff);
  const rejectDiff = useDiffReviewStore((s) => s.rejectDiff);
  const clearIfExecutionChanges = useDiffReviewStore(
    (s) => s.clearIfExecutionChanges,
  );

  const isTauri = runtimeConfig.isTauri;
  const successfulRun =
    latestRun !== undefined && latestRun.status === 'completed' ? latestRun : undefined;

  const blockedReason: 'no-plan' | 'no-workspace' | 'no-execution-run' | undefined =
    !isPlanApproved
      ? 'no-plan'
      : !hasWorkspace
        ? 'no-workspace'
        : successfulRun === undefined
          ? 'no-execution-run'
          : undefined;

  // Cross-store invariant: the diff review is bound to (executionRunId,
  // planId, workspacePath). When any changes upstream we wipe state.
  useEffect(() => {
    if (
      blockedReason !== undefined ||
      plan === undefined ||
      workspaceResult === undefined ||
      successfulRun === undefined
    ) {
      clearIfExecutionChanges(undefined, undefined, undefined);
      markBlocked();
      return;
    }
    clearIfExecutionChanges(
      successfulRun.id,
      plan.id,
      workspaceResult.workspacePath,
    );
    initializeFromExecution({
      executionRunId: successfulRun.id,
      planId: plan.id,
      planStepId: successfulRun.planStepId,
      stepTitle: successfulRun.stepTitle,
      workspacePath: workspaceResult.workspacePath,
      sourcePath: workspaceResult.sourcePath,
      ...(workspaceResult.branchName !== undefined
        ? { branchName: workspaceResult.branchName }
        : {}),
      changedFiles: successfulRun.changedFiles.map((f) => f.path),
    });
  }, [
    blockedReason,
    plan,
    workspaceResult,
    successfulRun,
    clearIfExecutionChanges,
    initializeFromExecution,
    markBlocked,
  ]);

  // Auto-load the diff once we transition into idle. The store guards
  // against duplicate loads while an in-flight call is pending.
  useEffect(() => {
    if (!isTauri) return;
    if (status !== 'idle') return;
    if (session !== undefined) return;
    void loadDiff();
  }, [isTauri, status, session, loadDiff]);

  const canApprove =
    isTauri &&
    blockedReason === undefined &&
    session !== undefined &&
    (status === 'ready' || status === 'failed');

  const canReject = canApprove;

  const canReload =
    isTauri &&
    blockedReason === undefined &&
    (status === 'ready' || status === 'failed' || status === 'idle');

  const disabledApproveReason = useMemo(() => {
    if (!isTauri) return 'Diff review requires the Migrate Pilot desktop shell.';
    if (blockedReason !== undefined) return 'Resolve the blocked state first.';
    if (session === undefined) return 'Load the diff before approving.';
    if (status === 'approved') return 'Already approved.';
    if (status === 'rejected') return 'Diff was rejected. Re-run execution to try again.';
    return undefined;
  }, [isTauri, blockedReason, session, status]);

  const disabledRejectReason = useMemo(() => {
    if (!isTauri) return 'Diff review requires the Migrate Pilot desktop shell.';
    if (blockedReason !== undefined) return 'Resolve the blocked state first.';
    if (session === undefined) return 'Load the diff before rejecting.';
    if (status === 'approved') {
      return 'Diff already approved. Reset the review to revert.';
    }
    if (status === 'rejected') return 'Diff already rejected.';
    return undefined;
  }, [isTauri, blockedReason, session, status]);

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        eyebrow={<StepEyebrow number={7} icon="diff" label="Diff" />}
        title="Diff review"
        subtitle="Review what changed in the workspace for this React 19 migration step before moving on. Approval only records your decision — no commit, no validation, no package install runs here."
        meta={
          <HeaderMeta
            status={status}
            isTauri={isTauri}
            blockedReason={blockedReason}
            additions={session?.totalAdditions ?? 0}
            deletions={session?.totalDeletions ?? 0}
            fileCount={session?.files.length ?? 0}
          />
        }
        actions={
          <DiffReviewActionBar
            status={status}
            canApprove={canApprove}
            canReject={canReject}
            canReload={canReload}
            {...(disabledApproveReason !== undefined
              ? { disabledApproveReason }
              : {})}
            {...(disabledRejectReason !== undefined
              ? { disabledRejectReason }
              : {})}
            onApprove={() => {
              void approveDiff();
            }}
            onReject={() => {
              void rejectDiff();
            }}
            onReload={() => {
              void loadDiff();
            }}
          />
        }
      />

      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
          {blockedReason !== undefined ? (
            <DiffReviewBlockedState
              reason={blockedReason}
              onGoToPlan={() => navigate(ROUTES.migrationPlan)}
              onGoToWorkspace={() => navigate(ROUTES.workspace)}
              onGoToExecute={() => navigate(ROUTES.execution)}
            />
          ) : !isTauri ? (
            <WebPreviewNotice />
          ) : (
            <ReadyContent
              status={status}
              session={session}
              selectedFilePath={session?.selectedFilePath}
              selectedFile={selectedFile}
              error={error}
              onSelectFile={selectFile}
              onReload={() => {
                void loadDiff();
              }}
              onRetryReject={() => {
                void rejectDiff();
              }}
              onContinueToValidation={() => navigate(ROUTES.summary)}
              onGoToExecute={() => navigate(ROUTES.execution)}
            />
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
  additions,
  deletions,
  fileCount,
}: {
  readonly status: DiffReviewStatus;
  readonly isTauri: boolean;
  readonly blockedReason:
    | 'no-plan'
    | 'no-workspace'
    | 'no-execution-run'
    | undefined;
  readonly additions: number;
  readonly deletions: number;
  readonly fileCount: number;
}): JSX.Element {
  return (
    <>
      <Badge tone="success" variant="soft" withDot>
        Workspace-only
      </Badge>
      <Badge tone="neutral" variant="outline">
        No commit
      </Badge>
      <Badge tone="neutral" variant="outline">
        No validation
      </Badge>
      <StatusIndicator
        variant="chip"
        status={REVIEW_STATUS_KIND[status]}
        label={REVIEW_STATUS_LABEL[status]}
      />
      <Badge tone="neutral" variant="outline">
        {fileCount} file{fileCount === 1 ? '' : 's'}
      </Badge>
      <Badge tone="success" variant="soft">
        +{additions}
      </Badge>
      <Badge tone="danger" variant="soft">
        −{deletions}
      </Badge>
      {blockedReason === 'no-plan' ? (
        <Badge tone="warning" variant="soft" withDot>
          Plan approval required
        </Badge>
      ) : blockedReason === 'no-workspace' ? (
        <Badge tone="warning" variant="soft" withDot>
          Workspace required
        </Badge>
      ) : blockedReason === 'no-execution-run' ? (
        <Badge tone="warning" variant="soft" withDot>
          Execute a step first
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

interface ReadyContentProps {
  readonly status: DiffReviewStatus;
  readonly session: ReturnType<typeof selectDiffReviewSession>;
  readonly selectedFilePath: string | undefined;
  readonly selectedFile: ReturnType<typeof selectSelectedDiffFile>;
  readonly error: ReturnType<typeof selectDiffReviewError>;
  readonly onSelectFile: (path: string) => void;
  readonly onReload: () => void;
  readonly onRetryReject: () => void;
  readonly onContinueToValidation: () => void;
  readonly onGoToExecute: () => void;
}

function ReadyContent({
  status,
  session,
  selectedFile,
  error,
  onSelectFile,
  onReload,
  onRetryReject,
  onContinueToValidation,
  onGoToExecute,
}: ReadyContentProps): JSX.Element {
  if (status === 'idle' || (status === 'loading' && session === undefined)) {
    return <LoadingNotice />;
  }

  if (session === undefined) {
    return (
      <Card>
        <p className="text-xs text-ink-muted">
          The diff has not been loaded yet. Click <strong>Reload diff</strong>{' '}
          in the toolbar to load it.
        </p>
      </Card>
    );
  }

  const decision = session.decision;
  const showError =
    error !== undefined && (status === 'failed' || status === 'rejected');

  return (
    <>
      <DiffReviewSummaryCard session={session} />

      {showError ? (
        <DiffReviewErrorState
          error={error}
          canReload={status !== 'rejected'}
          canRetryReject={status === 'failed' && session.decision === undefined}
          onReload={onReload}
          onRetryReject={onRetryReject}
        />
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <aside className="flex flex-col gap-3">
          <SectionHeading
            label="Changed files"
            count={session.files.length}
          />
          <DiffChangedFilesList
            files={session.files}
            selectedFilePath={session.selectedFilePath}
            disabled={
              status === 'approving' ||
              status === 'rejecting' ||
              status === 'loading'
            }
            onSelectFile={onSelectFile}
          />
        </aside>

        <section className="min-w-0">
          <DiffViewer file={selectedFile} />
        </section>
      </div>

      {decision !== undefined ? (
        <DiffReviewDecisionCard
          decision={decision}
          onContinueToValidation={onContinueToValidation}
          onGoToExecute={onGoToExecute}
        />
      ) : (
        <SafetyNotice />
      )}

      <DiffStatsCard
        title="Captured Git commands"
        description="Read-only commands the safe diff loader / revert ran inside the workspace. Stdout/stderr are capped at 8 KB per command."
        logs={session.commandLogs}
      />
    </>
  );
}

function SectionHeading({
  label,
  count,
}: {
  readonly label: string;
  readonly count: number;
}): JSX.Element {
  return (
    <div className="flex items-center justify-between">
      <p className="text-2xs font-medium uppercase tracking-[0.14em] text-ink-subtle">
        {label}
      </p>
      <span className="font-mono text-2xs text-ink-faint">{count}</span>
    </div>
  );
}

function SafetyNotice(): JSX.Element {
  return (
    <Card tone="subtle">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
          <Icon name="shield" className="h-3 w-3" />
        </span>
        <div>
          <p className="text-xs font-semibold text-ink">Safety promise</p>
          <ul className="mt-1.5 space-y-1 text-xs leading-relaxed text-ink-muted">
            <li>Approval only records your decision. Commit and validation happen later.</li>
            <li>Reject only reverts known changed files inside the migration workspace.</li>
            <li>The original source project is never touched.</li>
          </ul>
        </div>
      </div>
    </Card>
  );
}

function LoadingNotice(): JSX.Element {
  return (
    <Card>
      <div className="flex items-start gap-3">
        <StatusIndicator status="running" label="Loading diff" />
        <p className="text-xs leading-relaxed text-ink-muted">
          Reading changed files from the workspace using safe Git commands.
          The original project is not accessed.
        </p>
      </div>
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
            Diff review not available here
          </p>
          <p className="mt-1 text-xs leading-relaxed text-ink-muted">
            Migrate Pilot reads workspace diffs via the Tauri desktop shell.
            Run{' '}
            <code className="rounded-xs border border-canvas-border bg-canvas-subtle px-1 py-0.5 font-mono text-[11px] text-ink">
              npm run tauri:dev
            </code>{' '}
            inside <code className="font-mono text-[11px]">apps/desktop</code> to
            enable diff review.
          </p>
        </div>
      </div>
    </Card>
  );
}
