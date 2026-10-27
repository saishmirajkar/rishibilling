import {
  COMPANY,
  DEFAULT_GST_RATE,
  DEFAULT_TAX_MODE,
  INVOICE_NUMBER_DIGITS,
  type CompanyDetails,
} from '../config/company';
import {
  GST_RATE_DECIMALS,
  QTY_DECIMALS,
  RATE_DECIMALS,
  lineAmountPaise,
  parseScaled,
  taxPaise,
} from './money';

export type TaxMode = 'CGST_SGST' | 'IGST';

/** Form values are kept as the strings the user typed, so partial input is never lost. */
export interface InvoiceItem {
  id: string;
  /** First line is the item name; extra lines (e.g. "DC NO- 049") print beneath it. */
  description: string;
  hsn: string;
  quantity: string;
  rate: string;
}

export interface Customer {
  name: string;
  address: string;
  gstin: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  /** ISO date, YYYY-MM-DD */
  invoiceDate: string;
  customer: Customer;
  items: InvoiceItem[];
  taxMode: TaxMode;
  /** Total GST percent, e.g. "18" */
  gstRate: string;
  /** Seller details captured when the invoice was first saved. */
  company?: CompanyDetails;
  savedAt?: string;
}

export interface TaxLine {
  label: string;
  /** thousandths of a percent */
  rate: number;
  amount: number;
}

export interface LineResult {
  item: InvoiceItem;
  quantity: number; // thousandths
  rate: number; // paise
  amount: number; // paise
}

export interface InvoiceTotals {
  lines: LineResult[];
  subtotal: number;
  taxes: TaxLine[];
  totalGst: number;
  total: number;
}

export function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function todayIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "2026-10-04" → "04-10-2026" */
export function formatDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : iso;
}

export function padInvoiceNumber(n: number): string {
  return String(n).padStart(INVOICE_NUMBER_DIGITS, '0');
}

/** "002" and "2" are the same invoice number; anything else compares case-insensitively. */
export function normalizeInvoiceNumber(value: string): string {
  const v = value.trim().toUpperCase();
  return /^\d+$/.test(v) ? String(Number(v)) : v;
}

export function blankItem(): InvoiceItem {
  return { id: newId(), description: '', hsn: '', quantity: '', rate: '' };
}

export function blankInvoice(invoiceNumber: string): Invoice {
  return {
    id: newId(),
    invoiceNumber,
    invoiceDate: todayIso(),
    customer: { name: '', address: '', gstin: '' },
    items: [blankItem()],
    taxMode: DEFAULT_TAX_MODE,
    gstRate: DEFAULT_GST_RATE,
  };
}

/** Company details to print: the saved snapshot, or the current settings for new invoices. */
export function companyFor(invoice: Invoice): CompanyDetails {
  return invoice.company ?? COMPANY;
}

/** Splits the total GST rate into the tax lines printed on the invoice. */
export function taxRates(taxMode: TaxMode, gstRateText: string): { label: string; rate: number }[] {
  const parsed = parseScaled(gstRateText, GST_RATE_DECIMALS);
  // hundredths of a percent → thousandths of a percent
  const total = parsed.ok ? parsed.value * 10 : 0;
  if (taxMode === 'IGST') return [{ label: 'IGST', rate: total }];
  return [
    { label: 'CGST', rate: total / 2 },
    { label: 'SGST', rate: total / 2 },
  ];
}

/**
 * Calculates every amount on the invoice. Invalid numbers count as 0 here;
 * validateInvoice() reports them to the user.
 *
 *   item subtotal = quantity × rate
 *   subtotal      = Σ item subtotals
 *   each tax      = subtotal × tax rate   (rounded to the paisa)
 *   total GST     = Σ taxes
 *   total amount  = subtotal + total GST
 */
export function calculateTotals(invoice: Invoice): InvoiceTotals {
  const lines = invoice.items.map((item) => {
    const q = parseScaled(item.quantity, QTY_DECIMALS);
    const r = parseScaled(item.rate, RATE_DECIMALS);
    const quantity = q.ok ? q.value : 0;
    const rate = r.ok ? r.value : 0;
    return { item, quantity, rate, amount: lineAmountPaise(quantity, rate) };
  });
  const subtotal = lines.reduce((sum, l) => sum + l.amount, 0);
  const taxes = taxRates(invoice.taxMode, invoice.gstRate).map((t) => ({
    ...t,
    amount: taxPaise(subtotal, t.rate),
  }));
  const totalGst = taxes.reduce((sum, t) => sum + t.amount, 0);
  return { lines, subtotal, taxes, totalGst, total: subtotal + totalGst };
}

export interface ValidationResult {
  /** Field errors keyed like "customer.name", "invoiceNumber", "items.<id>.quantity" */
  errors: Record<string, string>;
  /** Short, human-readable list for display above the action buttons. */
  messages: string[];
}

export function validateInvoice(invoice: Invoice, otherInvoiceNumbers: string[]): ValidationResult {
  const errors: Record<string, string> = {};
  const messages: string[] = [];
  const add = (key: string, error: string, message: string) => {
    errors[key] = error;
    messages.push(message);
  };

  const number = invoice.invoiceNumber.trim();
  if (!number) {
    add('invoiceNumber', 'Required', 'Invoice number is required.');
  } else if (otherInvoiceNumbers.some((n) => normalizeInvoiceNumber(n) === normalizeInvoiceNumber(number))) {
    add('invoiceNumber', 'Already used by a saved invoice', `Invoice number ${number} is already used by a saved invoice.`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(invoice.invoiceDate)) {
    add('invoiceDate', 'Required', 'Invoice date is required.');
  }
  if (!invoice.customer.name.trim()) {
    add('customer.name', 'Required', 'Customer name is required.');
  }

  if (invoice.items.length === 0) {
    messages.push('Add at least one item.');
  }
  invoice.items.forEach((item, index) => {
    const label = `Item ${index + 1}`;
    if (!item.description.trim()) {
      add(`items.${item.id}.description`, 'Required', `${label}: description is required.`);
    }
    const q = parseScaled(item.quantity, QTY_DECIMALS);
    if (!q.ok) add(`items.${item.id}.quantity`, q.error, `${label}: quantity — ${q.error.toLowerCase()}.`);
    else if (q.value === 0) add(`items.${item.id}.quantity`, 'Must be greater than 0', `${label}: quantity must be greater than 0.`);
    const r = parseScaled(item.rate, RATE_DECIMALS);
    if (!r.ok) add(`items.${item.id}.rate`, r.error, `${label}: rate — ${r.error.toLowerCase()}.`);
  });

  const g = parseScaled(invoice.gstRate, GST_RATE_DECIMALS);
  if (!g.ok) add('gstRate', g.error, `GST rate — ${g.error.toLowerCase()}.`);
  else if (g.value > 100_00) add('gstRate', 'Must be 100 or less', 'GST rate must be 100% or less.');

  return { errors, messages };
}

/** Safe file name, e.g. Yantrika_Invoice_002.pdf */
export function pdfFileName(invoice: Invoice): string {
  const number = invoice.invoiceNumber.trim().replace(/[^A-Za-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
  return `Yantrika_Invoice_${number || 'draft'}.pdf`;
}
