import type { ButtonHTMLAttributes } from 'react';
import { ArrowLeft } from 'lucide-react';

export interface PageBackButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'type'> {
  label: string;
}

/**
 * Shared, touch-friendly previous-page control.
 *
 * Navigation remains the responsibility of the parent through `onClick`, so
 * the same control can be used with the application navigation stack, modal
 * close actions, or a dashboard tab history.
 */
export default function PageBackButton({
  label,
  className = '',
  ...buttonProps
}: PageBackButtonProps) {
  return (
    <button
      {...buttonProps}
      type="button"
      data-navigation-back
      className={`inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-medium text-ink-600 transition-colors hover:bg-ink-100 hover:text-ink-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
    >
      <ArrowLeft aria-hidden="true" className="h-4 w-4 shrink-0" />
      <span>{label}</span>
    </button>
  );
}
