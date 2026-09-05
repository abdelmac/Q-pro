import type { ChangeEvent, KeyboardEvent, PointerEvent } from 'react';
import { RATING_VALUES } from '@/lib/ratingScale';

interface RatingScaleProps {
  value: number | null;
  onChange: (value: number) => void;
  questionId: string;
  questionText: string;
  labels: { low: string; high: string };
  unansweredLabel: string;
}

const MIN_RATING = RATING_VALUES[0];
const MAX_RATING = RATING_VALUES[RATING_VALUES.length - 1];
const RANGE_STEPS = MAX_RATING - MIN_RATING;
const THUMB_RADIUS_PX = 20;

export default function RatingScale({
  value,
  onChange,
  questionId,
  questionText,
  labels,
  unansweredLabel,
}: RatingScaleProps) {
  const helpTextId = `${questionId}-rating-scale-help`;
  const selectedValue = RATING_VALUES.find((rating) => rating === value) ?? null;
  const progress = selectedValue === null
    ? 0
    : ((selectedValue - MIN_RATING) / RANGE_STEPS) * 100;

  const commitRating = (candidate: number) => {
    const exactRating = RATING_VALUES.find((rating) => rating === candidate);
    if (exactRating !== undefined) onChange(exactRating);
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    commitRating(Number(event.currentTarget.value));
  };

  const handlePointerUp = (event: PointerEvent<HTMLInputElement>) => {
    if (!event.isPrimary || event.button !== 0) return;

    const bounds = event.currentTarget.getBoundingClientRect();
    const usableWidth = Math.max(bounds.width - (THUMB_RADIUS_PX * 2), 1);
    const position = Math.min(
      1,
      Math.max(0, (event.clientX - bounds.left - THUMB_RADIUS_PX) / usableWidth),
    );
    commitRating(Math.round(position * RANGE_STEPS) + MIN_RATING);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (selectedValue !== null) return;

    const initialKeyboardRatings: Partial<Record<string, number>> = {
      ArrowDown: MIN_RATING,
      ArrowLeft: MIN_RATING,
      ArrowRight: MIN_RATING + 1,
      ArrowUp: MIN_RATING + 1,
      End: MAX_RATING,
      Enter: MIN_RATING,
      Home: MIN_RATING,
      PageDown: MIN_RATING,
      PageUp: MIN_RATING + 1,
      ' ': MIN_RATING,
    };
    const initialRating = initialKeyboardRatings[event.key];
    if (initialRating === undefined) return;

    event.preventDefault();
    commitRating(initialRating);
  };

  return (
    <fieldset className="min-w-0" aria-describedby={helpTextId}>
      <legend className="sr-only">{questionText}</legend>

      <div className="relative h-[72px] select-none">
        <input
          type="range"
          min={MIN_RATING}
          max={MAX_RATING}
          step={1}
          value={selectedValue ?? MIN_RATING}
          onChange={handleChange}
          onPointerUp={handlePointerUp}
          onKeyDown={handleKeyDown}
          aria-label={questionText}
          aria-describedby={helpTextId}
          aria-valuetext={selectedValue === null ? unansweredLabel : undefined}
          className="rating-range peer absolute inset-x-0 top-0 z-20 m-0 h-14 w-full cursor-pointer touch-pan-y opacity-0 focus:outline-none"
        />

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-5 top-0 h-14 rounded-xl peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500 peer-focus-visible:ring-offset-2"
        >
          <div className="absolute inset-x-0 top-[26px] h-1 overflow-hidden rounded-full bg-ink-200">
            <span
              data-rating-progress
              className="block h-full rounded-full bg-brand-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          {RATING_VALUES.map((rating) => (
            <span
              key={rating}
              data-rating-tick={rating}
              className={`absolute top-[23px] h-2.5 w-0.5 -translate-x-1/2 rounded-full ${
                selectedValue !== null && rating <= selectedValue ? 'bg-brand-600' : 'bg-ink-300'
              }`}
              style={{ left: `${((rating - MIN_RATING) / RANGE_STEPS) * 100}%` }}
            />
          ))}

          {selectedValue !== null && (
            <span
              data-rating-thumb={selectedValue}
              className="absolute top-2 flex h-10 w-10 -translate-x-1/2 items-center justify-center rounded-full border-2 border-white bg-brand-600 text-sm font-bold tabular-nums text-white shadow-lift ring-2 ring-brand-200"
              style={{ left: `${progress}%` }}
            >
              {selectedValue}
            </span>
          )}
        </div>

        <div aria-hidden="true" className="pointer-events-none absolute inset-x-5 top-[52px] h-5">
          {RATING_VALUES.map((rating) => (
            <span
              key={rating}
              className={`absolute -translate-x-1/2 text-xs font-semibold tabular-nums ${
                selectedValue === rating ? 'text-brand-700' : 'text-ink-600'
              }`}
              style={{ left: `${((rating - MIN_RATING) / RANGE_STEPS) * 100}%` }}
            >
              {rating}
            </span>
          ))}
        </div>
      </div>

      <div
        id={helpTextId}
        className="mt-1 flex items-start justify-between gap-4 text-[11px] leading-tight text-ink-500"
      >
        <span className="max-w-[48%]">{labels.low}</span>
        <span className="max-w-[48%] text-right">{labels.high}</span>
      </div>
    </fieldset>
  );
}
