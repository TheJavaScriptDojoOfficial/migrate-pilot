import type { ReactNode } from 'react';

import { Badge, type BadgeTone } from '@shared/ui/Badge';
import { Card, CardDescription, CardHeader, CardSection, CardTitle } from '@shared/ui/Card';
import { Icon } from '@shared/ui/Icon';
import { cn } from '@shared/utils/cn';

import type { ProjectMetadata } from '../types/projectSelection.types';

/**
 * ProjectMetadataCard — read-only summary of every signal we collected
 * from the selected folder. Mirrors the bullet list in the Milestone 2
 * spec (project name, path, React versions, package manager, Git status,
 * branch, TypeScript status, scripts).
 *
 * No validation logic lives here — the card renders whatever metadata it
 * is given and lets `ProjectValidationIssues` describe blockers separately.
 */
export interface ProjectMetadataCardProps {
  readonly metadata: ProjectMetadata;
}

export function ProjectMetadataCard({
  metadata,
}: ProjectMetadataCardProps): JSX.Element {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Project snapshot</CardTitle>
          <CardDescription>
            Read-only metadata from package.json, lock files, tsconfig.json, and .git/HEAD.
          </CardDescription>
        </div>
        <Badge tone={metadata.reactVersion ? 'success' : 'neutral'} variant="soft" withDot>
          {metadata.reactVersion ? 'React detected' : 'React missing'}
        </Badge>
      </CardHeader>

      <CardSection label="Identity">
        <dl className="grid gap-3 sm:grid-cols-2">
          <Field label="Project name" value={metadata.name} mono={false} />
          <Field label="Selected path" value={metadata.path} mono />
        </dl>
      </CardSection>

      <CardSection label="Runtime">
        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field
            label="React"
            value={metadata.reactVersion ?? 'not found'}
            tone={metadata.reactVersion ? 'success' : 'danger'}
            mono
          />
          <Field
            label="React DOM"
            value={metadata.reactDomVersion ?? '—'}
            tone={metadata.reactDomVersion ? 'success' : 'neutral'}
            mono
          />
          <Field
            label="Package manager"
            value={metadata.packageManager}
            tone={metadata.packageManager === 'unknown' ? 'warning' : 'info'}
          />
          <Field
            label="TypeScript"
            value={metadata.hasTypeScript ? 'present' : 'not present'}
            tone={metadata.hasTypeScript ? 'success' : 'warning'}
          />
          <Field
            label="Git repository"
            value={metadata.isGitRepository ? 'detected' : 'not detected'}
            tone={metadata.isGitRepository ? 'success' : 'warning'}
          />
          <Field
            label="Current branch"
            value={metadata.currentBranch ?? '—'}
            tone={metadata.currentBranch ? 'info' : 'neutral'}
            mono
            icon={metadata.currentBranch ? <Icon name="git-branch" className="h-3 w-3" /> : null}
          />
        </dl>
      </CardSection>

      <CardSection label="Available scripts">
        <Scripts scripts={metadata.scripts} />
      </CardSection>
    </Card>
  );
}

interface FieldProps {
  readonly label: string;
  readonly value: string;
  readonly tone?: BadgeTone;
  readonly mono?: boolean;
  readonly icon?: ReactNode;
}

function Field({ label, value, tone = 'neutral', mono, icon }: FieldProps): JSX.Element {
  return (
    <div>
      <dt className="text-2xs font-medium uppercase tracking-[0.14em] text-ink-subtle">
        {label}
      </dt>
      <dd className="mt-1 flex items-center gap-1.5">
        {icon}
        <Badge
          tone={tone}
          variant="soft"
          className={cn(
            'max-w-full truncate',
            mono ? 'font-mono' : undefined,
          )}
          title={value}
        >
          {value}
        </Badge>
      </dd>
    </div>
  );
}

const SCRIPT_KEYS = ['start', 'dev', 'build', 'test', 'lint', 'typecheck'] as const;

function Scripts({
  scripts,
}: {
  readonly scripts: ProjectMetadata['scripts'];
}): JSX.Element {
  const present = SCRIPT_KEYS.filter((k) => Boolean(scripts[k]));
  if (present.length === 0) {
    return (
      <p className="flex items-center gap-2 text-xs text-ink-muted">
        <Icon name="help" className="h-3.5 w-3.5 text-warning" />
        No recognised scripts (start, dev, build, test, lint, typecheck) found in
        package.json.
      </p>
    );
  }
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {SCRIPT_KEYS.map((key) => (
        <ScriptRow key={key} name={key} command={scripts[key]} />
      ))}
    </ul>
  );
}

function ScriptRow({
  name,
  command,
}: {
  readonly name: string;
  readonly command: string | undefined;
}): JSX.Element {
  const present = command !== undefined;
  return (
    <li
      className={cn(
        'flex items-center justify-between gap-3 rounded-md border px-3 py-2',
        present
          ? 'border-canvas-border bg-canvas-subtle-2/40'
          : 'border-dashed border-canvas-border bg-canvas-subtle/30',
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <Badge tone={present ? 'info' : 'neutral'} variant="soft" uppercase>
          {name}
        </Badge>
        {present ? (
          <code className="truncate font-mono text-xs text-ink-muted" title={command}>
            {command}
          </code>
        ) : (
          <span className="text-xs text-ink-faint">not defined</span>
        )}
      </div>
      <Icon
        name={present ? 'check' : 'cross'}
        className={cn('h-3.5 w-3.5', present ? 'text-success' : 'text-ink-faint')}
      />
    </li>
  );
}
