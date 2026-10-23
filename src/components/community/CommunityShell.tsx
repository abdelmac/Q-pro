import type { ReactNode } from 'react';
import BrandLogo from '@/components/BrandLogo';
import PageBackButton from '@/components/PageBackButton';
import PageHomeButton from '@/components/PageHomeButton';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { useLanguage } from '@/lib/LanguageContext';
import { COMMUNITY_COPY } from '@/data/communityI18n';

export const FIELD = 'mt-2 block min-h-12 w-full min-w-0 rounded-xl border border-ink-200 bg-white px-3 py-3 text-base text-ink-900 focus:outline-none focus:ring-2 focus:ring-brand-400 disabled:opacity-50';
export const PRIMARY = 'inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-brand-800 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40';
export const SECONDARY = 'inline-flex min-h-11 items-center justify-center rounded-full border border-ink-200 bg-white px-4 py-2 text-sm font-medium text-ink-700 hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-40';
export const CARD = 'rounded-2xl border border-ink-100 bg-white p-5 shadow-soft sm:p-7';

export default function CommunityShell({ title, subtitle, onBack, onHome, children }: {
  title: string; subtitle?: string; onBack: () => void; onHome: () => void; children: ReactNode;
}) {
  const { lang } = useLanguage();
  return <div className="min-h-screen bg-accent-50">
    <header className="border-b border-ink-100 bg-white px-4 py-4 sm:px-8">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2"><PageBackButton onClick={onBack} label={COMMUNITY_COPY[lang].back} /><PageHomeButton onClick={onHome} /><BrandLogo variant="mark" className="w-9 sm:hidden" /><BrandLogo className="hidden w-44 sm:block" /></div>
        <LanguageSwitcher />
      </div>
    </header>
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-8 sm:py-12">
      <h1 className="font-display text-3xl font-semibold tracking-tight text-ink-900 sm:text-4xl">{title}</h1>
      {subtitle && <p className="mt-3 max-w-3xl text-base leading-7 text-ink-600">{subtitle}</p>}
      <div className="mt-7">{children}</div>
    </main>
  </div>;
}
