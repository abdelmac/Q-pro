import { RATING_VALUES } from '@/lib/ratingScale';

export function SmileyThumb() {
  return (
    <svg
      viewBox="0 0 32 32"
      className="pointer-events-none h-6 w-6"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="16" cy="16" r="12" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="11.5" cy="13.5" r="1.35" fill="currentColor" />
      <circle cx="20.5" cy="13.5" r="1.35" fill="currentColor" />
      <path
        d="M10.5 19c1.45 2.25 3.3 3.4 5.5 3.4s4.05-1.15 5.5-3.4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

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
  const selectedValue = RATING_VALUES.find((rating) => rating === value) ?? null;
  const desktopProgress = selectedValue === null ? 0 : ((selectedValue - 1) / 9) * 100;
  const firstMobileRowProgress = selectedValue === null
    ? 0
    : selectedValue <= 5
      ? ((selectedValue - 1) / 4) * 100
      : 100;
  const secondMobileRowProgress = selectedValue === null || selectedValue <= 5
    ? 0
    : ((selectedValue - 6) / 4) * 100;

  return (
    <fieldset className="min-w-0" aria-describedby={helpTextId}>
      <legend className="sr-only">{questionText}</legend>

      <div className="relative">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-[10%] right-[10%] top-[22px] h-1 overflow-hidden rounded-full bg-ink-200 sm:left-[5%] sm:right-[5%]"
        >
          <span
            className="block h-full rounded-full bg-brand-400 transition-[width] duration-200 ease-out sm:hidden"
            style={{ width: `${firstMobileRowProgress}%` }}
          />
          <span
            className="hidden h-full rounded-full bg-brand-400 transition-[width] duration-200 ease-out sm:block"
            style={{ width: `${desktopProgress}%` }}
          />
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-[10%] right-[10%] top-[76px] h-1 overflow-hidden rounded-full bg-ink-200 sm:hidden"
        >
          <span
            className="block h-full rounded-full bg-brand-400 transition-[width] duration-200 ease-out"
            style={{ width: `${secondMobileRowProgress}%` }}
          />
        </div>

        <div className="relative grid grid-cols-5 gap-1.5 sm:grid-cols-10 sm:gap-2">
          {RATING_VALUES.map((rating) => {
            const optionLabel = rating === 1
              ? `${rating}: ${labels.low}`
              : rating === 10
                ? `${rating}: ${labels.high}`
                : String(rating);

            return (
              <label
                key={rating}
                className="relative z-[1] flex min-h-12 cursor-pointer touch-manipulation select-none items-center justify-center"
              >
                <input
                  type="radio"
                  name={`rating-${questionId}`}
                  value={rating}
                  checked={selectedValue === rating}
                  onChange={() => onChange(rating)}
                  aria-label={optionLabel}
                  className="peer sr-only"
                />
                <span
                  aria-hidden="true"
                  className="relative flex h-9 w-9 items-center justify-center rounded-full border-2 border-ink-200 bg-white text-xs font-semibold tabular-nums text-ink-600 shadow-sm transition-all duration-200 ease-out hover:border-brand-300 hover:bg-brand-50 peer-checked:h-11 peer-checked:w-11 peer-checked:-translate-y-0.5 peer-checked:border-brand-600 peer-checked:bg-brand-600 peer-checked:text-white peer-checked:shadow-lift peer-checked:ring-2 peer-checked:ring-brand-200 peer-checked:ring-offset-1 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500 peer-focus-visible:ring-offset-2"
                >
                  {selectedValue === rating ? (
                    <>
                      <SmileyThumb />
                      <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-brand-100 px-1 text-[10px] font-bold leading-none text-brand-800 shadow-sm">
                        {rating}
                      </span>
                    </>
                  ) : rating}
                </span>
              </label>
            );
          })}
        </div>
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
