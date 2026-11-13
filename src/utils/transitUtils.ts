import {
  Container,
  CurrencyCode,
  ExchangeRates,
  Invoice,
  InvoiceStatus,
  LifecycleStep,
  TrafficStatus,
} from '../types/transit';

export const REFERENCE_TODAY = new Date('2026-11-13T12:00:00Z');

export const LIFECYCLE_STEPS: { key: LifecycleStep; label: string; shortLabel: string }[] = [
  { key: 'EN_MER', label: 'En mer', shortLabel: 'En mer' },
  { key: 'ARRIVE_PORT', label: 'Arrivé au port', shortLabel: 'Au port' },
  { key: 'DEDOUANE', label: 'Dédouané', shortLabel: 'Dédouané' },
  { key: 'SORTIE_PARC', label: 'Sortie parc', shortLabel: 'Sortie parc' },
  { key: 'LIVRE_CLIENT', label: 'Livré au client', shortLabel: 'Livré' },
  { key: 'VIDE_RESTITUE', label: 'Vide restitué', shortLabel: 'Restitué' },
];

export const SHIPPING_LINES = [
  { name: 'MSC', defaultFreeDays: 10, dailyRate20Xof: 28000, dailyRate40Xof: 45000 },
  { name: 'Maersk', defaultFreeDays: 12, dailyRate20Xof: 30000, dailyRate40Xof: 48000 },
  { name: 'CMA CGM', defaultFreeDays: 10, dailyRate20Xof: 27500, dailyRate40Xof: 44000 },
  { name: 'Hapag-Lloyd', defaultFreeDays: 14, dailyRate20Xof: 26000, dailyRate40Xof: 42000 },
  { name: 'COSCO Shipping', defaultFreeDays: 10, dailyRate20Xof: 25000, dailyRate40Xof: 40000 },
];

/**
 * Formats raw input into ISO 6346 container pattern: ABCD 123456-7
 */
export function formatContainerNumberMask(raw: string): string {
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const letters = cleaned.slice(0, 4).replace(/[^A-Z]/g, '');
  const digits = cleaned.slice(letters.length).replace(/[^0-9]/g, '').slice(0, 7);

  if (letters.length < 4) {
    return letters;
  }
  if (digits.length === 0) {
    return letters;
  }
  if (digits.length <= 6) {
    return `${letters} ${digits}`;
  }
  return `${letters} ${digits.slice(0, 6)}-${digits.slice(6, 7)}`;
}

export function isValidContainerNumber(num: string): boolean {
  return /^[A-Z]{4}\s\d{6}-\d$/.test(num.trim());
}

export interface DemurrageEvaluation {
  status: TrafficStatus;
  statusLabel: string;
  daysElapsed: number;
  daysRemaining: number;
  overdueDays: number;
  accruedFeeXof: number;
  detailText: string;
}

export function calculateContainerDemurrage(
  container: Container,
  referenceDate: Date = REFERENCE_TODAY
): DemurrageEvaluation {
  if (container.step === 'EN_MER') {
    const arrival = new Date(container.arrivalDate + 'T00:00:00Z');
    const diffDays = Math.ceil((arrival.getTime() - referenceDate.getTime()) / 86400000);
    return {
      status: 'green',
      statusLabel: 'Conforme · En transit',
      daysElapsed: 0,
      daysRemaining: container.freeDays,
      overdueDays: 0,
      accruedFeeXof: 0,
      detailText: diffDays > 0 ? `Arrivée prévue dans ${diffDays} j` : 'Arrivée imminente',
    };
  }

  const arrival = new Date(container.arrivalDate + 'T00:00:00Z');
  const endDate =
    container.step === 'VIDE_RESTITUE' && container.emptyReturnDate
      ? new Date(container.emptyReturnDate + 'T00:00:00Z')
      : referenceDate;

  const daysElapsed = Math.max(
    0,
    Math.floor((endDate.getTime() - arrival.getTime()) / 86400000)
  );
  const daysRemaining = container.freeDays - daysElapsed;
  const overdueDays = Math.max(0, daysElapsed - container.freeDays);
  const accruedFeeXof = overdueDays * container.dailyDemurrageXof;

  if (container.step === 'VIDE_RESTITUE') {
    if (overdueDays > 0) {
      return {
        status: 'orange',
        statusLabel: 'Clôturé avec retard',
        daysElapsed,
        daysRemaining: 0,
        overdueDays,
        accruedFeeXof,
        detailText: `Restitué après ${overdueDays} j de surestarie`,
      };
    }
    return {
      status: 'green',
      statusLabel: 'Conforme · Restitué',
      daysElapsed,
      daysRemaining: Math.max(0, daysRemaining),
      overdueDays: 0,
      accruedFeeXof: 0,
      detailText: `Restitué en ${daysElapsed} j (dans franchise)`,
    };
  }

  if (overdueDays > 0) {
    return {
      status: 'red',
      statusLabel: `Surestarie · +${overdueDays} j`,
      daysElapsed,
      daysRemaining: 0,
      overdueDays,
      accruedFeeXof,
      detailText: `${overdueDays} j hors franchise (${formatMoney(accruedFeeXof, 'XOF')})`,
    };
  }

  if (daysRemaining <= 2) {
    return {
      status: 'orange',
      statusLabel: `Franchise critique · ${daysRemaining} j`,
      daysElapsed,
      daysRemaining,
      overdueDays: 0,
      accruedFeeXof: 0,
      detailText:
        daysRemaining === 0
          ? 'Dernier jour de franchise aujourd’hui'
          : `Expire dans ${daysRemaining} jour${daysRemaining > 1 ? 's' : ''}`,
    };
  }

  return {
    status: 'green',
    statusLabel: `Franchise OK · ${daysRemaining} j`,
    daysElapsed,
    daysRemaining,
    overdueDays: 0,
    accruedFeeXof: 0,
    detailText: `${daysRemaining} j restants sur ${container.freeDays} j`,
  };
}

export function formatMoney(amount: number, currency: CurrencyCode): string {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  if (currency === 'XOF') {
    return `${Math.round(safeAmount).toLocaleString('fr-FR')} XOF`;
  }
  if (currency === 'EUR') {
    return `${safeAmount.toLocaleString('fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} €`;
  }
  return `$${safeAmount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function convertFromXof(
  amountXof: number,
  targetCurrency: CurrencyCode,
  rates: ExchangeRates
): number {
  if (targetCurrency === 'XOF') return Math.round(amountXof);
  const rate = rates[targetCurrency] || 1;
  return Number((amountXof / rate).toFixed(2));
}

export function computeInvoiceTotals(invoice: Invoice) {
  const subtotal = invoice.lines.reduce(
    (sum, line) => sum + line.quantity * line.unitPrice,
    0
  );
  const taxableSubtotal = invoice.lines
    .filter((l) => l.taxable)
    .reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
  const tvaAmount = taxableSubtotal * invoice.tvaRate;
  const totalTTC = subtotal + tvaAmount;
  const paidAmount = invoice.payments.reduce((sum, p) => sum + p.amount, 0);
  const balanceDue = Math.max(0, totalTTC - paidAmount);
  const totalTtcXof = totalTTC * invoice.exchangeRateToXof;
  const balanceDueXof = balanceDue * invoice.exchangeRateToXof;

  return {
    subtotal,
    tvaAmount,
    totalTTC,
    paidAmount,
    balanceDue,
    totalTtcXof,
    balanceDueXof,
  };
}

export function evaluateInvoiceStatus(
  invoice: Invoice,
  referenceDate: Date = REFERENCE_TODAY
): { status: InvoiceStatus; traffic: TrafficStatus; label: string } {
  const { totalTTC, paidAmount, balanceDue } = computeInvoiceTotals(invoice);

  if (totalTTC > 0 && balanceDue <= 0.01) {
    return { status: 'PAYEE', traffic: 'green', label: 'Payée' };
  }

  const due = new Date(invoice.dueDate + 'T00:00:00Z');
  const isOverdue = referenceDate.getTime() > due.getTime();

  if (paidAmount > 0 && balanceDue > 0.01) {
    return {
      status: 'PARTIELLE',
      traffic: isOverdue ? 'red' : 'orange',
      label: isOverdue ? 'Partielle · Échue' : 'Acompte versé',
    };
  }

  if (isOverdue) {
    return { status: 'ECHUE', traffic: 'red', label: 'Impayée · Échue' };
  }

  return { status: 'IMPAYEE', traffic: 'orange', label: 'En attente' };
}

export function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const escapeCell = (val: string | number) => {
    const str = String(val ?? '');
    if (str.includes(';') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const csvContent =
    '\uFEFF' +
    [headers.map(escapeCell).join(';'), ...rows.map((r) => r.map(escapeCell).join(';'))].join(
      '\n'
    );
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
