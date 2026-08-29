import { useState } from 'react';
import { submitStudentResponse, type SupportedLanguage } from '@/lib/supabase';
import { useLanguage } from '@/lib/LanguageContext';
import { AlertCircle, ArrowRight, Loader2, GraduationCap } from 'lucide-react';

interface StudentPromptProps {
  preferredSpecialty: string | null;
  ratings: Record<string, number>;
  selectedValues: string[];
  scores: Array<{ specialty: { name: string }; score: number }>;
  language: SupportedLanguage;
  onDone: () => void;
}

export default function StudentPrompt({ preferredSpecialty, ratings, selectedValues, scores, language, onDone }: StudentPromptProps) {
  const { t } = useLanguage();
  const [studyYear, setStudyYear] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submissionId] = useState(() => crypto.randomUUID());

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    const result = await submitStudentResponse({
      submission_id: submissionId,
      study_year: studyYear ? Number(studyYear) : null,
      preferred_specialty: preferredSpecialty,
      ratings,
      selected_values: selectedValues,
      client_scores: scores.map(({ specialty, score }) => ({ specialty: specialty.name, score })),
      language,
    });
    setSubmitting(false);
    if (result.success) onDone();
    else setError(result.error ?? 'Unable to save your response.');
  };

  return (
    <main className="max-w-xl mx-auto px-6 py-16 animate-fade-up">
      <div className="w-14 h-14 rounded-2xl bg-brand-50 flex items-center justify-center text-brand-600 mb-6">
        <GraduationCap className="w-7 h-7" />
      </div>
      <h2 className="font-display text-3xl font-semibold text-ink-900 mb-3">{t.studentDataTitle}</h2>
      <p className="text-ink-500 leading-relaxed mb-8">{t.studentDataDesc}</p>

      <label htmlFor="study-year" className="text-sm font-semibold text-ink-700 mb-2 block">{t.studentStudyYear} <span className="font-normal text-ink-400">({t.specialtyOptional})</span></label>
      <select
        id="study-year"
        value={studyYear}
        onChange={(event) => setStudyYear(event.target.value)}
        className="w-full px-4 py-3 rounded-xl bg-white border border-ink-200 text-sm text-ink-900 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 transition-all"
      >
        <option value="">{t.studentPreferNotToSay}</option>
        {Array.from({ length: 12 }, (_, index) => index + 1).map((year) => (
          <option key={year} value={year}>{t.studentYear(year)}</option>
        ))}
      </select>

      {error && <div className="mt-5 p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-center gap-2.5 text-sm text-red-700"><AlertCircle className="w-4 h-4 shrink-0" />{error}</div>}

      <button onClick={handleSubmit} disabled={submitting} className="mt-8 w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-ink-900 text-white font-semibold text-sm shadow-lift hover:bg-ink-800 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
        {submitting ? <><Loader2 className="w-4 h-4 animate-spin" />{t.studentSaving}</> : <>{t.studentContinue}<ArrowRight className="w-4 h-4" /></>}
      </button>
      <button onClick={onDone} disabled={submitting} className="w-full mt-3 py-3 text-sm font-medium text-ink-500 hover:text-ink-900 transition-colors">{t.studentSkip}</button>
    </main>
  );
}
