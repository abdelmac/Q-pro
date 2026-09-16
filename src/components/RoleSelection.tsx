import { ArrowRight, Compass, Globe2, GraduationCap, Heart, Stethoscope } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import type { ParticipantRole } from '@/lib/participantProfile';
import LanguageSwitcher from './LanguageSwitcher';

export interface RoleSelectionCopy {
  appName: string;
  title: string;
  description: string;
  introspection: string;
  perspective: string;
  connection: string;
  curiousStage: string;
  studentStage: string;
  specialistStage: string;
  creditsLabel: string;
  worldMapLabel: string;
  studentLabel: string;
  studentDescription: string;
  specialistLabel: string;
  specialistDescription: string;
  curiousLabel: string;
  curiousDescription: string;
  footerNote: string;
}

interface RoleSelectionViewProps {
  copy: RoleSelectionCopy;
  onSelectRole: (role: ParticipantRole) => void;
  onOpenCredits: () => void;
  onOpenWorldMap: () => void;
}

export function RoleSelectionView({ copy, onSelectRole, onOpenCredits, onOpenWorldMap }: RoleSelectionViewProps) {
  const choices = [
    {
      role: 'curious' as const,
      label: copy.curiousLabel,
      stage: copy.curiousStage,
      description: copy.curiousDescription,
      icon: Compass,
      iconClassName: 'bg-amber-50 text-amber-700',
    },
    {
      role: 'student' as const,
      label: copy.studentLabel,
      stage: copy.studentStage,
      description: copy.studentDescription,
      icon: GraduationCap,
      iconClassName: 'bg-brand-50 text-brand-600',
    },
    {
      role: 'specialist' as const,
      label: copy.specialistLabel,
      stage: copy.specialistStage,
      description: copy.specialistDescription,
      icon: Stethoscope,
      iconClassName: 'bg-accent-100 text-accent-700',
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-accent-50">
      <header className="flex items-center justify-between gap-4 px-6 py-5 sm:px-10 sm:py-7">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white shadow-soft">
            <Stethoscope className="h-5 w-5" strokeWidth={2.2} />
          </div>
          <span className="font-display text-lg font-semibold tracking-tight text-ink-900">{copy.appName}</span>
        </div>
        <LanguageSwitcher />
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 py-8 sm:py-12">
        <div className="mb-10 max-w-3xl text-center">
          <h1 className="font-display text-3xl font-semibold leading-tight tracking-tight text-ink-900 text-balance sm:text-5xl">
            {copy.introspection}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-ink-600">{copy.perspective}</p>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-ink-500">{copy.connection}</p>
        </div>
        <fieldset className="w-full max-w-5xl text-center">
          <legend className="w-full font-display text-xl font-semibold tracking-tight text-ink-900 sm:text-2xl">
            {copy.title}
          </legend>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-ink-500">
            {copy.description}
          </p>

          <div className="mx-auto mt-6 grid max-w-5xl gap-4 md:grid-cols-3">
            {choices.map(({ role, label, stage, description, icon: Icon, iconClassName }) => (
              <button
                key={role}
                type="button"
                data-participant-role={role}
                onClick={() => onSelectRole(role)}
                className="group flex min-h-44 items-start gap-4 rounded-2xl border border-ink-100 bg-white p-6 text-left shadow-soft transition-all hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-lift focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
              >
                <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${iconClassName}`}>
                  <Icon className="h-6 w-6" strokeWidth={2} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col self-stretch">
                  <span className="mb-2 text-xs font-semibold text-brand-700">{stage}</span>
                  <span className="text-lg font-semibold text-ink-900">{label}</span>
                  <span className="mt-2 text-sm leading-relaxed text-ink-500">{description}</span>
                  <span className="mt-auto flex justify-end pt-4 text-brand-700 transition-transform group-hover:translate-x-0.5" aria-hidden="true">
                    <ArrowRight className="h-5 w-5" />
                  </span>
                </span>
              </button>
            ))}
          </div>
        </fieldset>
      </main>

      <footer className="px-6 py-6 text-center text-xs text-ink-500">
        <nav className="mb-3 flex flex-wrap justify-center gap-2">
          <button type="button" onClick={onOpenWorldMap} className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 font-semibold hover:bg-white hover:text-brand-800 focus-visible:ring-2 focus-visible:ring-brand-500">
            <Globe2 className="h-4 w-4" aria-hidden="true" />{copy.worldMapLabel}
          </button>
          <button type="button" onClick={onOpenCredits} className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 font-semibold hover:bg-white hover:text-brand-800 focus-visible:ring-2 focus-visible:ring-brand-500">
            <Heart className="h-4 w-4" aria-hidden="true" />{copy.creditsLabel}
          </button>
        </nav>
        {copy.footerNote}
      </footer>
    </div>
  );
}

export default function RoleSelection({ onSelectRole, onOpenCredits, onOpenWorldMap }: Omit<RoleSelectionViewProps, 'copy'>) {
  const { t } = useLanguage();

  return (
    <RoleSelectionView
      onSelectRole={onSelectRole}
      onOpenCredits={onOpenCredits}
      onOpenWorldMap={onOpenWorldMap}
      copy={{
        appName: t.appName,
        title: t.roleSelectionTitle,
        description: t.roleSelectionDescription,
        introspection: t.roleIntrospection,
        perspective: t.projectPerspective,
        connection: t.projectConnection,
        curiousStage: t.curiousStage,
        studentStage: t.studentStage,
        specialistStage: t.specialistStage,
        creditsLabel: t.navCredits,
        worldMapLabel: t.navWorldMap,
        studentLabel: t.studentMode,
        studentDescription: t.studentRoleDescription,
        specialistLabel: t.specialistMode,
        specialistDescription: t.specialistRoleDescription,
        curiousLabel: t.curiousMode,
        curiousDescription: t.curiousRoleDescription,
        footerNote: t.footerNote,
      }}
    />
  );
}
