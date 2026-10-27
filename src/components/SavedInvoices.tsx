import { calculateTotals, formatDate, normalizeInvoiceNumber, type Invoice } from '../lib/invoice';
import { formatINR } from '../lib/money';

interface Props {
  invoices: Invoice[];
  busyId: string | null;
  onOpen: (invoice: Invoice) => void;
  onDownload: (invoice: Invoice) => void;
  onDelete: (invoice: Invoice) => void;
}

/** Newest invoice numbers first; non-numeric numbers sort after, alphabetically. */
function compareNumbers(a: Invoice, b: Invoice): number {
  const na = normalizeInvoiceNumber(a.invoiceNumber);
  const nb = normalizeInvoiceNumber(b.invoiceNumber);
  const ia = /^\d+$/.test(na);
  const ib = /^\d+$/.test(nb);
  if (ia && ib) return Number(nb) - Number(na);
  if (ia !== ib) return ia ? -1 : 1;
  return nb.localeCompare(na);
}

export function SavedInvoices({ invoices, busyId, onOpen, onDownload, onDelete }: Props) {
  const sorted = [...invoices].sort(compareNumbers);

  return (
    <div className="saved">
      <div className="notice">
        <strong>Stored in this browser only.</strong> Saved invoices live in this browser's local storage on this
        device. They are not backed up to the cloud, will not appear on another computer or browser, and are lost if
        the browser's site data is cleared. Keep the downloaded PDFs as your permanent records.
      </div>

      {sorted.length === 0 ? (
        <p className="empty">No saved invoices yet. Create one in the “Create Invoice” tab and click Save.</p>
      ) : (
        <div className="table-scroll">
          <table className="saved-table">
            <thead>
              <tr>
                <th>Invoice no.</th>
                <th>Customer</th>
                <th>Date</th>
                <th className="num">Total amount</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {sorted.map((inv) => (
                <tr key={inv.id}>
                  <td>{inv.invoiceNumber}</td>
                  <td>{inv.customer.name}</td>
                  <td>{formatDate(inv.invoiceDate)}</td>
                  <td className="num">{formatINR(calculateTotals(inv).total)}</td>
                  <td className="row-actions">
                    <button type="button" className="secondary small" onClick={() => onOpen(inv)}>
                      Open
                    </button>
                    <button
                      type="button"
                      className="primary small"
                      onClick={() => onDownload(inv)}
                      disabled={busyId === inv.id}
                    >
                      {busyId === inv.id ? 'Preparing…' : 'Download PDF'}
                    </button>
                    <button type="button" className="link danger small" onClick={() => onDelete(inv)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
