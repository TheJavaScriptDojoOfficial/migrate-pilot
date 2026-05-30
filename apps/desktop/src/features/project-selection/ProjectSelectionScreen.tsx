import { useNavigate } from 'react-router-dom';

import { Badge } from '@shared/ui/Badge';
import { Button } from '@shared/ui/Button';
import { Card, CardDescription, CardHeader, CardTitle } from '@shared/ui/Card';
import { EmptyState } from '@shared/ui/EmptyState';
import { Icon } from '@shared/ui/Icon';
import { PageHeader } from '@shared/ui/PageHeader';
import { StepEyebrow } from '@shared/ui/StepEyebrow';
import { ROUTES } from '@shared/constants/routes';
import { runtimeConfig } from '@shared/config/runtime';

import { ProjectMetadataCard } from './components/ProjectMetadataCard';
import { ProjectPickerCard } from './components/ProjectPickerCard';
import { ProjectValidationIssues } from './components/ProjectValidationIssues';
import { useProjectSelectionStore } from './hooks/useProjectSelection';

/**
 * Step 1 — Project Selection (Milestone 2).
 *
 * Composes the picker, metadata snapshot, and validation issues into the
 * functional first workflow step. The screen owns no domain logic — all
 * file IO and validation lives in the feature's services / store.
 *
 * UX rules:
 *   - The "Continue to Scan" affordance is visible at all times so the
 *     user knows where the flow is heading, but only enabled when a
 *     valid React project is selected.
 *   - We never auto-navigate. The user always confirms with an explicit
 *     click. Trust > delight.
 */
export function ProjectSelectionScreen(): JSX.Element {
  const navigate = useNavigate();

  const status = useProjectSelectionStore((s) => s.status);
  const metadata = useProjectSelectionStore((s) => s.metadata);
  const issues = useProjectSelectionStore((s) => s.issues);
  const selectFolder = useProjectSelectionStore((s) => s.selectFolder);
  const reset = useProjectSelectionStore((s) => s.reset);

  const isValid = status === 'valid' && metadata !== undefined;
  const canContinue = isValid;
  const showMetadata = metadata !== undefined && status !== 'idle' && status !== 'selecting';

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        eyebrow={<StepEyebrow number={1} icon="folder" label="Project" />}
        title="Select a project"
        subtitle="Choose the React 16, React 17, or React 18 project you want to migrate to React 19. The original repository stays read-only throughout the session."
        meta={
          <>
            <Badge tone="success" variant="soft" withDot>
              Read-only safe
            </Badge>
            <Badge tone="neutral" variant="outline">
              No network calls
            </Badge>
            {!runtimeConfig.isTauri ? (
              <Badge tone="warning" variant="soft" withDot>
                Web preview — folder picker disabled
              </Badge>
            ) : null}
          </>
        }
        actions={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={reset}
              disabled={status === 'idle' && metadata === undefined}
            >
              Reset
            </Button>
            <Button
              size="md"
              variant="primary"
              trailingIcon={<Icon name="arrow-right" />}
              disabled={!canContinue}
              onClick={() => navigate(ROUTES.scanner)}
              title={
                canContinue
                  ? 'Continue to the React 19 compatibility scan'
                  : 'Select a valid React 16/17/18 project to continue'
              }
            >
              Continue to Scan
            </Button>
          </>
        }
      />

      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="mx-auto flex max-w-5xl flex-col gap-6">
          <ProjectPickerCard
            status={status}
            {...(metadata?.path !== undefined ? { currentPath: metadata.path } : {})}
            disabled={!runtimeConfig.isTauri}
            onSelectFolder={selectFolder}
            onClear={reset}
          />

          {showMetadata && metadata ? <ProjectMetadataCard metadata={metadata} /> : null}

          <ProjectValidationIssues
            issues={issues}
            {...(isValid ? { emptyLabel: 'All checks passed.' } : {})}
          />

          {!metadata && status === 'idle' ? <PreSelectionGuide /> : null}

          {!runtimeConfig.isTauri ? <WebPreviewNotice /> : null}
        </div>
      </div>
    </div>
  );
}

function PreSelectionGuide(): JSX.Element {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <div>
            <CardTitle>What Migrate Pilot will check</CardTitle>
            <CardDescription>
              Quick React 19 readiness metadata read only. No installs, no scans, no
              scripts run.
            </CardDescription>
          </div>
          <Badge tone="accent" variant="soft" uppercase>
            Local-first
          </Badge>
        </CardHeader>

        <ul className="grid gap-2 text-xs text-ink-muted sm:grid-cols-2">
          <FeatureLine>Reads <code className="font-mono text-[11px]">package.json</code></FeatureLine>
          <FeatureLine>Detects React + React DOM versions</FeatureLine>
          <FeatureLine>Identifies the package manager from lock files</FeatureLine>
          <FeatureLine>Detects TypeScript via <code className="font-mono text-[11px]">tsconfig.json</code></FeatureLine>
          <FeatureLine>Reads current Git branch from <code className="font-mono text-[11px]">.git/HEAD</code></FeatureLine>
          <FeatureLine>Lists known scripts (start, dev, build, test, lint, typecheck)</FeatureLine>
        </ul>
      </Card>

      <Card tone="subtle">
        <CardHeader>
          <div>
            <CardTitle>Won't happen yet</CardTitle>
            <CardDescription>
              These run later in the workflow and require the migration workspace to be
              created first.
            </CardDescription>
          </div>
        </CardHeader>
        <ul className="space-y-2 text-xs text-ink-muted">
          <DontLine>Full source-tree scan</DontLine>
          <DontLine>Dependency installation</DontLine>
          <DontLine>Build / test / lint commands</DontLine>
          <DontLine>Any AI execution</DontLine>
          <DontLine>Any write to the selected folder</DontLine>
        </ul>
      </Card>

      <EmptyState
        className="lg:col-span-3"
        icon="folder"
        fullWidth
        title="No project selected yet"
        description="Pick a local React project folder above to get started."
      />
    </div>
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
          <p className="text-xs font-semibold text-ink">Folder picker not available here</p>
          <p className="mt-1 text-xs leading-relaxed text-ink-muted">
            Migrate Pilot reads local files via the Tauri desktop shell. Run{' '}
            <code className="rounded-xs border border-canvas-border bg-canvas-subtle px-1 py-0.5 font-mono text-[11px] text-ink">
              npm run tauri:dev
            </code>{' '}
            inside <code className="font-mono text-[11px]">apps/desktop</code> to enable
            project selection.
          </p>
        </div>
      </div>
    </Card>
  );
}

function FeatureLine({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <li className="flex items-start gap-2">
      <Icon name="check" className="mt-0.5 h-3 w-3 shrink-0 text-success" />
      <span>{children}</span>
    </li>
  );
}

function DontLine({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <li className="flex items-start gap-2">
      <Icon name="lock" className="mt-0.5 h-3 w-3 shrink-0 text-ink-faint" />
      <span>{children}</span>
    </li>
  );
}
