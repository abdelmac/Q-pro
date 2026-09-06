import { ArrowRight, Compass, GraduationCap, Stethoscope } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import type { ParticipantRole } from '@/lib/participantProfile';
import LanguageSwitcher from './LanguageSwitcher';

export interface RoleSelectionCopy {
  appName: string;
  title: string;
  description: string;
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
}

export function RoleSelectionView({ copy, onSelectRole }: RoleSelectionViewProps) {
  const choices = [
    {
      role: 'student' as const,
      label: copy.studentLabel,
      description: copy.studentDescription,
      icon: GraduationCap,
      iconClassName: 'bg-brand-50 text-brand-600',
    },
    {
      role: 'specialist' as const,
      label: copy.specialistLabel,
      description: copy.specialistDescription,
      icon: Stethoscope,
      iconClassName: 'bg-accent-100 text-accent-700',
    },
    {
      role: 'curious' as const,
      label: copy.curiousLabel,
      description: copy.curiousDescription,
      icon: Compass,
      iconClassName: 'bg-amber-50 text-amber-700',
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

      <main className="flex flex-1 items-center justify-center px-6 py-12 sm:py-16">
        <fieldset className="w-full max-w-5xl text-center">
          <legend className="w-full font-display text-3xl font-semibold tracking-tight text-ink-900 sm:text-5xl">
            {copy.title}
          </legend>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-ink-500 sm:text-lg">
            {copy.description}
          </p>

          <div className="mx-auto mt-10 grid max-w-5xl gap-4 md:grid-cols-3">
            {choices.map(({ role, label, description, icon: Icon, iconClassName }) => (
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

      <footer className="px-6 py-8 text-center text-xs text-ink-400">{copy.footerNote}</footer>
    </div>
  );
}

export default function RoleSelection({ onSelectRole }: { onSelectRole: (role: ParticipantRole) => void }) {
  const { t } = useLanguage();

  return (
    <RoleSelectionView
      onSelectRole={onSelectRole}
      copy={{
        appName: t.appName,
        title: t.roleSelectionTitle,
        description: t.roleSelectionDescription,
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
