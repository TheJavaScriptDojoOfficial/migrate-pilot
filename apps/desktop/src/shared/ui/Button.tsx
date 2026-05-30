import { Children, cloneElement, forwardRef, isValidElement } from 'react';
import type { ButtonHTMLAttributes, ReactElement } from 'react';

import { cn } from '@shared/utils/cn';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /**
   * Render as the single child element instead of a <button>.
   * Useful for wrapping a router <Link>.
   */
  asChild?: boolean;
  loading?: boolean;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-accent text-white hover:bg-accent-hover disabled:bg-accent/50 border border-transparent',
  secondary:
    'bg-canvas-raised text-ink border border-canvas-border hover:bg-canvas-border disabled:opacity-50',
  ghost: 'bg-transparent text-ink hover:bg-canvas-raised border border-transparent',
  danger: 'bg-danger text-white hover:bg-red-600 border border-transparent disabled:opacity-50',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-7 px-2.5 text-xs gap-1.5',
  md: 'h-8 px-3 text-sm gap-2',
};

const BASE_CLASSES =
  'inline-flex select-none items-center justify-center rounded-md font-medium tracking-tight transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:cursor-not-allowed';

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', asChild, className, loading, children, ...rest },
  ref,
) {
  const classes = cn(BASE_CLASSES, VARIANT_CLASSES[variant], SIZE_CLASSES[size], className);

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
      {loading ? <span className="opacity-70">…</span> : children}
    </button>
  );
});
