import { useLanguage } from '@/lib/LanguageContext';
import { FEATURE_FLAGS } from '@/config/features';
import LanguageSwitcher from './LanguageSwitcher';
import SpecialistToggle from './SpecialistToggle';
import { Stethoscope, Brain, HeartPulse, Sparkles, ArrowRight, Compass, BookOpen, BarChart3 } from 'lucide-react';

interface IntroProps {
  onStart: () => void;
  totalQuestions: number;
  isSpecialist: boolean;
  onSpecialistToggle: (value: boolean) => void;
  onOpenExplorer: () => void;
  onOpenMethodology: () => void;
  onOpenDashboard: () => void;
}

export default function Intro({ onStart, totalQuestions, isSpecialist, onSpecialistToggle, onOpenExplorer, onOpenMethodology, onOpenDashboard }: IntroProps) {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-6 py-5 sm:px-10 sm:py-7 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center text-white shadow-soft">
            <Stethoscope className="w-5 h-5" strokeWidth={2.2} />
          </div>
          <span className="font-display text-lg font-semibold tracking-tight text-ink-900">
            {t.appName}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <SpecialistToggle isSpecialist={isSpecialist} onToggle={onSpecialistToggle} />
          <LanguageSwitcher />
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 pb-16">
        <div className="max-w-3xl w-full text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-50 border border-brand-100 text-brand-700 text-xs font-semibold mb-8 animate-fade-in">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{t.forMedicalStudents}</span>
          </div>

          <h1 className="font-display text-4xl sm:text-6xl font-semibold tracking-tight text-ink-900 leading-[1.05] text-balance animate-fade-up">
            {t.heroTitle1}
            <br />
            {t.heroTitle2.split(' ').map((word, i, arr) =>
              i === arr.length - 1 ? (
                <span key={i} className="italic text-brand-600">{word}</span>
              ) : (
                <span key={i}>{word} </span>
              )
            )}
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-ink-500 leading-relaxed max-w-xl mx-auto text-balance animate-fade-up" style={{ animationDelay: '80ms' }}>
            {t.heroSubtitle}
          </p>

          {isSpecialist && (
            <div className="mt-6 mx-auto max-w-xl p-4 rounded-2xl bg-brand-50 border border-brand-100 animate-fade-up" style={{ animationDelay: '100ms' }}>
              <p className="text-sm text-brand-800 leading-relaxed text-balance">
                {t.specialistSubtitle}
              </p>
            </div>
          )}

          <p className="mt-4 text-sm text-ink-400 animate-fade-up" style={{ animationDelay: '120ms' }}>
            {t.questionsCount(totalQuestions)}
          </p>

          <div className="mt-10 flex justify-center animate-fade-up" style={{ animationDelay: '160ms' }}>
            <button
              onClick={onStart}
              className="group inline-flex items-center gap-2.5 px-7 py-4 rounded-full bg-ink-900 text-white font-semibold text-base shadow-lift hover:bg-ink-800 transition-all duration-200 hover:scale-[1.03] active:scale-[0.98]"
            >
              {t.startButton}
              <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>

          <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto animate-fade-up" style={{ animationDelay: '240ms' }}>
            {[
              { icon: Brain, title: t.feature1Title, desc: t.feature1Desc },
              { icon: HeartPulse, title: t.feature2Title, desc: t.feature2Desc },
              { icon: Sparkles, title: t.feature3Title, desc: t.feature3Desc },
            ].map((f) => (
              <div key={f.title} className="p-5 rounded-2xl bg-white border border-ink-100 shadow-soft text-left">
                <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center text-brand-600 mb-3">
                  <f.icon className="w-5 h-5" strokeWidth={2} />
                </div>
                <h3 className="font-semibold text-sm text-ink-900 mb-1">{f.title}</h3>
                <p className="text-sm text-ink-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      <footer className="px-6 py-8 text-center">
        <div className="flex items-center justify-center gap-2 mb-5">
          <button onClick={onOpenExplorer} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold text-ink-500 hover:text-ink-900 hover:bg-ink-100 transition-colors">
            <Compass className="w-3.5 h-3.5" /> {t.navExplorer}
          </button>
          {FEATURE_FLAGS.methodology && (
            <button onClick={onOpenMethodology} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold text-ink-500 hover:text-ink-900 hover:bg-ink-100 transition-colors">
              <BookOpen className="w-3.5 h-3.5" /> {t.navMethodology}
            </button>
          )}
          <button onClick={onOpenDashboard} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold text-ink-500 hover:text-ink-900 hover:bg-ink-100 transition-colors">
            <BarChart3 className="w-3.5 h-3.5" /> Dashboard
          </button>
        </div>
        <p className="text-xs text-ink-400">{t.footerNote}</p>
      </footer>
    </div>
  );
}
