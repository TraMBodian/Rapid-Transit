import React from 'react';
import { Menu, Plus, Search } from 'lucide-react';
import { CurrencyCode, ErpAppId } from '../../types/erp';

interface ErpHeaderProps {
  activeApp: ErpAppId;
  onSelectApp: (app: ErpAppId) => void;
  currency: CurrencyCode;
  onChangeCurrency: (cur: CurrencyCode) => void;
  onOpenMobileMenu: () => void;
  onOpenCommandPalette: () => void;
  onOpenQuickContainer: () => void;
}

const APP_NAMES: Record<ErpAppId, string> = {
  launcher: 'Applications',
  dashboard: 'Tableau de bord',
  transit: 'Dossiers & Conteneurs',
  quotes: 'Devis Transit',
  invoicing: 'Facturation',
  archive: 'Archivage',
  clients: 'Clients & Tarifs',
};

export const ErpHeader: React.FC<ErpHeaderProps> = ({
  activeApp,
  onSelectApp,
  currency,
  onChangeCurrency,
  onOpenMobileMenu,
  onOpenCommandPalette,
  onOpenQuickContainer,
}) => {
  return (
    <header className="sticky top-0 z-30 h-14 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 lg:px-6 flex items-center justify-between gap-4 no-print">
      {/* Zone 1: Mobile Menu + Breadcrumb */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="lg:hidden p-2 -ml-1 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          aria-label="Ouvrir la navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 text-sm min-w-0">
          <button
            type="button"
            onClick={() => onSelectApp('launcher')}
            className="font-display font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
          >
            OdooTransit
          </button>
          <span
            className="text-slate-300 dark:text-slate-600"
            aria-hidden="true"
          >
            /
          </span>
          <span className="font-semibold text-slate-900 dark:text-white truncate">
            {APP_NAMES[activeApp]}
          </span>
        </div>
      </div>

      {/* Zone 2: Command Palette Trigger */}
      <div className="flex-1 max-w-md hidden sm:flex justify-center">
        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="w-full h-9 px-3 flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400 bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg hover:border-slate-300 dark:hover:border-slate-600 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-2 truncate">
            <Search className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">
              Rechercher conteneur ISO, B/L, devis, facture...
            </span>
          </span>
          <kbd className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 shrink-0">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Zone 3: Search icon (mobile) + Currency + Primary CTA */}
      <div className="flex items-center gap-2.5 shrink-0">
        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="sm:hidden p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          aria-label="Recherche rapide"
        >
          <Search className="w-4 h-4" />
        </button>

        <select
          value={currency}
          onChange={(e) => onChangeCurrency(e.target.value as CurrencyCode)}
          aria-label="Devise d'affichage"
          className="h-9 px-2.5 text-xs font-mono font-semibold bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:border-teal-600 cursor-pointer"
        >
          <option value="XOF">XOF</option>
          <option value="EUR">EUR</option>
          <option value="USD">USD</option>
        </select>

        <button
          type="button"
          onClick={onOpenQuickContainer}
          className="inline-flex items-center gap-1.5 h-9 px-3.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>Réf. Conteneur</span>
        </button>
      </div>
    </header>
  );
};
