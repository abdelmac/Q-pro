import {
  GitCompare,
  GraduationCap,
  Settings2,
  Stethoscope,
  type LucideIcon,
} from 'lucide-react';
import type { Language } from '@/data/i18n';

export type CohortView = 'specialists' | 'students';
export type DashboardView = CohortView | 'algorithm' | 'configuration';

export interface DashboardNavItem {
  id: DashboardView;
  label: string;
  section: 'data' | 'method' | 'administration';
  icon: LucideIcon;
}

export function isCohortView(view: DashboardView): view is CohortView {
  return view === 'specialists' || view === 'students';
}

export function pushDashboardViewHistory(
  history: readonly DashboardView[],
  currentView: DashboardView,
  nextView: DashboardView,
): DashboardView[] {
  return currentView === nextView ? [...history] : [...history, currentView];
}

export function popDashboardViewHistory(history: readonly DashboardView[]): {
  previousView: DashboardView | null;
  remainingHistory: DashboardView[];
} {
  if (history.length === 0) return { previousView: null, remainingHistory: [] };
  return {
    previousView: history[history.length - 1],
    remainingHistory: history.slice(0, -1),
  };
}

export function participantRoleLabel(value: string, lang: Language): string {
  if (value === 'curious') {
    return lang === 'fr' ? 'Découverte de la médecine' : lang === 'ro' ? 'Explorează medicina' : 'Exploring medicine';
  }
  if (value === 'student') {
    return lang === 'fr' ? 'Étudiant en médecine' : lang === 'ro' ? 'Student la medicină' : 'Medical student';
  }
  return value;
}

export function participantRoleSupportsStudyYear(value: string): boolean {
  return value !== 'curious';
}

export function getDashboardNavItems(canEdit: boolean, lang: Language): DashboardNavItem[] {
  const items: DashboardNavItem[] = [
    {
      id: 'specialists',
      label: lang === 'fr' ? 'Spécialistes' : lang === 'ro' ? 'Specialiști' : 'Specialists',
      section: 'data',
      icon: Stethoscope,
    },
    {
      id: 'students',
      label: lang === 'fr' ? 'Étudiants & explorateurs' : lang === 'ro' ? 'Studenți și exploratori' : 'Students & explorers',
      section: 'data',
      icon: GraduationCap,
    },
    {
      id: 'algorithm',
      label: lang === 'fr' ? 'Comprendre l’algorithme' : lang === 'ro' ? 'Cum funcționează algoritmul' : 'How the algorithm works',
      section: 'method',
      icon: GitCompare,
    },
  ];

  if (canEdit) {
    items.push({
      id: 'configuration',
      label: lang === 'ro' ? 'Configurare' : 'Configuration',
      section: 'administration',
      icon: Settings2,
    });
  }

  return items;
}
