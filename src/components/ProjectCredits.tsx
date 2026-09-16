import { Heart, MessageCircle, Stethoscope } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import LanguageSwitcher from './LanguageSwitcher';
import PageBackButton from './PageBackButton';
import BrandLogo from './BrandLogo';

export default function ProjectCredits({ onBack }: { onBack: () => void }) {
  const { t } = useLanguage();
  return (
    <div className="min-h-screen bg-accent-50">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-ink-100 bg-white/90 px-6 py-5 backdrop-blur sm:px-10">
        <PageBackButton onClick={onBack} label={t.back} />
        <LanguageSwitcher />
      </header>
      <main className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
        <BrandLogo variant="stacked" className="mb-10 w-56 sm:w-64" label={t.appName} />
        <p className="mb-3 text-sm font-semibold text-brand-700">{t.navCredits}</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink-900 text-balance sm:text-4xl">{t.creditsTitle}</h1>
        <p className="mt-4 text-lg leading-relaxed text-ink-500">{t.creditsSubtitle}</p>
        <section className="mt-10 rounded-3xl border border-brand-100 bg-white p-7 shadow-soft sm:p-9">
          <Heart className="mb-4 h-7 w-7 text-brand-600" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-brand-700">{t.creditsMotivationTitle}</h2>
          <p className="mt-3 font-display text-2xl leading-snug text-ink-900 sm:text-3xl">{t.creditsMotivation}</p>
          <p className="mt-5 leading-relaxed text-ink-600">{t.creditsMotivationDescription}</p>
        </section>
        <div className="mt-8 space-y-8">
          {[
            { Icon: Stethoscope, title: t.creditsPerspectiveTitle, description: t.creditsPerspectiveDescription },
            { Icon: MessageCircle, title: t.creditsCommunityTitle, description: t.creditsCommunityDescription },
          ].map(({ Icon, title, description }) => (
            <section key={title}>
              <h2 className="flex items-center gap-3 font-display text-xl font-semibold text-ink-900">
                <Icon className="h-5 w-5 shrink-0 text-brand-600" aria-hidden="true" />{title}
              </h2>
              <p className="mt-3 leading-relaxed text-ink-600">{description}</p>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
