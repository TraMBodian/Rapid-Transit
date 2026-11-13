import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  CreditCard,
  Download,
  Plus,
  Printer,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  CurrencyCode,
  InvoicePayment,
  InvoiceStatus,
  TransitClient,
  TransitDocLine,
  TransitDossier,
  TransitInvoice,
  TransitServiceItem,
} from '../../types/erp';
import { Container } from '../../types/transit';
import { formatContainerNumberMask } from '../../utils/transitUtils';
import {
  computeTransitInvoiceBalance,
  computeTransitLinesTotals,
  exportErpCsv,
  formatErpMoney,
} from '../../utils/erpUtils';
import { StatusBadge } from '../StatusBadge';

interface InvoicingModuleProps {
  invoices: TransitInvoice[];
  dossiers: TransitDossier[];
  containers: Container[];
  clients: TransitClient[];
  services: TransitServiceItem[];
  currency: CurrencyCode;
  onCreateInvoice: (
    invoice: Omit<TransitInvoice, 'id' | 'number'>
  ) => TransitInvoice;
  onPostInvoice: (invoiceId: string) => void;
  onRecordPayment: (
    invoiceId: string,
    payment: Omit<InvoicePayment, 'id'>
  ) => void;
}

export const InvoicingModule: React.FC<InvoicingModuleProps> = ({
  invoices,
  dossiers,
  containers,
  clients,
  services,
  currency,
  onCreateInvoice,
  onPostInvoice,
  onRecordPayment,
}) => {
  const [statusFilter, setStatusFilter] = useState<'ALL' | InvoiceStatus>(
    'ALL'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [previewInv, setPreviewInv] = useState<TransitInvoice | null>(null);
  const [payInv, setPayInv] = useState<TransitInvoice | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] =
    useState<InvoicePayment['method']>('VIREMENT');
  const [payRef, setPayRef] = useState('');

  // Direct Invoice Modal State
  const [creatingDirect, setCreatingDirect] = useState(false);
  const [docType, setDocType] =
    useState<TransitInvoice['docType']>('DEFINITIVE');
  const [directDossierId, setDirectDossierId] = useState(dossiers[0]?.id || '');
  const [directContainerInput, setDirectContainerInput] = useState('');
  const [extraContainerRefs, setExtraContainerRefs] = useState<string[]>([]);
  const [directLines, setDirectLines] = useState<TransitDocLine[]>(() => {
    const first = services[0];
    return first
      ? [
          {
            id: 'dinv-1',
            serviceId: first.id,
            label: first.label,
            quantity: 1,
            unitPriceXof: first.defaultPriceXof,
            taxable: first.taxable,
          },
        ]
      : [];
  });

  const totalsSummary = useMemo(() => {
    return invoices.reduce(
      (acc, inv) => {
        const b = computeTransitInvoiceBalance(inv);
        acc.totalTtc += b.totalTtc;
        acc.paid += b.paid;
        acc.balance += b.balance;
        if (b.balance > 0.5) acc.openCount += 1;
        return acc;
      },
      { totalTtc: 0, paid: 0, balance: 0, openCount: 0 }
    );
  }, [invoices]);

  const filteredInvoices = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return invoices.filter((inv) => {
      if (statusFilter !== 'ALL' && inv.status !== statusFilter) return false;
      if (!q) return true;
      const cl = clients.find((c) => c.id === inv.clientId);
      const dos = dossiers.find((d) => d.id === inv.dossierId);
      return (
        inv.number.toLowerCase().includes(q) ||
        (cl?.name || '').toLowerCase().includes(q) ||
        (dos?.reference || '').toLowerCase().includes(q) ||
        (dos?.blNumber || '').toLowerCase().includes(q) ||
        inv.containerRefs.some((r) => r.toLowerCase().includes(q))
      );
    });
  }, [invoices, statusFilter, searchQuery, clients, dossiers]);

  const selectedDirectDossier = useMemo(
    () => dossiers.find((d) => d.id === directDossierId) || dossiers[0],
    [dossiers, directDossierId]
  );

  const combinedDirectContainerRefs = useMemo(() => {
    const fromDossier = containers
      .filter((c) => c.dossierId === selectedDirectDossier?.id)
      .map((c) => c.number);
    return Array.from(new Set([...fromDossier, ...extraContainerRefs]));
  }, [containers, selectedDirectDossier, extraContainerRefs]);

  const openPayment = (inv: TransitInvoice) => {
    const { balance } = computeTransitInvoiceBalance(inv);
    setPayInv(inv);
    setPayAmount(String(Math.round(balance)));
    setPayMethod('VIREMENT');
    setPayRef(`VIR-${Date.now().toString().slice(-5)}`);
  };

  const submitPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payInv) return;
    const amt = Number(payAmount);
    if (!amt || amt <= 0) return;
    onRecordPayment(payInv.id, {
      date: '2026-11-13',
      amountXof: amt,
      method: payMethod,
      reference: payRef.trim() || `REG-${Date.now().toString().slice(-4)}`,
    });
    setPayInv(null);
  };

  const handleAddDirectContainerRef = () => {
    const formatted = formatContainerNumberMask(directContainerInput).trim();
    if (!formatted) return;
    setExtraContainerRefs((prev) =>
      prev.includes(formatted) ? prev : [...prev, formatted]
    );
    setDirectContainerInput('');
  };

  const handleSubmitDirectInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDirectDossier || directLines.length === 0) return;
    onCreateInvoice({
      docType,
      clientId: selectedDirectDossier.clientId,
      dossierId: selectedDirectDossier.id,
      containerRefs: combinedDirectContainerRefs,
      currency,
      issueDate: '2026-11-13',
      dueDate: '2026-11-28',
      status: 'POSTED',
      tvaRate: 0.18,
      lines: directLines,
      payments: [],
      notes: `Facture établie directement pour ${selectedDirectDossier.reference}.`,
    });
    setCreatingDirect(false);
    setExtraContainerRefs([]);
  };

  const handleCsv = () => {
    const headers = [
      'Numéro',
      'Type',
      'Client',
      'Dossier',
      'Conteneurs',
      'Émission',
      'Échéance',
      'Total TTC (XOF)',
      'Payé (XOF)',
      'Reste dû (XOF)',
      'Statut',
    ];
    const rows = invoices.map((inv) => {
      const cl = clients.find((x) => x.id === inv.clientId);
      const dos = dossiers.find((d) => d.id === inv.dossierId);
      const bal = computeTransitInvoiceBalance(inv);
      return [
        inv.number,
        inv.docType,
        cl?.name || '',
        dos?.reference || '',
        inv.containerRefs.join(', '),
        inv.issueDate,
        inv.dueDate,
        Math.round(bal.totalTtc),
        Math.round(bal.paid),
        Math.round(bal.balance),
        inv.status,
      ];
    });
    exportErpCsv('odootransit_factures.csv', headers, rows);
  };

  const directTotals = computeTransitLinesTotals(directLines, 0.18);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
            Facturation Transit & Règlements
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Factures liées aux dossiers et conteneurs, suivi des acomptes et reçus PDF.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleCsv}
            className="inline-flex items-center gap-2 px-3.5 py-2 min-h-[40px] text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={() => setCreatingDirect(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 rounded-lg cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nouvelle facture</span>
          </button>
        </div>
      </div>

      {/* Billing KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 no-print">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Total facturé TTC
          </p>
          <p className="font-mono text-xl font-semibold text-slate-900 dark:text-white tabular-nums mt-1.5">
            {formatErpMoney(totalsSummary.totalTtc, currency)}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Encaissé à ce jour
          </p>
          <p className="font-mono text-xl font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums mt-1.5">
            {formatErpMoney(totalsSummary.paid, currency)}
          </p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Reste dû ({totalsSummary.openCount} facture(s))
          </p>
          <p className="font-mono text-xl font-semibold text-red-700 dark:text-red-400 tabular-nums mt-1.5">
            {formatErpMoney(totalsSummary.balance, currency)}
          </p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3 no-print">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { key: 'ALL', label: 'Toutes' },
              { key: 'POSTED', label: 'À encaisser' },
              { key: 'PARTIAL', label: 'Acomptes' },
              { key: 'PAID', label: 'Payées' },
              { key: 'DRAFT', label: 'Brouillons' },
            ] as { key: 'ALL' | InvoiceStatus; label: string }[]
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
            placeholder="Rechercher n° facture, conteneur, client..."
            className="w-full h-9 pl-8 pr-7 text-xs bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-teal-600"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto no-print">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400">
              <th className="py-3 px-5">Facture</th>
              <th className="py-3 px-4">Client & Dossier</th>
              <th className="py-3 px-4">Réf. Conteneurs</th>
              <th className="py-3 px-4 text-right">Total TTC</th>
              <th className="py-3 px-4 text-right">Reste dû</th>
              <th className="py-3 px-4">Statut</th>
              <th className="py-3 px-5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {filteredInvoices.map((inv) => {
              const client = clients.find((c) => c.id === inv.clientId);
              const dossier = dossiers.find((d) => d.id === inv.dossierId);
              const bal = computeTransitInvoiceBalance(inv);
              return (
                <tr
                  key={inv.id}
                  className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                >
                  <td className="py-3.5 px-5">
                    <p className="font-mono font-semibold text-slate-900 dark:text-white">
                      {inv.number}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                      {inv.docType} · Éch. {inv.dueDate}
                    </p>
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
                    {inv.containerRefs.join(', ')}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums text-slate-900 dark:text-white">
                    {formatErpMoney(bal.totalTtc, currency)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-semibold tabular-nums text-slate-900 dark:text-white">
                    {formatErpMoney(bal.balance, currency)}
                  </td>
                  <td className="py-3.5 px-4">
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
                          ? 'Acompte versé'
                          : inv.status === 'DRAFT'
                          ? 'Brouillon'
                          : 'À encaisser'
                      }
                      compact
                    />
                  </td>
                  <td className="py-3.5 px-5 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPreviewInv(inv)}
                        className="px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        Aperçu PDF
                      </button>
                      {inv.status === 'DRAFT' && (
                        <button
                          type="button"
                          onClick={() => onPostInvoice(inv.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-teal-700 rounded-lg hover:bg-teal-800 cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Valider</span>
                        </button>
                      )}
                      {inv.status !== 'DRAFT' && bal.balance > 0.5 && (
                        <button
                          type="button"
                          onClick={() => openPayment(inv)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 cursor-pointer"
                        >
                          <CreditCard className="w-3.5 h-3.5" />
                          <span>Encaisser</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Direct Invoice Creation Modal */}
      {creatingDirect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto no-print">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden my-auto">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Émettre une facture transit directe
              </h3>
              <button
                type="button"
                onClick={() => setCreatingDirect(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form
              onSubmit={handleSubmitDirectInvoice}
              className="p-6 space-y-5 max-h-[80vh] overflow-y-auto"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Type de pièce
                  </label>
                  <select
                    value={docType}
                    onChange={(e) =>
                      setDocType(e.target.value as TransitInvoice['docType'])
                    }
                    className="w-full h-10 px-3 text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg"
                  >
                    <option value="DEFINITIVE">Facture Définitive</option>
                    <option value="PROFORMA">Facture Pro-forma</option>
                    <option value="NOTE_DEBIT">Note de Débit</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Dossier de transit
                  </label>
                  <select
                    value={directDossierId}
                    onChange={(e) => setDirectDossierId(e.target.value)}
                    className="w-full h-10 px-3 text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg"
                  >
                    {dossiers.map((d) => {
                      const cl = clients.find((c) => c.id === d.clientId);
                      return (
                        <option key={d.id} value={d.id}>
                          {d.reference} · {cl?.name}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Références conteneurs associées (
                  {combinedDirectContainerRefs.length})
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {combinedDirectContainerRefs.map((ref) => (
                    <span
                      key={ref}
                      className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded font-mono text-xs text-slate-800 dark:text-slate-200"
                    >
                      {ref}
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={directContainerInput}
                    onChange={(e) =>
                      setDirectContainerInput(
                        formatContainerNumberMask(e.target.value)
                      )
                    }
                    placeholder="Ajouter réf. conteneur (ex: MSCU 492817-4)"
                    className="flex-1 h-9 px-3 font-mono text-xs bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                  <button
                    type="button"
                    onClick={handleAddDirectContainerRef}
                    className="px-3 h-9 text-xs font-medium text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 rounded-lg cursor-pointer"
                  >
                    + Ajouter
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <span className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Ajouter une prestation tarifée :
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {services.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() =>
                        setDirectLines((prev) => [
                          ...prev,
                          {
                            id: `dl-${Date.now()}-${Math.random()
                              .toString(36)
                              .slice(2, 5)}`,
                            serviceId: s.id,
                            label: s.label,
                            quantity: 1,
                            unitPriceXof: s.defaultPriceXof,
                            taxable: s.taxable,
                          },
                        ])
                      }
                      className="px-2.5 py-1 text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                    >
                      + {s.code}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                {directLines.map((l) => (
                  <div key={l.id} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={l.label}
                      onChange={(e) =>
                        setDirectLines((prev) =>
                          prev.map((x) =>
                            x.id === l.id ? { ...x, label: e.target.value } : x
                          )
                        )
                      }
                      className="flex-1 h-9 px-2.5 text-xs bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-md"
                    />
                    <input
                      type="number"
                      min={1}
                      value={l.quantity}
                      onChange={(e) =>
                        setDirectLines((prev) =>
                          prev.map((x) =>
                            x.id === l.id
                              ? {
                                  ...x,
                                  quantity: Math.max(1, Number(e.target.value)),
                                }
                              : x
                          )
                        )
                      }
                      className="w-16 h-9 px-2 font-mono text-xs text-right bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-md tabular-nums"
                    />
                    <input
                      type="number"
                      step="1000"
                      value={l.unitPriceXof}
                      onChange={(e) =>
                        setDirectLines((prev) =>
                          prev.map((x) =>
                            x.id === l.id
                              ? {
                                  ...x,
                                  unitPriceXof: Math.max(
                                    0,
                                    Number(e.target.value)
                                  ),
                                }
                              : x
                          )
                        )
                      }
                      className="w-28 h-9 px-2 font-mono text-xs text-right bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-md tabular-nums"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setDirectLines((prev) =>
                          prev.filter((x) => x.id !== l.id)
                        )
                      }
                      className="p-1.5 text-slate-400 hover:text-red-600 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
                <span className="text-sm font-semibold text-slate-900 dark:text-white font-mono tabular-nums">
                  Total TTC : {formatErpMoney(directTotals.totalTtc, currency)}
                </span>
                <div className="flex gap-2.5">
                  <button
                    type="button"
                    onClick={() => setCreatingDirect(false)}
                    className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg cursor-pointer"
                  >
                    Émettre la facture
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {payInv && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs no-print">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Encaisser {payInv.number}
              </h3>
              <button
                type="button"
                onClick={() => setPayInv(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={submitPayment} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Montant encaissé (XOF)
                </label>
                <input
                  type="number"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full h-11 px-3 font-mono text-base font-semibold bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Mode de règlement
                </label>
                <select
                  value={payMethod}
                  onChange={(e) =>
                    setPayMethod(e.target.value as InvoicePayment['method'])
                  }
                  className="w-full h-10 px-3 text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg"
                >
                  <option value="VIREMENT">Virement bancaire</option>
                  <option value="CHEQUE">Chèque certifié</option>
                  <option value="ESPECES">Espèces</option>
                  <option value="MOBILE_MONEY">Mobile Money</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Référence rapprochement
                </label>
                <input
                  type="text"
                  value={payRef}
                  onChange={(e) => setPayRef(e.target.value)}
                  className="w-full h-10 px-3 font-mono text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setPayInv(null)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 cursor-pointer"
                >
                  Valider règlement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Invoice PDF Modal */}
      {previewInv && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-2xl bg-white text-slate-900 border border-slate-200 rounded-xl shadow-2xl overflow-hidden my-auto">
            <div className="px-6 py-3.5 bg-slate-900 text-white flex items-center justify-between no-print">
              <span className="font-mono text-sm font-semibold">
                {previewInv.number}
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
                  onClick={() => setPreviewInv(null)}
                  className="p-1.5 text-white/70 hover:text-white rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {(() => {
              const cl = clients.find((x) => x.id === previewInv.clientId);
              const dos = dossiers.find((d) => d.id === previewInv.dossierId);
              const bal = computeTransitInvoiceBalance(previewInv);
              return (
                <div className="p-8 space-y-6">
                  <div className="flex justify-between pb-4 border-b border-slate-200">
                    <div>
                      <h2 className="font-display text-xl font-bold text-slate-900">
                        OdooTransit · Commissionnaire Agréé
                      </h2>
                      <p className="text-xs text-slate-500 mt-1">
                        Port Autonome de Dakar · NINEA 003194820 2V1
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold text-slate-500">
                        FACTURE TRANSIT ({previewInv.docType})
                      </p>
                      <p className="font-mono text-lg font-bold text-slate-900">
                        {previewInv.number}
                      </p>
                      <p className="font-mono text-xs text-slate-500">
                        Émise le {previewInv.issueDate}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200">
                      <p className="font-semibold text-slate-500">CLIENT</p>
                      <p className="text-sm font-semibold text-slate-900 mt-0.5">
                        {cl?.name}
                      </p>
                      <p className="font-mono text-slate-500">
                        NINEA : {cl?.ninea}
                      </p>
                    </div>
                    <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200">
                      <p className="font-semibold text-slate-500">
                        DOSSIER & CONTENEURS
                      </p>
                      <p className="font-mono font-semibold text-slate-900 mt-0.5">
                        {dos?.reference} · B/L {dos?.blNumber}
                      </p>
                      <p className="font-mono text-slate-600 mt-0.5">
                        {previewInv.containerRefs.join(', ')}
                      </p>
                    </div>
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
                      {previewInv.lines.map((l) => (
                        <tr key={l.id}>
                          <td className="py-2.5">{l.label}</td>
                          <td className="py-2.5 text-right font-mono tabular-nums">
                            {l.quantity}
                          </td>
                          <td className="py-2.5 text-right font-mono tabular-nums">
                            {formatErpMoney(l.unitPriceXof, currency)}
                          </td>
                          <td className="py-2.5 text-right font-mono tabular-nums">
                            {formatErpMoney(
                              l.quantity * l.unitPriceXof,
                              currency
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {previewInv.payments.length > 0 && (
                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1">
                      <p className="font-semibold text-slate-700">
                        Règlements enregistrés :
                      </p>
                      {previewInv.payments.map((p) => (
                        <div
                          key={p.id}
                          className="flex justify-between font-mono text-slate-600 tabular-nums"
                        >
                          <span>
                            {p.date} · {p.method} ({p.reference})
                          </span>
                          <span>{formatErpMoney(p.amountXof, currency)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex justify-end pt-4 border-t border-slate-200">
                    <div className="w-64 space-y-1.5 text-sm">
                      <div className="flex justify-between text-slate-600">
                        <span>Total HT</span>
                        <span className="font-mono tabular-nums">
                          {formatErpMoney(bal.subtotal, currency)}
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>TVA</span>
                        <span className="font-mono tabular-nums">
                          {formatErpMoney(bal.tva, currency)}
                        </span>
                      </div>
                      <div className="flex justify-between font-bold text-slate-900 pt-1.5 border-t border-slate-200">
                        <span>Total TTC</span>
                        <span className="font-mono tabular-nums">
                          {formatErpMoney(bal.totalTtc, currency)}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs font-semibold text-teal-800 pt-1">
                        <span>Reste dû</span>
                        <span className="font-mono tabular-nums">
                          {formatErpMoney(bal.balance, currency)}
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
