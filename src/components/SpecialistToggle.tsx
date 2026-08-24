import { useLanguage } from '@/lib/LanguageContext';
import { Stethoscope } from 'lucide-react';

interface SpecialistToggleProps {
  isSpecialist: boolean;
  onToggle: (value: boolean) => void;
}

export default function SpecialistToggle({ isSpecialist, onToggle }: SpecialistToggleProps) {
  const { t } = useLanguage();

  return (
    <button
      onClick={() => onToggle(!isSpecialist)}
      className={`group flex items-center gap-3 px-4 py-2.5 rounded-full border transition-all duration-200 ${
        isSpecialist
          ? 'bg-brand-600 border-brand-600 text-white shadow-soft'
          : 'bg-white border-ink-200 text-ink-600 hover:border-ink-300 hover:bg-ink-50'
      }`}
      aria-pressed={isSpecialist}
    >
      <Stethoscope className={`w-4 h-4 ${isSpecialist ? 'text-white' : 'text-ink-400'}`} />
      <span className="text-sm font-medium hidden sm:inline">
        {isSpecialist ? t.specialistMode : t.studentMode}
      </span>
      <span className="text-sm font-medium sm:hidden">{isSpecialist ? t.specialistMode : t.studentMode}</span>
      <span
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
          isSpecialist ? 'bg-white/30' : 'bg-ink-200'
        }`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${
            isSpecialist ? 'translate-x-4' : 'translate-x-1'
          }`}
        />
      </span>
    </button>
  );
}
