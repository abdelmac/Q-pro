import {
  ArrowLeft,
  BarChart3,
  LogOut,
  X,
} from 'lucide-react';
import type { Language } from '@/data/i18n';
import {
  getDashboardNavItems,
  type DashboardNavItem,
  type DashboardView,
} from '@/lib/dashboardNavigation';

interface DashboardSidebarProps {
  id?: string;
  className?: string;
  activeView: DashboardView;
  canEdit: boolean;
  lang: Language;
  displayName: string;
  portalRole: string;
  showClose?: boolean;
  onClose?: () => void;
  onSelectView: (view: DashboardView) => void;
  onBack: () => void;
  onSignOut: () => void;
}

const SECTION_ORDER: DashboardNavItem['section'][] = ['data', 'method', 'administration'];

export default function DashboardSidebar({
  id,
  className = '',
  activeView,
  canEdit,
  lang,
  displayName,
  portalRole,
  showClose = false,
  onClose,
  onSelectView,
  onBack,
  onSignOut,
}: DashboardSidebarProps) {
  const french = lang === 'fr';
  const romanian = lang === 'ro';
  const items = getDashboardNavItems(canEdit, lang);
  const roleLabels: Record<string, string> = {
    researcher: french ? 'Chercheur' : romanian ? 'Cercetător' : 'Researcher',
    doctor: french ? 'Médecin' : romanian ? 'Medic' : 'Doctor',
    professor: french ? 'Professeur' : romanian ? 'Profesor' : 'Professor',
  };
  const displayedRole = roleLabels[portalRole] ?? portalRole;
  const sectionLabels: Record<DashboardNavItem['section'], string> = {
    data: french ? 'Données de recherche' : romanian ? 'Date de cercetare' : 'Research data',
    method: french ? 'Méthode' : romanian ? 'Metodă' : 'Method',
    administration: french ? 'Administration' : romanian ? 'Administrare' : 'Administration',
  };

  return (
    <aside
      id={id}
      data-dashboard-sidebar
      aria-label={french ? 'Navigation du dashboard' : romanian ? 'Navigarea tabloului de bord' : 'Dashboard navigation'}
      className={`h-full bg-brand-950 text-white shadow-lift ${className}`}
    >
      <div className="flex h-full flex-col overflow-y-auto p-5 scrollbar-thin sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-brand-800 shadow-soft">
              <BarChart3 className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="font-display text-lg font-semibold tracking-tight">Q-Pro</p>
              <p className="mt-0.5 text-xs text-brand-200">
                {french ? 'Portail de recherche' : romanian ? 'Portal de cercetare' : 'Research portal'}
              </p>
            </div>
          </div>
          {showClose && (
            <button
              type="button"
              autoFocus
              onClick={onClose}
              aria-label={french ? 'Fermer le menu' : romanian ? 'Închide meniul' : 'Close menu'}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-brand-100 transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
        </div>

        <nav aria-label={french ? 'Sections du dashboard' : romanian ? 'Secțiunile tabloului de bord' : 'Dashboard sections'} className="mt-9 space-y-7">
          {SECTION_ORDER.map((section) => {
            const sectionItems = items.filter((item) => item.section === section);
            if (sectionItems.length === 0) return null;
            const sectionId = `${id ?? 'dashboard-sidebar'}-nav-${section}`;
            return (
              <section key={section} aria-labelledby={sectionId}>
                <h2 id={sectionId} className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-300">
                  {sectionLabels[section]}
                </h2>
                <div className="space-y-1.5">
                  {sectionItems.map((item) => {
                    const active = activeView === item.id;
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        data-dashboard-view={item.id}
                        aria-current={active ? 'page' : undefined}
                        onClick={() => onSelectView(item.id)}
                        className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white ${
                          active
                            ? 'bg-white text-brand-900 shadow-soft'
                            : 'text-brand-100 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        <Icon className={`h-5 w-5 shrink-0 ${active ? 'text-brand-600' : 'text-brand-300'}`} aria-hidden="true" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </nav>

        <div className="mt-auto pt-8">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="truncate text-sm font-semibold text-white">{displayName}</p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-brand-300">{displayedRole}</p>
          </div>
          <div className="mt-3 grid gap-2">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-brand-100 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              {french ? 'Retour au questionnaire' : romanian ? 'Înapoi la chestionar' : 'Back to questionnaire'}
            </button>
            <button
              type="button"
              onClick={onSignOut}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-brand-100 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              {french ? 'Déconnexion' : romanian ? 'Deconectare' : 'Sign out'}
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
