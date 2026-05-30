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
  DependencyReport,
  DeprecatedPackage,
  ScriptReport,
} from '../types/scanner.types';

/**
 * ScanDependencyCard — runtime + tooling dependency snapshot.
 *
 * Combines the dependency report with the script availability so the user
 * can see at a glance which validation gates (build / test / lint /
 * typecheck) are actually wired up.
 */
export interface ScanDependencyCardProps {
  readonly dependencies: DependencyReport;
  readonly scripts: ScriptReport;
}

export function ScanDependencyCard({
  dependencies,
  scripts,
}: ScanDependencyCardProps): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Dependencies &amp; tooling</CardTitle>
          <CardDescription>
            Resolved from package.json and lockfile fingerprints. No installs ran.
          </CardDescription>
        </div>
        {dependencies.deprecatedPackages.length > 0 ? (
          <Badge tone="danger" variant="soft" withDot>
            {dependencies.deprecatedPackages.length} deprecated
          </Badge>
        ) : (
          <Badge tone="success" variant="soft" withDot>
            No deprecated packages
          </Badge>
        )}
      </CardHeader>

      <CardSection label="React stack">
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <DepField
            label="react"
            version={dependencies.reactVersion}
            tone={dependencies.reactVersion ? 'success' : 'danger'}
          />
          <DepField
            label="react-dom"
            version={dependencies.reactDomVersion}
            tone={dependencies.reactDomVersion ? 'success' : 'neutral'}
          />
          <DepField
            label="react-scripts"
            version={dependencies.reactScriptsVersion}
            tone={dependencies.reactScriptsVersion ? 'info' : 'neutral'}
          />
          <DepField
            label={dependencies.routing.packageName ?? 'react-router'}
            version={dependencies.routing.version}
            tone={dependencies.routing.version ? 'info' : 'neutral'}
          />
          <DepField
            label="typescript"
            version={dependencies.tooling.typescript}
            tone={dependencies.tooling.typescript ? 'success' : 'warning'}
          />
          <DepField
            label="eslint"
            version={dependencies.tooling.eslint}
            tone={dependencies.tooling.eslint ? 'success' : 'warning'}
          />
        </dl>
      </CardSection>

      <CardSection label="Styling">
        <dl className="grid gap-3 sm:grid-cols-2">
          <DepField
            label="node-sass"
            version={dependencies.styling.nodeSassVersion}
            tone={dependencies.styling.usesNodeSass ? 'danger' : 'success'}
            note={
              dependencies.styling.usesNodeSass
                ? 'Deprecated — plan a step to replace with sass.'
                : 'Not present.'
            }
          />
          <DepField
            label="sass"
            version={dependencies.styling.sassVersion}
            tone={dependencies.styling.usesSass ? 'success' : 'neutral'}
            note={
              dependencies.styling.usesSass
                ? 'Modern Dart Sass detected.'
                : 'Not declared.'
            }
          />
        </dl>
      </CardSection>

      <CardSection label="State management">
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <DepField label="redux" version={dependencies.stateManagement.redux} />
          <DepField
            label="@reduxjs/toolkit"
            version={dependencies.stateManagement.reduxToolkit}
          />
          <DepField label="mobx" version={dependencies.stateManagement.mobx} />
          <DepField
            label="zustand"
            version={dependencies.stateManagement.zustand}
          />
        </dl>
      </CardSection>

      <CardSection label="Testing">
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <DepField label="jest" version={dependencies.testing.jest} />
          <DepField
            label="@testing-library/react"
            version={dependencies.testing.testingLibraryReact}
          />
          <DepField label="cypress" version={dependencies.testing.cypress} />
          <DepField
            label="@playwright/test"
            version={dependencies.testing.playwright}
          />
          <DepField label="vitest" version={dependencies.testing.vitest} />
        </dl>
      </CardSection>

      {dependencies.deprecatedPackages.length > 0 ? (
        <CardSection label="Deprecated packages">
          <ul className="space-y-2.5">
            {dependencies.deprecatedPackages.map((pkg) => (
              <DeprecatedRow key={pkg.name} pkg={pkg} />
            ))}
          </ul>
        </CardSection>
      ) : null}

      <CardSection label="Validation scripts">
        <ScriptsRow scripts={scripts} />
      </CardSection>

      <CardSection label="Lockfiles">
        <LockfileRow lockFiles={dependencies.lockFiles} />
      </CardSection>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* helpers                                                                    */
/* -------------------------------------------------------------------------- */

interface DepFieldProps {
  readonly label: string;
  readonly version?: string | undefined;
  readonly tone?: BadgeTone;
  readonly note?: string;
}

function DepField({
  label,
  version,
  tone,
  note,
}: DepFieldProps): JSX.Element {
  const present = version !== undefined;
  const finalTone: BadgeTone = tone ?? (present ? 'info' : 'neutral');
  return (
    <div className="min-w-0">
      <dt className="text-2xs font-medium uppercase tracking-[0.14em] text-ink-subtle">
        {label}
      </dt>
      <dd className="mt-1 flex flex-col gap-1">
        <Badge
          tone={finalTone}
          variant="soft"
          className="max-w-full truncate font-mono"
          title={version ?? 'not declared'}
        >
          {version ?? 'not declared'}
        </Badge>
        {note ? (
          <p className="text-2xs leading-snug text-ink-faint">{note}</p>
        ) : null}
      </dd>
    </div>
  );
}

function DeprecatedRow({ pkg }: { pkg: DeprecatedPackage }): JSX.Element {
  return (
    <li className="rounded-md border border-danger/30 bg-danger-soft px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="danger" variant="soft" className="font-mono">
          {pkg.name}@{pkg.version}
        </Badge>
        {pkg.recommendedReplacement ? (
          <span className="inline-flex items-center gap-1 text-2xs text-ink-muted">
            <Icon name="arrow-right" className="h-3 w-3" />
            replace with{' '}
            <span className="font-mono text-ink">{pkg.recommendedReplacement}</span>
          </span>
        ) : null}
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">{pkg.reason}</p>
    </li>
  );
}

interface ScriptsRowProps {
  readonly scripts: ScriptReport;
}

function ScriptsRow({ scripts }: ScriptsRowProps): JSX.Element {
  const items: ReadonlyArray<{
    readonly key: keyof Omit<ScriptReport, 'raw'>;
    readonly label: string;
    readonly importance: 'critical' | 'recommended' | 'optional';
  }> = [
    { key: 'hasBuild', label: 'build', importance: 'critical' },
    { key: 'hasTest', label: 'test', importance: 'recommended' },
    { key: 'hasLint', label: 'lint', importance: 'recommended' },
    { key: 'hasTypecheck', label: 'typecheck', importance: 'optional' },
    { key: 'hasStart', label: 'start', importance: 'optional' },
    { key: 'hasDev', label: 'dev', importance: 'optional' },
  ];

  return (
    <ul className="grid gap-2 sm:grid-cols-3">
      {items.map((item) => {
        const present = scripts[item.key];
        const tone: BadgeTone = present
          ? 'success'
          : item.importance === 'critical'
            ? 'danger'
            : item.importance === 'recommended'
              ? 'warning'
              : 'neutral';
        return (
          <li
            key={item.key}
            className={cn(
              'flex items-center justify-between gap-3 rounded-md border px-3 py-2',
              present
                ? 'border-canvas-border bg-canvas-subtle-2/40'
                : 'border-dashed border-canvas-border bg-canvas-subtle/30',
            )}
          >
            <Badge tone={tone} variant="soft" uppercase>
              {item.label}
            </Badge>
            <Icon
              name={present ? 'check' : 'cross'}
              className={cn('h-3.5 w-3.5', present ? 'text-success' : 'text-ink-faint')}
            />
          </li>
        );
      })}
    </ul>
  );
}

function LockfileRow({
  lockFiles,
}: {
  readonly lockFiles: readonly string[];
}): JSX.Element {
  if (lockFiles.length === 0) {
    return (
      <p className="flex items-center gap-2 text-xs text-ink-muted">
        <Icon name="help" className="h-3.5 w-3.5 text-warning" />
        No lockfile detected. Reproducible installs are not yet possible.
      </p>
    );
  }
  return (
    <ul className="flex flex-wrap items-center gap-2">
      {lockFiles.map((file) => (
        <li key={file}>
          <Badge tone="info" variant="soft" className="font-mono">
            {file}
          </Badge>
        </li>
      ))}
    </ul>
  );
}
