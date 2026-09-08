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
      label: lang === 'fr' ? 'Étudiants' : lang === 'ro' ? 'Studenți' : 'Students',
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
