import {
  ArrowLeft,
  ArrowRight,
  ClipboardList,
  MessageSquareText,
  ShieldCheck,
  Stethoscope,
} from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import LanguageSwitcher from './LanguageSwitcher';

export interface SpecialistQuestionnaireChoiceCopy {
  appName: string;
  back: string;
  title: string;
  description: string;
  answerLabel: string;
  answerDescription: string;
  skipLabel: string;
  skipDescription: string;
  privacy: string;
}

interface SpecialistQuestionnaireChoiceViewProps {
  copy: SpecialistQuestionnaireChoiceCopy;
  onAnswerQuestionnaire: () => void;
  onSkipQuestionnaire: () => void;
  onBack: () => void;
}

export function SpecialistQuestionnaireChoiceView({
  copy,
  onAnswerQuestionnaire,
  onSkipQuestionnaire,
  onBack,
}: SpecialistQuestionnaireChoiceViewProps) {
  const choices = [
    {
      id: 'answer',
      label: copy.answerLabel,
      description: copy.answerDescription,
      onSelect: onAnswerQuestionnaire,
      icon: ClipboardList,
      iconClassName: 'bg-brand-50 text-brand-700',
    },
    {
      id: 'skip',
      label: copy.skipLabel,
      description: copy.skipDescription,
      onSelect: onSkipQuestionnaire,
      icon: MessageSquareText,
      iconClassName: 'bg-accent-100 text-accent-700',
    },
  ] as const;

  return (
    <div className="flex min-h-screen flex-col bg-accent-50">
      <header className="flex items-center justify-between gap-4 px-5 py-5 sm:px-10 sm:py-7">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white shadow-soft">
            <Stethoscope aria-hidden="true" className="h-5 w-5" strokeWidth={2.2} />
          </div>
          <span className="font-display text-lg font-semibold tracking-tight text-ink-900">
            {copy.appName}
          </span>
        </div>
        <LanguageSwitcher />
      </header>

      <main className="flex flex-1 items-center justify-center px-5 py-8 sm:px-6 sm:py-14">
        <div className="w-full max-w-4xl">
          <button
            type="button"
            onClick={onBack}
            className="mb-8 inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-medium text-ink-600 transition-colors hover:bg-white hover:text-ink-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
          >
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            {copy.back}
          </button>

          <fieldset className="w-full text-center">
            <legend className="w-full font-display text-3xl font-semibold tracking-tight text-ink-900 sm:text-5xl">
              {copy.title}
            </legend>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-ink-500 sm:text-lg">
              {copy.description}
            </p>

            <div className="mx-auto mt-9 grid max-w-3xl gap-4 md:grid-cols-2">
              {choices.map(({ id, label, description, onSelect, icon: Icon, iconClassName }) => {
                const descriptionId = `specialist-path-${id}-description`;
                return (
                  <button
                    key={id}
                    type="button"
                    data-specialist-path={id}
                    aria-describedby={descriptionId}
                    onClick={onSelect}
                    className="group flex min-h-48 w-full items-start gap-4 rounded-2xl border border-ink-100 bg-white p-5 text-left shadow-soft transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-lift focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 sm:p-6"
                  >
                    <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${iconClassName}`}>
                      <Icon aria-hidden="true" className="h-6 w-6" strokeWidth={2} />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col self-stretch">
                      <span className="text-lg font-semibold leading-snug text-ink-900">{label}</span>
                      <span id={descriptionId} className="mt-2 text-sm leading-relaxed text-ink-500">
                        {description}
                      </span>
                      <span className="mt-auto flex justify-end pt-5 text-brand-700 transition-transform group-hover:translate-x-0.5" aria-hidden="true">
                        <ArrowRight className="h-5 w-5" />
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <p role="note" className="mx-auto mt-6 flex max-w-3xl items-start gap-2.5 rounded-2xl border border-brand-100 bg-brand-50 px-4 py-3.5 text-left text-xs leading-relaxed text-brand-900 sm:text-sm">
            <ShieldCheck aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
            <span>{copy.privacy}</span>
          </p>
        </div>
      </main>
    </div>
  );
}

export default function SpecialistQuestionnaireChoice({
  onAnswerQuestionnaire,
  onSkipQuestionnaire,
  onBack,
}: {
  onAnswerQuestionnaire: () => void;
  onSkipQuestionnaire: () => void;
  onBack: () => void;
}) {
  const { t } = useLanguage();

  return (
    <SpecialistQuestionnaireChoiceView
      onAnswerQuestionnaire={onAnswerQuestionnaire}
      onSkipQuestionnaire={onSkipQuestionnaire}
      onBack={onBack}
      copy={{
        appName: t.appName,
        back: t.back,
        title: t.specialistPathTitle,
        description: t.specialistPathDescription,
        answerLabel: t.specialistPathAnswer,
        answerDescription: t.specialistPathAnswerDescription,
        skipLabel: t.specialistPathSkip,
        skipDescription: t.specialistPathSkipDescription,
        privacy: t.specialistPathPrivacy,
      }}
    />
  );
}
