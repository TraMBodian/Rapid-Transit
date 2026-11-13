import React, { useMemo, useState } from 'react';
import {
  Archive,
  ChevronRight,
  Container as ContainerIcon,
  Download,
  FilePlus2,
  FileSpreadsheet,
  LayoutList,
  MapPin,
  Receipt,
  Search,
  Ship,
  Table2,
  X,
} from 'lucide-react';
import {
  CurrencyCode,
  TransitClient,
  TransitDossier,
} from '../../types/erp';
import {
  Client,
  Container,
  Dossier,
  LifecycleStep,
  TrafficStatus,
} from '../../types/transit';
import {
  calculateContainerDemurrage,
  downloadCSV,
  LIFECYCLE_STEPS,
} from '../../utils/transitUtils';
import { formatErpMoney } from '../../utils/erpUtils';
import { QuickContainerModal } from '../QuickContainerModal';
import { StatusBadge } from '../StatusBadge';

interface TransitModuleProps {
  dossiers: TransitDossier[];
  containers: Container[];
  clients: TransitClient[];
  currency: CurrencyCode;
  onCreateContainer: (
    containerData: Omit<Container, 'id'>,
    newDossierData?: Omit<Dossier, 'id' | 'reference' | 'createdAt'>
  ) => string;
  onUpdateContainerStep: (containerId: string, nextStep: LifecycleStep) => void;
  onGenerateQuoteForDossier: (
    dossier: TransitDossier,
    dossierContainers: Container[]
  ) => void;
  onGenerateInvoiceForDossier: (
    dossier: TransitDossier,
    dossierContainers: Container[]
  ) => void;
  onArchiveDossier: (dossierId: string) => void;
}

type TransitFilter =
  | 'ALL'
  | TrafficStatus
  | 'EN_MER'
  | 'ARRIVE_PORT'
  | 'DEDOUANE';

export const TransitModule: React.FC<TransitModuleProps> = ({
  dossiers,
  containers,
  clients,
  currency,
  onCreateContainer,
  onUpdateContainerStep,
  onGenerateQuoteForDossier,
  onGenerateInvoiceForDossier,
  onArchiveDossier,
}) => {
  const [viewMode, setViewMode] = useState<'DOSSIERS' | 'LIST'>('DOSSIERS');
  const [filter, setFilter] = useState<TransitFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [quickModalOpen, setQuickModalOpen] = useState(false);
  const [preselectedDossierId, setPreselectedDossierId] = useState<
    string | undefined
  >(undefined);
  const [inspectedContainerId, setInspectedContainerId] = useState<
    string | null
  >(null);

  const activeDossiers = useMemo(
    () => dossiers.filter((d) => !d.archived),
    [dossiers]
  );

  const activeDossierIds = useMemo(
    () => new Set(activeDossiers.map((d) => d.id)),
    [activeDossiers]
  );

  const mappedClients: Client[] = useMemo(
    () =>
      clients.map((c) => ({
        ...c,
        creditLimitXof: 30000000,
      })),
    [clients]
  );

  const evaluated = useMemo(
    () =>
      containers
        .filter((c) => activeDossierIds.has(c.dossierId))
        .map((c) => ({
          container: c,
          dossier: activeDossiers.find((d) => d.id === c.dossierId),
          demurrage: calculateContainerDemurrage(c),
        })),
    [containers, activeDossiers, activeDossierIds]
  );

  const summary = useMemo(() => {
    const active = evaluated.filter(
      (x) => x.container.step !== 'VIDE_RESTITUE'
    );
    const greenCount = evaluated.filter(
      (x) => x.demurrage.status === 'green'
    ).length;
    const orangeCount = active.filter(
      (x) => x.demurrage.status === 'orange'
    ).length;
    const redItems = active.filter((x) => x.demurrage.status === 'red');
    const totalDemurrageXof = evaluated.reduce(
      (sum, x) => sum + x.demurrage.accruedFeeXof,
      0
    );

    return {
      activeCount: active.length,
      totalCount: evaluated.length,
      greenCount,
      orangeCount,
      redCount: redItems.length,
      totalDemurrageXof,
    };
  }, [evaluated]);

  const matchesFilterAndSearch = (
    c: Container,
    status: TrafficStatus,
    dossier?: TransitDossier
  ): boolean => {
    const matchesStatus =
      filter === 'ALL'
        ? true
        : filter === 'green' || filter === 'orange' || filter === 'red'
        ? status === filter
        : c.step === filter;

    if (!matchesStatus) return false;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    const cl = clients.find((x) => x.id === dossier?.clientId);
    return (
      c.number.toLowerCase().includes(q) ||
      c.sealNumber.toLowerCase().includes(q) ||
      (c.yardLocation || '').toLowerCase().includes(q) ||
      (dossier?.reference || '').toLowerCase().includes(q) ||
      (dossier?.blNumber || '').toLowerCase().includes(q) ||
      (dossier?.vesselName || '').toLowerCase().includes(q) ||
      (dossier?.shippingLine || '').toLowerCase().includes(q) ||
      (cl?.name || '').toLowerCase().includes(q)
    );
  };

  const filteredEvaluated = useMemo(
    () =>
      evaluated.filter(({ container, dossier, demurrage }) =>
        matchesFilterAndSearch(container, demurrage.status, dossier)
      ),
    [evaluated, filter, searchQuery, clients]
  );

  const groupedDossiers = useMemo(() => {
    return activeDossiers
      .map((dossier) => {
        const client = clients.find((c) => c.id === dossier.clientId);
        const allItems = evaluated.filter(
          (x) => x.container.dossierId === dossier.id
        );
        const visibleItems = allItems.filter((x) =>
          matchesFilterAndSearch(x.container, x.demurrage.status, dossier)
        );
        const dossierDemurrageXof = allItems.reduce(
          (sum, x) => sum + x.demurrage.accruedFeeXof,
          0
        );
        const worstStatus: TrafficStatus = allItems.some(
          (x) => x.demurrage.status === 'red'
        )
          ? 'red'
          : allItems.some((x) => x.demurrage.status === 'orange')
          ? 'orange'
          : 'green';

        return {
          dossier,
          client,
          allItems,
          visibleItems,
          dossierDemurrageXof,
          worstStatus,
        };
      })
      .filter((g) => g.visibleItems.length > 0);
  }, [activeDossiers, clients, evaluated, filter, searchQuery]);

  const inspectedItem = useMemo(
    () =>
      inspectedContainerId
        ? evaluated.find((x) => x.container.id === inspectedContainerId) || null
        : null,
    [inspectedContainerId, evaluated]
  );

  const handleOpenQuick = (dossierId?: string) => {
    setPreselectedDossierId(dossierId);
    setQuickModalOpen(true);
  };

  const handleExportCsv = () => {
    const headers = [
      'Dossier',
      'B/L',
      'Armateur',
      'Navire',
      'Client',
      'N° Conteneur',
      'Type',
      'Étape',
      'Arrivée',
      'Franchise (j)',
      'Jours écoulés',
      'Statut',
      'Surestarie (XOF)',
    ];
    const rows = evaluated.map(({ container, dossier, demurrage }) => {
      const client = clients.find((c) => c.id === dossier?.clientId);
      const stepLabel =
        LIFECYCLE_STEPS.find((s) => s.key === container.step)?.label ||
        container.step;
      return [
        dossier?.reference || '',
        dossier?.blNumber || '',
        dossier?.shippingLine || '',
        dossier?.vesselName || '',
        client?.name || '',
        container.number,
        container.type,
        stepLabel,
        container.arrivalDate,
        container.freeDays,
        demurrage.daysElapsed,
        demurrage.statusLabel,
        demurrage.accruedFeeXof,
      ];
    });
    downloadCSV('odootransit_parc_conteneurs.csv', headers, rows);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
            Dossiers de Transit & Références Conteneurs
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Enregistrez les références ISO 6346, pilotez les étapes douanières et maîtrisez les surestaries.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
            <button
              type="button"
              onClick={() => setViewMode('DOSSIERS')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer transition-colors ${
                viewMode === 'DOSSIERS'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <LayoutList className="w-3.5 h-3.5" />
              <span>Dossiers</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('LIST')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer transition-colors ${
                viewMode === 'LIST'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Table2 className="w-3.5 h-3.5" />
              <span>Tableau Parc</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenQuick()}
            className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 rounded-lg cursor-pointer"
          >
            <FilePlus2 className="w-4 h-4" />
            <span>Saisir réf. conteneur</span>
          </button>
        </div>
      </div>

      {/* KPI & Color Indicator Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Conteneurs actifs / total
          </p>
          <p className="font-mono text-2xl font-semibold text-slate-900 dark:text-white tabular-nums mt-2">
            {summary.activeCount}{' '}
            <span className="text-sm font-normal text-slate-400 dark:text-slate-500">
              / {summary.totalCount}
            </span>
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Sur {activeDossiers.length} dossiers ouverts
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Conformes / Dans franchise
            </p>
            <StatusBadge status="green" label="Nominal" compact />
          </div>
          <p className="font-mono text-2xl font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums mt-2">
            {summary.greenCount} unité(s)
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Franchise proche (≤ 2j)
            </p>
            <StatusBadge status="orange" label="Attention" compact />
          </div>
          <p className="font-mono text-2xl font-semibold text-amber-700 dark:text-amber-400 tabular-nums mt-2">
            {summary.orangeCount} alerte(s)
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Surestaries ({summary.redCount} TC)
            </p>
            <StatusBadge status="red" label="Critique" compact />
          </div>
          <p className="font-mono text-2xl font-semibold text-red-700 dark:text-red-400 tabular-nums mt-2">
            {formatErpMoney(summary.totalDemurrageXof, currency)}
          </p>
        </div>
      </div>

      {/* Search + Filter Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { key: 'ALL', label: 'Tous' },
              { key: 'EN_MER', label: 'En mer' },
              { key: 'ARRIVE_PORT', label: 'Arrivé au port' },
              { key: 'DEDOUANE', label: 'Dédouané' },
              { key: 'green', label: 'Conformes' },
              { key: 'orange', label: 'Franchise critique' },
              { key: 'red', label: 'En surestarie' },
            ] as { key: TransitFilter; label: string }[]
          ).map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 min-h-[36px] text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                filter === f.key
                  ? 'bg-slate-900 dark:bg-teal-600 text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1 sm:w-64">
            <Search
              className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filtrer réf. conteneur, B/L, navire..."
              className="w-full h-9 pl-8 pr-7 text-xs bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-teal-600"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                aria-label="Effacer le filtre"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <span className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums whitespace-nowrap">
            {filteredEvaluated.length} TC
          </span>
        </div>
      </div>

      {/* VIEW 1: DOSSIERS & INTERACTIVE LIFECYCLE STEPPER */}
      {viewMode === 'DOSSIERS' ? (
        groupedDossiers.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center space-y-3">
            <p className="text-sm font-medium text-slate-900 dark:text-white">
              Aucun conteneur actif pour ce filtre
            </p>
            <button
              type="button"
              onClick={() => {
                setFilter('ALL');
                setSearchQuery('');
              }}
              className="px-4 py-2 text-xs font-medium text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 rounded-lg hover:bg-teal-100 cursor-pointer"
            >
              Réinitialiser les filtres
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            {groupedDossiers.map(
              ({
                dossier,
                client,
                allItems,
                visibleItems,
                dossierDemurrageXof,
                worstStatus,
              }) => (
                <article
                  key={dossier.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden"
                >
                  {/* Dossier Header */}
                  <div className="px-6 py-4 bg-slate-50/80 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="font-mono text-sm font-semibold text-teal-800 dark:text-teal-400">
                          {dossier.reference}
                        </span>
                        <span
                          className="text-slate-300 dark:text-slate-700"
                          aria-hidden="true"
                        >
                          ·
                        </span>
                        <span className="text-sm font-semibold text-slate-900 dark:text-white">
                          {client?.name}
                        </span>
                        <StatusBadge
                          status={worstStatus}
                          label={
                            worstStatus === 'red'
                              ? 'Surestarie active'
                              : worstStatus === 'orange'
                              ? 'Franchise à surveiller'
                              : 'Dossier conforme'
                          }
                          compact
                        />
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
                        <span className="font-mono">B/L {dossier.blNumber}</span>
                        <span className="inline-flex items-center gap-1">
                          <Ship className="w-3.5 h-3.5 text-slate-400" />
                          <span>
                            {dossier.shippingLine} · {dossier.vesselName}
                          </span>
                        </span>
                        <span>{dossier.cargoDescription}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {dossierDemurrageXof > 0 && (
                        <span className="px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-xs font-mono font-semibold text-red-800 dark:text-red-300 tabular-nums">
                          Surestaries :{' '}
                          {formatErpMoney(dossierDemurrageXof, currency)}
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => handleOpenQuick(dossier.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[36px] text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                      >
                        <ContainerIcon className="w-3.5 h-3.5 text-slate-500" />
                        <span>+ Réf. Conteneur ({allItems.length})</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          onGenerateQuoteForDossier(
                            dossier,
                            allItems.map((x) => x.container)
                          )
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[36px] text-xs font-medium text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 rounded-lg hover:bg-teal-100 dark:hover:bg-teal-900/60 cursor-pointer"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        <span>Devis</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          onGenerateInvoiceForDossier(
                            dossier,
                            allItems.map((x) => x.container)
                          )
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[36px] text-xs font-semibold text-white bg-slate-900 dark:bg-teal-600 rounded-lg hover:bg-slate-800 dark:hover:bg-teal-500 cursor-pointer"
                      >
                        <Receipt className="w-3.5 h-3.5" />
                        <span>Facturer</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => onArchiveDossier(dossier.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[36px] text-xs font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                        title="Clôturer et envoyer vers l'Archivage"
                      >
                        <Archive className="w-3.5 h-3.5" />
                        <span>Archiver</span>
                      </button>
                    </div>
                  </div>

                  {/* Containers inside Dossier */}
                  <div className="divide-y divide-slate-200 dark:divide-slate-800">
                    {visibleItems.map(({ container, demurrage }) => {
                      const currentStepIdx = LIFECYCLE_STEPS.findIndex(
                        (s) => s.key === container.step
                      );
                      const nextStep =
                        currentStepIdx < LIFECYCLE_STEPS.length - 1
                          ? LIFECYCLE_STEPS[currentStepIdx + 1]
                          : null;

                      const freeRatio =
                        container.freeDays > 0
                          ? Math.min(
                              100,
                              Math.round(
                                (demurrage.daysElapsed / container.freeDays) *
                                  100
                              )
                            )
                          : 100;

                      const barColor =
                        demurrage.status === 'red'
                          ? 'bg-red-600'
                          : demurrage.status === 'orange'
                          ? 'bg-amber-500'
                          : 'bg-emerald-600';

                      return (
                        <div key={container.id} className="p-5 sm:px-6 space-y-4">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2.5">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setInspectedContainerId(container.id)
                                  }
                                  className="font-mono text-base font-semibold text-slate-900 dark:text-white hover:text-teal-700 dark:hover:text-teal-400 cursor-pointer"
                                >
                                  {container.number}
                                </button>
                                <span className="text-xs text-slate-600 dark:text-slate-400">
                                  {container.type} · Tare{' '}
                                  <span className="font-mono tabular-nums">
                                    {container.tareKg} kg
                                  </span>{' '}
                                  · Plomb{' '}
                                  <span className="font-mono">
                                    {container.sealNumber}
                                  </span>
                                </span>
                              </div>

                              <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                                <span className="inline-flex items-center gap-1">
                                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                  <span>
                                    {container.yardLocation || 'Terminal'}
                                  </span>
                                </span>
                                <span aria-hidden="true">·</span>
                                <span className="font-mono tabular-nums">
                                  Arrivée {container.arrivalDate} · Franchise{' '}
                                  {container.freeDays} j · Tarif{' '}
                                  {formatErpMoney(
                                    container.dailyDemurrageXof,
                                    currency
                                  )}
                                  /j
                                </span>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-3 shrink-0">
                              <div className="text-right hidden sm:block">
                                <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                                  {demurrage.detailText}
                                </p>
                              </div>
                              <StatusBadge
                                status={demurrage.status}
                                label={demurrage.statusLabel}
                              />
                              {nextStep && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onUpdateContainerStep(
                                      container.id,
                                      nextStep.key
                                    )
                                  }
                                  className="inline-flex items-center gap-1 px-3 py-1.5 min-h-[36px] text-xs font-medium text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 rounded-lg hover:bg-teal-100 dark:hover:bg-teal-900/60 cursor-pointer"
                                >
                                  <span>Passer : {nextStep.shortLabel}</span>
                                  <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Franchise & Demurrage Progress Bar */}
                          {container.step !== 'EN_MER' && (
                            <div className="space-y-1">
                              <div className="flex justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                                <span>
                                  Consommation franchise :{' '}
                                  {demurrage.daysElapsed} / {container.freeDays}{' '}
                                  jours
                                </span>
                                {demurrage.overdueDays > 0 ? (
                                  <span className="font-semibold text-red-700 dark:text-red-400">
                                    +{demurrage.overdueDays} j hors franchise (
                                    {formatErpMoney(
                                      demurrage.accruedFeeXof,
                                      currency
                                    )}
                                    )
                                  </span>
                                ) : (
                                  <span>
                                    {demurrage.daysRemaining} j restants
                                  </span>
                                )}
                              </div>
                              <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                                  style={{ width: `${freeRatio}%` }}
                                />
                              </div>
                            </div>
                          )}

                          {/* 6-Step Lifecycle Selector */}
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                            {LIFECYCLE_STEPS.map((stepObj, idx) => {
                              const completed = idx < currentStepIdx;
                              const isCurrent = idx === currentStepIdx;
                              return (
                                <button
                                  key={stepObj.key}
                                  type="button"
                                  onClick={() =>
                                    onUpdateContainerStep(
                                      container.id,
                                      stepObj.key
                                    )
                                  }
                                  className={`px-2.5 py-2 min-h-[36px] rounded-lg border text-left transition-colors cursor-pointer flex items-center gap-2 ${
                                    isCurrent
                                      ? 'bg-slate-900 dark:bg-teal-600 text-white border-slate-900 dark:border-teal-600'
                                      : completed
                                      ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/70 hover:bg-emerald-100 dark:hover:bg-emerald-900/50'
                                      : 'bg-slate-50 dark:bg-slate-950/60 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
                                  }`}
                                >
                                  <span
                                    className={`w-5 h-5 rounded-full text-[11px] font-mono font-semibold flex items-center justify-center shrink-0 ${
                                      isCurrent
                                        ? 'bg-teal-600 dark:bg-slate-900 text-white'
                                        : completed
                                        ? 'bg-emerald-600 text-white'
                                        : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                    }`}
                                  >
                                    {idx + 1}
                                  </span>
                                  <span className="text-xs font-medium truncate">
                                    {stepObj.shortLabel}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </article>
              )
            )}
          </div>
        )
      ) : (
        /* VIEW 2: HIGH-DENSITY CONTAINER PARK TABLE */
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400">
                <th className="py-3 px-5">N° Conteneur</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Dossier · Client</th>
                <th className="py-3 px-4">Étape actuelle</th>
                <th className="py-3 px-4 text-right">Jours / Franchise</th>
                <th className="py-3 px-4 text-right">Surestaries</th>
                <th className="py-3 px-4">Indicateur</th>
                <th className="py-3 px-5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {filteredEvaluated.map(({ container, dossier, demurrage }) => {
                const client = clients.find((c) => c.id === dossier?.clientId);
                const currentStepIdx = LIFECYCLE_STEPS.findIndex(
                  (s) => s.key === container.step
                );
                const stepLabel =
                  LIFECYCLE_STEPS[currentStepIdx]?.label || container.step;
                const nextStep =
                  currentStepIdx < LIFECYCLE_STEPS.length - 1
                    ? LIFECYCLE_STEPS[currentStepIdx + 1]
                    : null;
                return (
                  <tr
                    key={container.id}
                    onClick={() => setInspectedContainerId(container.id)}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 cursor-pointer"
                  >
                    <td className="py-3 px-5 font-mono font-semibold text-slate-900 dark:text-white">
                      {container.number}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-300">
                      {container.type}
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-mono text-xs font-semibold text-teal-800 dark:text-teal-400">
                        {dossier?.reference} · B/L {dossier?.blNumber}
                      </p>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        {client?.name}
                      </p>
                    </td>
                    <td className="py-3 px-4 text-xs font-medium text-slate-800 dark:text-slate-200">
                      {stepLabel}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-xs tabular-nums text-slate-700 dark:text-slate-300">
                      {demurrage.daysElapsed} / {container.freeDays} j
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold tabular-nums text-slate-900 dark:text-white">
                      {formatErpMoney(demurrage.accruedFeeXof, currency)}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge
                        status={demurrage.status}
                        label={demurrage.statusLabel}
                        compact
                      />
                    </td>
                    <td
                      className="py-3 px-5 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {nextStep && (
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateContainerStep(container.id, nextStep.key)
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 rounded-md hover:bg-teal-100 cursor-pointer"
                        >
                          <span>{nextStep.shortLabel}</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Slide-Over Container Inspector Drawer */}
      {inspectedItem && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-slate-950/50 backdrop-blur-xs no-print"
          onClick={() => setInspectedContainerId(null)}
        >
          <div
            className="w-full max-w-md h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <p className="font-mono text-lg font-bold text-slate-900 dark:text-white">
                  {inspectedItem.container.number}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {inspectedItem.container.type} ·{' '}
                  {inspectedItem.dossier?.reference}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectedContainerId(null)}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                aria-label="Fermer le panneau"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="flex items-center justify-between">
                <StatusBadge
                  status={inspectedItem.demurrage.status}
                  label={inspectedItem.demurrage.statusLabel}
                />
                <span className="font-mono text-sm font-semibold text-slate-900 dark:text-white tabular-nums">
                  {formatErpMoney(
                    inspectedItem.demurrage.accruedFeeXof,
                    currency
                  )}
                </span>
              </div>

              <div className="space-y-2 text-xs border-t border-b border-slate-200 dark:border-slate-800 py-4">
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">
                    Connaissement (B/L)
                  </span>
                  <span className="font-mono font-medium text-slate-900 dark:text-white">
                    {inspectedItem.dossier?.blNumber}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">
                    Armateur / Navire
                  </span>
                  <span className="font-medium text-slate-900 dark:text-white">
                    {inspectedItem.dossier?.shippingLine} ·{' '}
                    {inspectedItem.dossier?.vesselName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">
                    N° de plomb & Tare
                  </span>
                  <span className="font-mono text-slate-900 dark:text-white">
                    {inspectedItem.container.sealNumber} ·{' '}
                    {inspectedItem.container.tareKg} kg
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">
                    Localisation parc
                  </span>
                  <span className="text-slate-900 dark:text-white">
                    {inspectedItem.container.yardLocation}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 dark:text-slate-400">
                    Arrivée / Franchise
                  </span>
                  <span className="font-mono tabular-nums text-slate-900 dark:text-white">
                    {inspectedItem.container.arrivalDate} ·{' '}
                    {inspectedItem.container.freeDays} j
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Changer l’étape du cycle de vie
                </p>
                <div className="space-y-1.5">
                  {LIFECYCLE_STEPS.map((st, idx) => {
                    const current = inspectedItem.container.step === st.key;
                    return (
                      <button
                        key={st.key}
                        type="button"
                        onClick={() =>
                          onUpdateContainerStep(
                            inspectedItem.container.id,
                            st.key
                          )
                        }
                        className={`w-full px-3 py-2.5 rounded-lg border text-left text-xs font-medium flex items-center justify-between cursor-pointer transition-colors ${
                          current
                            ? 'bg-slate-900 dark:bg-teal-600 text-white border-slate-900 dark:border-teal-600'
                            : 'bg-slate-50 dark:bg-slate-950/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <span>
                          0{idx + 1}. {st.label}
                        </span>
                        {current && (
                          <span className="font-mono text-[11px]">Actif</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <QuickContainerModal
        isOpen={quickModalOpen}
        onClose={() => setQuickModalOpen(false)}
        dossiers={activeDossiers}
        clients={mappedClients}
        preselectedDossierId={preselectedDossierId}
        onCreateContainer={onCreateContainer}
      />
    </div>
  );
};
