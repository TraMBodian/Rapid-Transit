import React, { useState } from 'react';
import {
  Anchor,
  Archive,
  ArrowUpRight,
  BarChart3,
  Building2,
  FileSpreadsheet,
  Receipt,
  Ship,
} from 'lucide-react';
import { ErpAppId } from '../../types/erp';

interface AppLauncherProps {
  onSelectApp: (app: ErpAppId) => void;
  onOpenQuickContainer: () => void;
  counts: {
    activeContainers: number;
    transitAlerts: number;
    quotesOpen: number;
    unpaidInvoices: number;
    archivedDossiers: number;
    clientsTotal: number;
  };
}

export const AppLauncher: React.FC<AppLauncherProps> = ({
  onSelectApp,
  onOpenQuickContainer,
  counts,
}) => {
  const [bannerError, setBannerError] = useState(false);

  const apps: {
    id: ErpAppId;
    name: string;
    subtitle: string;
    stat: string;
    icon: React.ComponentType<{ className?: string }>;
    accentClass: string;
  }[] = [
    {
      id: 'dashboard',
      name: 'Tableau de bord',
      subtitle: 'Pilotage transit, pipeline conteneurs & Chatter',
      stat: 'Vue consolidée temps réel',
      icon: BarChart3,
      accentClass:
        'bg-slate-900 text-white dark:bg-slate-800 dark:text-teal-300',
    },
    {
      id: 'transit',
      name: 'Dossiers & Conteneurs',
      subtitle: 'Saisie réf. ISO, B/L, étapes & surestaries',
      stat:
        counts.transitAlerts > 0
          ? `${counts.transitAlerts} alerte(s) · ${counts.activeContainers} TC actifs`
          : `${counts.activeContainers} conteneurs actifs`,
      icon: Anchor,
      accentClass: 'bg-teal-700 text-white dark:bg-teal-600',
    },
    {
      id: 'quotes',
      name: 'Devis Transit',
      subtitle: 'Cotations liées aux références conteneurs',
      stat: `${counts.quotesOpen} devis ouvert(s)`,
      icon: FileSpreadsheet,
      accentClass: 'bg-amber-600 text-white dark:bg-amber-600',
    },
    {
      id: 'invoicing',
      name: 'Facturation',
      subtitle: 'Factures, règlements multi-devises & PDF',
      stat: `${counts.unpaidInvoices} facture(s) à solder`,
      icon: Receipt,
      accentClass: 'bg-emerald-700 text-white dark:bg-emerald-600',
    },
    {
      id: 'archive',
      name: 'Archivage',
      subtitle: 'Dossiers clôturés & contrôle 5 pièces',
      stat: `${counts.archivedDossiers} dossiers archivés`,
      icon: Archive,
      accentClass: 'bg-indigo-700 text-white dark:bg-indigo-600',
    },
    {
      id: 'clients',
      name: 'Clients & Tarifs',
      subtitle: 'Importateurs, NINEA & grille tarifaire',
      stat: `${counts.clientsTotal} comptes clients`,
      icon: Building2,
      accentClass: 'bg-sky-700 text-white dark:bg-sky-600',
    },
  ];

  return (
    <div className="max-w-5xl mx-auto py-4 sm:py-6 space-y-8">
      {/* Editorial Port Terminal Banner */}
      <section className="relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 min-h-[200px] flex items-end bg-slate-900">
        {!bannerError ? (
          <img
            src="/src/assets/images/banner_port_terminal_1794586297351.jpg"
            alt="Terminal portuaire à conteneurs"
            referrerPolicy="no-referrer"
            onError={() => setBannerError(true)}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900 flex items-center justify-end pr-12 opacity-90">
            <Ship className="w-36 h-36 text-teal-800/40" aria-hidden="true" />
          </div>
        )}
        <div
          className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/75 to-slate-950/35"
          aria-hidden="true"
        />

        <div className="relative z-10 w-full p-6 sm:p-8 flex flex-col sm:flex-row sm:items-end justify-between gap-5">
          <div className="max-w-xl space-y-2">
            <p className="text-xs font-mono text-teal-300">
              Port Autonome de Dakar · Suite Transitaire
            </p>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white [text-wrap:balance]">
              OdooTransit · Pilotage Opérationnel & Facturation
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              Centralisez la saisie des références conteneurs ISO, le suivi des franchises, la création des devis, les encaissements et l’archivage douanier.
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenQuickContainer}
            className="self-start sm:self-end px-4 py-2.5 min-h-[42px] text-xs font-semibold text-slate-950 bg-teal-400 hover:bg-teal-300 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            + Saisir réf. conteneur
          </button>
        </div>
      </section>

      {/* 6-Tile Odoo App Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {apps.map((app) => {
          const Icon = app.icon;
          return (
            <button
              key={app.id}
              type="button"
              onClick={() => onSelectApp(app.id)}
              className="group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 text-left hover:border-teal-600/60 dark:hover:border-teal-500/60 transition-colors cursor-pointer flex items-start gap-4"
            >
              <div
                className={`w-11 h-11 rounded-xl ${app.accentClass} flex items-center justify-center shrink-0 group-hover:scale-[1.03] transition-transform`}
              >
                <Icon className="w-5 h-5" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-base font-semibold text-slate-900 dark:text-white group-hover:text-teal-700 dark:group-hover:text-teal-300 transition-colors truncate">
                    {app.name}
                  </h2>
                  <ArrowUpRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-teal-600 dark:group-hover:text-teal-400 shrink-0 transition-colors" />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">
                  {app.subtitle}
                </p>
                <p className="text-xs font-mono font-medium text-slate-700 dark:text-slate-300 mt-3 tabular-nums">
                  {app.stat}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
