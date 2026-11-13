import React, { useState } from 'react';
import {
  Anchor,
  Archive,
  BarChart3,
  Building2,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  LayoutGrid,
  Moon,
  Receipt,
  RotateCcw,
  Sun,
  X,
} from 'lucide-react';
import { ErpAppId } from '../../types/erp';

interface ErpSidebarProps {
  activeApp: ErpAppId;
  onSelectApp: (app: ErpAppId) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onResetDemo: () => void;
  counts: {
    activeContainers: number;
    transitAlerts: number;
    quotesOpen: number;
    unpaidInvoices: number;
    archivedDossiers: number;
    clientsTotal: number;
  };
}

export const ErpSidebar: React.FC<ErpSidebarProps> = ({
  activeApp,
  onSelectApp,
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
  theme,
  onToggleTheme,
  onResetDemo,
  counts,
}) => {
  const [avatarFailed, setAvatarFailed] = useState(false);

  const navItems: {
    id: ErpAppId;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    count?: number;
    alertCount?: number;
  }[] = [
    { id: 'dashboard', label: 'Tableau de bord', icon: BarChart3 },
    {
      id: 'transit',
      label: 'Dossiers & Conteneurs',
      icon: Anchor,
      count: counts.activeContainers,
      alertCount: counts.transitAlerts,
    },
    {
      id: 'quotes',
      label: 'Devis Transit',
      icon: FileSpreadsheet,
      count: counts.quotesOpen,
    },
    {
      id: 'invoicing',
      label: 'Facturation',
      icon: Receipt,
      count: counts.unpaidInvoices,
    },
    {
      id: 'archive',
      label: 'Archivage',
      icon: Archive,
      count: counts.archivedDossiers,
    },
    {
      id: 'clients',
      label: 'Clients & Tarifs',
      icon: Building2,
      count: counts.clientsTotal,
    },
  ];

  const handleNav = (id: ErpAppId) => {
    onSelectApp(id);
    onCloseMobile();
  };

  const sidebarContent = (isMobileDrawer: boolean) => {
    const isCompact = !isMobileDrawer && collapsed;
    return (
      <div className="flex flex-col h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 select-none">
        {/* Top Brand + App Launcher Trigger */}
        <div
          className={`h-14 px-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center ${
            isCompact ? 'justify-center' : 'justify-between'
          } gap-2 shrink-0`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => handleNav('launcher')}
              className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                activeApp === 'launcher'
                  ? 'bg-teal-700 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-teal-50 hover:text-teal-800 dark:hover:bg-teal-950/60 dark:hover:text-teal-300'
              }`}
              title="Lanceur d'applications OdooTransit"
              aria-label="Ouvrir le lanceur d'applications"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            {!isCompact && (
              <button
                type="button"
                onClick={() => handleNav('dashboard')}
                className="font-display font-bold text-base tracking-tight text-slate-900 dark:text-white whitespace-nowrap cursor-pointer"
              >
                OdooTransit
              </button>
            )}
          </div>

          {isMobileDrawer ? (
            <button
              type="button"
              onClick={onCloseMobile}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white cursor-pointer"
              aria-label="Fermer le menu"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            !isCompact && (
              <button
                type="button"
                onClick={onToggleCollapse}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                title="Réduire la barre latérale"
                aria-label="Réduire la barre latérale"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )
          )}
        </div>

        {isCompact && (
          <div className="px-2 pt-3 flex justify-center">
            <button
              type="button"
              onClick={onToggleCollapse}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800 cursor-pointer"
              title="Déployer la barre latérale"
              aria-label="Déployer la barre latérale"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Primary Module Navigation */}
        <nav
          className="flex-1 overflow-y-auto px-2.5 py-4 space-y-1"
          aria-label="Modules Transitaire"
        >
          {!isCompact && (
            <p className="px-2.5 pb-1.5 text-[11px] font-medium text-slate-400 dark:text-slate-500">
              Opérations & Comptabilité
            </p>
          )}
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeApp === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNav(item.id)}
                title={isCompact ? item.label : undefined}
                className={`w-full flex items-center ${
                  isCompact ? 'justify-center px-2' : 'justify-between px-3'
                } py-2.5 min-h-[40px] rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  active
                    ? 'bg-teal-50 text-teal-900 dark:bg-teal-950/60 dark:text-teal-200'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      active
                        ? 'text-teal-700 dark:text-teal-400'
                        : 'text-slate-400 dark:text-slate-500'
                    }`}
                    aria-hidden="true"
                  />
                  {!isCompact && (
                    <span className="truncate whitespace-nowrap">
                      {item.label}
                    </span>
                  )}
                </span>

                {!isCompact && (item.alertCount || item.count !== undefined) && (
                  <span className="flex items-center gap-1.5 shrink-0">
                    {item.alertCount !== undefined && item.alertCount > 0 && (
                      <span className="font-mono text-[11px] font-semibold text-red-700 dark:text-red-400 tabular-nums">
                        {item.alertCount}!
                      </span>
                    )}
                    {item.count !== undefined && (
                      <span
                        className={`font-mono text-xs tabular-nums ${
                          active
                            ? 'text-teal-800 dark:text-teal-300 font-semibold'
                            : 'text-slate-400 dark:text-slate-500'
                        }`}
                      >
                        {item.count}
                      </span>
                    )}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom Utilities: Theme + Reset + User Profile */}
        <div className="p-2.5 border-t border-slate-200 dark:border-slate-800 space-y-1.5 shrink-0">
          <button
            type="button"
            onClick={onToggleTheme}
            title={
              theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'
            }
            className={`w-full flex items-center ${
              isCompact ? 'justify-center px-2' : 'justify-between px-3'
            } py-2 min-h-[38px] rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer`}
          >
            <span className="flex items-center gap-2.5">
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400 shrink-0" />
              ) : (
                <Moon className="w-4 h-4 text-slate-500 shrink-0" />
              )}
              {!isCompact && (
                <span className="whitespace-nowrap">
                  {theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
                </span>
              )}
            </span>
          </button>

          <button
            type="button"
            onClick={onResetDemo}
            title="Réinitialiser les données de démonstration"
            className={`w-full flex items-center ${
              isCompact ? 'justify-center px-2' : 'gap-2.5 px-3'
            } py-2 min-h-[38px] rounded-lg text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer`}
          >
            <RotateCcw className="w-3.5 h-3.5 shrink-0" />
            {!isCompact && (
              <span className="whitespace-nowrap">Réinitialiser démo</span>
            )}
          </button>

          <div
            className={`pt-2 mt-1 border-t border-slate-100 dark:border-slate-800/80 flex items-center ${
              isCompact ? 'justify-center' : 'gap-2.5 px-2'
            } py-1.5`}
          >
            {!avatarFailed ? (
              <img
                src="/src/assets/images/avatar_transitaire_director_1794586296698.jpg"
                alt="Ousmane Diop"
                referrerPolicy="no-referrer"
                onError={() => setAvatarFailed(true)}
                className="w-8 h-8 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-teal-700 text-white text-xs font-semibold flex items-center justify-center shrink-0">
                OD
              </div>
            )}
            {!isCompact && (
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                  Ousmane Diop
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  Directeur Transit · Dakar
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside
        className={`hidden lg:block shrink-0 transition-[width] duration-200 no-print ${
          collapsed ? 'w-[72px]' : 'w-[252px]'
        }`}
      >
        <div className="sticky top-0 h-screen">{sidebarContent(false)}</div>
      </aside>

      {/* Mobile / Tablet Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex no-print">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative w-72 max-w-[85vw] h-full z-10">
            {sidebarContent(true)}
          </div>
        </div>
      )}
    </>
  );
};
