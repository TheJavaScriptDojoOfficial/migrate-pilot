import { NavLink, useLocation } from 'react-router-dom';

import { Icon, type IconName } from '@shared/ui/Icon';
import { ROUTES } from '@shared/constants/routes';
import { cn } from '@shared/utils/cn';

/**
 * ActivityRail — narrow far-left "VS Code style" rail.
 *
 * Per DESIGN.md → "Navigation Rails": 48-64px vertical bar on the far
 * left for top-level surfaces. Each entry is an icon-only nav button
 * with an active-state indicator (left-edge 2px accent). Tooltips are
 * rendered as native `title` attributes — we'll graduate to floating
 * tooltips when we add an overlay primitive.
 *
 * V1 surfaces are:
 *   - Workflow  → active when on any workflow route
 *   - History   → planned (sessions list)
 *   - Settings  → planned
 *   - Help      → planned
 */
interface RailItem {
  readonly id: string;
  readonly label: string;
  readonly icon: IconName;
  readonly to?: string;
  readonly matches?: readonly string[];
  readonly disabled?: boolean;
}

/**
 * Workflow rail item matches any path that belongs to the V1 migration
 * journey. Non-workflow surfaces (e.g. Settings) must be excluded so the
 * rail correctly switches the active indicator when the user opens them.
 */
const WORKFLOW_PATHS: readonly string[] = [
  ROUTES.projectSelection,
  ROUTES.scanner,
  ROUTES.scanReport,
  ROUTES.migrationPlan,
  ROUTES.workspace,
  ROUTES.execution,
  ROUTES.diffReview,
  ROUTES.summary,
];

const PRIMARY_ITEMS: readonly RailItem[] = [
  {
    id: 'workflow',
    label: 'Workflow',
    icon: 'rocket',
    to: ROUTES.projectSelection,
    matches: WORKFLOW_PATHS,
  },
  {
    id: 'history',
    label: 'Session history',
    icon: 'history',
    disabled: true,
  },
];

const SECONDARY_ITEMS: readonly RailItem[] = [
  { id: 'help', label: 'Documentation', icon: 'help', disabled: true },
  { id: 'settings', label: 'Settings', icon: 'settings', to: ROUTES.settings },
];

export function ActivityRail(): JSX.Element {
  const { pathname } = useLocation();
  return (
    <aside
      aria-label="Application activity bar"
      className="flex w-14 shrink-0 flex-col items-center justify-between border-r border-canvas-border bg-canvas-subtle py-3"
    >
      <div className="flex flex-col items-center gap-1.5">
        <BrandMark />
        <span className="my-2 h-px w-6 bg-canvas-border" aria-hidden />
        {PRIMARY_ITEMS.map((item) => (
          <RailButton key={item.id} item={item} pathname={pathname} />
        ))}
      </div>

      <div className="flex flex-col items-center gap-1.5">
        {SECONDARY_ITEMS.map((item) => (
          <RailButton key={item.id} item={item} pathname={pathname} />
        ))}
      </div>
    </aside>
  );
}

function BrandMark(): JSX.Element {
  return (
    <span
      aria-label="Migrate Pilot"
      className="mb-1 flex h-9 w-9 items-center justify-center rounded-md border border-accent/30 bg-accent/10 text-accent shadow-[0_0_0_1px_rgba(88,166,255,0.18)_inset]"
    >
      <Icon name="logo" className="h-5 w-5" strokeWidth={1.7} />
    </span>
  );
}

interface RailButtonProps {
  item: RailItem;
  pathname: string;
}

function RailButton({ item, pathname }: RailButtonProps): JSX.Element {
  if (item.disabled || !item.to) {
    return (
      <button
        type="button"
        disabled
        title={`${item.label} (coming soon)`}
        className="group relative flex h-9 w-9 items-center justify-center rounded-md text-ink-faint hover:text-ink-faint disabled:cursor-not-allowed"
      >
        <Icon name={item.icon} className="h-[18px] w-[18px]" />
      </button>
    );
  }

  const active = isItemActive(item, pathname);

  return (
    <NavLink
      to={item.to}
      title={item.label}
      end={false}
      className={cn(
        'group relative flex h-9 w-9 items-center justify-center rounded-md transition-colors',
        'focus-visible:outline-none focus-visible:shadow-focus',
        active
          ? 'bg-canvas-raised text-ink'
          : 'text-ink-subtle hover:bg-canvas-raised hover:text-ink',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'absolute inset-y-1 left-0 w-0.5 rounded-r-md',
          active ? 'bg-accent' : 'bg-transparent',
        )}
      />
      <Icon name={item.icon} className="h-[18px] w-[18px]" />
    </NavLink>
  );
}

function isItemActive(item: RailItem, pathname: string): boolean {
  if (item.matches && item.matches.length > 0) {
    return item.matches.some((m) => pathname === m || pathname.startsWith(`${m}/`));
  }
  if (!item.to) return false;
  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}
