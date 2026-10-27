/**
 * Saves invoices in this browser's localStorage.
 *
 * NOTE: this is NOT a cloud backup. Data lives only in this browser on this
 * device, and is lost if the browser's site data is cleared. Keep the
 * downloaded PDFs as your permanent records.
 */
import { FIRST_INVOICE_NUMBER } from '../config/company';
import { normalizeInvoiceNumber, padInvoiceNumber, type Invoice } from './invoice';

const STORE_KEY = 'yantrika-billing:v1';
const DRAFT_KEY = 'yantrika-billing:draft:v1';

export interface StoreData {
  invoices: Invoice[];
  /** Next number to suggest for a new invoice. */
  nextNumber: number;
}

const emptyStore = (): StoreData => ({ invoices: [], nextNumber: FIRST_INVOICE_NUMBER });

export function isStorageAvailable(): boolean {
  try {
    const probe = `${STORE_KEY}:probe`;
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

export function loadStore(): StoreData {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return emptyStore();
    const data = JSON.parse(raw) as Partial<StoreData>;
    return {
      invoices: Array.isArray(data.invoices) ? data.invoices : [],
      nextNumber: Number.isSafeInteger(data.nextNumber) ? (data.nextNumber as number) : FIRST_INVOICE_NUMBER,
    };
  } catch {
    return emptyStore();
  }
}

/** Throws if the browser refuses to store the data (e.g. storage full or disabled). */
function writeStore(data: StoreData): void {
  localStorage.setItem(STORE_KEY, JSON.stringify(data));
}

/** Suggests the next free sequential number, skipping any number already saved. */
export function suggestInvoiceNumber(store: StoreData): string {
  const used = new Set(store.invoices.map((inv) => normalizeInvoiceNumber(inv.invoiceNumber)));
  let n = Math.max(store.nextNumber, FIRST_INVOICE_NUMBER);
  while (used.has(String(n))) n++;
  return padInvoiceNumber(n);
}

/** Adds a new invoice or replaces the saved invoice with the same id. Returns the updated store. */
export function saveInvoice(store: StoreData, invoice: Invoice): StoreData {
  const exists = store.invoices.some((inv) => inv.id === invoice.id);
  const invoices = exists
    ? store.invoices.map((inv) => (inv.id === invoice.id ? invoice : inv))
    : [...store.invoices, invoice];
  let nextNumber = store.nextNumber;
  const numeric = invoice.invoiceNumber.trim();
  if (/^\d+$/.test(numeric)) nextNumber = Math.max(nextNumber, Number(numeric) + 1);
  const updated = { invoices, nextNumber };
  writeStore(updated);
  return updated;
}

export function deleteInvoice(store: StoreData, id: string): StoreData {
  const updated = { ...store, invoices: store.invoices.filter((inv) => inv.id !== id) };
  writeStore(updated);
  return updated;
}

/** The invoice currently being edited, so a page refresh doesn't lose typing. */
export function loadDraft(): Invoice | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Invoice) : null;
  } catch {
    return null;
  }
}

export function saveDraft(invoice: Invoice): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(invoice));
  } catch {
    // Draft autosave is a convenience only.
  }
}
