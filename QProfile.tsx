import { useEffect, useRef } from 'react';

interface RatingSliderProps {
  value: number | null;
  onChange: (v: number) => void;
  questionId: string;
  labels: { low: string; high: string };
}

export default function RatingSlider({ value, onChange, questionId, labels }: RatingSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);

  const pct = value !== null ? (value - 1) / 9 : 0;

  useEffect(() => {
    if (value !== null && trackRef.current) {
      trackRef.current.style.setProperty('--pct', `${pct * 100}%`);
    }
  }, [value, pct]);

  return (
    <div>
      <div className="flex items-center gap-3 sm:gap-5">
        <div className="flex flex-col items-center gap-1 text-xs font-medium text-ink-400 shrink-0 w-16 sm:w-20 text-center">
          <span className="font-semibold text-ink-500">1</span>
          <span className="text-[10px] leading-tight">{labels.low}</span>
        </div>

        <div className="flex-1 relative">
          <div ref={trackRef} className="relative h-2 rounded-full bg-ink-100">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-brand-300 to-brand-500 origin-left transition-transform duration-300"
              style={{ width: '100%', transform: value !== null ? `scaleX(${pct})` : 'scaleX(0)' }}
            />
          </div>
          <input
            type="range"
            min={1}
            max={10}
            step={1}
            value={value ?? 5}
            onChange={(e) => onChange(Number(e.target.value))}
            aria-label={`Rating for ${questionId}`}
            className="absolute inset-0 w-full h-8 -mt-3 opacity-0 cursor-pointer"
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-white border-2 border-brand-500 shadow-lift pointer-events-none transition-all duration-150"
            style={{ left: value !== null ? `${pct * 100}%` : '50%' }}
          >
            {value !== null && (
              <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-brand-600">
                {value}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col items-center gap-1 text-xs font-medium text-ink-400 shrink-0 w-16 sm:w-20 text-center">
          <span className="font-semibold text-ink-500">10</span>
          <span className="text-[10px] leading-tight">{labels.high}</span>
        </div>
      </div>
    </div>
  );
}
