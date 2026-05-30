import { Badge } from '@shared/ui/Badge';
import { Card, CardDescription, CardHeader, CardSection, CardTitle } from '@shared/ui/Card';
import { Icon } from '@shared/ui/Icon';

import {
  CLEANLINESS_LABEL,
  CLEANLINESS_TONE,
  STRATEGY_DESCRIPTION,
  STRATEGY_ICON,
  STRATEGY_LABEL,
  STRATEGY_TONE,
} from '../services/workspacePresentationService';
import type { WorkspacePreflight } from '../types/workspace.types';

/**
 * WorkspaceStrategyCard — explains which strategy was selected and why.
 *
 * The card surfaces enough context for the user to understand whether the
 * Git worktree path is in play (and what it implies) or whether the copy
 * fallback would be considered. The strategy is read-only here — preflight
 * decides which strategy is recommended.
 */
export interface WorkspaceStrategyCardProps {
  readonly preflight: WorkspacePreflight;
}

export function WorkspaceStrategyCard({
  preflight,
}: WorkspaceStrategyCardProps): JSX.Element {
  const { recommendedStrategy, fallbackAvailable, gitAvailable, isGitRepository, gitCleanliness, currentBranch } = preflight;

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Selected strategy</CardTitle>
          <CardDescription>
            {STRATEGY_DESCRIPTION[recommendedStrategy]}
          </CardDescription>
        </div>
        <Badge tone={STRATEGY_TONE[recommendedStrategy]} variant="soft" withDot>
          <Icon name={STRATEGY_ICON[recommendedStrategy]} className="h-3 w-3" />
          {STRATEGY_LABEL[recommendedStrategy]}
        </Badge>
      </CardHeader>

      <CardSection label="Git signals">
        <dl className="grid grid-cols-1 gap-4 text-xs sm:grid-cols-2">
          <Item
            label="Git available"
            tone={gitAvailable ? 'success' : 'danger'}
            value={gitAvailable ? 'Yes' : 'No'}
          />
          <Item
            label="Git repository"
            tone={isGitRepository ? 'success' : 'warning'}
            value={isGitRepository ? 'Yes' : 'No'}
          />
          <Item
            label="Working tree"
            tone={CLEANLINESS_TONE[gitCleanliness]}
            value={CLEANLINESS_LABEL[gitCleanliness]}
          />
          <Item
            label="Current branch"
            tone="neutral"
            value={currentBranch ?? 'Unknown'}
            mono={currentBranch !== undefined}
          />
        </dl>
      </CardSection>

      <CardSection label="Fallback availability">
        <p className="text-xs leading-relaxed text-ink-muted">
          {fallbackAvailable
            ? 'A copy-based fallback is available if the Git worktree path is unsuitable. It will only be used after explicit confirmation.'
            : 'The copy-based fallback is preflighted but disabled in V1. If the Git worktree strategy is unavailable, workspace creation cannot proceed in this version.'}
        </p>
      </CardSection>
    </Card>
  );
}

import type { BadgeTone } from '@shared/ui/Badge';

function Item({
  label,
  value,
  tone,
  mono,
}: {
  readonly label: string;
  readonly value: string;
  readonly tone: BadgeTone;
  readonly mono?: boolean;
}): JSX.Element {
  return (
    <div>
      <dt className="text-2xs font-medium uppercase tracking-[0.12em] text-ink-subtle">
        {label}
      </dt>
      <dd className="mt-1.5">
        <Badge tone={tone} variant="soft">
          <span className={mono === true ? 'font-mono' : undefined}>{value}</span>
        </Badge>
      </dd>
    </div>
  );
}
