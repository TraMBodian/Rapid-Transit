import React, { useMemo, useState } from 'react';
import {
  Archive,
  ArrowRight,
  Container as ContainerIcon,
  FileSpreadsheet,
  MessageSquarePlus,
  Receipt,
} from 'lucide-react';
import {
  ChatterLog,
  CurrencyCode,
  ErpAppId,
  TransitClient,
  TransitDossier,
  TransitInvoice,
  TransitQuote,
} from '../../types/erp';
import { Container, LifecycleStep } from '../../types/transit';
import {
  calculateContainerDemurrage,
  LIFECYCLE_STEPS,
} from '../../utils/transitUtils';
import {
  computeTransitInvoiceBalance,
  formatErpMoney,
} from '../../utils/erpUtils';
import { StatusBadge } from '../StatusBadge';

interface ErpDashboardProps {
  currency: CurrencyCode;
  dossiers: TransitDossier[];
  containers: Container[];
  quotes: TransitQuote[];
  invoices: TransitInvoice[];
  clients: TransitClient[];
  chatter: ChatterLog[];
  onSelectApp: (app: ErpAppId) => void;
  onOpenQuickContainer: () => void;
  onAddChatterNote: (message: string) => void;
}

export const ErpDashboard: React.FC<ErpDashboardProps> = ({
  currency,
  dossiers,
  containers,
  quotes,
  invoices,
  clients,
  chatter,
  onSelectApp,
  onOpenQuickContainer,
  onAddChatterNote,
}) => {
  const [noteInput, setNoteInput] = useState('');
  const [chatterFilter, setChatterFilter] = useState<'ALL' | 'NOTE' | 'SYSTEM'>(
    'ALL'
  );

  const stats = useMemo(() => {
    const activeDossiers = dossiers.filter((d) => !d.archived);
    const activeIds = new Set(activeDossiers.map((d) => d.id));
    const activeContainers = containers.filter(
      (c) => activeIds.has(c.dossierId) && c.step !== 'VIDE_RESTITUE'
    );

    const alerts = activeContainers
      .map((c) => ({
        container: c,
        dossier: activeDossiers.find((d) => d.id === c.dossierId),
        demurrage: calculateContainerDemurrage(c),
      }))
      .filter(
        (x) => x.demurrage.status === 'red' || x.demurrage.status === 'orange'
      )
      .sort((a, b) =>
        a.demurrage.status === b.demurrage.status
          ? b.demurrage.accruedFeeXof - a.demurrage.accruedFeeXof
          : a.demurrage.status === 'red'
          ? -1
          : 1
      );

    const totalDemurrageXof = alerts.reduce(
      (sum, x) => sum + x.demurrage.accruedFeeXof,
      0
    );

    const pendingQuotes = quotes.filter((q) => q.status !== 'INVOICED');
    const unpaidBalanceXof = invoices.reduce(
      (sum, inv) => sum + computeTransitInvoiceBalance(inv).balance,
      0
    );
    const collectedXof = invoices.reduce(
      (sum, inv) => sum + computeTransitInvoiceBalance(inv).paid,
      0
    );
    const archivedCount = dossiers.filter((d) => d.archived).length;

    const stageCounts = LIFECYCLE_STEPS.map((st) => ({
      ...st,
      count: containers.filter(
        (c) => activeIds.has(c.dossierId) && c.step === st.key
      ).length,
    }));

    return {
      activeDossiersCount: activeDossiers.length,
      activeContainersCount: activeContainers.length,
      allActiveScopeCount: containers.filter((c) => activeIds.has(c.dossierId))
        .length,
      alerts,
      totalDemurrageXof,
      pendingQuotesCount: pendingQuotes.length,
      unpaidBalanceXof,
      collectedXof,
      archivedCount,
      stageCounts,
    };
  }, [dossiers, containers, quotes, invoices]);

  const filteredChatter = useMemo(() => {
    if (chatterFilter === 'ALL') return chatter;
    return chatter.filter((c) => c.kind === chatterFilter);
  }, [chatter, chatterFilter]);

  const handleNoteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteInput.trim()) return;
    onAddChatterNote(noteInput.trim());
    setNoteInput('');
  };

  const STAGE_COLORS: Record<LifecycleStep, string> = {
    EN_MER: 'bg-sky-500',
    ARRIVE_PORT: 'bg-amber-500',
    DEDOUANE: 'bg-teal-600',
    SORTIE_PARC: 'bg-indigo-500',
    LIVRE_CLIENT: 'bg-emerald-500',
    VIDE_RESTITUE: 'bg-slate-400 dark:bg-slate-600',
  };

  return (
    <div className="space-y-6">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white [text-wrap:balance]">
            Pilotage Transitaire
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Parc conteneurs actif, exposition aux surestaries, devis et encaissements.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onOpenQuickContainer}
            className="px-3.5 py-2 min-h-[40px] text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer whitespace-nowrap"
          >
            + Saisir réf. conteneur
          </button>
          <button
            type="button"
            onClick={() => onSelectApp('quotes')}
            className="px-4 py-2 min-h-[40px] text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 rounded-lg cursor-pointer whitespace-nowrap"
          >
            Créer un devis
          </button>
        </div>
      </div>

      {/* 4 Transitaire KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => onSelectApp('transit')}
          className="text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-teal-600/50 dark:hover:border-teal-500/50 rounded-xl p-5 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Conteneurs actifs</span>
            <ContainerIcon
              className="w-4 h-4 text-teal-700 dark:text-teal-400"
              aria-hidden="true"
            />
          </div>
          <p className="font-mono text-2xl font-semibold text-slate-900 dark:text-white tabular-nums mt-3">
            {stats.activeContainersCount} unités
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {stats.activeDossiersCount} dossiers ouverts
          </p>
        </button>

        <button
          type="button"
          onClick={() => onSelectApp('transit')}
          className="text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-red-500/50 rounded-xl p-5 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Surestaries courues</span>
            <span className="font-mono text-xs font-semibold text-red-700 dark:text-red-400 tabular-nums">
              {stats.alerts.length} alerte(s)
            </span>
          </div>
          <p className="font-mono text-2xl font-semibold text-red-700 dark:text-red-400 tabular-nums mt-3">
            {formatErpMoney(stats.totalDemurrageXof, currency)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Exposition armateur à refacturer
          </p>
        </button>

        <button
          type="button"
          onClick={() => onSelectApp('invoicing')}
          className="text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-teal-600/50 dark:hover:border-teal-500/50 rounded-xl p-5 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Reste à encaisser</span>
            <FileSpreadsheet
              className="w-4 h-4 text-amber-600 dark:text-amber-400"
              aria-hidden="true"
            />
          </div>
          <p className="font-mono text-2xl font-semibold text-slate-900 dark:text-white tabular-nums mt-3">
            {formatErpMoney(stats.unpaidBalanceXof, currency)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {stats.pendingQuotesCount} devis ouvert(s) ·{' '}
            {formatErpMoney(stats.collectedXof, currency)} encaissés
          </p>
        </button>

        <button
          type="button"
          onClick={() => onSelectApp('archive')}
          className="text-left bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-teal-600/50 dark:hover:border-teal-500/50 rounded-xl p-5 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Dossiers archivés</span>
            <Archive
              className="w-4 h-4 text-slate-500 dark:text-slate-400"
              aria-hidden="true"
            />
          </div>
          <p className="font-mono text-2xl font-semibold text-slate-900 dark:text-white tabular-nums mt-3">
            {stats.archivedCount} clôturés
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            B/L, GAINDE & factures classés
          </p>
        </button>
      </div>

      {/* Live 6-Stage Container Pipeline */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Répartition du parc conteneurs par étape
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Suivi en temps réel des dossiers actifs ({stats.allActiveScopeCount} unités)
            </p>
          </div>
          <button
            type="button"
            onClick={() => onSelectApp('transit')}
            className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 dark:text-teal-400 hover:underline cursor-pointer"
          >
            <span>Gérer les étapes</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Segmented Proportional Bar */}
        <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
          {stats.stageCounts.map((st) => {
            if (st.count === 0 || stats.allActiveScopeCount === 0) return null;
            const pct = (st.count / stats.allActiveScopeCount) * 100;
            return (
              <div
                key={st.key}
                className={`${STAGE_COLORS[st.key]} h-full transition-all duration-300`}
                style={{ width: `${pct}%` }}
                title={`${st.label} : ${st.count}`}
              />
            );
          })}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-1">
          {stats.stageCounts.map((st) => (
            <button
              key={st.key}
              type="button"
              onClick={() => onSelectApp('transit')}
              className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 hover:border-teal-600/40 text-left transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300 truncate">
                  {st.shortLabel}
                </span>
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${STAGE_COLORS[st.key]}`}
                  aria-hidden="true"
                />
              </div>
              <p className="font-mono text-lg font-semibold text-slate-900 dark:text-white tabular-nums mt-1">
                {st.count}
              </p>
            </button>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left 7 Cols: Demurrage Watchlist + Invoices */}
        <div className="xl:col-span-7 space-y-6">
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Alertes Franchises & Surestaries
              </h2>
              <button
                type="button"
                onClick={() => onSelectApp('transit')}
                className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 dark:text-teal-400 hover:underline cursor-pointer"
              >
                <span>Ouvrir Dossiers</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {stats.alerts.length === 0 ? (
                <p className="p-6 text-sm text-slate-500 dark:text-slate-400 text-center">
                  Aucun conteneur en dépassement ou franchise critique.
                </p>
              ) : (
                stats.alerts.map(({ container, dossier, demurrage }) => {
                  const cl = clients.find((c) => c.id === dossier?.clientId);
                  return (
                    <div
                      key={container.id}
                      className="px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <div>
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono text-sm font-semibold text-slate-900 dark:text-white">
                            {container.number}
                          </span>
                          <StatusBadge
                            status={demurrage.status}
                            label={demurrage.statusLabel}
                            compact
                          />
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {cl?.name} · {dossier?.reference} · B/L{' '}
                          {dossier?.blNumber}
                        </p>
                      </div>
                      <span className="font-mono text-xs font-semibold text-slate-800 dark:text-slate-200 shrink-0 tabular-nums">
                        {demurrage.detailText}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Factures Transit récentes
              </h2>
              <button
                type="button"
                onClick={() => onSelectApp('invoicing')}
                className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 dark:text-teal-400 hover:underline cursor-pointer"
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>Facturation</span>
              </button>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {invoices.slice(0, 5).map((inv) => {
                const cl = clients.find((c) => c.id === inv.clientId);
                const bal = computeTransitInvoiceBalance(inv);
                return (
                  <div
                    key={inv.id}
                    className="px-6 py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-semibold text-slate-900 dark:text-white">
                        {inv.number}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {cl?.name} · {inv.containerRefs.join(', ')}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-mono text-sm font-semibold text-slate-900 dark:text-white tabular-nums">
                        {formatErpMoney(bal.totalTtc, currency)}
                      </span>
                      <StatusBadge
                        status={
                          inv.status === 'PAID'
                            ? 'green'
                            : inv.status === 'PARTIAL' || inv.status === 'DRAFT'
                            ? 'orange'
                            : 'red'
                        }
                        label={
                          inv.status === 'PAID'
                            ? 'Payée'
                            : inv.status === 'PARTIAL'
                            ? 'Acompte'
                            : inv.status === 'DRAFT'
                            ? 'Brouillon'
                            : 'À payer'
                        }
                        compact
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* Right 5 Cols: Chatter */}
        <section className="xl:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Chatter Opérationnel
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Traçabilité conteneurs, devis et archives
              </p>
            </div>
            <div className="inline-flex p-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-[11px] font-medium">
              {(['ALL', 'NOTE', 'SYSTEM'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setChatterFilter(k)}
                  className={`px-2 py-1 rounded-md cursor-pointer transition-colors ${
                    chatterFilter === k
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {k === 'ALL' ? 'Tout' : k === 'NOTE' ? 'Notes' : 'Système'}
                </button>
              ))}
            </div>
          </div>

          <form
            onSubmit={handleNoteSubmit}
            className="p-4 bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 flex gap-2"
          >
            <input
              type="text"
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              placeholder="Ajouter une consigne de suivi transit..."
              className="flex-1 h-10 px-3 text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:border-teal-600"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-3.5 h-10 text-xs font-semibold text-white bg-slate-900 dark:bg-teal-600 hover:bg-slate-800 dark:hover:bg-teal-500 rounded-lg cursor-pointer shrink-0"
            >
              <MessageSquarePlus className="w-3.5 h-3.5" />
              <span>Publier</span>
            </button>
          </form>

          <div className="divide-y divide-slate-100 dark:divide-slate-800/80 max-h-[430px] overflow-y-auto">
            {filteredChatter.map((entry) => (
              <div key={entry.id} className="px-5 py-3.5 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {entry.author}{' '}
                    <span className="font-normal text-slate-400 dark:text-slate-500">
                      · {entry.module}
                    </span>
                  </span>
                  <span className="font-mono text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">
                    {entry.timestamp}
                  </span>
                </div>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  <span className="font-mono font-medium text-teal-800 dark:text-teal-400 mr-1.5">
                    [{entry.recordRef}]
                  </span>
                  {entry.message}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};
