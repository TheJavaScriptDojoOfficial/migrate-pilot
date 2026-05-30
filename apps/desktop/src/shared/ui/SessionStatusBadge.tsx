import { Icon, type IconName } from '@shared/ui/Icon';
import { useSessionStore } from '@shared/hooks/useSessionState';

/**
 * Compact "what project am I working on?" badge for the app TitleBar.
 *
 * Milestone 1 reality: there is no real project picker yet. When the
 * session store has no project, render a clearly-empty placeholder so
 * the user always sees *where the project name will appear*. Once the
 * Phase 2 folder picker lands, the same component will surface the
 * selected project + active workspace branch with zero changes here.
 */
export function SessionStatusBadge(): JSX.Element {
  const project = useSessionStore((s) => s.project);
  const session = useSessionStore((s) => s.session);

  if (!project) {
    return (
      <StatusChip
        icon="folder"
        tone="muted"
        label="No project selected"
        hint="Pick one in step 01"
      />
    );
  }

  return (
    <StatusChip
      icon="folder"
      tone="active"
      label={project.name}
      hint={session?.branchName ?? project.path}
    />
  );
}

interface StatusChipProps {
  readonly icon: IconName;
  readonly tone: 'muted' | 'active';
  readonly label: string;
  readonly hint?: string;
}

function StatusChip({ icon, tone, label, hint }: StatusChipProps): JSX.Element {
  const isActive = tone === 'active';
  return (
    <span
      className={
        'flex max-w-[24rem] items-center gap-2 rounded-xs border px-2 py-1 ' +
        (isActive
          ? 'border-accent/30 bg-accent/10 text-ink'
          : 'border-canvas-border bg-canvas-overlay text-ink-muted')
      }
    >
      <Icon
        name={icon}
        className={'h-3 w-3 shrink-0 ' + (isActive ? 'text-accent' : 'text-ink-subtle')}
      />
      <span className="min-w-0 truncate text-xs font-medium tracking-tight">{label}</span>
      {hint ? (
        <span className="hidden min-w-0 truncate font-mono text-[10px] text-ink-subtle md:inline">
          {hint}
        </span>
      ) : null}
    </span>
  );
}
