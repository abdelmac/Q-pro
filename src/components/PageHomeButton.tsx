import { Home } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';

interface PageHomeButtonProps {
  onClick: () => void;
  disabled?: boolean;
  current?: boolean;
}

export default function PageHomeButton({ onClick, disabled = false, current = false }: PageHomeButtonProps) {
  const { t } = useLanguage();
  return (
    <button
      type="button"
      data-navigation-home
      onClick={onClick}
      disabled={disabled}
      aria-current={current ? 'page' : undefined}
      className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-brand-100 bg-brand-50 px-3 text-sm font-medium text-brand-800 transition-colors hover:border-brand-300 hover:bg-brand-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <Home aria-hidden="true" className="h-4 w-4 shrink-0" />
      <span>{t.home}</span>
    </button>
  );
}
