import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Container as ContainerIcon,
  Layers,
  Plus,
  X,
  Zap,
} from 'lucide-react';
import {
  Client,
  Container,
  ContainerType,
  Dossier,
  LifecycleStep,
} from '../types/transit';
import {
  calculateContainerDemurrage,
  formatContainerNumberMask,
  isValidContainerNumber,
  LIFECYCLE_STEPS,
  SHIPPING_LINES,
} from '../utils/transitUtils';
import { StatusBadge } from './StatusBadge';

interface QuickContainerModalProps {
  isOpen: boolean;
  onClose: () => void;
  dossiers: Dossier[];
  clients: Client[];
  preselectedDossierId?: string;
  onCreateContainer: (
    containerData: Omit<Container, 'id'>,
    newDossierData?: Omit<Dossier, 'id' | 'reference' | 'createdAt'>
  ) => string;
}

const CONTAINER_TYPES: ContainerType[] = [
  "20' Dry",
  "40' High Cube",
  "40' Reefer",
  "20' Open Top",
];

export const QuickContainerModal: React.FC<QuickContainerModalProps> = ({
  isOpen,
  onClose,
  dossiers,
  clients,
  preselectedDossierId,
  onCreateContainer,
}) => {
  const [mode, setMode] = useState<'EXISTING' | 'NEW_DOSSIER'>('EXISTING');
  const [entryType, setEntryType] = useState<'SINGLE' | 'BATCH'>('SINGLE');
  const [selectedDossierId, setSelectedDossierId] = useState(
    preselectedDossierId || dossiers[0]?.id || ''
  );

  // New dossier fields
  const [blNumber, setBlNumber] = useState('');
  const [shippingLine, setShippingLine] = useState(SHIPPING_LINES[0].name);
  const [vesselName, setVesselName] = useState('');
  const [clientId, setClientId] = useState(clients[0]?.id || '');
  const [cargoDescription, setCargoDescription] = useState('');

  // Container fields
  const [containerNumber, setContainerNumber] = useState('');
  const [batchRaw, setBatchRaw] = useState('');
  const [containerType, setContainerType] =
    useState<ContainerType>("40' High Cube");
  const [tareKg, setTareKg] = useState('3850');
  const [sealNumber, setSealNumber] = useState('');
  const [step, setStep] = useState<LifecycleStep>('ARRIVE_PORT');
  const [arrivalDate, setArrivalDate] = useState('2026-11-11');
  const [freeDays, setFreeDays] = useState('10');
  const [yardLocation, setYardLocation] = useState('Parc DPW · Allée C-08');
  const [savedToast, setSavedToast] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const containerInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (preselectedDossierId) {
        setMode('EXISTING');
        setSelectedDossierId(preselectedDossierId);
      } else if (!selectedDossierId && dossiers[0]) {
        setSelectedDossierId(dossiers[0].id);
      }
      setSavedToast(null);
      setErrorMsg('');
    }
  }, [isOpen, preselectedDossierId, dossiers, selectedDossierId]);

  const activeShippingLine = useMemo(() => {
    if (mode === 'NEW_DOSSIER') {
      return (
        SHIPPING_LINES.find((s) => s.name === shippingLine) ||
        SHIPPING_LINES[0]
      );
    }
    const existing = dossiers.find((d) => d.id === selectedDossierId);
    return (
      SHIPPING_LINES.find((s) => s.name === existing?.shippingLine) ||
      SHIPPING_LINES[0]
    );
  }, [mode, shippingLine, dossiers, selectedDossierId]);

  const dailyRateXof = useMemo(() => {
    return containerType.startsWith("20'")
      ? activeShippingLine.dailyRate20Xof
      : activeShippingLine.dailyRate40Xof;
  }, [containerType, activeShippingLine]);

  const parsedBatchRefs = useMemo(() => {
    if (!batchRaw.trim()) return [];
    const tokens = batchRaw
      .split(/[\n,;]+/)
      .map((t) => formatContainerNumberMask(t.trim()))
      .filter(Boolean);
    return Array.from(new Set(tokens));
  }, [batchRaw]);

  const validBatchRefs = useMemo(
    () => parsedBatchRefs.filter((r) => isValidContainerNumber(r)),
    [parsedBatchRefs]
  );

  const livePreview = useMemo(() => {
    const mockContainer: Container = {
      id: 'preview',
      dossierId: 'preview',
      number: containerNumber || 'MSCU 000000-0',
      type: containerType,
      tareKg: Number(tareKg) || 3800,
      sealNumber: sealNumber || 'PL-0000',
      step,
      arrivalDate: arrivalDate || '2026-11-13',
      freeDays: Math.max(0, Number(freeDays) || 0),
      dailyDemurrageXof: dailyRateXof,
    };
    return calculateContainerDemurrage(mockContainer);
  }, [
    containerNumber,
    containerType,
    tareKg,
    sealNumber,
    step,
    arrivalDate,
    freeDays,
    dailyRateXof,
  ]);

  if (!isOpen) return null;

  const isIsoValid = isValidContainerNumber(containerNumber);

  const handleTypeSelect = (t: ContainerType) => {
    setContainerType(t);
    if (t === "20' Dry") setTareKg('2250');
    else if (t === "20' Open Top") setTareKg('2380');
    else if (t === "40' Reefer") setTareKg('4600');
    else setTareKg('3850');
  };

  const handleSave = (addAnother: boolean) => {
    setErrorMsg('');

    if (mode === 'NEW_DOSSIER') {
      if (!blNumber.trim() || !vesselName.trim()) {
        setErrorMsg(
          'Veuillez renseigner le n° de Connaissement (B/L) et le nom du navire.'
        );
        return;
      }
    }

    const newDossierPayload =
      mode === 'NEW_DOSSIER'
        ? {
            blNumber: blNumber.trim().toUpperCase(),
            shippingLine,
            vesselName: vesselName.trim().toUpperCase(),
            clientId: clientId || clients[0]?.id || '',
            cargoDescription:
              cargoDescription.trim() ||
              'Marchandises générales conteneurisées',
            portOfDischarge: 'Port Autonome de Dakar (Terminal DP World)',
          }
        : undefined;

    if (entryType === 'BATCH') {
      if (validBatchRefs.length === 0) {
        setErrorMsg(
          'Saisissez au moins une référence conteneur ISO valide (ex: MSCU 492817-4).'
        );
        return;
      }

      let targetDossierId = mode === 'EXISTING' ? selectedDossierId : '';
      validBatchRefs.forEach((refNum, idx) => {
        const returnedId = onCreateContainer(
          {
            dossierId: targetDossierId,
            number: refNum,
            type: containerType,
            tareKg: Number(tareKg) || 3850,
            sealNumber: `PL-${Date.now().toString().slice(-4)}-${idx + 1}`,
            step,
            arrivalDate,
            freeDays: Math.max(0, Number(freeDays) || 10),
            dailyDemurrageXof: dailyRateXof,
            yardLocation: yardLocation.trim() || 'Parc Portuaire',
          },
          idx === 0 ? newDossierPayload : undefined
        );
        targetDossierId = returnedId;
      });

      setBatchRaw('');
      onClose();
      return;
    }

    if (!isIsoValid) {
      setErrorMsg(
        'Le numéro de conteneur doit respecter le masque ISO 6346 (ex: MSCU 492817-4).'
      );
      containerInputRef.current?.focus();
      return;
    }

    const usedDossierId = onCreateContainer(
      {
        dossierId: mode === 'EXISTING' ? selectedDossierId : '',
        number: containerNumber.trim(),
        type: containerType,
        tareKg: Number(tareKg) || 3850,
        sealNumber:
          sealNumber.trim() || `PL-${Date.now().toString().slice(-5)}`,
        step,
        arrivalDate,
        freeDays: Math.max(0, Number(freeDays) || 10),
        dailyDemurrageXof: dailyRateXof,
        yardLocation: yardLocation.trim() || 'Parc Portuaire',
      },
      newDossierPayload
    );

    if (addAnother) {
      setSavedToast(`Conteneur ${containerNumber} enregistré.`);
      setMode('EXISTING');
      setSelectedDossierId(usedDossierId);
      setContainerNumber('');
      setSealNumber('');
      setTimeout(() => containerInputRef.current?.focus(), 50);
    } else {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/65 backdrop-blur-xs overflow-y-auto no-print">
      <div
        className="w-full max-w-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden my-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-container-title"
      >
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 dark:bg-slate-950 text-white flex items-center justify-between gap-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <Zap className="w-4 h-4 text-teal-400" aria-hidden="true" />
            <h2 id="quick-container-title" className="text-base font-semibold">
              Saisie rapide des références conteneurs
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {savedToast && (
            <div className="px-4 py-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>
                {savedToast} Saisissez la référence suivante pour le même dossier.
              </span>
            </div>
          )}

          {/* Step A: Dossier Selection or Inline Creation */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                01. Rattachement au dossier B/L
              </span>
              <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setMode('EXISTING')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                    mode === 'EXISTING'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Dossier existant
                </button>
                <button
                  type="button"
                  onClick={() => setMode('NEW_DOSSIER')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                    mode === 'NEW_DOSSIER'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  + Nouveau dossier B/L
                </button>
              </div>
            </div>

            {mode === 'EXISTING' ? (
              <select
                value={selectedDossierId}
                onChange={(e) => {
                  setSelectedDossierId(e.target.value);
                  const d = dossiers.find((x) => x.id === e.target.value);
                  const line = SHIPPING_LINES.find(
                    (s) => s.name === d?.shippingLine
                  );
                  if (line) setFreeDays(String(line.defaultFreeDays));
                }}
                className="w-full h-11 px-3.5 text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:border-teal-600"
              >
                {dossiers.map((d) => {
                  const cl = clients.find((c) => c.id === d.clientId);
                  return (
                    <option key={d.id} value={d.id}>
                      {d.reference} · B/L {d.blNumber} · {d.shippingLine} (
                      {cl?.name})
                    </option>
                  );
                })}
              </select>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    N° Connaissement (B/L) *
                  </label>
                  <input
                    type="text"
                    value={blNumber}
                    onChange={(e) => setBlNumber(e.target.value.toUpperCase())}
                    placeholder="ex: MSCUDKR901422"
                    className="w-full h-10 px-3 font-mono text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:border-teal-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Client importateur / expéditeur
                  </label>
                  <select
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    className="w-full h-10 px-3 text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:border-teal-600"
                  >
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Armateur (auto-franchise)
                  </label>
                  <select
                    value={shippingLine}
                    onChange={(e) => {
                      setShippingLine(e.target.value);
                      const found = SHIPPING_LINES.find(
                        (s) => s.name === e.target.value
                      );
                      if (found) setFreeDays(String(found.defaultFreeDays));
                    }}
                    className="w-full h-10 px-3 text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:border-teal-600"
                  >
                    {SHIPPING_LINES.map((s) => (
                      <option key={s.name} value={s.name}>
                        {s.name} ({s.defaultFreeDays} j franchise std)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Nom du navire *
                  </label>
                  <input
                    type="text"
                    value={vesselName}
                    onChange={(e) => setVesselName(e.target.value.toUpperCase())}
                    placeholder="ex: MSC EMMA"
                    className="w-full h-10 px-3 text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:border-teal-600"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Nature de la marchandise
                  </label>
                  <input
                    type="text"
                    value={cargoDescription}
                    onChange={(e) => setCargoDescription(e.target.value)}
                    placeholder="ex: Pièces détachées industrielles, produits alimentaires..."
                    className="w-full h-10 px-3 text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:border-teal-600"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Step B: Container Specifications (Single vs Batch) */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                02. Identification & Références conteneurs
              </span>
              <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setEntryType('SINGLE')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                    entryType === 'SINGLE'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Unitaire
                </button>
                <button
                  type="button"
                  onClick={() => setEntryType('BATCH')}
                  className={`inline-flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                    entryType === 'BATCH'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <Layers className="w-3 h-3" />
                  <span>Import en lot</span>
                </button>
              </div>
            </div>

            {entryType === 'SINGLE' ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Numéro de conteneur (Masque ISO 6346) *
                  </label>
                  <div className="relative">
                    <input
                      ref={containerInputRef}
                      type="text"
                      value={containerNumber}
                      onChange={(e) =>
                        setContainerNumber(
                          formatContainerNumberMask(e.target.value)
                        )
                      }
                      placeholder="MSCU 492817-4"
                      maxLength={13}
                      className={`w-full h-11 px-3.5 font-mono text-base font-medium bg-white dark:bg-slate-950 text-slate-900 dark:text-white border rounded-lg focus:outline-none focus:ring-2 ${
                        isIsoValid
                          ? 'border-emerald-500 focus:ring-emerald-500/20'
                          : 'border-slate-300 dark:border-slate-700 focus:ring-teal-600/20 focus:border-teal-600'
                      }`}
                    />
                    {isIsoValid && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" />
                        ISO valide
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    N° de plomb (Scellé)
                  </label>
                  <input
                    type="text"
                    value={sealNumber}
                    onChange={(e) => setSealNumber(e.target.value.toUpperCase())}
                    placeholder="PL-MSC-88412"
                    className="w-full h-11 px-3.5 font-mono text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:border-teal-600"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Collez plusieurs références conteneurs (séparées par virgule ou retour à la ligne)
                </label>
                <textarea
                  rows={3}
                  value={batchRaw}
                  onChange={(e) => setBatchRaw(e.target.value)}
                  placeholder="MSCU 492817-4&#10;MSCU 492818-0, MSKU 710294-2"
                  className="w-full p-3 font-mono text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:border-teal-600"
                />
                {parsedBatchRefs.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-slate-500 dark:text-slate-400">
                      Détectés : {validBatchRefs.length} valide(s) /{' '}
                      {parsedBatchRefs.length}
                    </span>
                    {parsedBatchRefs.map((ref) => {
                      const ok = isValidContainerNumber(ref);
                      return (
                        <span
                          key={ref}
                          className={`px-2 py-0.5 rounded font-mono text-xs border ${
                            ok
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                              : 'bg-red-50 dark:bg-red-950/60 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
                          }`}
                        >
                          {ref}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Container Type Selector */}
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Type de conteneur
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {CONTAINER_TYPES.map((t) => {
                  const active = containerType === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => handleTypeSelect(t)}
                      className={`min-h-[42px] px-3 py-2 rounded-lg border text-xs font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                        active
                          ? 'bg-teal-700 text-white border-teal-700 dark:bg-teal-600 dark:border-teal-600'
                          : 'bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <ContainerIcon className="w-3.5 h-3.5 shrink-0" />
                      <span>{t}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Tare (kg)
                </label>
                <input
                  type="number"
                  value={tareKg}
                  onChange={(e) => setTareKg(e.target.value)}
                  className="w-full h-11 px-3.5 font-mono text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:border-teal-600 tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Étape du cycle de vie
                </label>
                <select
                  value={step}
                  onChange={(e) => setStep(e.target.value as LifecycleStep)}
                  className="w-full h-11 px-3 text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:border-teal-600"
                >
                  {LIFECYCLE_STEPS.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Localisation parc / zone
                </label>
                <input
                  type="text"
                  value={yardLocation}
                  onChange={(e) => setYardLocation(e.target.value)}
                  className="w-full h-11 px-3.5 text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:border-teal-600"
                />
              </div>
            </div>
          </div>

          {/* Step C: Dates, Franchise & Instant Color Status Preview */}
          <div className="space-y-3">
            <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400">
              03. Calcul automatique de franchise & alerte surestaries
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Date arrivée port (ETA/ATA)
                </label>
                <input
                  type="date"
                  value={arrivalDate}
                  onChange={(e) => setArrivalDate(e.target.value)}
                  className="w-full h-11 px-3 font-mono text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:border-teal-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Franchise accordée (jours)
                </label>
                <input
                  type="number"
                  min={0}
                  max={60}
                  value={freeDays}
                  onChange={(e) => setFreeDays(e.target.value)}
                  className="w-full h-11 px-3 font-mono text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg focus:outline-none focus:border-teal-600 tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Tarif surestarie / jour
                </label>
                <div className="h-11 px-3 flex items-center bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg font-mono text-sm text-slate-700 dark:text-slate-300 tabular-nums">
                  {dailyRateXof.toLocaleString('fr-FR')} XOF / j
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Évaluation immédiate à la date du jour
                </p>
                <p className="text-sm font-medium text-slate-900 dark:text-white mt-0.5">
                  {livePreview.detailText}
                </p>
              </div>
              <StatusBadge
                status={livePreview.status}
                label={livePreview.statusLabel}
              />
            </div>
          </div>

          {errorMsg && (
            <p className="text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 rounded-lg px-4 py-2.5">
              {errorMsg}
            </p>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 min-h-[40px] text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            Fermer
          </button>

          <div className="flex flex-wrap items-center gap-3">
            {entryType === 'SINGLE' && (
              <button
                type="button"
                onClick={() => handleSave(true)}
                className="inline-flex items-center gap-2 px-4 py-2 min-h-[40px] text-sm font-medium text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 rounded-lg hover:bg-teal-100 dark:hover:bg-teal-900/60 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Enregistrer + Suivant</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => handleSave(false)}
              className="inline-flex items-center gap-2 px-5 py-2 min-h-[40px] text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 rounded-lg cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {entryType === 'BATCH'
                  ? `Importer ${validBatchRefs.length} conteneur(s)`
                  : 'Enregistrer le conteneur'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
