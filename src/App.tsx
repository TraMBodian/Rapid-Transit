import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { QuickContainerModal } from './components/QuickContainerModal';
import { AppLauncher } from './components/erp/AppLauncher';
import { ArchiveModule } from './components/erp/ArchiveModule';
import { ClientsTariffsModule } from './components/erp/ClientsTariffsModule';
import { CommandPalette } from './components/erp/CommandPalette';
import { ErpDashboard } from './components/erp/ErpDashboard';
import { ErpHeader } from './components/erp/ErpHeader';
import { ErpSidebar } from './components/erp/ErpSidebar';
import { InvoicingModule } from './components/erp/InvoicingModule';
import { QuotesTransitModule } from './components/erp/QuotesTransitModule';
import { TransitModule } from './components/erp/TransitModule';
import {
  INITIAL_CHATTER,
  INITIAL_CLIENTS,
  INITIAL_CONTAINERS,
  INITIAL_DOSSIERS,
  INITIAL_INVOICES,
  INITIAL_QUOTES,
  INITIAL_TRANSIT_SERVICES,
} from './data/transitErpData';
import {
  ArchiveDocKey,
  ChatterLog,
  CurrencyCode,
  ErpAppId,
  InvoicePayment,
  QuoteStatus,
  TransitClient,
  TransitDocLine,
  TransitDossier,
  TransitInvoice,
  TransitQuote,
  TransitServiceItem,
} from './types/erp';
import { Client, Container, Dossier, LifecycleStep } from './types/transit';
import { computeTransitInvoiceBalance } from './utils/erpUtils';
import {
  calculateContainerDemurrage,
  LIFECYCLE_STEPS,
} from './utils/transitUtils';

const STORAGE_KEY = 'odootransit_2026_state_v1';
const THEME_KEY = 'odootransit_2026_theme';

function loadStoredState<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return key in parsed ? parsed[key] : fallback;
  } catch {
    return fallback;
  }
}

export default function App() {
  const [activeApp, setActiveApp] = useState<ErpAppId>('dashboard');
  const [currency, setCurrency] = useState<CurrencyCode>('XOF');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [globalQuickContainerOpen, setGlobalQuickContainerOpen] =
    useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  });

  const [clients, setClients] = useState<TransitClient[]>(() =>
    loadStoredState('clients', INITIAL_CLIENTS)
  );
  const [services, setServices] = useState<TransitServiceItem[]>(() =>
    loadStoredState('services', INITIAL_TRANSIT_SERVICES)
  );
  const [dossiers, setDossiers] = useState<TransitDossier[]>(() =>
    loadStoredState('dossiers', INITIAL_DOSSIERS)
  );
  const [containers, setContainers] = useState<Container[]>(() =>
    loadStoredState('containers', INITIAL_CONTAINERS)
  );
  const [quotes, setQuotes] = useState<TransitQuote[]>(() =>
    loadStoredState('quotes', INITIAL_QUOTES)
  );
  const [invoices, setInvoices] = useState<TransitInvoice[]>(() =>
    loadStoredState('invoices', INITIAL_INVOICES)
  );
  const [chatter, setChatter] = useState<ChatterLog[]>(() =>
    loadStoredState('chatter', INITIAL_CHATTER)
  );

  // Sync Tailwind dark mode class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Ignore storage errors
    }
  }, [theme]);

  // Persist operational data to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          clients,
          services,
          dossiers,
          containers,
          quotes,
          invoices,
          chatter,
        })
      );
    } catch {
      // Ignore storage quota errors
    }
  }, [clients, services, dossiers, containers, quotes, invoices, chatter]);

  // Global Cmd+K / Ctrl+K shortcut for Command Palette
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const notify = useCallback((msg: string) => {
    setToastMsg(msg);
  }, []);

  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(null), 3500);
    return () => clearTimeout(t);
  }, [toastMsg]);

  const pushChatter = useCallback(
    (
      module: string,
      recordRef: string,
      message: string,
      kind: 'SYSTEM' | 'NOTE' = 'SYSTEM'
    ) => {
      const now = new Date();
      const timestamp = `${now.toISOString().slice(0, 10)} ${now
        .toTimeString()
        .slice(0, 5)}`;
      setChatter((prev) => [
        {
          id: `ch-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
          timestamp,
          author: 'Ousmane Diop',
          module,
          recordRef,
          message,
          kind,
        },
        ...prev,
      ]);
    },
    []
  );

  const launcherCounts = useMemo(() => {
    const activeDossiers = dossiers.filter((d) => !d.archived);
    const activeIds = new Set(activeDossiers.map((d) => d.id));
    const activeContainers = containers.filter((c) =>
      activeIds.has(c.dossierId)
    );
    const transitAlerts = activeContainers.filter((c) => {
      if (c.step === 'VIDE_RESTITUE') return false;
      const st = calculateContainerDemurrage(c).status;
      return st === 'red' || st === 'orange';
    }).length;

    return {
      activeContainers: activeContainers.filter(
        (c) => c.step !== 'VIDE_RESTITUE'
      ).length,
      transitAlerts,
      quotesOpen: quotes.filter((q) => q.status !== 'INVOICED').length,
      unpaidInvoices: invoices.filter(
        (i) => computeTransitInvoiceBalance(i).balance > 0.5
      ).length,
      archivedDossiers: dossiers.filter((d) => d.archived).length,
      clientsTotal: clients.length,
    };
  }, [dossiers, containers, quotes, invoices, clients]);

  const activeDossiers = useMemo(
    () => dossiers.filter((d) => !d.archived),
    [dossiers]
  );

  const mappedClients: Client[] = useMemo(
    () => clients.map((c) => ({ ...c, creditLimitXof: 30000000 })),
    [clients]
  );

  const handleResetDemo = () => {
    setClients(INITIAL_CLIENTS);
    setServices(INITIAL_TRANSIT_SERVICES);
    setDossiers(INITIAL_DOSSIERS);
    setContainers(INITIAL_CONTAINERS);
    setQuotes(INITIAL_QUOTES);
    setInvoices(INITIAL_INVOICES);
    setChatter(INITIAL_CHATTER);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore
    }
    notify('Données de démonstration réinitialisées.');
  };

  // Transit Container & Dossier Handlers
  const handleCreateContainer = (
    containerData: Omit<Container, 'id'>,
    newDossierData?: Omit<Dossier, 'id' | 'reference' | 'createdAt'>
  ): string => {
    let targetDossierId = containerData.dossierId;
    let targetRef =
      dossiers.find((d) => d.id === targetDossierId)?.reference || '';

    if (newDossierData) {
      const seq = 422 + dossiers.length;
      targetDossierId = `dos-${Date.now()}`;
      targetRef = `DOS-2026-0${seq}`;
      const newDos: TransitDossier = {
        id: targetDossierId,
        reference: targetRef,
        createdAt: '2026-11-13',
        archived: false,
        attachedDocs: ['BL_ORIGINAL'],
        ...newDossierData,
      };
      setDossiers((prev) => [newDos, ...prev]);
      pushChatter(
        'Transit',
        targetRef,
        `Nouveau dossier ouvert · B/L ${newDos.blNumber} (${newDos.shippingLine}).`
      );
    }

    const created: Container = {
      ...containerData,
      id: `cnt-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      dossierId: targetDossierId,
    };
    setContainers((prev) => [created, ...prev]);
    pushChatter(
      'Conteneurs',
      created.number,
      `Référence conteneur (${created.type}) ajoutée au dossier ${targetRef}.`
    );
    notify(`Conteneur ${created.number} enregistré (${targetRef}).`);
    return targetDossierId;
  };

  const handleUpdateContainerStep = (
    containerId: string,
    nextStep: LifecycleStep
  ) => {
    const target = containers.find((c) => c.id === containerId);
    if (!target || target.step === nextStep) return;
    const nextLabel =
      LIFECYCLE_STEPS.find((s) => s.key === nextStep)?.label || nextStep;

    setContainers((prev) =>
      prev.map((c) =>
        c.id === containerId
          ? {
              ...c,
              step: nextStep,
              emptyReturnDate:
                nextStep === 'VIDE_RESTITUE' ? '2026-11-13' : c.emptyReturnDate,
            }
          : c
      )
    );
    pushChatter('Conteneurs', target.number, `Étape mise à jour : ${nextLabel}.`);
    notify(`${target.number} → ${nextLabel}`);
  };

  const buildDossierTransitLines = (
    dossier: TransitDossier,
    dosContainers: Container[]
  ): TransitDocLine[] => {
    const c20 = dosContainers.filter((c) => c.type.startsWith("20'")).length;
    const c40 = dosContainers.filter((c) => c.type.startsWith("40'")).length;
    const demurrageTotal = dosContainers.reduce(
      (sum, c) => sum + calculateContainerDemurrage(c).accruedFeeXof,
      0
    );

    const lines: TransitDocLine[] = [
      {
        id: `ln-1-${Date.now()}`,
        serviceId: 'srv-1',
        label: `Déclaration en douane & Validation GAINDE (${dossier.reference})`,
        quantity: 1,
        unitPriceXof:
          services.find((s) => s.code === 'DOU-01')?.defaultPriceXof || 185000,
        taxable: true,
      },
    ];
    if (c20 > 0) {
      lines.push({
        id: `ln-2-${Date.now()}`,
        serviceId: 'srv-2',
        label: "Manutention portuaire & Relevage parc (20')",
        quantity: c20,
        unitPriceXof:
          services.find((s) => s.code === 'MAN-20')?.defaultPriceXof || 145000,
        taxable: true,
      });
    }
    if (c40 > 0) {
      lines.push({
        id: `ln-3-${Date.now()}`,
        serviceId: 'srv-3',
        label: "Manutention portuaire & Relevage parc (40')",
        quantity: c40,
        unitPriceXof:
          services.find((s) => s.code === 'MAN-40')?.defaultPriceXof || 235000,
        taxable: true,
      });
    }
    lines.push({
      id: `ln-4-${Date.now()}`,
      serviceId: 'srv-5',
      label: 'Honoraires & Commission de transit agréé',
      quantity: 1,
      unitPriceXof:
        services.find((s) => s.code === 'COM-TR')?.defaultPriceXof || 250000,
      taxable: true,
    });
    if (demurrageTotal > 0) {
      lines.push({
        id: `ln-5-${Date.now()}`,
        serviceId: 'srv-6',
        label: `Refacturation Surestaries Armateur (${dossier.shippingLine})`,
        quantity: 1,
        unitPriceXof: demurrageTotal,
        taxable: false,
      });
    }
    return lines;
  };

  const handleGenerateQuoteForDossier = (
    dossier: TransitDossier,
    dosContainers: Container[]
  ) => {
    const num = `DEV-2026-00${43 + quotes.length}`;
    const created: TransitQuote = {
      id: `q-${Date.now()}`,
      number: num,
      clientId: dossier.clientId,
      dossierId: dossier.id,
      containerRefs: dosContainers.map((c) => c.number),
      date: '2026-11-13',
      validityDate: '2026-11-28',
      currency,
      status: 'DRAFT',
      tvaRate: 0.18,
      lines: buildDossierTransitLines(dossier, dosContainers),
      notes: `Devis généré pour B/L ${dossier.blNumber}.`,
    };
    setQuotes((prev) => [created, ...prev]);
    pushChatter(
      'Devis',
      num,
      `Devis créé depuis le dossier ${dossier.reference} (${created.containerRefs.length} conteneur(s)).`
    );
    notify(`Devis ${num} généré pour ${dossier.reference}.`);
    setActiveApp('quotes');
  };

  const handleGenerateInvoiceForDossier = (
    dossier: TransitDossier,
    dosContainers: Container[]
  ) => {
    const invNum = `FAC-2026-0${186 + invoices.length}`;
    const created: TransitInvoice = {
      id: `inv-${Date.now()}`,
      number: invNum,
      docType: 'DEFINITIVE',
      clientId: dossier.clientId,
      dossierId: dossier.id,
      containerRefs: dosContainers.map((c) => c.number),
      currency,
      issueDate: '2026-11-13',
      dueDate: '2026-11-28',
      status: 'POSTED',
      tvaRate: 0.18,
      lines: buildDossierTransitLines(dossier, dosContainers),
      payments: [],
      notes: `Facture établie pour B/L ${dossier.blNumber}.`,
    };
    setInvoices((prev) => [created, ...prev]);
    pushChatter(
      'Facturation',
      invNum,
      `Facture émise pour le dossier ${dossier.reference}.`
    );
    notify(`Facture ${invNum} émise pour ${dossier.reference}.`);
    setActiveApp('invoicing');
  };

  // Quotes Handlers
  const handleCreateQuote = (
    data: Omit<TransitQuote, 'id' | 'number'>
  ): TransitQuote => {
    const num = `DEV-2026-00${43 + quotes.length}`;
    const created: TransitQuote = { ...data, id: `q-${Date.now()}`, number: num };
    setQuotes((prev) => [created, ...prev]);
    pushChatter(
      'Devis',
      num,
      `Devis créé avec ${created.containerRefs.length} référence(s) conteneur.`
    );
    notify(`Devis ${num} enregistré.`);
    return created;
  };

  const handleUpdateQuoteStatus = (quoteId: string, status: QuoteStatus) => {
    const target = quotes.find((q) => q.id === quoteId);
    setQuotes((prev) =>
      prev.map((q) => (q.id === quoteId ? { ...q, status } : q))
    );
    if (target) {
      pushChatter('Devis', target.number, `Statut mis à jour : ${status}.`);
      notify(`${target.number} · Statut : ${status}`);
    }
  };

  const handleConvertQuoteToInvoice = (quote: TransitQuote) => {
    const invNum = `FAC-2026-0${186 + invoices.length}`;
    const newInv: TransitInvoice = {
      id: `inv-${Date.now()}`,
      number: invNum,
      docType: 'DEFINITIVE',
      clientId: quote.clientId,
      dossierId: quote.dossierId,
      quoteId: quote.id,
      containerRefs: quote.containerRefs,
      currency: quote.currency,
      issueDate: '2026-11-13',
      dueDate: '2026-11-28',
      status: 'POSTED',
      tvaRate: quote.tvaRate,
      lines: quote.lines,
      payments: [],
      notes: `Facture issue du devis ${quote.number}.`,
    };
    setInvoices((prev) => [newInv, ...prev]);
    setQuotes((prev) =>
      prev.map((q) => (q.id === quote.id ? { ...q, status: 'INVOICED' } : q))
    );
    pushChatter(
      'Facturation',
      invNum,
      `Facture générée depuis le devis ${quote.number}.`
    );
    notify(`Facture ${invNum} créée depuis ${quote.number}.`);
    setActiveApp('invoicing');
  };

  // Invoicing Handlers
  const handleCreateDirectInvoice = (
    data: Omit<TransitInvoice, 'id' | 'number'>
  ): TransitInvoice => {
    const invNum = `FAC-2026-0${186 + invoices.length}`;
    const created: TransitInvoice = {
      ...data,
      id: `inv-${Date.now()}`,
      number: invNum,
    };
    setInvoices((prev) => [created, ...prev]);
    pushChatter(
      'Facturation',
      invNum,
      `Facture directe (${created.docType}) émise.`
    );
    notify(`Facture ${invNum} émise.`);
    return created;
  };

  const handlePostInvoice = (invoiceId: string) => {
    const inv = invoices.find((i) => i.id === invoiceId);
    setInvoices((prev) =>
      prev.map((i) => (i.id === invoiceId ? { ...i, status: 'POSTED' } : i))
    );
    if (inv) {
      pushChatter('Facturation', inv.number, 'Facture validée et comptabilisée.');
      notify(`${inv.number} validée.`);
    }
  };

  const handleRecordPayment = (
    invoiceId: string,
    payment: Omit<InvoicePayment, 'id'>
  ) => {
    const inv = invoices.find((i) => i.id === invoiceId);
    if (!inv) return;
    const newPay: InvoicePayment = { ...payment, id: `pay-${Date.now()}` };
    const updatedPayments = [...inv.payments, newPay];
    const updatedInv: TransitInvoice = { ...inv, payments: updatedPayments };
    const { balance } = computeTransitInvoiceBalance(updatedInv);
    const nextStatus = balance <= 0.5 ? 'PAID' : 'PARTIAL';

    setInvoices((prev) =>
      prev.map((i) =>
        i.id === invoiceId
          ? { ...i, payments: updatedPayments, status: nextStatus }
          : i
      )
    );
    pushChatter(
      'Facturation',
      inv.number,
      `Règlement de ${Math.round(payment.amountXof).toLocaleString(
        'fr-FR'
      )} XOF encaissé (${payment.reference}).`
    );
    notify(`Règlement encaissé sur ${inv.number}.`);
  };

  // Archive Handlers
  const handleToggleArchiveDossier = (
    dossierId: string,
    archive: boolean,
    boxRef?: string
  ) => {
    const dos = dossiers.find((d) => d.id === dossierId);
    const resolvedBox =
      boxRef || `ARC-2026-B${13 + dossiers.filter((d) => d.archived).length}`;

    setDossiers((prev) =>
      prev.map((d) =>
        d.id === dossierId
          ? {
              ...d,
              archived: archive,
              archivedAt: archive ? '2026-11-13' : undefined,
              archiveBoxRef: archive ? d.archiveBoxRef || resolvedBox : undefined,
            }
          : d
      )
    );

    if (dos) {
      pushChatter(
        'Archivage',
        dos.reference,
        archive
          ? `Dossier clôturé et archivé (${resolvedBox}).`
          : 'Dossier restauré vers les opérations actives.'
      );
      notify(
        archive
          ? `${dos.reference} archivé (${resolvedBox}).`
          : `${dos.reference} restauré.`
      );
      if (archive) setActiveApp('archive');
    }
  };

  const handleUpdateArchiveBox = (dossierId: string, boxRef: string) => {
    setDossiers((prev) =>
      prev.map((d) =>
        d.id === dossierId ? { ...d, archiveBoxRef: boxRef } : d
      )
    );
  };

  const handleToggleArchiveDoc = (dossierId: string, docKey: ArchiveDocKey) => {
    setDossiers((prev) =>
      prev.map((d) => {
        if (d.id !== dossierId) return d;
        const exists = d.attachedDocs.includes(docKey);
        return {
          ...d,
          attachedDocs: exists
            ? d.attachedDocs.filter((k) => k !== docKey)
            : [...d.attachedDocs, docKey],
        };
      })
    );
  };

  // Clients & Services
  const handleAddClient = (client: Omit<TransitClient, 'id'>) => {
    const created: TransitClient = { ...client, id: `cli-${Date.now()}` };
    setClients((prev) => [created, ...prev]);
    pushChatter('Clients', created.ninea, `Nouveau client : ${created.name}.`);
    notify(`Client ${created.name} ajouté.`);
  };

  const handleAddService = (service: Omit<TransitServiceItem, 'id'>) => {
    const created: TransitServiceItem = { ...service, id: `srv-${Date.now()}` };
    setServices((prev) => [...prev, created]);
    pushChatter('Tarifs', created.code, `Prestation ajoutée : ${created.label}.`);
    notify(`Tarif ${created.code} ajouté.`);
  };

  const handleUpdateServicePrice = (serviceId: string, priceXof: number) => {
    setServices((prev) =>
      prev.map((s) =>
        s.id === serviceId ? { ...s, defaultPriceXof: priceXof } : s
      )
    );
  };

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <ErpSidebar
        activeApp={activeApp}
        onSelectApp={setActiveApp}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        theme={theme}
        onToggleTheme={() =>
          setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
        }
        onResetDemo={handleResetDemo}
        counts={launcherCounts}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <ErpHeader
          activeApp={activeApp}
          onSelectApp={setActiveApp}
          currency={currency}
          onChangeCurrency={setCurrency}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onOpenCommandPalette={() => setCommandPaletteOpen(true)}
          onOpenQuickContainer={() => setGlobalQuickContainerOpen(true)}
        />

        <main className="flex-1 w-full max-w-[1440px] mx-auto p-4 sm:p-6 lg:p-8">
          {activeApp === 'launcher' && (
            <AppLauncher
              onSelectApp={setActiveApp}
              onOpenQuickContainer={() => setGlobalQuickContainerOpen(true)}
              counts={launcherCounts}
            />
          )}

          {activeApp === 'dashboard' && (
            <ErpDashboard
              currency={currency}
              dossiers={dossiers}
              containers={containers}
              quotes={quotes}
              invoices={invoices}
              clients={clients}
              chatter={chatter}
              onSelectApp={setActiveApp}
              onOpenQuickContainer={() => setGlobalQuickContainerOpen(true)}
              onAddChatterNote={(msg) =>
                pushChatter('Transit', 'NOTE', msg, 'NOTE')
              }
            />
          )}

          {activeApp === 'transit' && (
            <TransitModule
              dossiers={dossiers}
              containers={containers}
              clients={clients}
              currency={currency}
              onCreateContainer={handleCreateContainer}
              onUpdateContainerStep={handleUpdateContainerStep}
              onGenerateQuoteForDossier={handleGenerateQuoteForDossier}
              onGenerateInvoiceForDossier={handleGenerateInvoiceForDossier}
              onArchiveDossier={(id) => handleToggleArchiveDossier(id, true)}
            />
          )}

          {activeApp === 'quotes' && (
            <QuotesTransitModule
              quotes={quotes}
              dossiers={dossiers}
              containers={containers}
              clients={clients}
              services={services}
              currency={currency}
              onCreateQuote={handleCreateQuote}
              onUpdateQuoteStatus={handleUpdateQuoteStatus}
              onConvertQuoteToInvoice={handleConvertQuoteToInvoice}
            />
          )}

          {activeApp === 'invoicing' && (
            <InvoicingModule
              invoices={invoices}
              dossiers={dossiers}
              containers={containers}
              clients={clients}
              services={services}
              currency={currency}
              onCreateInvoice={handleCreateDirectInvoice}
              onPostInvoice={handlePostInvoice}
              onRecordPayment={handleRecordPayment}
            />
          )}

          {activeApp === 'archive' && (
            <ArchiveModule
              dossiers={dossiers}
              containers={containers}
              clients={clients}
              onToggleArchiveDossier={handleToggleArchiveDossier}
              onUpdateArchiveBox={handleUpdateArchiveBox}
              onToggleArchiveDoc={handleToggleArchiveDoc}
            />
          )}

          {activeApp === 'clients' && (
            <ClientsTariffsModule
              clients={clients}
              dossiers={dossiers}
              services={services}
              currency={currency}
              onAddClient={handleAddClient}
              onAddService={handleAddService}
              onUpdateServicePrice={handleUpdateServicePrice}
            />
          )}
        </main>
      </div>

      {/* Global Command Palette (⌘K) */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onSelectApp={setActiveApp}
        onOpenQuickContainer={() => setGlobalQuickContainerOpen(true)}
        onToggleTheme={() =>
          setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
        }
        theme={theme}
        clients={clients}
        dossiers={dossiers}
        containers={containers}
        quotes={quotes}
        invoices={invoices}
      />

      {/* Global Quick Container Intake Modal */}
      <QuickContainerModal
        isOpen={globalQuickContainerOpen}
        onClose={() => setGlobalQuickContainerOpen(false)}
        dossiers={activeDossiers}
        clients={mappedClients}
        onCreateContainer={handleCreateContainer}
      />

      {/* Subtle Action Toast */}
      {toastMsg && (
        <div
          role="status"
          className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-800 text-white border border-slate-700 shadow-xl text-xs font-medium no-print"
        >
          <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
          <span>{toastMsg}</span>
          <button
            type="button"
            onClick={() => setToastMsg(null)}
            className="text-slate-400 hover:text-white ml-1 cursor-pointer"
            aria-label="Fermer la notification"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
