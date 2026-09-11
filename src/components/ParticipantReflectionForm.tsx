import type { FormEvent } from 'react';
import type { UIStrings } from '@/data/i18n';
import { AlertCircle, ArrowRight, Compass, GraduationCap, Loader2 } from 'lucide-react';
import { STUDENT_STUDY_YEARS } from '@/lib/participantProfile';

export const PARTICIPANT_MEDICINE_VIEW_MIN_LENGTH = 3;
export const PARTICIPANT_MEDICINE_VIEW_MAX_LENGTH = 2000;

export interface ParticipantReflectionDraft {
  submissionId: string;
  studyYear: string;
  medicineView: string;
}

export interface ParticipantReflectionFormProps {
  participantRole: 'student' | 'curious';
  draft: ParticipantReflectionDraft;
  onDraftChange: (draft: ParticipantReflectionDraft) => void;
  submitting: boolean;
  error: string | null;
  copy: UIStrings;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onSkip: () => void;
}

export default function ParticipantReflectionForm({
  participantRole,
  draft,
  onDraftChange,
  submitting,
  error,
  copy,
  onSubmit,
  onSkip,
}: ParticipantReflectionFormProps) {
  const isStudent = participantRole === 'student';
  const normalizedMedicineViewLength = draft.medicineView.trim().length;
  const canSave = normalizedMedicineViewLength >= PARTICIPANT_MEDICINE_VIEW_MIN_LENGTH
    && normalizedMedicineViewLength <= PARTICIPANT_MEDICINE_VIEW_MAX_LENGTH;
  const medicineViewHelpId = 'medicine-view-help';
  const Icon = isStudent ? GraduationCap : Compass;

  const updateDraft = (patch: Partial<ParticipantReflectionDraft>) => {
    onDraftChange({ ...draft, ...patch });
  };

  return (
    <main className="mx-auto max-w-xl px-6 py-12 animate-fade-up sm:py-16">
      <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
        <Icon className="h-7 w-7" aria-hidden="true" />
      </div>
      <h2 className="mb-3 font-display text-3xl font-semibold text-ink-900">
        {isStudent ? copy.studentDataTitle : copy.curiousDataTitle}
      </h2>
      <p className="mb-8 leading-relaxed text-ink-500">
        {isStudent ? copy.studentDataDesc : copy.curiousDataDesc}
      </p>

      <form onSubmit={onSubmit}>
        <div>
          <label htmlFor="medicine-view" className="mb-2 block text-sm font-semibold text-ink-700">
            {copy.participantMedicineView} <span className="text-red-500" aria-hidden="true">*</span>
          </label>
          <textarea
            id="medicine-view"
            name="medicine_view"
            rows={6}
            required
            minLength={PARTICIPANT_MEDICINE_VIEW_MIN_LENGTH}
            maxLength={PARTICIPANT_MEDICINE_VIEW_MAX_LENGTH}
            value={draft.medicineView}
            onChange={(event) => updateDraft({ medicineView: event.target.value })}
            placeholder={copy.participantMedicineViewPlaceholder}
            aria-describedby={medicineViewHelpId}
            aria-invalid={Boolean(error)}
            disabled={submitting}
            className="w-full resize-y rounded-xl border border-ink-200 bg-white px-4 py-3 text-sm text-ink-900 placeholder:text-ink-400 transition-all focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:opacity-60"
          />
          <div id={medicineViewHelpId} className="mt-1.5 flex items-start justify-between gap-4 text-[11px] leading-relaxed text-ink-400">
            <p className="max-w-md text-amber-800">{copy.participantMedicineViewPrivacy}</p>
            <p className="shrink-0 tabular-nums">
              {copy.participantMedicineViewCount(draft.medicineView.length, PARTICIPANT_MEDICINE_VIEW_MAX_LENGTH)}
            </p>
          </div>
        </div>

        {isStudent && (
          <div className="mt-7">
            <label htmlFor="study-year" className="mb-2 block text-sm font-semibold text-ink-700">
              {copy.studentStudyYear}{' '}
              <span className="font-normal text-ink-400">({copy.specialtyOptional})</span>
            </label>
            <select
              id="study-year"
              value={draft.studyYear}
              onChange={(event) => updateDraft({ studyYear: event.target.value })}
              disabled={submitting}
              className="w-full rounded-xl border border-ink-200 bg-white px-4 py-3 text-sm text-ink-900 transition-all focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="">{copy.studentPreferNotToSay}</option>
              {STUDENT_STUDY_YEARS.map((year) => (
                <option key={year} value={year}>{copy.studentYear(year)}</option>
              ))}
            </select>
          </div>
        )}

        {error && (
          <div className="mt-5 flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-sm text-red-700" role="alert">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || !canSave}
          className="mt-8 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-brand-800 px-6 py-3.5 text-sm font-semibold text-white shadow-lift transition-all hover:bg-brand-900 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? (
            <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />{copy.studentSaving}</>
          ) : (
            <>{copy.studentContinue}<ArrowRight className="h-4 w-4" aria-hidden="true" /></>
          )}
        </button>
        <button
          type="button"
          onClick={onSkip}
          disabled={submitting}
          className="mt-3 min-h-11 w-full py-3 text-sm font-medium text-ink-500 transition-colors hover:text-ink-900 disabled:opacity-40"
        >
          {copy.studentSkip}
        </button>
      </form>
    </main>
  );
}
