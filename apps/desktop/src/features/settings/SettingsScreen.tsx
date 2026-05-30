import type { ReactNode } from 'react';

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
import { Icon, type IconName } from '@shared/ui/Icon';
import { PageHeader } from '@shared/ui/PageHeader';
import { APP_NAME, APP_VERSION, LOCAL_DATA_DIR_NAME } from '@shared/constants/app';

/**
 * Settings — non-workflow surface reached from the ActivityRail.
 *
 * V1 settings are deliberately small (per dev plan Phase 10):
 *   - AI provider selection
 *   - Default workspace location
 *   - Validation auto-run + commit-per-step toggles
 *   - Log retention
 *
 * Milestone 1 ships the read-only shell only. All controls are disabled
 * until the relevant orchestrator services are wired up.
 */
export function SettingsScreen(): JSX.Element {
  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Settings"
        subtitle="Local preferences for the orchestrator. All values stay on your machine."
        meta={
          <>
            <Badge tone="success" variant="soft" withDot>
              Local-first
            </Badge>
            <Badge tone="neutral" variant="outline">
              No telemetry
            </Badge>
          </>
        }
        actions={
          <Button variant="ghost" size="sm" disabled>
            Reset to defaults
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="mx-auto flex max-w-4xl flex-col gap-6">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>AI provider</CardTitle>
                <CardDescription>
                  Migrate Pilot talks to one provider at a time through an adapter.
                  Provider selection is locked until the adapter layer is wired in
                  Phase 6.
                </CardDescription>
              </div>
              <Badge tone="info" variant="soft">
                Adapter layer pending
              </Badge>
            </CardHeader>

            <CardSection label="Provider">
              <SettingRow
                icon="sparkles"
                title="Provider adapter"
                description="OpenCode CLI is the V1 default. Cursor CLI and Claude API adapters are planned."
                control={<Badge tone="neutral">OpenCode CLI</Badge>}
              />
            </CardSection>

            <CardSection label="Model">
              <SettingRow
                icon="report"
                title="Default model"
                description="Used as the fallback when a step does not override the model."
                control={<Badge tone="neutral">—</Badge>}
              />
              <SettingRow
                icon="plan"
                title="Max context size"
                description="Per-prompt token ceiling enforced by the prompt builder."
                control={<Badge tone="neutral">—</Badge>}
              />
            </CardSection>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Workspace defaults</CardTitle>
                <CardDescription>
                  Where new Git worktrees are created. The original project is
                  always read-only — these paths only affect the isolated
                  workspace.
                </CardDescription>
              </div>
            </CardHeader>

            <CardSection label="Locations">
              <SettingRow
                icon="folder"
                title="Workspace root"
                description="New worktrees are created under this directory."
                control={
                  <code className="rounded-xs border border-canvas-border bg-canvas-subtle px-2 py-1 font-mono text-2xs text-ink-muted">
                    ~/LegacyModernizer/workspaces
                  </code>
                }
              />
              <SettingRow
                icon="report"
                title="Local data directory"
                description="Sessions, logs, scan reports, and validation artifacts."
                control={
                  <code className="rounded-xs border border-canvas-border bg-canvas-subtle px-2 py-1 font-mono text-2xs text-ink-muted">
                    ~/{LOCAL_DATA_DIR_NAME}
                  </code>
                }
              />
            </CardSection>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>Execution behaviour</CardTitle>
                <CardDescription>
                  Toggles that affect how steps are run and committed. Every
                  default is conservative — Migrate Pilot never auto-commits a
                  failing step.
                </CardDescription>
              </div>
            </CardHeader>

            <CardSection label="Validation">
              <SettingRow
                icon="check-circle"
                title="Auto-run validation"
                description="Run lint, typecheck, and test after each step."
                control={<ToggleStub state="on" />}
              />
              <SettingRow
                icon="git-branch"
                title="One commit per step"
                description="Commit every approved step to the migration branch."
                control={<ToggleStub state="on" />}
              />
              <SettingRow
                icon="report"
                title="Show token & cost estimates"
                description="Surface provider cost telemetry when available."
                control={<ToggleStub state="off" />}
              />
            </CardSection>

            <CardSection label="Retention">
              <SettingRow
                icon="history"
                title="Log retention"
                description="How long to keep step logs and validation output on disk."
                control={<Badge tone="neutral">30 days</Badge>}
              />
            </CardSection>
          </Card>

          <Card tone="subtle">
            <CardHeader>
              <div>
                <CardTitle>About</CardTitle>
                <CardDescription>Build and runtime information.</CardDescription>
              </div>
            </CardHeader>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-xs sm:grid-cols-3">
              <AboutField label="App" value={APP_NAME} />
              <AboutField label="Version" value={`v${APP_VERSION}`} />
              <AboutField label="Mode" value="Local-first" />
              <AboutField label="Telemetry" value="Disabled" />
              <AboutField label="Account" value="None" />
              <AboutField label="Cloud sync" value="None" />
            </dl>
          </Card>

          <EmptyState
            icon="settings"
            title="No editable settings yet"
            description="Controls become interactive as their backing services land in later milestones."
            fullWidth
          />
        </div>
      </div>
    </div>
  );
}

interface SettingRowProps {
  readonly icon: IconName;
  readonly title: string;
  readonly description: string;
  readonly control: ReactNode;
}

function SettingRow({ icon, title, description, control }: SettingRowProps): JSX.Element {
  return (
    <div className="flex items-start justify-between gap-4 py-3 [&+&]:border-t [&+&]:border-canvas-border">
      <div className="flex items-start gap-3 min-w-0">
        <span
          aria-hidden
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xs border border-canvas-border bg-canvas-subtle text-ink-subtle"
        >
          <Icon name={icon} className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium text-ink">{title}</p>
          <p className="mt-0.5 text-2xs leading-relaxed text-ink-muted">{description}</p>
        </div>
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}

/**
 * ToggleStub — static, non-interactive switch for the Milestone 1 shell.
 * Replaced with a real Switch primitive when execution settings land.
 */
function ToggleStub({ state }: { readonly state: 'on' | 'off' }): JSX.Element {
  const on = state === 'on';
  return (
    <span
      role="switch"
      aria-checked={on}
      aria-disabled="true"
      title="Editable once execution settings are wired"
      className={
        'inline-flex h-5 w-9 cursor-not-allowed items-center rounded-full border border-canvas-border-strong px-0.5 transition-colors ' +
        (on ? 'bg-accent/30' : 'bg-canvas-subtle')
      }
    >
      <span
        className={
          'h-3.5 w-3.5 rounded-full bg-ink-muted shadow-sm transition-transform ' +
          (on ? 'translate-x-4 bg-accent' : 'translate-x-0')
        }
      />
    </span>
  );
}

function AboutField({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div>
      <dt className="text-2xs font-medium uppercase tracking-[0.12em] text-ink-subtle">
        {label}
      </dt>
      <dd className="mt-1 font-mono text-xs text-ink-muted">{value}</dd>
    </div>
  );
}
