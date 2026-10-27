import { useEffect, useMemo, useState } from 'react';
import { COMPANY } from './config/company';
import { InvoiceForm } from './components/InvoiceForm';
import { InvoicePreview } from './components/InvoicePreview';
import { PdfPreviewModal } from './components/PdfPreviewModal';
import { SavedInvoices } from './components/SavedInvoices';
import {
  blankInvoice,
  calculateTotals,
  normalizeInvoiceNumber,
  pdfFileName,
  validateInvoice,
  type Invoice,
} from './lib/invoice';
import {
  deleteInvoice,
  isStorageAvailable,
  loadDraft,
  loadStore,
  saveDraft,
  saveInvoice,
  suggestInvoiceNumber,
  type StoreData,
} from './lib/storage';

/** The PDF library is large, so it is only loaded when a PDF is first needed. */
const loadPdf = () => import('./pdf');

type Tab = 'create' | 'saved';
type Status = { kind: 'success' | 'error'; text: string } | null;

function hasContent(invoice: Invoice): boolean {
  return (
    !!invoice.customer.name.trim() ||
    !!invoice.customer.address.trim() ||
    invoice.items.some((i) => i.description.trim() || i.quantity.trim() || i.rate.trim())
  );
}

/** Compares the parts of an invoice the user can edit. */
function sameContent(a: Invoice, b: Invoice): boolean {
  const pick = (i: Invoice) => [i.invoiceNumber, i.invoiceDate, i.customer, i.items, i.taxMode, i.gstRate];
  return JSON.stringify(pick(a)) === JSON.stringify(pick(b));
}

export default function App() {
  const [store, setStore] = useState<StoreData>(() => loadStore());
  const [invoice, setInvoice] = useState<Invoice>(() => loadDraft() ?? blankInvoice(suggestInvoiceNumber(loadStore())));
  const [tab, setTab] = useState<Tab>('create');
  const [showErrors, setShowErrors] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [storageOk] = useState(isStorageAvailable);

  useEffect(() => saveDraft(invoice), [invoice]);

  const totals = useMemo(() => calculateTotals(invoice), [invoice]);
  const savedVersion = store.invoices.find((inv) => inv.id === invoice.id);
  const otherNumbers = store.invoices.filter((inv) => inv.id !== invoice.id).map((inv) => inv.invoiceNumber);
  const validation = validateInvoice(invoice, otherNumbers);
  const duplicateNumber = otherNumbers.some(
    (n) => normalizeInvoiceNumber(n) === normalizeInvoiceNumber(invoice.invoiceNumber),
  );
  const unsaved = savedVersion ? !sameContent(savedVersion, invoice) : hasContent(invoice);

  const updateInvoice = (next: Invoice) => {
    setInvoice(next);
    setStatus(null);
  };

  /** Returns true if the invoice is valid; otherwise shows the problems. */
  const checkValid = (): boolean => {
    if (validation.messages.length === 0) return true;
    setShowErrors(true);
    setStatus({ kind: 'error', text: 'Please fix the highlighted fields.' });
    return false;
  };

  /** Saves the current invoice. Returns the saved copy, or null if it could not be saved. */
  const save = (): Invoice | null => {
    if (!checkValid()) return null;
    const toSave: Invoice = {
      ...invoice,
      invoiceNumber: invoice.invoiceNumber.trim(),
      company: savedVersion?.company ?? invoice.company ?? COMPANY,
      savedAt: new Date().toISOString(),
    };
    try {
      setStore(saveInvoice(store, toSave));
    } catch {
      setStatus({ kind: 'error', text: 'Could not save: this browser is blocking or out of local storage.' });
      return null;
    }
    setInvoice(toSave);
    setShowErrors(false);
    return toSave;
  };

  const handleSave = () => {
    const saved = save();
    if (saved) setStatus({ kind: 'success', text: `Invoice ${saved.invoiceNumber} saved.` });
  };

  const handleDownload = async () => {
    const saved = save();
    if (!saved) return;
    setBusy('download');
    try {
      await (await loadPdf()).downloadInvoicePdf(saved);
      setStatus({ kind: 'success', text: `Invoice ${saved.invoiceNumber} saved and downloaded as ${pdfFileName(saved)}.` });
    } catch (err) {
      console.error(err);
      setStatus({ kind: 'error', text: 'The PDF could not be created. Please try again.' });
    } finally {
      setBusy(null);
    }
  };

  const handlePreview = async () => {
    if (!checkValid()) return;
    setBusy('preview');
    try {
      setPdfUrl(await (await loadPdf()).invoicePdfUrl(invoice));
    } catch (err) {
      console.error(err);
      setStatus({ kind: 'error', text: 'The PDF preview could not be created. Please try again.' });
    } finally {
      setBusy(null);
    }
  };

  const closePreview = () => {
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    setPdfUrl(null);
  };

  const confirmDiscard = () =>
    !unsaved || window.confirm('The current invoice has unsaved changes. Discard them?');

  const handleNew = () => {
    if (!confirmDiscard()) return;
    setInvoice(blankInvoice(suggestInvoiceNumber(store)));
    setShowErrors(false);
    setStatus(null);
  };

  const handleOpen = (saved: Invoice) => {
    if (saved.id !== invoice.id && !confirmDiscard()) return;
    setInvoice(structuredClone(saved));
    setShowErrors(false);
    setStatus({ kind: 'success', text: `Opened invoice ${saved.invoiceNumber}.` });
    setTab('create');
  };

  const handleDownloadSaved = async (saved: Invoice) => {
    setBusy(saved.id);
    try {
      await (await loadPdf()).downloadInvoicePdf(saved);
    } catch (err) {
      console.error(err);
      window.alert('The PDF could not be created. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = (saved: Invoice) => {
    if (!window.confirm(`Delete invoice ${saved.invoiceNumber} for ${saved.customer.name}? This cannot be undone.`)) return;
    try {
      setStore(deleteInvoice(store, saved.id));
    } catch {
      window.alert('Could not update local storage.');
    }
  };

  const heading = savedVersion ? `Editing saved invoice ${savedVersion.invoiceNumber}` : 'New invoice';

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <span>{COMPANY.name} · Billing</span>
        </div>
        <nav className="tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'create'} onClick={() => setTab('create')}>
            Create Invoice
          </button>
          <button role="tab" aria-selected={tab === 'saved'} onClick={() => setTab('saved')}>
            Saved Invoices <span className="count">{store.invoices.length}</span>
          </button>
        </nav>
      </header>

      {!storageOk && (
        <div className="banner error-banner">
          This browser is blocking local storage, so invoices cannot be saved here. PDFs can still be downloaded.
        </div>
      )}

      {tab === 'create' ? (
        <main className="create">
          <div className="form-col">
            <div className="form-title">
              <h1>{heading}</h1>
              {unsaved && <span className="badge">Unsaved changes</span>}
              <button type="button" className="secondary small" onClick={handleNew}>
                New Invoice
              </button>
            </div>

            <InvoiceForm
              invoice={invoice}
              totals={totals}
              errors={showErrors ? validation.errors : {}}
              duplicateNumber={duplicateNumber}
              onChange={updateInvoice}
            />

            <div className="actions card">
              {showErrors && validation.messages.length > 0 && (
                <ul className="error-list">
                  {validation.messages.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              )}
              {status && <p className={`status ${status.kind}`}>{status.text}</p>}
              <div className="buttons">
                <button type="button" className="secondary" onClick={handlePreview} disabled={!!busy}>
                  {busy === 'preview' ? 'Preparing…' : 'Preview Invoice'}
                </button>
                <button type="button" className="secondary" onClick={handleSave} disabled={!!busy}>
                  Save Invoice
                </button>
                <button type="button" className="primary" onClick={handleDownload} disabled={!!busy}>
                  {busy === 'download' ? 'Preparing PDF…' : 'Download PDF'}
                </button>
              </div>
              <p className="hint">Download PDF also saves the invoice, so its number is not reused.</p>
            </div>
          </div>

          <div className="preview-col">
            <div className="preview-label">Live preview</div>
            <InvoicePreview invoice={invoice} />
          </div>
        </main>
      ) : (
        <main className="saved-page">
          <h1>Saved invoices</h1>
          <SavedInvoices
            invoices={store.invoices}
            busyId={busy}
            onOpen={handleOpen}
            onDownload={handleDownloadSaved}
            onDelete={handleDelete}
          />
        </main>
      )}

      {pdfUrl && (
        <PdfPreviewModal
          url={pdfUrl}
          fileName={pdfFileName(invoice)}
          onClose={closePreview}
          onDownload={() => {
            closePreview();
            void handleDownload();
          }}
        />
      )}
    </div>
  );
}
