import type { SVGProps } from 'react';

import { cn } from '@shared/utils/cn';

/**
 * Hand-tuned monoline icon set for Migrate Pilot.
 *
 * Goals:
 *   - Zero runtime dependencies; pure inline SVG.
 *   - Consistent 24x24 viewBox, 1.6 stroke width.
 *   - `currentColor` so icons inherit text color (`text-ink`, `text-accent`, …).
 *   - Sized via Tailwind classes on the wrapping element.
 *
 * Add new icons by extending `ICONS` below. Keep paths simple — these are
 * navigational glyphs, not illustrations.
 */
export type IconName =
  | 'folder'
  | 'scan'
  | 'report'
  | 'plan'
  | 'workspace'
  | 'play'
  | 'diff'
  | 'check-circle'
  | 'check'
  | 'cross'
  | 'arrow-right'
  | 'sparkles'
  | 'history'
  | 'settings'
  | 'help'
  | 'shield'
  | 'git-branch'
  | 'rocket'
  | 'logo';

const PATHS: Record<IconName, JSX.Element> = {
  folder: (
    <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h3.4a2 2 0 0 1 1.5.7l1.3 1.5h6.8A2.5 2.5 0 0 1 21 9.7v7.8A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5v-10Z" />
  ),
  scan: (
    <>
      <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" />
      <path d="M4 12h16" />
    </>
  ),
  report: (
    <>
      <path d="M7 3.5h7l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-9.5A1.5 1.5 0 0 1 5.5 19V5A1.5 1.5 0 0 1 7 3.5Z" />
      <path d="M14 3.5V8h4" />
      <path d="M9 13h6M9 16.5h6M9 9.5h2" />
    </>
  ),
  plan: (
    <>
      <path d="M5 5.5h14M5 12h14M5 18.5h14" />
      <circle cx="6" cy="5.5" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="18" cy="18.5" r="1.4" fill="currentColor" stroke="none" />
    </>
  ),
  workspace: (
    <>
      <path d="M4 6.5A1.5 1.5 0 0 1 5.5 5H10v6H4V6.5Z" />
      <path d="M14 5h4.5A1.5 1.5 0 0 1 20 6.5V11h-6V5Z" />
      <path d="M4 13h6v6H5.5A1.5 1.5 0 0 1 4 17.5V13Z" />
      <path d="M14 13h6v4.5a1.5 1.5 0 0 1-1.5 1.5H14v-6Z" />
    </>
  ),
  play: (
    <path d="M8 5.5v13a.7.7 0 0 0 1.06.6l10.5-6.5a.7.7 0 0 0 0-1.2L9.06 4.9A.7.7 0 0 0 8 5.5Z" />
  ),
  diff: (
    <>
      <path d="M9 4.5v15" />
      <path d="M5.5 8H12M5.5 12H10M5.5 16H12" />
      <path d="M15 4.5v15" />
      <path d="M12 8h6.5M14 12h4.5M12 16h6.5" />
    </>
  ),
  'check-circle': (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m8.5 12 2.5 2.5L15.5 10" />
    </>
  ),
  check: <path d="m5.5 12.5 4 4L18.5 7.5" />,
  cross: <path d="M6 6l12 12M18 6 6 18" />,
  'arrow-right': <path d="M5 12h14M13 6l6 6-6 6" />,
  sparkles: (
    <>
      <path d="M12 4v4M12 16v4M4 12h4M16 12h4M6.5 6.5l2.8 2.8M14.7 14.7l2.8 2.8M6.5 17.5l2.8-2.8M14.7 9.3l2.8-2.8" />
    </>
  ),
  history: (
    <>
      <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" />
      <path d="M3.5 4v5h5" />
      <path d="M12 8v4l3 1.5" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="2.8" />
      <path d="M19.4 14.3a1.4 1.4 0 0 0 .3 1.5l.05.06a1.65 1.65 0 1 1-2.33 2.33l-.06-.05a1.4 1.4 0 0 0-1.5-.3 1.4 1.4 0 0 0-.85 1.28V19a1.65 1.65 0 1 1-3.3 0v-.07a1.4 1.4 0 0 0-.93-1.3 1.4 1.4 0 0 0-1.5.3l-.06.05a1.65 1.65 0 1 1-2.33-2.33l.05-.06a1.4 1.4 0 0 0 .3-1.5 1.4 1.4 0 0 0-1.28-.85H5a1.65 1.65 0 1 1 0-3.3h.07a1.4 1.4 0 0 0 1.3-.93 1.4 1.4 0 0 0-.3-1.5l-.05-.06a1.65 1.65 0 1 1 2.33-2.33l.06.05a1.4 1.4 0 0 0 1.5.3h.01a1.4 1.4 0 0 0 .85-1.28V5a1.65 1.65 0 1 1 3.3 0v.07a1.4 1.4 0 0 0 .85 1.28 1.4 1.4 0 0 0 1.5-.3l.06-.05a1.65 1.65 0 1 1 2.33 2.33l-.05.06a1.4 1.4 0 0 0-.3 1.5v.01a1.4 1.4 0 0 0 1.28.85H19a1.65 1.65 0 1 1 0 3.3h-.07a1.4 1.4 0 0 0-1.28.85Z" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.5 9.5a2.5 2.5 0 1 1 3.6 2.25c-.6.3-1.1.9-1.1 1.75V14" />
      <path d="M12 17h.01" />
    </>
  ),
  shield: <path d="M12 3.5 5 6v5.4c0 4 3 7.6 7 9.1 4-1.5 7-5.1 7-9.1V6L12 3.5Z" />,
  'git-branch': (
    <>
      <circle cx="6" cy="6" r="2" />
      <circle cx="6" cy="18" r="2" />
      <circle cx="18" cy="8" r="2" />
      <path d="M6 8v8" />
      <path d="M18 10v.5A4.5 4.5 0 0 1 13.5 15H10a4 4 0 0 0-4 4" />
    </>
  ),
  rocket: (
    <>
      <path d="M14 4c4.5 0 6 1.5 6 6 0 4.5-2 7.5-6 10l-2-2-2 2c-4-2.5-6-5.5-6-10 0-4.5 1.5-6 6-6 1 .5 2 1.5 2 1.5S13 4.5 14 4Z" />
      <circle cx="12" cy="10" r="2" />
      <path d="M8 18c-1 1-1 3-1 3s2 0 3-1" />
      <path d="M16 18c1 1 1 3 1 3s-2 0-3-1" />
    </>
  ),
  logo: (
    <>
      <path d="M4 17V8.5a1.5 1.5 0 0 1 .8-1.32l6.5-3.6a1.5 1.5 0 0 1 1.4 0l6.5 3.6A1.5 1.5 0 0 1 20 8.5V17" />
      <path d="m4 17 8 4 8-4" />
      <path d="M12 12.5v8.5" />
      <path d="m4 12.5 8 4 8-4" />
    </>
  ),
};

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'children'> {
  name: IconName;
  /** Apply a sensible default size (`h-4 w-4`) unless overridden via className. */
  size?: number;
}

export function Icon({ name, size, className, strokeWidth, ...rest }: IconProps): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth ?? 1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={cn(size ? undefined : 'h-4 w-4', className)}
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}
