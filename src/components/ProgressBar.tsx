import { useLanguage } from '@/lib/LanguageContext';

interface ProgressBarProps {
  current: number;
  total: number;
}

export default function ProgressBar({ current, total }: ProgressBarProps) {
  const { t } = useLanguage();
  const pct = Math.min(100, (current / total) * 100);
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2 text-xs font-medium text-ink-500">
        <span>{t.step(current, total)}</span>
        <span>{Math.round(pct)}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-ink-100 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-600 transition-all duration-500 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
