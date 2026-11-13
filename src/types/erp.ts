import { Container, Dossier } from './transit';

export type ErpAppId =
  | 'launcher'
  | 'dashboard'
  | 'transit'
  | 'quotes'
  | 'invoicing'
  | 'archive'
  | 'clients';

export type CurrencyCode = 'XOF' | 'EUR' | 'USD';

export type QuoteStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'INVOICED';

export type InvoiceStatus = 'DRAFT' | 'POSTED' | 'PARTIAL' | 'PAID';

export type ArchiveDocKey =
  | 'BL_ORIGINAL'
  | 'DECLARATION_DOUANE'
  | 'BAD_COMPAGNIE'
  | 'FACTURE_ACQUITTEE'
  | 'BON_RESTITUTION_VIDE';

export interface TransitDossier extends Dossier {
  archived: boolean;
  archivedAt?: string;
  archiveBoxRef?: string;
  archiveNotes?: string;
  attachedDocs: ArchiveDocKey[];
}

export interface TransitClient {
  id: string;
  name: string;
  ninea: string;
  contactName: string;
  email: string;
  phone: string;
  city: string;
}

export interface TransitServiceItem {
  id: string;
  code: string;
  category: 'DOUANE' | 'MANUTENTION' | 'TRANSPORT' | 'COMMISSION' | 'SURESTARIE' | 'FRET';
  label: string;
  unit: string;
  defaultPriceXof: number;
  taxable: boolean;
}

export interface TransitDocLine {
  id: string;
  serviceId?: string;
  label: string;
  quantity: number;
  unitPriceXof: number;
  taxable: boolean;
}

export interface TransitQuote {
  id: string;
  number: string;
  clientId: string;
  dossierId: string;
  containerRefs: string[]; // Références des conteneurs rattachés
  date: string;
  validityDate: string;
  currency: CurrencyCode;
  status: QuoteStatus;
  tvaRate: number;
  lines: TransitDocLine[];
  notes?: string;
}

export interface InvoicePayment {
  id: string;
  date: string;
  amountXof: number;
  method: 'VIREMENT' | 'CHEQUE' | 'ESPECES' | 'MOBILE_MONEY';
  reference: string;
}

export interface TransitInvoice {
  id: string;
  number: string;
  docType: 'DEFINITIVE' | 'PROFORMA' | 'NOTE_DEBIT';
  clientId: string;
  dossierId: string;
  quoteId?: string;
  containerRefs: string[];
  currency: CurrencyCode;
  issueDate: string;
  dueDate: string;
  status: InvoiceStatus;
  tvaRate: number;
  lines: TransitDocLine[];
  payments: InvoicePayment[];
  notes?: string;
}

export interface ChatterLog {
  id: string;
  timestamp: string;
  author: string;
  module: string;
  recordRef: string;
  message: string;
  kind: 'SYSTEM' | 'NOTE';
}

export type { Container };
