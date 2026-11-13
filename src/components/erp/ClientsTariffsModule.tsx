import React, { useMemo, useState } from 'react';
import { Building2, Mail, MapPin, Phone, Plus, Search, X } from 'lucide-react';
import {
  CurrencyCode,
  TransitClient,
  TransitDossier,
  TransitServiceItem,
} from '../../types/erp';
import { formatErpMoney } from '../../utils/erpUtils';

interface ClientsTariffsModuleProps {
  clients: TransitClient[];
  dossiers: TransitDossier[];
  services: TransitServiceItem[];
  currency: CurrencyCode;
  onAddClient: (client: Omit<TransitClient, 'id'>) => void;
  onAddService: (service: Omit<TransitServiceItem, 'id'>) => void;
  onUpdateServicePrice: (serviceId: string, priceXof: number) => void;
}

export const ClientsTariffsModule: React.FC<ClientsTariffsModuleProps> = ({
  clients,
  dossiers,
  services,
  currency,
  onAddClient,
  onAddService,
  onUpdateServicePrice,
}) => {
  const [tab, setTab] = useState<'CLIENTS' | 'TARIFFS'>('CLIENTS');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddClient, setShowAddClient] = useState(false);
  const [showAddService, setShowAddService] = useState(false);

  // Client form
  const [name, setName] = useState('');
  const [ninea, setNinea] = useState('');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('Dakar');

  // Service form
  const [srvCode, setSrvCode] = useState('');
  const [srvCat, setSrvCat] =
    useState<TransitServiceItem['category']>('DOUANE');
  const [srvLabel, setSrvLabel] = useState('');
  const [srvUnit, setSrvUnit] = useState('Dossier');
  const [srvPrice, setSrvPrice] = useState('150000');
  const [srvTaxable, setSrvTaxable] = useState(true);

  const filteredClients = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.ninea.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q)
    );
  }, [clients, searchQuery]);

  const filteredServices = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return services;
    return services.filter(
      (s) =>
        s.code.toLowerCase().includes(q) ||
        s.label.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q)
    );
  }, [services, searchQuery]);

  const handleSubmitClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onAddClient({
      name: name.trim(),
      ninea: ninea.trim() || `00${Date.now().toString().slice(-7)} 2G1`,
      contactName: contactName.trim() || 'Service Import',
      email: email.trim() || 'import@client.sn',
      phone: phone.trim() || '+221 33 800 00 00',
      city: city.trim() || 'Dakar',
    });
    setName('');
    setNinea('');
    setContactName('');
    setEmail('');
    setPhone('');
    setShowAddClient(false);
  };

  const handleSubmitService = (e: React.FormEvent) => {
    e.preventDefault();
    if (!srvCode.trim() || !srvLabel.trim()) return;
    onAddService({
      code: srvCode.trim().toUpperCase(),
      category: srvCat,
      label: srvLabel.trim(),
      unit: srvUnit.trim() || 'Forfait',
      defaultPriceXof: Math.max(0, Number(srvPrice) || 0),
      taxable: srvTaxable,
    });
    setSrvCode('');
    setSrvLabel('');
    setSrvPrice('150000');
    setShowAddService(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
            Clients & Grille Tarifaire Transit
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Gérez vos importateurs/expéditeurs et personnalisez les tarifs de vos prestations transit.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
            <button
              type="button"
              onClick={() => setTab('CLIENTS')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer transition-colors ${
                tab === 'CLIENTS'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Clients ({clients.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('TARIFFS')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md cursor-pointer transition-colors ${
                tab === 'TARIFFS'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Tarifs prestations ({services.length})
            </button>
          </div>

          {tab === 'CLIENTS' ? (
            <button
              type="button"
              onClick={() => setShowAddClient(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 rounded-lg cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nouveau client</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowAddService(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-500 rounded-lg cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nouvelle prestation</span>
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={
            tab === 'CLIENTS'
              ? 'Filtrer par raison sociale, NINEA, ville...'
              : 'Filtrer par code prestation ou libellé...'
          }
          className="w-full h-10 pl-10 pr-4 text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-teal-600"
        />
      </div>

      {tab === 'CLIENTS' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredClients.map((cl) => {
            const count = dossiers.filter((d) => d.clientId === cl.id).length;
            return (
              <div
                key={cl.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0">
                      <Building2 className="w-5 h-5 text-slate-700 dark:text-slate-300" />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                        {cl.name}
                      </h2>
                      <p className="font-mono text-xs text-slate-500 dark:text-slate-400">
                        NINEA : {cl.ninea}
                      </p>
                    </div>
                  </div>
                  <span className="font-mono text-xs font-medium text-teal-800 dark:text-teal-400 tabular-nums">
                    {count} dossier(s)
                  </span>
                </div>
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-slate-600 dark:text-slate-400">
                  <span className="inline-flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span className="truncate">{cl.email}</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 font-mono">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{cl.phone}</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 sm:col-span-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      {cl.city} · Contact : {cl.contactName}
                    </span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400">
                <th className="py-3 px-5">Code</th>
                <th className="py-3 px-4">Catégorie</th>
                <th className="py-3 px-4">Libellé prestation</th>
                <th className="py-3 px-4">Unité</th>
                <th className="py-3 px-4 text-right">Tarif base (XOF)</th>
                <th className="py-3 px-5 text-right">Équiv. {currency}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {filteredServices.map((s) => (
                <tr
                  key={s.id}
                  className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                >
                  <td className="py-3 px-5 font-mono text-xs font-semibold text-teal-800 dark:text-teal-400">
                    {s.code}
                  </td>
                  <td className="py-3 px-4 text-xs font-medium text-slate-600 dark:text-slate-400">
                    {s.category}
                  </td>
                  <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">
                    {s.label}
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-500 dark:text-slate-400">
                    {s.unit}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <input
                      type="number"
                      step="1000"
                      value={s.defaultPriceXof}
                      onChange={(e) =>
                        onUpdateServicePrice(
                          s.id,
                          Math.max(0, Number(e.target.value))
                        )
                      }
                      className="w-32 h-9 px-2.5 font-mono text-right bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-md tabular-nums"
                    />
                  </td>
                  <td className="py-3 px-5 text-right font-mono text-xs text-slate-600 dark:text-slate-300 tabular-nums">
                    {formatErpMoney(s.defaultPriceXof, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Client Modal */}
      {showAddClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Nouveau client transitaire
              </h3>
              <button
                type="button"
                onClick={() => setShowAddClient(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmitClient} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Raison sociale *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-10 px-3 text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    NINEA
                  </label>
                  <input
                    type="text"
                    value={ninea}
                    onChange={(e) => setNinea(e.target.value)}
                    className="w-full h-10 px-3 font-mono text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Contact
                  </label>
                  <input
                    type="text"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    className="w-full h-10 px-3 text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-10 px-3 text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Téléphone
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full h-10 px-3 font-mono text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Ville / Zone
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full h-10 px-3 text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddClient(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-semibold text-white bg-teal-700 rounded-lg hover:bg-teal-800 cursor-pointer"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Service Modal */}
      {showAddService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Nouvelle prestation tarifée
              </h3>
              <button
                type="button"
                onClick={() => setShowAddService(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSubmitService} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Code *
                  </label>
                  <input
                    type="text"
                    required
                    value={srvCode}
                    onChange={(e) => setSrvCode(e.target.value.toUpperCase())}
                    placeholder="ex: ESC-01"
                    className="w-full h-10 px-3 font-mono text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Catégorie
                  </label>
                  <select
                    value={srvCat}
                    onChange={(e) =>
                      setSrvCat(
                        e.target.value as TransitServiceItem['category']
                      )
                    }
                    className="w-full h-10 px-3 text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg"
                  >
                    <option value="DOUANE">DOUANE</option>
                    <option value="MANUTENTION">MANUTENTION</option>
                    <option value="TRANSPORT">TRANSPORT</option>
                    <option value="COMMISSION">COMMISSION</option>
                    <option value="SURESTARIE">SURESTARIE</option>
                    <option value="FRET">FRET</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Libellé prestation *
                </label>
                <input
                  type="text"
                  required
                  value={srvLabel}
                  onChange={(e) => setSrvLabel(e.target.value)}
                  placeholder="ex: Escorte douanière / Visite physique"
                  className="w-full h-10 px-3 text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Unité
                  </label>
                  <input
                    type="text"
                    value={srvUnit}
                    onChange={(e) => setSrvUnit(e.target.value)}
                    className="w-full h-10 px-3 text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Prix base (XOF)
                  </label>
                  <input
                    type="number"
                    step="1000"
                    value={srvPrice}
                    onChange={(e) => setSrvPrice(e.target.value)}
                    className="w-full h-10 px-3 font-mono text-sm bg-white dark:bg-slate-950 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 rounded-lg tabular-nums"
                  />
                </div>
              </div>
              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={srvTaxable}
                  onChange={(e) => setSrvTaxable(e.target.checked)}
                />
                <span>Soumis à la TVA (18%)</span>
              </label>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddService(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-semibold text-white bg-teal-700 rounded-lg hover:bg-teal-800 cursor-pointer"
                >
                  Ajouter tarif
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
