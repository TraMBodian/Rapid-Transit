import { EXCHANGE_RATES } from '../data/transitErpData';
import { CurrencyCode, TransitDocLine, TransitInvoice } from '../types/erp';

export function formatErpMoney(
  amountXof: number,
  currency: CurrencyCode = 'XOF'
): string {
  const rate = EXCHANGE_RATES[currency] || 1;
  const converted = currency === 'XOF' ? amountXof : amountXof / rate;

  if (currency === 'XOF') {
    return `${Math.round(converted).toLocaleString('fr-FR')} XOF`;
  }
  if (currency === 'EUR') {
    return `${converted.toLocaleString('fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} €`;
  }
  return `$${converted.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function computeTransitLinesTotals(
  lines: TransitDocLine[],
  tvaRate = 0.18
) {
  const subtotal = lines.reduce(
    (sum, line) => sum + line.quantity * line.unitPriceXof,
    0
  );
  const taxableSubtotal = lines
    .filter((l) => l.taxable)
    .reduce((sum, line) => sum + line.quantity * line.unitPriceXof, 0);
  const tva = taxableSubtotal * tvaRate;
  const totalTtc = subtotal + tva;
  return { subtotal, tva, totalTtc };
}

export function computeTransitInvoiceBalance(invoice: TransitInvoice) {
  const { subtotal, tva, totalTtc } = computeTransitLinesTotals(
    invoice.lines,
    invoice.tvaRate
  );
  const paid = invoice.payments.reduce((sum, p) => sum + p.amountXof, 0);
  const balance = Math.max(0, totalTtc - paid);
  return { subtotal, tva, totalTtc, paid, balance };
}

export function exportErpCsv(
  filename: string,
  headers: string[],
  rows: (string | number)[][]
) {
  const escape = (v: string | number) => {
    const s = String(v ?? '');
    return s.includes(';') || s.includes('"')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const csv =
    '\uFEFF' +
    [headers.map(escape).join(';'), ...rows.map((r) => r.map(escape).join(';'))].join(
      '\n'
    );
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
