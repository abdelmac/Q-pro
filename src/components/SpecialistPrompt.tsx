import { useState } from 'react';
import { useLanguage } from '@/lib/LanguageContext';
import { SPECIALTIES, CATEGORY_ORDER, type Specialty } from '@/data/specialties';
import { translateSpecialtyName, translateCategory } from '@/data/i18n';
import {
  submitSpecialistResponse,
  type IntentionToChangeCode,
  type SupportedLanguage,
  type VoluntaryChoiceCode,
  type WouldChooseAgainCode,
} from '@/lib/supabase';
import { Check, Search, Loader2, AlertCircle, PartyPopper, Pencil } from 'lucide-react';

interface SpecialistPromptProps {
  initialSpecialty?: string | null;
  ratings: Record<string, number>;
  selectedValues: string[];
  language: SupportedLanguage;
  onDone: () => void;
}

export default function SpecialistPrompt({
  initialSpecialty = null,
  ratings,
  selectedValues,
  language,
  onDone,
}: SpecialistPromptProps) {
  const { t, lang } = useLanguage();
  const [actualSpecialty, setActualSpecialty] = useState<string | null>(initialSpecialty);
  const [editingSpecialty, setEditingSpecialty] = useState(!initialSpecialty);
  const [query, setQuery] = useState('');
  const [yearsExperience, setYearsExperience] = useState<string>('');
  const [careerSatisfaction, setCareerSatisfaction] = useState<number | null>(null);
  const [wouldChooseAgain, setWouldChooseAgain] = useState<WouldChooseAgainCode | null>(null);
  const [intentionToChange, setIntentionToChange] = useState<IntentionToChangeCode | null>(null);
  const [voluntaryChoice, setVoluntaryChoice] = useState<VoluntaryChoiceCode | null>(null);
  const [submissionId] = useState(() => crypto.randomUUID());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const grouped: Record<string, Specialty[]> = {};
  for (const cat of CATEGORY_ORDER) grouped[cat] = [];
  for (const s of SPECIALTIES) {
    const translated = translateSpecialtyName(s.name, lang).toLowerCase();
    if (translated.includes(query.toLowerCase())) {
      grouped[s.category]?.push(s);
    }
  }

  const handleSubmit = async () => {
    if (!actualSpecialty) return;
    setSubmitting(true);
    setError(null);
    const result = await submitSpecialistResponse({
      submission_id: submissionId,
      actual_specialty: actualSpecialty,
      ratings,
      selected_values: selectedValues,
      language,
      years_of_experience: yearsExperience ? Number(yearsExperience) : null,
      career_satisfaction: careerSatisfaction,
      would_choose_again_code: wouldChooseAgain,
      intention_to_change_code: intentionToChange,
      voluntary_choice_code: voluntaryChoice,
    });
    setSubmitting(false);
    if (result.success) {
      setSuccess(true);
    } else {
      setError(result.error ?? t.specialistError);
    }
  };

  if (success) {
    return (
      <div className="max-w-xl mx-auto px-6 py-16 text-center animate-fade-up">
        <div className="w-16 h-16 rounded-2xl bg-brand-50 flex items-center justify-center text-brand-600 mx-auto mb-6">
          <PartyPopper className="w-8 h-8" />
        </div>
        <h2 className="font-display text-3xl font-semibold text-ink-900 mb-3 text-balance">
          {t.specialistThankYou}
        </h2>
        <p className="text-ink-500 leading-relaxed mb-8 text-balance">
          {t.specialistThankYouDesc}
        </p>
        <button
          onClick={() => {
            setSuccess(false);
            setActualSpecialty(null);
            setEditingSpecialty(true);
            onDone();
          }}
          className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-ink-900 text-white font-semibold text-sm shadow-lift hover:bg-ink-800 transition-all hover:scale-[1.03] active:scale-[0.98]"
        >
          {t.specialistAnother}
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 animate-fade-up">
      <div className="text-center mb-8">
        <h2 className="font-display text-3xl font-semibold text-ink-900 mb-3 text-balance">
          {t.specialistPromptTitle}
        </h2>
        <p className="text-ink-500 leading-relaxed text-balance">
          {t.specialistPromptDesc}
        </p>
      </div>

      {/* Specialty confirmation */}
      <div className="mb-8">
        <label className="text-sm font-semibold text-ink-700 mb-3 block">
          {t.specialistActualSpecialty}
        </label>

        {actualSpecialty && !editingSpecialty ? (
          <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-brand-200 bg-brand-50 text-brand-900">
            <span className="inline-flex items-center gap-2 text-sm font-medium">
              <Check className="w-4 h-4 text-brand-600 shrink-0" strokeWidth={3} />
              {translateSpecialtyName(actualSpecialty, lang)}
            </span>
            <button
              onClick={() => setEditingSpecialty(true)}
              disabled={submitting}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:text-brand-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Pencil className="w-3.5 h-3.5" />
              {t.specialistChangeSpecialty}
            </button>
          </div>
        ) : (
          <>
            <div className="relative mb-4">
              <Search aria-hidden="true" className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-ink-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t.searchPlaceholder}
                aria-label={t.searchPlaceholder}
                disabled={submitting}
                className="w-full pl-11 pr-4 py-3 rounded-xl bg-white border border-ink-200 text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            <div className="space-y-5 max-h-80 overflow-y-auto scrollbar-thin pr-1">
              {CATEGORY_ORDER.map((cat) => {
                const items = grouped[cat];
                if (!items || items.length === 0) return null;
                return (
                  <div key={cat}>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-400 mb-2.5">
                      {translateCategory(cat, lang)}
                    </h3>
                    <div className="grid grid-cols-1 gap-2">
                      {items.map((s) => {
                        const active = actualSpecialty === s.name;
                        return (
                          <button
                            key={s.name}
                            disabled={submitting}
                            onClick={() => {
                              setActualSpecialty(s.name);
                              setEditingSpecialty(false);
                              setQuery('');
                            }}
                            aria-pressed={active}
                            className={`flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border text-left text-sm transition-all duration-150 ${
                              active
                                ? 'border-brand-500 bg-brand-50 text-brand-900 shadow-soft'
                                : 'border-ink-200 bg-white text-ink-700 hover:border-ink-300 hover:bg-ink-50'
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                          >
                            <span className="font-medium leading-snug">{translateSpecialtyName(s.name, lang)}</span>
                            {active && <Check className="w-4 h-4 text-brand-600 shrink-0" strokeWidth={3} />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Calibration fields */}
      {actualSpecialty && (
        <fieldset disabled={submitting} className="space-y-6 mb-8 p-5 rounded-2xl bg-ink-50 border border-ink-100 animate-fade-in disabled:opacity-70">
          {/* Years of experience */}
          <div>
            <label className="text-sm font-semibold text-ink-700 mb-2 block">
              {t.specialistYearsExperience}
            </label>
            <input
              type="number"
              min={0}
              max={60}
              value={yearsExperience}
              onChange={(e) => setYearsExperience(e.target.value)}
              placeholder={t.specialistYearsPlaceholder}
              className="w-full px-4 py-2.5 rounded-xl bg-white border border-ink-200 text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 transition-all"
            />
          </div>

          {/* Career satisfaction */}
          <div>
            <label className="text-sm font-semibold text-ink-700 mb-2 block">
              {t.specialistCareerSatisfaction}
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                { val: 5, label: t.specialistVerySatisfied },
                { val: 4, label: t.specialistSatisfied },
                { val: 3, label: t.specialistNeutral },
                { val: 2, label: t.specialistDissatisfied },
                { val: 1, label: t.specialistVeryDissatisfied },
              ].map((opt) => (
                <ChipButton key={opt.val} active={careerSatisfaction === opt.val} onClick={() => setCareerSatisfaction(opt.val)}>
                  {opt.label}
                </ChipButton>
              ))}
            </div>
          </div>

          {/* Would choose again */}
          <div>
            <label className="text-sm font-semibold text-ink-700 mb-2 block">
              {t.specialistWouldChooseAgain}
            </label>
            <div className="flex flex-wrap gap-2">
              {([
                { code: 'yes', label: t.specialistYes },
                { code: 'no', label: t.specialistNo },
                { code: 'unsure', label: t.specialistNotSure },
              ] as const).map((option) => (
                <ChipButton key={option.code} active={wouldChooseAgain === option.code} onClick={() => setWouldChooseAgain(option.code)}>
                  {option.label}
                </ChipButton>
              ))}
            </div>
          </div>

          {/* Intention to change */}
          <div>
            <label className="text-sm font-semibold text-ink-700 mb-2 block">
              {t.specialistIntentionToChange}
            </label>
            <div className="flex flex-wrap gap-2">
              {([
                { code: 'definitely', label: t.specialistDefinitely },
                { code: 'probably', label: t.specialistProbably },
                { code: 'probably_not', label: t.specialistProbablyNot },
                { code: 'definitely_not', label: t.specialistDefinitelyNot },
              ] as const).map((option) => (
                <ChipButton key={option.code} active={intentionToChange === option.code} onClick={() => setIntentionToChange(option.code)}>
                  {option.label}
                </ChipButton>
              ))}
            </div>
          </div>

          {/* Voluntary choice */}
          <div>
            <label className="text-sm font-semibold text-ink-700 mb-2 block">
              {t.specialistVoluntaryChoice}
            </label>
            <div className="flex flex-wrap gap-2">
              {([
                { code: 'fully_voluntary', label: t.specialistFullyVoluntary },
                { code: 'somewhat_voluntary', label: t.specialistSomewhatVoluntary },
                { code: 'not_voluntary', label: t.specialistNotVoluntary },
              ] as const).map((option) => (
                <ChipButton key={option.code} active={voluntaryChoice === option.code} onClick={() => setVoluntaryChoice(option.code)}>
                  {option.label}
                </ChipButton>
              ))}
            </div>
          </div>
        </fieldset>
      )}

      {error && (
        <div className="mb-4 p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-center gap-2.5 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={!actualSpecialty || submitting}
        className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-ink-900 text-white font-semibold text-sm shadow-lift hover:bg-ink-800 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
      >
        {submitting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            {t.specialistSubmitting}
          </>
        ) : (
          t.specialistSubmit
        )}
      </button>
    </div>
  );
}

function ChipButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3.5 py-2 rounded-full text-xs font-semibold border transition-all duration-150 ${
        active
          ? 'border-brand-500 bg-brand-50 text-brand-700 shadow-soft'
          : 'border-ink-200 bg-white text-ink-600 hover:border-ink-300'
      }`}
    >
      {children}
    </button>
  );
}
