import { Children, cloneElement, forwardRef, isValidElement } from 'react';
import type { ButtonHTMLAttributes, ReactElement, ReactNode } from 'react';

import { cn } from '@shared/utils/cn';

/**
 * Button — design-system primitive matching DESIGN.md spec.
 *
 * Variants:
 *   - `primary`   Solid accent on accent-contrast text. The default CTA.
 *   - `secondary` Surface-tinted with hairline border. The reversible action.
 *   - `ghost`     No fill, hover only. Used in toolbars and inline contexts.
 *   - `danger`    Destructive solid. Reserved for irreversible operations.
 *   - `outline`   Accent-bordered transparent fill. Quiet emphasis.
 *
 * Sizes are rendered as fixed-height pill rects to fit dense IDE toolbars.
 */
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type ButtonSize = 'xs' | 'sm' | 'md';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Render as the single child element instead of a <button>; useful for <Link>. */
  asChild?: boolean;
  loading?: boolean;
  /** Optional leading visual (e.g. `<Icon />`). Sized automatically. */
  leadingIcon?: ReactNode;
  /** Optional trailing visual (e.g. arrow on "Continue" buttons). */
  trailingIcon?: ReactNode;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: [
    'bg-accent text-ink-inverse border border-transparent',
    'hover:bg-accent-hover',
    'active:bg-accent-press',
    'disabled:bg-accent/40 disabled:text-ink-inverse/60',
  ].join(' '),
  secondary: [
    'bg-canvas-raised text-ink border border-canvas-border-strong',
    'hover:bg-canvas-bright hover:border-canvas-border-emphasis',
    'active:bg-canvas-overlay',
    'disabled:opacity-50',
  ].join(' '),
  ghost: [
    'bg-transparent text-ink-muted border border-transparent',
    'hover:bg-canvas-raised hover:text-ink',
    'active:bg-canvas-overlay',
    'disabled:opacity-50',
  ].join(' '),
  outline: [
    'bg-transparent text-accent border border-accent/60',
    'hover:bg-accent/10 hover:border-accent',
    'active:bg-accent/15',
    'disabled:opacity-50',
  ].join(' '),
  danger: [
    'bg-danger text-white border border-transparent',
    'hover:bg-danger/90',
    'active:bg-danger/80',
    'disabled:opacity-50',
  ].join(' '),
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  xs: 'h-7 px-2 text-2xs gap-1.5 rounded-xs',
  sm: 'h-8 px-2.5 text-xs gap-1.5 rounded-md',
  md: 'h-9 px-3.5 text-xs gap-2 rounded-md',
};

const BASE_CLASSES = [
  'inline-flex select-none items-center justify-center',
  'font-medium tracking-tight whitespace-nowrap',
  'transition-[background-color,border-color,color,box-shadow]',
  'duration-150 ease-out-quint',
  'focus-visible:outline-none',
  'focus-visible:shadow-focus',
  'disabled:cursor-not-allowed',
].join(' ');

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    asChild,
    className,
    loading,
    leadingIcon,
    trailingIcon,
    children,
    ...rest
  },
  ref,
) {
  const classes = cn(BASE_CLASSES, VARIANT_CLASSES[variant], SIZE_CLASSES[size], className);

  const content = (
    <>
      {loading ? (
        <Spinner />
      ) : leadingIcon ? (
        <span className="-ml-0.5 inline-flex h-3.5 w-3.5 items-center justify-center [&_svg]:h-full [&_svg]:w-full">
          {leadingIcon}
        </span>
      ) : null}
      {children ? <span className="truncate">{children}</span> : null}
      {!loading && trailingIcon ? (
        <span className="-mr-0.5 inline-flex h-3.5 w-3.5 items-center justify-center [&_svg]:h-full [&_svg]:w-full">
          {trailingIcon}
        </span>
      ) : null}
    </>
  );

  if (asChild) {
    const child = Children.only(children);
    if (!isValidElement(child)) {
      throw new Error('<Button asChild> requires a single React element child.');
    }
    const childProps = (child.props as { className?: string }) ?? {};
    return cloneElement(child as ReactElement<{ className?: string }>, {
      className: cn(classes, childProps.className),
    });
  }

  return (
    <button ref={ref} className={classes} aria-busy={loading || undefined} {...rest}>
      {content}
    </button>
  );
});

function Spinner(): JSX.Element {
  return (
    <svg
      className="h-3.5 w-3.5 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
