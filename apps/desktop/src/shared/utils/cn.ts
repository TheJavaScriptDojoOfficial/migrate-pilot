import clsx, { type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Concatenate Tailwind class strings safely and resolve conflicts.
 *
 * Usage: cn('p-2', condition && 'bg-red-500', extraClassName)
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
