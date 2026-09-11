import { useEffect, useRef, useState, type FormEvent } from 'react';
import { submitStudentResponse, type SupportedLanguage } from '@/lib/supabase';
import { useLanguage } from '@/lib/LanguageContext';
import { useSpecialtyCatalog } from '@/lib/SpecialtyCatalogContext';
import ParticipantReflectionForm, {
  PARTICIPANT_MEDICINE_VIEW_MAX_LENGTH,
  PARTICIPANT_MEDICINE_VIEW_MIN_LENGTH,
  type ParticipantReflectionDraft,
} from './ParticipantReflectionForm';

export type { ParticipantReflectionDraft } from './ParticipantReflectionForm';

interface StudentPromptProps {
  participantRole: 'student' | 'curious';
  draft: ParticipantReflectionDraft;
  onDraftChange: (draft: ParticipantReflectionDraft) => void;
  preferredSpecialty: string | null;
  ratings: Record<string, number>;
  selectedValues: string[];
  scores: Array<{ specialty: { name: string }; score: number }>;
  language: SupportedLanguage;
  onDone: (saved: boolean) => void;
  onSubmittingChange?: (submitting: boolean) => void;
}

export default function StudentPrompt({
  participantRole,
  draft,
  onDraftChange,
  preferredSpecialty,
  ratings,
  selectedValues,
  scores,
  language,
  onDone,
  onSubmittingChange,
}: StudentPromptProps) {
  const { t } = useLanguage();
  const { version, source } = useSpecialtyCatalog();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      onSubmittingChange?.(false);
    };
  }, [onSubmittingChange]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedMedicineView = draft.medicineView.trim();
    if (
      normalizedMedicineView.length < PARTICIPANT_MEDICINE_VIEW_MIN_LENGTH
      || normalizedMedicineView.length > PARTICIPANT_MEDICINE_VIEW_MAX_LENGTH
    ) return;

    setSubmitting(true);
    onSubmittingChange?.(true);
    setError(null);
    try {
      const result = await submitStudentResponse({
        submission_id: draft.submissionId,
        participant_role: participantRole,
        medicine_view: normalizedMedicineView,
        study_year: participantRole === 'student' && draft.studyYear ? Number(draft.studyYear) : null,
        preferred_specialty: preferredSpecialty,
        ratings,
        selected_values: selectedValues,
        client_scores: scores.map(({ specialty, score }) => ({ specialty: specialty.name, score })),
        language,
        specialty_config_version_id: source === 'remote' ? version.id : null,
      });
      if (!mountedRef.current) return;
      if (result.success) onDone(true);
      else setError(result.error ?? t.specialistError);
    } catch (submissionError) {
      if (mountedRef.current) {
        setError(submissionError instanceof Error ? submissionError.message : t.specialistError);
      }
    } finally {
      if (mountedRef.current) {
        setSubmitting(false);
        onSubmittingChange?.(false);
      }
    }
  };

  return (
    <ParticipantReflectionForm
      participantRole={participantRole}
      draft={draft}
      onDraftChange={onDraftChange}
      submitting={submitting}
      error={error}
      copy={t}
      onSubmit={(event) => void handleSubmit(event)}
      onSkip={() => onDone(false)}
    />
  );
}
