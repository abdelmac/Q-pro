import { RATING_VALUES } from '@/lib/ratingScale';

interface RatingScaleProps {
  value: number | null;
  onChange: (value: number) => void;
  questionId: string;
  questionText: string;
  labels: { low: string; high: string };
}

export default function RatingScale({
  value,
  onChange,
  questionId,
  questionText,
  labels,
}: RatingScaleProps) {
  const helpTextId = `${questionId}-rating-scale-help`;

  return (
    <fieldset className="min-w-0" aria-describedby={helpTextId}>
      <legend className="sr-only">{questionText}</legend>

      <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-10 sm:gap-2">
        {RATING_VALUES.map((rating) => {
          const optionLabel = rating === 1
            ? `${rating}: ${labels.low}`
            : rating === 10
              ? `${rating}: ${labels.high}`
              : String(rating);

          return (
            <label
              key={rating}
              className="relative block cursor-pointer touch-manipulation select-none"
            >
              <input
                type="radio"
                name={`rating-${questionId}`}
                value={rating}
                checked={value === rating}
                onChange={() => onChange(rating)}
                aria-label={optionLabel}
                className="peer sr-only"
              />
              <span
                aria-hidden="true"
                className="flex min-h-11 items-center justify-center rounded-xl border border-ink-200 bg-white px-1 text-sm font-semibold tabular-nums text-ink-600 shadow-sm transition-colors hover:border-brand-300 hover:bg-brand-50 peer-checked:border-brand-600 peer-checked:bg-brand-600 peer-checked:text-white peer-checked:ring-2 peer-checked:ring-brand-200 peer-checked:ring-offset-1 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500 peer-focus-visible:ring-offset-2"
              >
                {rating}
              </span>
            </label>
          );
        })}
      </div>

      <div
        id={helpTextId}
        className="mt-2 flex items-start justify-between gap-4 text-[11px] leading-tight text-ink-500"
      >
        <span className="flex max-w-[45%] items-start gap-1">
          <span className="font-semibold text-ink-600">1</span>
          <span>{labels.low}</span>
        </span>
        <span className="flex max-w-[45%] items-start gap-1 text-right">
          <span>{labels.high}</span>
          <span className="font-semibold text-ink-600">10</span>
        </span>
      </div>
    </fieldset>
  );
}
