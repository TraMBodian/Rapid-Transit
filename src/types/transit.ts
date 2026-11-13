export type UserRole = 'AGENT' | 'COMPTABLE' | 'ADMIN';

export type ModuleKey =
  | 'dashboard'
  | 'dossiers'
  | 'facturation'
  | 'clients'
  | 'rapports';

export type ContainerType =
  | "20' Dry"
  | "40' High Cube"
  | "40' Reefer"
  | "20' Open Top";

export type LifecycleStep =
  | 'EN_MER'
  | 'ARRIVE_PORT'
  | 'DEDOUANE'
  | 'SORTIE_PARC'
  | 'LIVRE_CLIENT'
  | 'VIDE_RESTITUE';

export type TrafficStatus = 'green' | 'orange' | 'red';

export type CurrencyCode = 'XOF' | 'EUR' | 'USD';

export type InvoiceDocType = 'PROFORMA' | 'DEFINITIVE' | 'NOTE_DEBIT';

export type InvoiceStatus = 'PAYEE' | 'PARTIELLE' | 'IMPAYEE' | 'ECHUE';

export type PaymentMethod = 'VIREMENT' | 'CHEQUE' | 'ESPECES' | 'MOBILE_MONEY';

export interface Client {
  id: string;
  name: string;
  ninea: string;
  contactName: string;
  email: string;
  phone: string;
  city: string;
  creditLimitXof: number;
}

export interface Container {
  id: string;
  dossierId: string;
  number: string; // ISO 6346 e.g. MSCU 492817-4
  type: ContainerType;
  tareKg: number;
  sealNumber: string;
  step: LifecycleStep;
  arrivalDate: string; // YYYY-MM-DD (ETA or ATA)
  freeDays: number; // Franchise accordée en jours
  dailyDemurrageXof: number; // Coût journalier au-delà de la franchise
  emptyReturnDate?: string; // YYYY-MM-DD if returned
  yardLocation?: string;
}

export interface Dossier {
  id: string;
  reference: string; // e.g. DOS-2026-0412
  blNumber: string; // Bill of Lading e.g. MSCUDKR882910
  shippingLine: string; // Armateur e.g. MSC, Maersk, CMA CGM
  vesselName: string; // Navire
  clientId: string;
  cargoDescription: string;
  createdAt: string;
  portOfDischarge: string;
}

export interface TariffItem {
  id: string;
  code: string;
  category:
    | 'DOUANE'
    | 'MANUTENTION'
    | 'TRANSPORT'
    | 'COMMISSION'
    | 'SURESTARIE';
  label: string;
  unit: string;
  defaultPriceXof: number;
  taxable: boolean;
}

export interface InvoiceLine {
  id: string;
  tariffId?: string;
  category: TariffItem['category'];
  label: string;
  quantity: number;
  unitPrice: number; // In invoice currency
  taxable: boolean;
}

export interface PaymentRecord {
  id: string;
  invoiceId: string;
  date: string;
  amount: number; // In invoice currency
  method: PaymentMethod;
  reference: string;
  recordedBy: string;
}

export interface Invoice {
  id: string;
  number: string; // e.g. FAC-2026-0188
  docType: InvoiceDocType;
  dossierId: string;
  clientId: string;
  currency: CurrencyCode;
  exchangeRateToXof: number;
  issueDate: string;
  dueDate: string;
  tvaRate: number; // 0.18 or 0
  lines: InvoiceLine[];
  payments: PaymentRecord[];
  notes?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actorName: string;
  actorRole: UserRole;
  ipAddress: string;
  action: string;
  entityType: 'DOSSIER' | 'CONTENEUR' | 'FACTURE' | 'REGLEMENT' | 'TARIF' | 'SECURITE';
  entityRef: string;
  details: string;
}

export interface ExchangeRates {
  XOF: number;
  EUR: number;
  USD: number;
}
