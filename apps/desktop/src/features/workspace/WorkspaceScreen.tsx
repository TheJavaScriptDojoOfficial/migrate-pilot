import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { Badge } from '@shared/ui/Badge';
import { Button } from '@shared/ui/Button';
import { Card, CardDescription, CardHeader, CardSection, CardTitle } from '@shared/ui/Card';
import { EmptyState } from '@shared/ui/EmptyState';
import { ErrorMessage } from '@shared/ui/ErrorMessage';
import { Icon } from '@shared/ui/Icon';
import { PageHeader } from '@shared/ui/PageHeader';
import { StatusIndicator, type StatusKind } from '@shared/ui/StatusIndicator';
import { StepEyebrow } from '@shared/ui/StepEyebrow';
import { ROUTES } from '@shared/constants/routes';
import { runtimeConfig } from '@shared/config/runtime';
import { useSessionStore } from '@shared/hooks/useSessionState';

import {
  selectIsPlanApproved,
  selectPlan,
  useMigrationPlanStore,
} from '@features/migration-plan';

import { WorkspaceActionBar } from './components/WorkspaceActionBar';
import { WorkspaceBlockedState } from './components/WorkspaceBlockedState';
import { WorkspaceCreatedCard } from './components/WorkspaceCreatedCard';
import { WorkspaceIssueList } from './components/WorkspaceIssueList';
import { WorkspacePreflightCard } from './components/WorkspacePreflightCard';
import { WorkspaceStrategyCard } from './components/WorkspaceStrategyCard';
import { WorkspaceSummaryCard } from './components/WorkspaceSummaryCard';
import {
  selectWorkspaceError,
  selectWorkspacePreflight,
  selectWorkspaceResult,
  selectWorkspaceStatus,
  useWorkspaceSetupStore,
} from './hooks/useWorkspaceSetup';
import {
  STATUS_KIND,
  STATUS_LABEL,
} from './services/workspacePresentationService';
import type { WorkspaceStatus } from './types/workspace.types';

/**
 * Step 5 — Migration Workspace Creation (Milestone 5).
 *
 * Owns the workspace state machine for the workflow:
 *
 *   no approved plan        → blocked empty state; CTA back to plan
 *   plan approved, idle     → "Check workspace readiness" CTA
 *   checking                → loading state
 *   ready                   → preflight cards + create CTA (gated by blockers)
 *   creating                → loading state with command-level activity
 *   created                 → workspace summary + command logs + continue
 *   failed                  → error message + retry action
 *
 * UX rules:
 *   - Approval is explicit; the screen never auto-navigates after creation.
 *   - When the upstream plan changes (or is reset), any existing
 *     workspace state is invalidated and the user is forced to re-run
 *     preflight.
 */
export function WorkspaceScreen(): JSX.Element {
  const navigate = useNavigate();

  const project = useSessionStore((s) => s.project);

  const plan = useMigrationPlanStore(selectPlan);
  const isPlanApproved = useMigrationPlanStore(selectIsPlanApproved);

  const status = useWorkspaceSetupStore(selectWorkspaceStatus);
  const preflight = useWorkspaceSetupStore(selectWorkspacePreflight);
  const result = useWorkspaceSetupStore(selectWorkspaceResult);
  const error = useWorkspaceSetupStore(selectWorkspaceError);
  const runPreflight = useWorkspaceSetupStore((s) => s.runPreflight);
  const createWorkspace = useWorkspaceSetupStore((s) => s.createWorkspace);
  const resetWorkspace = useWorkspaceSetupStore((s) => s.resetWorkspace);
  const clearIfPlanChanges = useWorkspaceSetupStore((s) => s.clearIfPlanChanges);
  const markBlocked = useWorkspaceSetupStore((s) => s.markBlocked);
  const markUnblocked = useWorkspaceSetupStore((s) => s.markUnblocked);

  // Cross-store invariants. The workspace step is only valid for the
  // currently approved plan id.
  useEffect(() => {
    if (!isPlanApproved || plan === undefined) {
      markBlocked();
      return;
    }
    clearIfPlanChanges(plan.id);
    markUnblocked(plan.id);
  }, [isPlanApproved, plan, markBlocked, markUnblocked, clearIfPlanChanges]);

  const isTauri = runtimeConfig.isTauri;
  const hasBlockers = preflight !== undefined && preflight.blockers.length > 0;

  const canRunPreflight =
    isTauri &&
    project !== undefined &&
    isPlanApproved &&
    plan !== undefined &&
    status !== 'creating' &&
    status !== 'created';

  const canCreate =
    isTauri &&
    isPlanApproved &&
    preflight !== undefined &&
    !hasBlockers &&
    preflight.recommendedStrategy === 'git-worktree' &&
    (status === 'ready' || status === 'failed');

  const canContinue = status === 'created' && result !== undefined;

  const disabledPreflightReason = useMemo(() => {
    if (!isTauri) return 'Workspace creation requires the Migrate Pilot desktop shell.';
    if (project === undefined) return 'Select a project on Step 1 to enable preflight.';
    if (!isPlanApproved) return 'Approve the migration plan to enable preflight.';
    return undefined;
  }, [isTauri, project, isPlanApproved]);

  const disabledCreateReason = useMemo(() => {
    if (!isTauri) return 'Workspace creation requires the Migrate Pilot desktop shell.';
    if (preflight === undefined) return 'Run preflight before creating the workspace.';
    if (hasBlockers) return 'Resolve preflight blockers before creating the workspace.';
    if (preflight.recommendedStrategy !== 'git-worktree') {
      return 'Only the Git worktree strategy is implemented in V1.';
    }
    return undefined;
  }, [isTauri, preflight, hasBlockers]);

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        eyebrow={<StepEyebrow number={5} icon="workspace" label="Workspace" />}
        title="Create React 19 migration workspace"
        subtitle="A new Git branch and worktree will be created for the React 19 migration. The original project stays read-only — every edit lands inside the workspace."
        meta={
          <HeaderMeta
            status={status}
            isTauri={isTauri}
            isPlanApproved={isPlanApproved}
          />
        }
        actions={
          <WorkspaceActionBar
            status={status}
            canRunPreflight={canRunPreflight}
            canCreate={canCreate}
            canContinue={canContinue}
            {...(disabledPreflightReason !== undefined
              ? { disabledPreflightReason }
              : {})}
            {...(disabledCreateReason !== undefined
              ? { disabledCreateReason }
              : {})}
            {...(canContinue
              ? {}
              : { disabledContinueReason: 'Create the workspace to enable execution.' })}
            onRunPreflight={() => {
              if (project === undefined || plan === undefined) return;
              void runPreflight({
                sourcePath: project.path,
                projectName: project.name,
                planId: plan.id,
              });
            }}
            onCreate={() => {
              if (preflight === undefined) return;
              void createWorkspace({
                sourcePath: preflight.sourcePath,
                workspacePath: preflight.proposedWorkspacePath,
                branchName: preflight.proposedBranchName,
                strategy: preflight.recommendedStrategy,
              });
            }}
            onReset={resetWorkspace}
            onContinue={() => navigate(ROUTES.execution)}
          />
        }
      />

      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="mx-auto flex max-w-5xl flex-col gap-6">
          {!isPlanApproved || plan === undefined ? (
            <WorkspaceBlockedState onGoToPlan={() => navigate(ROUTES.migrationPlan)} />
          ) : project === undefined ? (
            <NoProjectState onGoBack={() => navigate(ROUTES.projectSelection)} />
          ) : !isTauri ? (
            <WebPreviewNotice />
          ) : (
            <>
              <WorkspaceSummaryCard
                projectName={project.name}
                sourcePath={project.path}
                planTitle={plan.title}
                planTotalSteps={plan.steps.length}
              />

              {status === 'idle' ? (
                <IdleState />
              ) : status === 'checking' ? (
                <CheckingState />
              ) : status === 'creating' ? (
                <CreatingState />
              ) : status === 'failed' ? (
                <>
                  <ErrorMessage
                    title={
                      error?.kind === 'creation-failed'
                        ? 'Workspace creation failed'
                        : error?.kind === 'preflight-blocked'
                          ? 'Preflight blocked'
                          : 'Workspace step failed'
                    }
                    message={error?.message ?? 'An unknown error occurred.'}
                    {...(error?.detail !== undefined ? { detail: error.detail } : {})}
                  />
                  {preflight !== undefined ? (
                    <>
                      <WorkspaceStrategyCard preflight={preflight} />
                      <WorkspacePreflightCard preflight={preflight} />
                      <WorkspaceIssueList
                        blockers={preflight.blockers}
                        warnings={preflight.warnings}
                      />
                    </>
                  ) : null}
                </>
              ) : status === 'ready' && preflight !== undefined ? (
                <>
                  <WorkspaceStrategyCard preflight={preflight} />
                  <WorkspacePreflightCard preflight={preflight} />
                  <WorkspaceIssueList
                    blockers={preflight.blockers}
                    warnings={preflight.warnings}
                  />
                </>
              ) : status === 'created' && result !== undefined ? (
                <WorkspaceCreatedCard result={result} />
              ) : null}
            </>
          )}
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
      title="No project selected"
      description="The workspace step needs the source project metadata. Re-select the project on Step 1 and re-approve the plan to continue."
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
          <p className="text-xs font-semibold text-ink">
            Workspace creation not available here
          </p>
          <p className="mt-1 text-xs leading-relaxed text-ink-muted">
            Migrate Pilot performs Git worktree operations via the Tauri
            desktop shell. Run{' '}
            <code className="rounded-xs border border-canvas-border bg-canvas-subtle px-1 py-0.5 font-mono text-[11px] text-ink">
              npm run tauri:dev
            </code>{' '}
            inside <code className="font-mono text-[11px]">apps/desktop</code> to
            enable preflight and workspace creation.
          </p>
        </div>
      </div>
    </Card>
  );
}

function IdleState(): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Run workspace preflight</CardTitle>
          <CardDescription>
            Preflight is a deterministic, read-only inspection. It never
            modifies the source project — it only reads Git metadata to
            decide whether the worktree strategy is safe.
          </CardDescription>
        </div>
        <Badge tone="success" variant="soft" withDot>
          Read-only — no mutation
        </Badge>
      </CardHeader>

      <CardSection>
        <ul className="grid gap-2 text-xs text-ink-muted sm:grid-cols-2">
          <Bullet>Verify Git is available on PATH.</Bullet>
          <Bullet>Confirm source is a Git working tree.</Bullet>
          <Bullet>Detect uncommitted changes safely.</Bullet>
          <Bullet>Propose a unique migration branch name.</Bullet>
          <Bullet>Propose a workspace path outside the source.</Bullet>
          <Bullet>Surface blockers before any Git mutation.</Bullet>
        </ul>
      </CardSection>

      <p className="mt-4 text-xs leading-relaxed text-ink-muted">
        After preflight, you confirm explicitly before any Git command runs.
        Worktree creation is reversible with{' '}
        <code className="font-mono text-[11px]">git worktree remove</code>.
      </p>
    </Card>
  );
}

function CheckingState(): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Running preflight</CardTitle>
          <CardDescription>
            Inspecting Git metadata. UI stays responsive — heavy IO runs off
            the main thread.
          </CardDescription>
        </div>
        <StatusIndicator status="running" label="Checking" variant="chip" />
      </CardHeader>
      <ul className="divide-y divide-canvas-border">
        <PhaseRow
          index={1}
          title="Resolve source path"
          hint="Canonicalise + verify it is a directory"
          status="success"
        />
        <PhaseRow
          index={2}
          title="Detect Git availability"
          hint="git --version (read-only)"
          status="running"
        />
        <PhaseRow
          index={3}
          title="Inspect repository state"
          hint="git rev-parse, git status, git branch --list (read-only)"
          status="running"
        />
        <PhaseRow
          index={4}
          title="Propose branch + workspace path"
          hint="Sanitise project name, derive sibling directory"
          status="pending"
        />
      </ul>
    </Card>
  );
}

function CreatingState(): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Creating workspace</CardTitle>
          <CardDescription>
            Running{' '}
            <code className="font-mono text-[11px]">git worktree add</code>{' '}
            with the confirmed parameters. Output is captured for the audit
            trail.
          </CardDescription>
        </div>
        <StatusIndicator status="running" label="Creating" variant="chip" />
      </CardHeader>
      <ul className="divide-y divide-canvas-border">
        <PhaseRow
          index={1}
          title="Re-verify Git invariants"
          hint="rev-parse, status, branch --list"
          status="success"
        />
        <PhaseRow
          index={2}
          title="Create migration branch + worktree"
          hint="git worktree add -b <branch> <workspace>"
          status="running"
        />
        <PhaseRow
          index={3}
          title="Capture command output"
          hint="stdout/stderr persisted to the result"
          status="pending"
        />
      </ul>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* tiny presentational helpers                                                */
/* -------------------------------------------------------------------------- */

function HeaderMeta({
  status,
  isTauri,
  isPlanApproved,
}: {
  readonly status: WorkspaceStatus;
  readonly isTauri: boolean;
  readonly isPlanApproved: boolean;
}): JSX.Element {
  return (
    <>
      <Badge tone="success" variant="soft" withDot>
        Reversible
      </Badge>
      <Badge tone="neutral" variant="outline">
        No remote push
      </Badge>
      <StatusIndicator
        variant="chip"
        status={STATUS_KIND[status]}
        label={STATUS_LABEL[status]}
      />
      {!isPlanApproved ? (
        <Badge tone="warning" variant="soft" withDot>
          Plan approval required
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
