import { ArrowRight, Download, GraduationCap, ShieldCheck, Stethoscope } from 'lucide-react';
import type { Language } from '@/data/i18n';
import { PROFESSOR_PORTAL_COPY } from '@/data/professorPortalI18n';
import type { DashboardView } from '@/lib/dashboardNavigation';

interface ProfessorOverviewProps {
  lang: Language;
  counts: { students: number; curious: number; specialists: number } | null;
  loading: boolean;
  onSelectView: (view: DashboardView) => void;
  onOpenExports: (view: 'students' | 'specialists') => void;
}

export default function ProfessorOverview({ lang, counts, loading, onSelectView, onOpenExports }: ProfessorOverviewProps) {
  const copy = PROFESSOR_PORTAL_COPY[lang];
  const number = new Intl.NumberFormat(lang);
  const cards = [
    { view: 'students' as const, title: copy.studentsCard, description: copy.studentsDescription, icon: GraduationCap },
    { view: 'specialists' as const, title: copy.specialistsCard, description: copy.specialistsDescription, icon: Stethoscope },
  ];
  const statistics = [
    { id: 'total', label: copy.total, count: counts ? counts.students + counts.curious + counts.specialists : null },
    { id: 'students', label: copy.students, count: counts?.students ?? null },
    { id: 'curious', label: copy.explorers, count: counts?.curious ?? null },
    { id: 'specialists', label: copy.specialists, count: counts?.specialists ?? null },
  ];
  return <section data-professor-overview className="space-y-6">
    <div>
      <dl className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-busy={loading}>
        {statistics.map(({ id, label, count }, index) => <div key={id} className={`rounded-2xl border p-5 ${index === 0 ? 'border-brand-800 bg-brand-800 text-white' : 'border-ink-100 bg-white text-ink-900'}`}>
          <dt className={`text-xs font-semibold ${index === 0 ? 'text-brand-100' : 'text-ink-500'}`}>{label}</dt>
          <dd data-professor-count={id} className="mt-3 text-3xl font-semibold tabular-nums">{count === null || loading ? '—' : number.format(count)}</dd>
        </div>)}
      </dl>
      {loading && <p role="status" className="mt-3 text-sm text-ink-500">{copy.loading}</p>}
      <p className="mt-3 text-xs leading-relaxed text-ink-500">{copy.countsNotice}</p>
    </div>

    <div className="grid gap-4 xl:grid-cols-2">
      {cards.map(({ view, title, description, icon: Icon }) => <button
        key={view} type="button" data-professor-action={view} onClick={() => onSelectView(view)}
        className="flex min-h-44 flex-col items-start rounded-2xl border border-ink-100 bg-white p-6 text-left shadow-soft transition hover:border-brand-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600"
      >
        <Icon className="mb-4 h-6 w-6 text-brand-700" aria-hidden="true" />
        <span className="font-display text-xl font-semibold text-ink-900">{title}</span>
        <span className="mt-2 text-sm leading-relaxed text-ink-500">{description}</span>
        <span className="mt-auto inline-flex items-center gap-2 pt-5 text-sm font-semibold text-brand-800">{copy.open}<ArrowRight className="h-4 w-4" aria-hidden="true" /></span>
      </button>)}
    </div>

    <section className="rounded-2xl border border-brand-100 bg-white p-5 sm:p-6" aria-labelledby="professor-exports-heading">
      <h2 id="professor-exports-heading" className="flex items-center gap-2 font-display text-xl font-semibold text-ink-900"><Download className="h-5 w-5 text-brand-700" aria-hidden="true" />{copy.exportsTitle}</h2>
      <p className="mt-3 max-w-4xl text-sm leading-relaxed text-ink-600">{copy.exportsDescription}</p>
      <p className="mt-2 text-xs text-ink-500">{copy.exportLimit}</p>
      <div className="mt-4 flex flex-wrap gap-3">
        {(['students', 'specialists'] as const).map(view => <button key={view} type="button" data-professor-export={view} onClick={() => onOpenExports(view)} className="min-h-11 rounded-xl border border-brand-200 px-4 py-3 text-sm font-semibold text-brand-800 transition hover:bg-brand-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600">{view === 'students' ? copy.exportStudents : copy.exportSpecialists}</button>)}
      </div>
      <p className="mt-5 flex items-start gap-2 text-xs leading-relaxed text-ink-500"><ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />{copy.exportSafety}</p>
    </section>
  </section>;
}
