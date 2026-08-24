import { useLanguage } from '@/lib/LanguageContext';
import { SPECIALTIES, type Specialty } from '@/data/specialties';
import { translateSpecialtyName, translateCategory } from '@/data/i18n';
import { getSpecialtyAxisValue, getStudentAxisValue } from '@/lib/scoring';
import { COMPARISON_AXES } from '@/data/dimensions';
import { ArrowLeft, X, Plus, Check } from 'lucide-react';
import { useState, useMemo } from 'react';

interface SpecialtyComparisonProps {
  studentTraits: Record<string, number>;
  onBack: () => void;
}

export default function SpecialtyComparison({ studentTraits, onBack }: SpecialtyComparisonProps) {
  const { t, lang } = useLanguage();
  const [selected, setSelected] = useState<string[]>([]);
  const [showPicker, setShowPicker] = useState(false);

  const selectedSpecialties = useMemo(
    () => selected.map((n) => SPECIALTIES.find((s) => s.name === n)!).filter(Boolean),
    [selected]
  );

  const axisLabels: Record<string, string> = {
    patient_interaction: t.comparisonAxisPatientInteraction,
    crisis_work: t.comparisonAxisCrisisWork,
    technical_activity: t.comparisonAxisTechnicalActivity,
    visual_reasoning: t.comparisonAxisVisualReasoning,
    long_term_care: t.comparisonAxisLongTermCare,
    lifestyle_balance: t.comparisonAxisLifestyleBalance,
    research: t.comparisonAxisResearch,
    manual_activity: t.comparisonAxisManualActivity,
  };

  const colors = ['bg-brand-500', 'bg-accent-500', 'bg-blue-500'];

  return (
    <div className="min-h-screen">
      <header className="px-6 py-5 sm:px-10 sm:py-7 flex items-center justify-between border-b border-ink-100 bg-white/80 backdrop-blur sticky top-0 z-10">
        <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-900 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          {t.comparisonBack}
        </button>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-10">
        <h1 className="font-display text-3xl sm:text-4xl font-semibold text-ink-900 mb-2">{t.comparisonTitle}</h1>
        <p className="text-ink-500 mb-6">{t.comparisonSubtitle}</p>

        {selected.length < 3 && (
          <button
            onClick={() => setShowPicker(!showPicker)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-ink-900 text-white text-sm font-semibold hover:bg-ink-800 transition-all mb-4"
          >
            <Plus className="w-4 h-4" />
            {t.comparisonAdd}
          </button>
        )}

        {showPicker && (
          <div className="mb-6 p-4 rounded-2xl bg-white border border-ink-100 shadow-soft max-h-64 overflow-y-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {SPECIALTIES.map((s) => {
                const isSelected = selected.includes(s.name);
                return (
                  <button
                    key={s.name}
                    onClick={() => {
                      if (isSelected) {
                        setSelected(selected.filter((n) => n !== s.name));
                      } else if (selected.length < 3) {
                        setSelected([...selected, s.name]);
                      }
                    }}
                    className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border text-left text-sm transition-all ${
                      isSelected ? 'border-brand-500 bg-brand-50 text-brand-900' : 'border-ink-200 bg-white text-ink-700 hover:border-ink-300'
                    }`}
                  >
                    <span className="font-medium leading-snug">{translateSpecialtyName(s.name, lang)}</span>
                    {isSelected && <Check className="w-4 h-4 text-brand-600 shrink-0" strokeWidth={3} />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {selected.length === 0 && (
          <p className="text-sm text-ink-400 mt-4">{t.comparisonSubtitle}</p>
        )}

        {selected.length > 0 && (
          <>
            {/* Selected specialty chips */}
            <div className="flex flex-wrap gap-2 mb-6">
              {selected.map((name, i) => (
                <div key={name} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border border-ink-200">
                  <span className={`w-2.5 h-2.5 rounded-full ${colors[i]}`} />
                  <span className="text-sm font-medium text-ink-800">{translateSpecialtyName(name, lang)}</span>
                  <button onClick={() => setSelected(selected.filter((n) => n !== name))} className="text-ink-300 hover:text-ink-500">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Comparison table */}
            <div className="rounded-2xl bg-white border border-ink-100 overflow-hidden">
              {/* Header row */}
              <div className="grid border-b border-ink-100" style={{ gridTemplateColumns: `180px repeat(${selected.length}, 1fr)` }}>
                <div className="p-4" />
                {selectedSpecialties.map((s, i) => (
                  <div key={s.name} className="p-4 border-l border-ink-100">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`w-2.5 h-2.5 rounded-full ${colors[i]}`} />
                      <span className="text-xs font-medium text-ink-400">{translateCategory(s.category, lang)}</span>
                    </div>
                    <h3 className="text-sm font-semibold text-ink-900 leading-snug">{translateSpecialtyName(s.name, lang)}</h3>
                  </div>
                ))}
              </div>

              {/* Your profile row */}
              <div className="grid border-b border-ink-100 bg-ink-50/50" style={{ gridTemplateColumns: `180px repeat(${selected.length}, 1fr)` }}>
                <div className="p-4">
                  <span className="text-xs font-semibold text-ink-500 uppercase tracking-wide">{t.comparisonYourProfile}</span>
                </div>
                {selectedSpecialties.map((s) => (
                  <div key={s.name} className="p-4 border-l border-ink-100 flex items-center">
                    <span className="text-sm text-ink-400">—</span>
                  </div>
                ))}
              </div>

              {/* Axis rows */}
              {COMPARISON_AXES.map((axis) => {
                const studentVal = getStudentAxisValue(studentTraits, axis.traits, axis.positive);
                return (
                  <div key={axis.key} className="grid border-b border-ink-100 last:border-b-0" style={{ gridTemplateColumns: `180px repeat(${selected.length}, 1fr)` }}>
                    <div className="p-4">
                      <span className="text-sm font-medium text-ink-700">{axisLabels[axis.key] ?? axis.label}</span>
                    </div>
                    {selectedSpecialties.map((s) => {
                      const val = getSpecialtyAxisValue(s, axis.traits, axis.positive);
                      return (
                        <div key={s.name} className="p-4 border-l border-ink-100">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 rounded-full bg-ink-100 overflow-hidden">
                              <div className="h-full rounded-full bg-brand-400" style={{ width: `${Math.round(val)}%` }} />
                            </div>
                            <span className="text-xs text-ink-400 tabular-nums w-8 text-right">{Math.round(val)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}

              {/* Student profile values row */}
              <div className="grid bg-brand-50/30" style={{ gridTemplateColumns: `180px repeat(${selected.length}, 1fr)` }}>
                <div className="p-4">
                  <span className="text-xs font-semibold text-brand-700 uppercase tracking-wide">{t.comparisonYourProfile}</span>
                </div>
                {selectedSpecialties.map((s) => (
                  <div key={s.name} className="p-4 border-l border-ink-100">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-ink-100 overflow-hidden">
                        <div className="h-full rounded-full bg-ink-700" style={{ width: `${Math.round(getStudentAxisValue(studentTraits, COMPARISON_AXES[0].traits, true))}%` }} />
                      </div>
                      <span className="text-xs text-ink-500 tabular-nums w-8 text-right">—</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
