import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Container as ContainerIcon,
  Copy,
  Plus,
  Printer,
  Receipt,
  Search,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import {
  CurrencyCode,
  QuoteStatus,
  TransitClient,
  TransitDocLine,
  TransitDossier,
  TransitQuote,
  TransitServiceItem,
} from '../../types/erp';
import { Container } from '../../types/transit';
import {
  calculateContainerDemurrage,
  formatContainerNumberMask,
} from '../../utils/transitUtils';
import { computeTransitLinesTotals, formatErpMoney } from '../../utils/erpUtils';
import { StatusBadge } from '../StatusBadge';

interface QuotesTransitModuleProps {
  quotes: TransitQuote[];
  dossiers: TransitDossier[];
  containers: Container[];
  clients: TransitClient[];
  services: TransitServiceItem[];
  currency: CurrencyCode;
  onCreateQuote: (quote: Omit<TransitQuote, 'id' | 'number'>) => TransitQuote;
  onUpdateQuoteStatus: (quoteId: string, status: QuoteStatus) => void;
  onConvertQuoteToInvoice: (quote: TransitQuote) => void;
}

export const QuotesTransitModule: React.FC<QuotesTransitModuleProps> = ({
  quotes,
  dossiers,
  containers,
  clients,
  services,
  currency,
  onCreateQuote,
  onUpdateQuoteStatus,
  onConvertQuoteToInvoice,
}) => {
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'ALL' | QuoteStatus>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [printPreviewQuote, setPrintPreviewQuote] =
    useState<TransitQuote | null>(null);

  const activeDossiers = useMemo(
    () => dossiers.filter((d) => !d.archived),
    [dossiers]
  );
  const [dossierId, setDossierId] = useState(
    activeDossiers[0]?.id || dossiers[0]?.id || ''
  );
  const [quoteCurrency, setQuoteCurrency] = useState<CurrencyCode>('XOF');
  const [applyTva, setApplyTva] = useState(true);
  const [extraContainerInput, setExtraContainerInput] = useState('');
  const [manualContainerRefs, setManualContainerRefs] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<TransitDocLine[]>(() => {
    const srv = services[0];
    return srv
      ? [
          {
            id: 'init-1',
            serviceId: srv.id,
            label: srv.label,
            quantity: 1,
            unitPriceXof: srv.defaultPriceXof,
            taxable: srv.taxable,
          },
        ]
      : [];
  });

  const selectedDossier = useMemo(
    () => dossiers.find((d) => d.id === dossierId) || activeDossiers[0],
    [dossiers, activeDossiers, dossierId]
  );

  const dossierContainers = useMemo(
    () => containers.filter((c) => c.dossierId === selectedDossier?.id),
    [containers, selectedDossier]
  );

  const combinedContainerRefs = useMemo(() => {
    const fromDossier = dossierContainers.map((c) => c.number);
    return Array.from(new Set([...fromDossier, ...manualContainerRefs]));
  }, [dossierContainers, manualContainerRefs]);

  const filteredQuotes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return quotes.filter((item) => {
      if (statusFilter !== 'ALL' && item.status !== statusFilter) return false;
      if (!q) return true;
      const cl = clients.find((c) => c.id === item.clientId);
      const dos = dossiers.find((d) => d.id === item.dossierId);
      return (
        item.number.toLowerCase().includes(q) ||
        (cl?.name || '').toLowerCase().includes(q) ||
        (dos?.reference || '').toLowerCase().includes(q) ||
        (dos?.blNumber || '').toLowerCase().includes(q) ||
        item.containerRefs.some((r) => r.toLowerCase().includes(q))
      );
    });
  }, [quotes, statusFilter, searchQuery, clients, dossiers]);

  const activeQuote = quotes.find((q) => q.id === selectedQuoteId) || null;

  const handleDossierChange = (nextDossierId: string) => {
    setDossierId(nextDossierId);
    const dosConts = containers.filter((c) => c.dossierId === nextDossierId);
    const c20 = dosConts.filter((c) => c.type.startsWith("20'")).length;
    const c40 = dosConts.filter((c) => c.type.startsWith("40'")).length;
    const demTotal = dosConts.reduce(
      (sum, c) => sum + calculateContainerDemurrage(c).accruedFeeXof,
      0
    );

    const autoLines: TransitDocLine[] = [];
    const addSrv = (code: string, qty: number) => {
      const s = services.find((x) => x.code === code);
      if (!s || qty <= 0) return;
      autoLines.push({
        id: `auto-${s.id}-${Math.random().toString(36).slice(2, 6)}`,
        serviceId: s.id,
        label: s.label,
        quantity: qty,
        unitPriceXof: s.defaultPriceXof,
        taxable: s.taxable,
      });
    };

    addSrv('DOU-01', 1);
    if (c20 > 0) addSrv('MAN-20', c20);
    if (c40 > 0) addSrv('MAN-40', c40);
    addSrv('TRP-DKR', Math.max(1, dosConts.length));
    addSrv('COM-TR', 1);
    if (demTotal > 0) {
      autoLines.push({
        id: `auto-dem-${Date.now()}`,
        label: 'Provision Surestaries Armateur (selon décompte parc)',
        quantity: 1,
        unitPriceXof: demTotal,
        taxable: false,
      });
    }
    setLines(autoLines);
  };

  const handleAddExtraContainerRef = () => {
    const tokens = extraContainerInput
      .split(/[,;]+/)
      .map((t) => formatContainerNumberMask(t.trim()).trim())
      .filter(Boolean);
    if (tokens.length === 0) return;
    setManualContainerRefs((prev) => Array.from(new Set([...prev, ...tokens])));
    setExtraContainerInput('');
  };

  const handleAddServiceLine = (s: TransitServiceItem) => {
    setLines((prev) => [
      ...prev,
      {
        id: `ql-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        serviceId: s.id,
        label: s.label,
        quantity: 1,
        unitPriceXof: s.defaultPriceXof,
        taxable: s.taxable,
      },
    ]);
  };

  const handleDuplicateQuote = (q: TransitQuote) => {
    const created = onCreateQuote({
      clientId: q.clientId,
      dossierId: q.dossierId,
      containerRefs: q.containerRefs,
      date: '2026-11-13',
      validityDate: '2026-11-28',
      currency: q.currency,
      status: 'DRAFT',
      tvaRate: q.tvaRate,
      lines: q.lines.map((l, idx) => ({
        ...l,
        id: `dup-${Date.now()}-${idx}`,
      })),
      notes: q.notes,
    });
    setSelectedQuoteId(created.id);
  };

  const handleSubmitQuote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDossier || lines.length === 0) return;
    const created = onCreateQuote({
      clientId: selectedDossier.clientId,
      dossierId: selectedDossier.id,
      containerRefs: combinedContainerRefs,
      date: '2026-11-13',
      validityDate: '2026-11-28',
      currency: quoteCurrency,
      status: 'DRAFT',
      tvaRate: applyTva ? 0.18 : 0,
      lines,
      notes:
        notes.trim() ||
        `Devis établi pour B/L ${selectedDossier.blNumber} (${combinedContainerRefs.length} conteneur(s)).`,
    });
    setCreating(false);
    setManualContainerRefs([]);
    setSelectedQuoteId(created.id);
  };

  /* FORM VIEW: CREATE NEW TRANSIT QUOTE */
  if (creating) {
    const totals = computeTransitLinesTotals(lines, applyTva ? 0.18 : 0);
    const client = clients.find((c) => c.id === selectedDossier?.clientId);

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setCreating(false)}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Retour aux devis</span>
          </button>
        </div>

        <form
          onSubmit={handleSubmitQuote}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
                Nouveau Devis Transitaire
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Liez le dossier B/L et ses références conteneurs, puis ajustez les prestations.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {(['XOF', 'EUR', 'USD'] as CurrencyCode[]).map((cur) => (
                <button
                  key={cur}
                  type="button"
                  onClick={() => setQuoteCurrency(cur)}
                  className={`px-3 py-1.5 text-xs font-mono font-semibold rounded-lg border cursor-pointer transition-colors ${
                    quoteCurrency === cur
                      ? 'bg-slate-900 dark:bg-teal-600 text-white border-slate-900 dark:border-teal-600'
                      : 'bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {cur}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Dossier de transit & Client
                </label>
                <select
                  value={dossierId}
                  onChange={(e) => handleDossierChange(e.target.value)}
                  className="w-full h-11 px-3 text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:border-teal-600"
                >
                  {activeDossiers.map((d) => {
                    const cl = clients.find((c) => c.id === d.clientId);
                    return (
                      <option key={d.id} value={d.id}>
                        {d.reference} · {cl?.name} (B/L {d.blNumber})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="p-3.5 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-lg text-xs space-y-1">
                <p className="font-semibold text-slate-900 dark:text-white">
                  {client?.name}
                </p>
                <p className="text-slate-600 dark:text-slate-400">
                  NINEA : <span className="font-mono">{client?.ninea}</span> ·{' '}
                  {selectedDossier?.shippingLine} ({selectedDossier?.vesselName})
                </p>
              </div>
            </div>

            {/* Container References Box */}
            <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Références conteneurs portées au devis (
                  {combinedContainerRefs.length})
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {combinedContainerRefs.length === 0 ? (
                  <span className="text-xs text-slate-400">
                    Aucune référence associée pour le moment.
                  </span>
                ) : (
                  combinedContainerRefs.map((ref) => (
                    <span
                      key={ref}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md font-mono text-xs font-medium text-slate-900 dark:text-slate-100"
                    >
                      <ContainerIcon className="w-3 h-3 text-teal-700 dark:text-teal-400" />
                      <span>{ref}</span>
                      {manualContainerRefs.includes(ref) && (
                        <button
                          type="button"
                          onClick={() =>
                            setManualContainerRefs((prev) =>
                              prev.filter((r) => r !== ref)
                            )
                          }
                          className="text-slate-400 hover:text-red-600 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </span>
                  ))
                )}
              </div>

              <div className="flex gap-2 pt-1">
                <input
                  type="text"
                  value={extraContainerInput}
                  onChange={(e) => setExtraContainerInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddExtraContainerRef();
                    }
                  }}
                  placeholder="Ajouter réf. conteneur (ex: MSCU 492817-4)"
                  className="flex-1 h-9 px-3 font-mono text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:border-teal-600"
                />
                <button
                  type="button"
                  onClick={handleAddExtraContainerRef}
                  className="px-3 h-9 text-xs font-medium text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 rounded-lg hover:bg-teal-100 cursor-pointer whitespace-nowrap"
                >
                  + Ajouter réf.
                </button>
              </div>
            </div>
          </div>

          {/* Quick-Add Services Strip */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                Prestations transit (cliquez pour ajouter) :
              </span>
              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={applyTva}
                  onChange={(e) => setApplyTva(e.target.checked)}
                  className="rounded border-slate-300"
                />
                <span>TVA 18% applicable</span>
              </label>
            </div>
            <div className="flex flex-wrap gap-2">
              {services.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => handleAddServiceLine(s)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
                  <span className="font-mono">{s.code}</span>
                  <span className="text-slate-400">·</span>
                  <span>{s.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Quote Lines Table */}
          <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400">
                  <th className="py-2.5 px-4">Désignation</th>
                  <th className="py-2.5 px-3 w-24 text-right">Qté</th>
                  <th className="py-2.5 px-3 w-40 text-right">P.U. (XOF)</th>
                  <th className="py-2.5 px-3 w-20 text-center">TVA</th>
                  <th className="py-2.5 px-4 w-40 text-right">Total HT</th>
                  <th className="py-2.5 px-3 w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {lines.map((line) => (
                  <tr key={line.id}>
                    <td className="py-2.5 px-4">
                      <input
                        type="text"
                        value={line.label}
                        onChange={(e) =>
                          setLines((prev) =>
                            prev.map((l) =>
                              l.id === line.id
                                ? { ...l, label: e.target.value }
                                : l
                            )
                          )
                        }
                        className="w-full h-9 px-2.5 text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-md"
                      />
                    </td>
                    <td className="py-2.5 px-3">
                      <input
                        type="number"
                        min={1}
                        value={line.quantity}
                        onChange={(e) =>
                          setLines((prev) =>
                            prev.map((l) =>
                              l.id === line.id
                                ? {
                                    ...l,
                                    quantity: Math.max(
                                      1,
                                      Number(e.target.value)
                                    ),
                                  }
                                : l
                            )
                          )
                        }
                        className="w-full h-9 px-2 font-mono text-right bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-md tabular-nums"
                      />
                    </td>
                    <td className="py-2.5 px-3">
                      <input
                        type="number"
                        step="1000"
                        value={line.unitPriceXof}
                        onChange={(e) =>
                          setLines((prev) =>
                            prev.map((l) =>
                              l.id === line.id
                                ? {
                                    ...l,
                                    unitPriceXof: Math.max(
                                      0,
                                      Number(e.target.value)
                                    ),
                                  }
                                : l
                            )
                          )
                        }
                        className="w-full h-9 px-2 font-mono text-right bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-md tabular-nums"
                      />
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <input
                        type="checkbox"
                        checked={line.taxable && applyTva}
                        disabled={!applyTva}
                        onChange={(e) =>
                          setLines((prev) =>
                            prev.map((l) =>
                              l.id === line.id
                                ? { ...l, taxable: e.target.checked }
                                : l
                            )
                          )
                        }
                      />
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-medium tabular-nums text-slate-900 dark:text-white">
                      {formatErpMoney(
                        line.quantity * line.unitPriceXof,
                        quoteCurrency
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <button
                        type="button"
                        onClick={() =>
                          setLines((prev) =>
                            prev.filter((l) => l.id !== line.id)
                          )
                        }
                        className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-4 border-t border-slate-200 dark:border-slate-800">
            <div className="flex-1 max-w-md">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Conditions / Observations
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Validité 15 jours, débours douane sur justificatifs..."
                className="w-full h-10 px-3 text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg"
              />
            </div>

            <div className="w-full sm:w-72 space-y-1.5 text-sm bg-slate-50 dark:bg-slate-950/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Total HT</span>
                <span className="font-mono tabular-nums">
                  {formatErpMoney(totals.subtotal, quoteCurrency)}
                </span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>TVA ({applyTva ? '18%' : 'Exonérée'})</span>
                <span className="font-mono tabular-nums">
                  {formatErpMoney(totals.tva, quoteCurrency)}
                </span>
              </div>
              <div className="flex justify-between font-bold text-base text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-slate-800">
                <span>Total TTC</span>
                <span className="font-mono tabular-nums text-teal-800 dark:text-teal-400">
                  {formatErpMoney(totals.totalTtc, quoteCurrency)}
                </span>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 rounded-lg cursor-pointer"
            >
              Enregistrer le devis
            </button>
          </div>
        </form>
      </div>
    );
  }

  /* FORM VIEW: SELECTED QUOTE */
  if (activeQuote) {
    const client = clients.find((c) => c.id === activeQuote.clientId);
    const dossier = dossiers.find((d) => d.id === activeQuote.dossierId);
    const totals = computeTransitLinesTotals(
      activeQuote.lines,
      activeQuote.tvaRate
    );

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setSelectedQuoteId(null)}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Liste des devis</span>
          </button>

          {/* Statusbar */}
          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium">
            {(['DRAFT', 'SENT', 'ACCEPTED', 'INVOICED'] as QuoteStatus[]).map(
              (st) => {
                const labels: Record<QuoteStatus, string> = {
                  DRAFT: 'Brouillon',
                  SENT: 'Envoyé',
                  ACCEPTED: 'Accepté',
                  INVOICED: 'Facturé',
                };
                return (
                  <span
                    key={st}
                    className={`px-3 py-1 rounded-md ${
                      activeQuote.status === st
                        ? 'bg-slate-900 dark:bg-teal-600 text-white'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {labels[st]}
                  </span>
                );
              }
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h1 className="font-mono text-2xl font-bold text-slate-900 dark:text-white">
                {activeQuote.number}
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                {client?.name} · Dossier{' '}
                <span className="font-mono font-semibold">
                  {dossier?.reference}
                </span>{' '}
                · B/L <span className="font-mono">{dossier?.blNumber}</span>
              </p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {activeQuote.containerRefs.map((ref) => (
                  <span
                    key={ref}
                    className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded font-mono text-xs text-slate-800 dark:text-slate-200"
                  >
                    {ref}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleDuplicateQuote(activeQuote)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Dupliquer</span>
              </button>

              <button
                type="button"
                onClick={() => setPrintPreviewQuote(activeQuote)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Imprimer PDF</span>
              </button>

              {activeQuote.status === 'DRAFT' && (
                <button
                  type="button"
                  onClick={() => onUpdateQuoteStatus(activeQuote.id, 'SENT')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-slate-700 rounded-lg hover:bg-slate-800 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Marquer Envoyé</span>
                </button>
              )}

              {activeQuote.status === 'SENT' && (
                <button
                  type="button"
                  onClick={() =>
                    onUpdateQuoteStatus(activeQuote.id, 'ACCEPTED')
                  }
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-teal-700 rounded-lg hover:bg-teal-800 cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Valider Accord Client</span>
                </button>
              )}

              {activeQuote.status !== 'INVOICED' && (
                <button
                  type="button"
                  onClick={() => onConvertQuoteToInvoice(activeQuote)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 cursor-pointer"
                >
                  <Receipt className="w-3.5 h-3.5" />
                  <span>Convertir en Facture</span>
                </button>
              )}
            </div>
          </div>

          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500 dark:text-slate-400">
                <th className="py-2.5">Prestation</th>
                <th className="py-2.5 text-right">Qté</th>
                <th className="py-2.5 text-right">P.U.</th>
                <th className="py-2.5 text-right">Sous-total HT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {activeQuote.lines.map((l) => (
                <tr key={l.id}>
                  <td className="py-3 font-medium text-slate-900 dark:text-white">
                    {l.label}
                  </td>
                  <td className="py-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                    {l.quantity}
                  </td>
                  <td className="py-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                    {formatErpMoney(l.unitPriceXof, activeQuote.currency)}
                  </td>
                  <td className="py-3 text-right font-mono font-medium tabular-nums text-slate-900 dark:text-white">
                    {formatErpMoney(
                      l.quantity * l.unitPriceXof,
                      activeQuote.currency
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-800">
            <div className="w-64 space-y-1.5 text-sm">
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>Total HT</span>
                <span className="font-mono tabular-nums">
                  {formatErpMoney(totals.subtotal, activeQuote.currency)}
                </span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <span>TVA ({activeQuote.tvaRate > 0 ? '18%' : '0%'})</span>
                <span className="font-mono tabular-nums">
                  {formatErpMoney(totals.tva, activeQuote.currency)}
                </span>
              </div>
              <div className="flex justify-between font-bold text-base text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-slate-800">
                <span>Total TTC</span>
                <span className="font-mono tabular-nums text-teal-800 dark:text-teal-400">
                  {formatErpMoney(totals.totalTtc, activeQuote.currency)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* LIST VIEW */
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
            Devis Transitaire & Cotations
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Établissez vos devis avec références de conteneurs et convertissez-les en factures d’un clic.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            if (activeDossiers[0]) handleDossierChange(activeDossiers[0].id);
            setCreating(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 min-h-[40px] text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 rounded-lg cursor-pointer self-start"
        >
          <Plus className="w-4 h-4" />
          <span>Créer un devis</span>
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3 no-print">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { key: 'ALL', label: 'Tous' },
              { key: 'DRAFT', label: 'Brouillons' },
              { key: 'SENT', label: 'Envoyés' },
              { key: 'ACCEPTED', label: 'Acceptés' },
              { key: 'INVOICED', label: 'Facturés' },
            ] as { key: 'ALL' | QuoteStatus; label: string }[]
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3 py-1.5 min-h-[36px] text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                statusFilter === tab.key
                  ? 'bg-slate-900 dark:bg-teal-600 text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative sm:w-72">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher n° devis, conteneur, client..."
            className="w-full h-9 pl-8 pr-7 text-xs bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-teal-600"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto no-print">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400">
              <th className="py-3 px-5">N° Devis</th>
              <th className="py-3 px-4">Client & Dossier</th>
              <th className="py-3 px-4">Conteneurs</th>
              <th className="py-3 px-4">Validité</th>
              <th className="py-3 px-4 text-right">Montant TTC</th>
              <th className="py-3 px-4">Statut</th>
              <th className="py-3 px-5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {filteredQuotes.map((q) => {
              const client = clients.find((c) => c.id === q.clientId);
              const dossier = dossiers.find((d) => d.id === q.dossierId);
              const totals = computeTransitLinesTotals(q.lines, q.tvaRate);
              return (
                <tr
                  key={q.id}
                  onClick={() => setSelectedQuoteId(q.id)}
                  className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer"
                >
                  <td className="py-3.5 px-5 font-mono font-semibold text-teal-800 dark:text-teal-400">
                    {q.number}
                  </td>
                  <td className="py-3.5 px-4">
                    <p className="font-medium text-slate-900 dark:text-white">
                      {client?.name}
                    </p>
                    <p className="font-mono text-xs text-slate-500 dark:text-slate-400">
                      {dossier?.reference} · B/L {dossier?.blNumber}
                    </p>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-xs text-slate-700 dark:text-slate-300">
                    {q.containerRefs.join(', ')}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-xs text-slate-600 dark:text-slate-400 tabular-nums">
                    {q.validityDate}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-semibold tabular-nums text-slate-900 dark:text-white">
                    {formatErpMoney(totals.totalTtc, currency)}
                  </td>
                  <td className="py-3.5 px-4">
                    <StatusBadge
                      status={
                        q.status === 'INVOICED' || q.status === 'ACCEPTED'
                          ? 'green'
                          : 'orange'
                      }
                      label={
                        q.status === 'INVOICED'
                          ? 'Facturé'
                          : q.status === 'ACCEPTED'
                          ? 'Accepté'
                          : q.status === 'SENT'
                          ? 'Envoyé'
                          : 'Brouillon'
                      }
                      compact
                    />
                  </td>
                  <td
                    className="py-3.5 px-5 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {q.status !== 'INVOICED' ? (
                      <button
                        type="button"
                        onClick={() => onConvertQuoteToInvoice(q)}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 cursor-pointer"
                      >
                        Facturer
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setPrintPreviewQuote(q)}
                        className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                      >
                        PDF
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Printable Quote Modal */}
      {printPreviewQuote && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-2xl bg-white text-slate-900 border border-slate-200 rounded-xl shadow-2xl overflow-hidden my-auto">
            <div className="px-6 py-3.5 bg-slate-900 text-white flex items-center justify-between no-print">
              <span className="font-mono text-sm font-semibold">
                {printPreviewQuote.number}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-teal-600 hover:bg-teal-700 rounded-lg cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimer</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPrintPreviewQuote(null)}
                  className="p-1.5 text-white/70 hover:text-white rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            {(() => {
              const cl = clients.find(
                (c) => c.id === printPreviewQuote.clientId
              );
              const dos = dossiers.find(
                (d) => d.id === printPreviewQuote.dossierId
              );
              const tot = computeTransitLinesTotals(
                printPreviewQuote.lines,
                printPreviewQuote.tvaRate
              );
              return (
                <div className="p-8 space-y-6">
                  <div className="flex justify-between pb-4 border-b border-slate-200">
                    <div>
                      <h2 className="font-display text-xl font-bold text-slate-900">
                        OdooTransit · Commissionnaire Agréé
                      </h2>
                      <p className="text-xs text-slate-500 mt-1">
                        Port Autonome de Dakar · Môle 2
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold text-slate-500">
                        DEVIS TRANSIT
                      </p>
                      <p className="font-mono text-lg font-bold text-slate-900">
                        {printPreviewQuote.number}
                      </p>
                      <p className="font-mono text-xs text-slate-500">
                        Valable jusqu’au {printPreviewQuote.validityDate}
                      </p>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                    <p className="font-semibold text-slate-900">{cl?.name}</p>
                    <p className="font-mono text-slate-600">
                      Dossier {dos?.reference} · B/L {dos?.blNumber}
                    </p>
                    <p className="font-mono text-slate-700">
                      Conteneurs : {printPreviewQuote.containerRefs.join(', ')}
                    </p>
                  </div>

                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b-2 border-slate-200 text-xs text-slate-500">
                        <th className="py-2">Prestation</th>
                        <th className="py-2 text-right">Qté</th>
                        <th className="py-2 text-right">P.U.</th>
                        <th className="py-2 text-right">Total HT</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {printPreviewQuote.lines.map((l) => (
                        <tr key={l.id}>
                          <td className="py-2.5">{l.label}</td>
                          <td className="py-2.5 text-right font-mono tabular-nums">
                            {l.quantity}
                          </td>
                          <td className="py-2.5 text-right font-mono tabular-nums">
                            {formatErpMoney(
                              l.unitPriceXof,
                              printPreviewQuote.currency
                            )}
                          </td>
                          <td className="py-2.5 text-right font-mono tabular-nums">
                            {formatErpMoney(
                              l.quantity * l.unitPriceXof,
                              printPreviewQuote.currency
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="flex justify-end pt-4 border-t border-slate-200">
                    <div className="w-64 space-y-1.5 text-sm">
                      <div className="flex justify-between text-slate-600">
                        <span>Total HT</span>
                        <span className="font-mono tabular-nums">
                          {formatErpMoney(
                            tot.subtotal,
                            printPreviewQuote.currency
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>TVA</span>
                        <span className="font-mono tabular-nums">
                          {formatErpMoney(tot.tva, printPreviewQuote.currency)}
                        </span>
                      </div>
                      <div className="flex justify-between font-bold text-slate-900 pt-1.5 border-t border-slate-200">
                        <span>Total TTC</span>
                        <span className="font-mono tabular-nums">
                          {formatErpMoney(
                            tot.totalTtc,
                            printPreviewQuote.currency
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};
