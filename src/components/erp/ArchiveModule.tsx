import React, { useMemo, useState } from 'react';
import {
  Archive,
  ArchiveRestore,
  CheckSquare,
  Container as ContainerIcon,
  Download,
  FolderCheck,
  Printer,
  Search,
  Square,
} from 'lucide-react';
import { ARCHIVE_DOC_LABELS } from '../../data/transitErpData';
import {
  ArchiveDocKey,
  TransitClient,
  TransitDossier,
} from '../../types/erp';
import { Container } from '../../types/transit';
import { exportErpCsv } from '../../utils/erpUtils';
import { StatusBadge } from '../StatusBadge';

interface ArchiveModuleProps {
  dossiers: TransitDossier[];
  containers: Container[];
  clients: TransitClient[];
  onToggleArchiveDossier: (
    dossierId: string,
    archive: boolean,
    boxRef?: string
  ) => void;
  onUpdateArchiveBox: (dossierId: string, boxRef: string) => void;
  onToggleArchiveDoc: (dossierId: string, docKey: ArchiveDocKey) => void;
}

const ALL_DOC_KEYS: ArchiveDocKey[] = [
  'BL_ORIGINAL',
  'DECLARATION_DOUANE',
  'BAD_COMPAGNIE',
  'FACTURE_ACQUITTEE',
  'BON_RESTITUTION_VIDE',
];

export const ArchiveModule: React.FC<ArchiveModuleProps> = ({
  dossiers,
  containers,
  clients,
  onToggleArchiveDossier,
  onUpdateArchiveBox,
  onToggleArchiveDoc,
}) => {
  const [search, setSearch] = useState('');
  const [completenessFilter, setCompletenessFilter] = useState<
    'ALL' | 'COMPLETE' | 'PARTIAL'
  >('ALL');
  const [selectedArchiveId, setSelectedArchiveId] = useState<string | null>(
    null
  );

  const archivedDossiers = useMemo(
    () =>
      dossiers
        .filter((d) => d.archived)
        .filter((d) => {
          const isComp = d.attachedDocs.length === ALL_DOC_KEYS.length;
          if (completenessFilter === 'COMPLETE' && !isComp) return false;
          if (completenessFilter === 'PARTIAL' && isComp) return false;
          const q = search.trim().toLowerCase();
          if (!q) return true;
          const cl = clients.find((c) => c.id === d.clientId);
          const dosContainers = containers.filter((c) => c.dossierId === d.id);
          return (
            d.reference.toLowerCase().includes(q) ||
            d.blNumber.toLowerCase().includes(q) ||
            (d.archiveBoxRef || '').toLowerCase().includes(q) ||
            (cl?.name || '').toLowerCase().includes(q) ||
            dosContainers.some((c) => c.number.toLowerCase().includes(q))
          );
        }),
    [dossiers, containers, clients, search, completenessFilter]
  );

  const archivableActiveDossiers = useMemo(
    () => dossiers.filter((d) => !d.archived),
    [dossiers]
  );

  const handleExportArchives = () => {
    const headers = [
      'Boîte Archive',
      'Référence Dossier',
      'Date Archivage',
      'Client',
      'N° B/L',
      'Conteneurs',
      'Pièces jointes',
    ];
    const rows = archivedDossiers.map((d) => {
      const cl = clients.find((c) => c.id === d.clientId);
      const contRefs = containers
        .filter((c) => c.dossierId === d.id)
        .map((c) => c.number)
        .join(', ');
      return [
        d.archiveBoxRef || '',
        d.reference,
        d.archivedAt || '',
        cl?.name || '',
        d.blNumber,
        contRefs,
        `${d.attachedDocs.length}/5`,
      ];
    });
    exportErpCsv('odootransit_archives_dossiers.csv', headers, rows);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
            Archivage des Dossiers & Pièces Douanières
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Conservation légale OHADA (10 ans) : connaissements, déclarations GAINDE, factures acquittées et références conteneurs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span>Imprimer registre</span>
          </button>
          <button
            type="button"
            onClick={handleExportArchives}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] text-xs font-semibold text-white bg-slate-900 dark:bg-teal-600 rounded-lg hover:bg-slate-800 dark:hover:bg-teal-500 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV Archives</span>
          </button>
        </div>
      </div>

      {/* Search & Quick Archive Strip */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 no-print">
        <div className="lg:col-span-7 flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par n° conteneur, B/L, boîte (ARC-...) ou client..."
              className="w-full h-11 pl-10 pr-4 text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-teal-600"
            />
          </div>
          <div className="inline-flex p-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shrink-0 self-start">
            {(
              [
                { key: 'ALL', label: 'Tous' },
                { key: 'COMPLETE', label: '5/5' },
                { key: 'PARTIAL', label: 'Partiels' },
              ] as const
            ).map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setCompletenessFilter(f.key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg cursor-pointer transition-colors ${
                  completenessFilter === f.key
                    ? 'bg-slate-900 dark:bg-teal-600 text-white'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 flex items-center justify-between gap-3">
          <div className="text-xs">
            <p className="font-semibold text-slate-900 dark:text-white">
              Clôturer & archiver un dossier actif
            </p>
            <p className="text-slate-500 dark:text-slate-400">
              {archivableActiveDossiers.length} dossier(s) en cours
            </p>
          </div>
          {archivableActiveDossiers.length > 0 && (
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) {
                  onToggleArchiveDossier(
                    e.target.value,
                    true,
                    `ARC-2026-B${13 + dossiers.filter((d) => d.archived).length}`
                  );
                }
              }}
              className="h-9 px-3 text-xs font-medium bg-teal-50 dark:bg-teal-950/60 text-teal-900 dark:text-teal-200 border border-teal-200 dark:border-teal-800 rounded-lg cursor-pointer"
            >
              <option value="">+ Archiver un dossier...</option>
              {archivableActiveDossiers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.reference} (B/L {d.blNumber})
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Archived Dossiers Grid */}
      {archivedDossiers.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-10 text-center space-y-2">
          <Archive className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
          <p className="text-sm font-medium text-slate-900 dark:text-white">
            Aucun dossier archivé ne correspond à cette recherche
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Les dossiers clôturés et leurs pièces justificatives apparaîtront ici.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {archivedDossiers.map((dossier) => {
            const client = clients.find((c) => c.id === dossier.clientId);
            const dosContainers = containers.filter(
              (c) => c.dossierId === dossier.id
            );
            const docCount = dossier.attachedDocs.length;
            const isComplete = docCount === ALL_DOC_KEYS.length;
            const expanded = selectedArchiveId === dossier.id;

            return (
              <article
                key={dossier.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden"
              >
                <div className="p-5 sm:px-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <input
                        type="text"
                        value={dossier.archiveBoxRef || ''}
                        onChange={(e) =>
                          onUpdateArchiveBox(
                            dossier.id,
                            e.target.value.toUpperCase()
                          )
                        }
                        aria-label="Code boîte d'archive"
                        className="w-32 px-2.5 py-0.5 bg-slate-900 dark:bg-slate-950 text-white font-mono text-xs font-semibold rounded border border-slate-700 focus:outline-none focus:border-teal-500"
                      />
                      <span className="font-mono text-sm font-semibold text-teal-800 dark:text-teal-400">
                        {dossier.reference}
                      </span>
                      <span className="text-sm font-semibold text-slate-900 dark:text-white">
                        {client?.name}
                      </span>
                      <StatusBadge
                        status={isComplete ? 'green' : 'orange'}
                        label={
                          isComplete
                            ? 'Dossier complet (5/5 pièces)'
                            : `Pièces partielles (${docCount}/5)`
                        }
                        compact
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-400">
                      <span className="font-mono">B/L {dossier.blNumber}</span>
                      <span>
                        {dossier.shippingLine} · {dossier.vesselName}
                      </span>
                      <span className="font-mono text-slate-500 dark:text-slate-400">
                        Archivé le {dossier.archivedAt}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {dosContainers.map((c) => (
                        <span
                          key={c.id}
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded font-mono text-xs text-slate-800 dark:text-slate-200"
                        >
                          <ContainerIcon className="w-3 h-3 text-slate-500 dark:text-slate-400" />
                          <span>{c.number}</span>
                          <span className="text-slate-400">({c.type})</span>
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0 no-print">
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedArchiveId(expanded ? null : dossier.id)
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[38px] text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                    >
                      <FolderCheck className="w-3.5 h-3.5 text-teal-700 dark:text-teal-400" />
                      <span>
                        {expanded ? 'Masquer pièces' : 'Vérifier pièces (5)'}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onToggleArchiveDossier(dossier.id, false)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[38px] text-xs font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <ArchiveRestore className="w-3.5 h-3.5" />
                      <span>Restaurer</span>
                    </button>
                  </div>
                </div>

                {/* Expandable Physical/Digital Document Checklist */}
                {expanded && (
                  <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-200 dark:border-slate-800 space-y-3">
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Contrôle des pièces justificatives archivées (cliquez pour valider la présence) :
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {ALL_DOC_KEYS.map((docKey) => {
                        const checked = dossier.attachedDocs.includes(docKey);
                        return (
                          <button
                            key={docKey}
                            type="button"
                            onClick={() =>
                              onToggleArchiveDoc(dossier.id, docKey)
                            }
                            className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-left text-xs font-medium transition-colors cursor-pointer ${
                              checked
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                          >
                            {checked ? (
                              <CheckSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-400 shrink-0" />
                            )}
                            <span>{ARCHIVE_DOC_LABELS[docKey]}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
