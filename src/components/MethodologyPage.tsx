import { useLanguage } from '@/lib/LanguageContext';
import {
  ArrowLeft, BookOpen, Brain, Calculator, ClipboardList, Database,
  FlaskConical, AlertTriangle, FileText, ShieldAlert, Layers,
  Sliders, ShieldCheck, Code, Lightbulb, Heart, BarChart3,
} from 'lucide-react';

interface MethodologyPageProps {
  onBack: () => void;
}

export default function MethodologyPage({ onBack }: MethodologyPageProps) {
  const { t } = useLanguage();

  const sections = [
    { icon: ClipboardList, title: t.methodologyQuestionnaire, desc: t.methodologyQuestionnaireDesc },
    { icon: Brain, title: t.methodologyTraitModel, desc: t.methodologyTraitModelDesc },
    { icon: Calculator, title: t.methodologyScoring, desc: t.methodologyScoringDesc },
    { icon: Database, title: t.methodologyProfiles, desc: t.methodologyProfilesDesc },
    { icon: FlaskConical, title: t.methodologyCalibration, desc: t.methodologyCalibrationDesc },
    { icon: FileText, title: t.methodologyValidation, desc: t.methodologyValidationDesc },
  ];

  const detailSections = [
    { icon: Lightbulb, title: t.methodologyOverview, desc: t.methodologyOverviewDesc },
    { icon: ClipboardList, title: t.methodologyQuestionnaireStructure, desc: t.methodologyQuestionnaireStructureDesc },
    { icon: Brain, title: t.methodologyTraitModelDetailed, desc: t.methodologyTraitModelDetailedDesc },
    { icon: Calculator, title: t.methodologyScoringFormula, desc: t.methodologyScoringFormulaDesc },
    { icon: BarChart3, title: t.subScoresTitle, desc: t.methodologySubScoresDesc },
    { icon: AlertTriangle, title: t.tradeOffsTitle, desc: t.methodologyTradeOffsDesc },
    { icon: Sliders, title: t.prioritiesTitle, desc: t.methodologyPriorityWeightsDesc },
    { icon: Database, title: t.methodologyProfilesDetailed, desc: t.methodologyProfilesDetailedDesc },
    { icon: FlaskConical, title: t.methodologyCalibrationDetailed, desc: t.methodologyCalibrationDetailedDesc },
    { icon: FileText, title: t.methodologyValidationDetailed, desc: t.methodologyValidationDetailedDesc },
    { icon: Layers, title: t.methodologyDimensions, desc: t.methodologyDimensionsDesc },
    { icon: Heart, title: t.methodologyValuesStep, desc: t.methodologyValuesStepDesc },
    { icon: ShieldCheck, title: t.methodologyDataPrivacy, desc: t.methodologyDataPrivacyDesc },
    { icon: Code, title: t.methodologyTechStack, desc: t.methodologyTechStackDesc },
  ];

  return (
    <div className="min-h-screen">
      <header className="px-6 py-5 sm:px-10 sm:py-7 flex items-center justify-between border-b border-ink-100 bg-white/80 backdrop-blur sticky top-0 z-10">
        <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-900 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          {t.methodologyBack}
        </button>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-10">
        {/* Hero */}
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-brand-50 border border-brand-100 text-brand-700 text-xs font-semibold mb-4">
            <BookOpen className="w-3.5 h-3.5" />
            {t.methodologyTitle}
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold text-ink-900 mb-3 text-balance">{t.methodologyTitle}</h1>
          <p className="text-ink-500 leading-relaxed text-balance">{t.methodologySubtitle}</p>
        </div>

        {/* Quick overview cards */}
        <div className="mb-12">
          <h2 className="font-display text-xl font-semibold text-ink-900 mb-4">{t.methodologyOverview}</h2>
          <p className="text-sm text-ink-600 leading-relaxed mb-6">{t.methodologyOverviewDesc}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {sections.map((s, i) => (
              <div key={i} className="p-4 rounded-2xl bg-white border border-ink-100 shadow-soft">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center text-brand-600 shrink-0">
                    <s.icon className="w-4.5 h-4.5" strokeWidth={2} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-ink-900 text-sm mb-1">{s.title}</h3>
                    <p className="text-xs text-ink-500 leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Detailed sections */}
        <div className="space-y-6 mb-10">
          {detailSections.map((s, i) => (
            <div key={i} className="p-6 rounded-2xl bg-white border border-ink-100 shadow-soft animate-fade-up" style={{ animationDelay: `${i * 40}ms` }}>
              <div className="flex items-start gap-4 mb-3">
                <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center text-brand-600 shrink-0">
                  <s.icon className="w-5 h-5" strokeWidth={2} />
                </div>
                <h2 className="font-display text-lg font-semibold text-ink-900 pt-1.5">{s.title}</h2>
              </div>
              <p className="text-sm text-ink-600 leading-relaxed pl-14">{s.desc}</p>
            </div>
          ))}
        </div>

        {/* Limitations */}
        <div className="p-5 rounded-2xl bg-ink-50 border border-ink-100 mb-4">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-ink-100 flex items-center justify-center text-ink-500 shrink-0">
              <AlertTriangle className="w-5 h-5" strokeWidth={2} />
            </div>
            <div>
              <h3 className="font-semibold text-ink-900 mb-1.5">{t.methodologyLimitations}</h3>
              <p className="text-sm text-ink-600 leading-relaxed">{t.methodologyLimitationsDesc}</p>
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="p-5 rounded-2xl bg-amber-50 border border-amber-200 mb-4">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
              <ShieldAlert className="w-5 h-5" strokeWidth={2} />
            </div>
            <div>
              <h3 className="font-semibold text-ink-900 mb-1.5">{t.methodologyDisclaimer}</h3>
              <p className="text-sm text-ink-600 leading-relaxed">{t.methodologyDisclaimerDesc}</p>
            </div>
          </div>
        </div>

        {/* Algorithm version + bibliography */}
        <div className="p-5 rounded-2xl bg-white border border-ink-100">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-400">{t.methodologyAlgorithmVersion}</span>
            <span className="text-sm font-mono text-ink-700">v2.0.0</span>
          </div>
          <h3 className="font-semibold text-ink-900 mb-2">{t.methodologyBibliography}</h3>
          <ul className="space-y-1.5 text-sm text-ink-600">
            <li>• Q Project — Medical Specialty Aptitude Questionnaire (original trait model)</li>
            <li>• Borggini et al. — Personality and specialty choice in medicine: a systematic review</li>
            <li>• McCrae & Costa — Five-Factor Theory of personality</li>
            <li>• Holland — Vocational personality and work environments (RIASEC)</li>
            <li>• Specialty-specific clinical guidelines (ESC, AHA, AAP, ESMO, AAN, etc.)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
