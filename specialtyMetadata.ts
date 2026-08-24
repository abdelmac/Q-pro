import { useLanguage } from '@/lib/LanguageContext';
import { translateQuestion, translateSection } from '@/data/i18n';
import { type RatingSection } from '@/data/questions';
import RatingSlider from './RatingSlider';

interface RatingStepProps {
  section: RatingSection;
  ratings: Record<string, number>;
  onChange: (id: string, value: number) => void;
}

export default function RatingStep({ section, ratings, onChange }: RatingStepProps) {
  const { lang, t } = useLanguage();
  const answered = section.questions.filter((q) => ratings[q.id] !== undefined).length;
  const total = section.questions.length;
  const sectionInfo = translateSection(section.id, lang);

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm text-ink-500">{sectionInfo.subtitle}</p>
        <span className="text-xs font-medium text-ink-400 tabular-nums">
          {t.answeredCount(answered, total)}
        </span>
      </div>

      <div className="space-y-3 mt-5">
        {section.questions.map((q, idx) => (
          <div
            key={q.id}
            className={`p-4 sm:p-5 rounded-2xl border transition-all duration-200 ${
              ratings[q.id] !== undefined
                ? 'border-brand-200 bg-brand-50/40'
                : 'border-ink-100 bg-white hover:border-ink-200'
            }`}
          >
            <div className="flex items-start gap-3 mb-4">
              <span className="shrink-0 mt-0.5 w-6 h-6 rounded-full bg-ink-100 text-ink-500 text-xs font-semibold flex items-center justify-center tabular-nums">
                {idx + 1}
              </span>
              <p className="text-sm sm:text-base font-medium text-ink-800 leading-snug pt-0.5">
                {translateQuestion(q.id, lang)}
              </p>
            </div>
            <div className="pl-9">
              <RatingSlider
                value={ratings[q.id] ?? null}
                onChange={(v) => onChange(q.id, v)}
                questionId={q.id}
                labels={{ low: t.sliderRarely, high: t.sliderStrongly }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
