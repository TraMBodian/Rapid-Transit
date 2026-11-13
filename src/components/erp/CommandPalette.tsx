import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Anchor,
  Archive,
  ArrowRight,
  Building2,
  Container as ContainerIcon,
  FilePlus2,
  FileSpreadsheet,
  Moon,
  Receipt,
  Search,
  Sun,
  X,
} from 'lucide-react';
import {
  ErpAppId,
  TransitClient,
  TransitDossier,
  TransitInvoice,
  TransitQuote,
} from '../../types/erp';
import { Container } from '../../types/transit';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectApp: (app: ErpAppId) => void;
  onOpenQuickContainer: () => void;
  onToggleTheme: () => void;
  theme: 'light' | 'dark';
  clients: TransitClient[];
  dossiers: TransitDossier[];
  containers: Container[];
  quotes: TransitQuote[];
  invoices: TransitInvoice[];
}

interface PaletteEntry {
  id: string;
  title: string;
  subtitle: string;
  group: string;
  icon: React.ComponentType<{ className?: string }>;
  action: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onSelectApp,
  onOpenQuickContainer,
  onToggleTheme,
  theme,
  clients,
  dossiers,
  containers,
  quotes,
  invoices,
}) => {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [isOpen]);

  const entries = useMemo<PaletteEntry[]>(() => {
    const q = query.trim().toLowerCase();

    const quickActions: PaletteEntry[] = [
      {
        id: 'act-container',
        title: 'Saisir une référence conteneur (ISO 6346)',
        subtitle: 'Enregistrement rapide ou import en lot',
        group: 'Actions rapides',
        icon: FilePlus2,
        action: () => {
          onClose();
          onOpenQuickContainer();
        },
      },
      {
        id: 'act-quote',
        title: 'Ouvrir Devis Transit',
        subtitle: 'Créer ou convertir un devis transitaire',
        group: 'Actions rapides',
        icon: FileSpreadsheet,
        action: () => {
          onSelectApp('quotes');
          onClose();
        },
      },
      {
        id: 'act-invoice',
        title: 'Ouvrir Facturation',
        subtitle: 'Factures, encaissements et reçus PDF',
        group: 'Actions rapides',
        icon: Receipt,
        action: () => {
          onSelectApp('invoicing');
          onClose();
        },
      },
      {
        id: 'act-archive',
        title: 'Ouvrir Archivage douanier',
        subtitle: 'Dossiers clôturés & contrôle des 5 pièces',
        group: 'Actions rapides',
        icon: Archive,
        action: () => {
          onSelectApp('archive');
          onClose();
        },
      },
      {
        id: 'act-theme',
        title:
          theme === 'dark'
            ? 'Basculer en mode clair'
            : 'Basculer en mode sombre',
        subtitle: 'Apparence de l’espace de travail',
        group: 'Actions rapides',
        icon: theme === 'dark' ? Sun : Moon,
        action: () => {
          onToggleTheme();
          onClose();
        },
      },
    ];

    if (!q) {
      return quickActions;
    }

    const matchedContainers: PaletteEntry[] = containers
      .filter((c) => c.number.toLowerCase().includes(q))
      .slice(0, 5)
      .map((c) => {
        const dos = dossiers.find((d) => d.id === c.dossierId);
        return {
          id: `cnt-${c.id}`,
          title: c.number,
          subtitle: `${c.type} · ${dos?.reference || ''} · B/L ${
            dos?.blNumber || ''
          }`,
          group: dos?.archived ? 'Conteneurs archivés' : 'Conteneurs actifs',
          icon: ContainerIcon,
          action: () => {
            onSelectApp(dos?.archived ? 'archive' : 'transit');
            onClose();
          },
        };
      });

    const matchedDossiers: PaletteEntry[] = dossiers
      .filter(
        (d) =>
          d.reference.toLowerCase().includes(q) ||
          d.blNumber.toLowerCase().includes(q) ||
          (d.archiveBoxRef || '').toLowerCase().includes(q)
      )
      .slice(0, 5)
      .map((d) => {
        const cl = clients.find((c) => c.id === d.clientId);
        return {
          id: `dos-${d.id}`,
          title: `${d.reference} · B/L ${d.blNumber}`,
          subtitle: `${cl?.name || ''} · ${d.shippingLine}`,
          group: d.archived ? 'Dossiers archivés' : 'Dossiers actifs',
          icon: d.archived ? Archive : Anchor,
          action: () => {
            onSelectApp(d.archived ? 'archive' : 'transit');
            onClose();
          },
        };
      });

    const matchedQuotes: PaletteEntry[] = quotes
      .filter((x) => x.number.toLowerCase().includes(q))
      .slice(0, 4)
      .map((x) => ({
        id: `q-${x.id}`,
        title: x.number,
        subtitle: `Devis · ${x.containerRefs.join(', ')}`,
        group: 'Devis Transit',
        icon: FileSpreadsheet,
        action: () => {
          onSelectApp('quotes');
          onClose();
        },
      }));

    const matchedInvoices: PaletteEntry[] = invoices
      .filter((i) => i.number.toLowerCase().includes(q))
      .slice(0, 4)
      .map((i) => ({
        id: `inv-${i.id}`,
        title: i.number,
        subtitle: `Facture · ${i.containerRefs.join(', ')}`,
        group: 'Facturation',
        icon: Receipt,
        action: () => {
          onSelectApp('invoicing');
          onClose();
        },
      }));

    const matchedClients: PaletteEntry[] = clients
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.ninea.toLowerCase().includes(q)
      )
      .slice(0, 4)
      .map((c) => ({
        id: `cli-${c.id}`,
        title: c.name,
        subtitle: `NINEA ${c.ninea} · ${c.city}`,
        group: 'Clients',
        icon: Building2,
        action: () => {
          onSelectApp('clients');
          onClose();
        },
      }));

    const filteredActions = quickActions.filter((a) =>
      a.title.toLowerCase().includes(q)
    );

    return [
      ...matchedContainers,
      ...matchedDossiers,
      ...matchedQuotes,
      ...matchedInvoices,
      ...matchedClients,
      ...filteredActions,
    ];
  }, [
    query,
    containers,
    dossiers,
    quotes,
    invoices,
    clients,
    theme,
    onClose,
    onOpenQuickContainer,
    onSelectApp,
    onToggleTheme,
  ]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  if (!isOpen) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (entries.length ? (prev + 1) % entries.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) =>
        entries.length ? (prev - 1 + entries.length) % entries.length : 0
      );
    } else if (e.key === 'Enter' && entries[activeIndex]) {
      e.preventDefault();
      entries[activeIndex].action();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4 bg-slate-950/60 backdrop-blur-xs no-print"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        role="dialog"
        aria-modal="true"
        aria-label="Recherche globale et actions rapides"
      >
        <div className="flex items-center gap-3 px-4 h-13 border-b border-slate-200 dark:border-slate-800">
          <Search
            className="w-4 h-4 text-slate-400 shrink-0"
            aria-hidden="true"
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un n° conteneur, B/L, dossier, devis, facture ou client..."
            className="flex-1 bg-transparent text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded cursor-pointer"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto py-2">
          {entries.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-slate-500 dark:text-slate-400">
              Aucun résultat pour « {query} »
            </div>
          ) : (
            entries.map((entry, idx) => {
              const Icon = entry.icon;
              const active = idx === activeIndex;
              return (
                <button
                  key={entry.id}
                  type="button"
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={entry.action}
                  className={`w-full px-4 py-2.5 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer ${
                    active
                      ? 'bg-teal-50 dark:bg-teal-950/50 text-teal-900 dark:text-teal-100'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        active
                          ? 'text-teal-700 dark:text-teal-400'
                          : 'text-slate-400 dark:text-slate-500'
                      }`}
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {entry.title}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {entry.subtitle}
                      </p>
                    </div>
                  </div>
                  <span className="flex items-center gap-2 text-[11px] font-mono text-slate-400 dark:text-slate-500 shrink-0">
                    <span>{entry.group}</span>
                    {active && <ArrowRight className="w-3.5 h-3.5" />}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div className="px-4 py-2 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
          <span>↑↓ Naviguer · Entrée Ouvrir · Échap Fermer</span>
          <span className="font-mono">OdooTransit</span>
        </div>
      </div>
    </div>
  );
};
