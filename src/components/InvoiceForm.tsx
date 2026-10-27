import type { ReactNode } from 'react';
import { blankItem, taxRates, type Invoice, type InvoiceItem, type InvoiceTotals, type TaxMode } from '../lib/invoice';
import { formatINR, formatPercent } from '../lib/money';

interface Props {
  invoice: Invoice;
  totals: InvoiceTotals;
  /** Errors to show next to fields (only after the user tries to save). */
  errors: Record<string, string>;
  /** Shown immediately while typing, even before saving. */
  duplicateNumber: boolean;
  onChange: (invoice: Invoice) => void;
}

export function InvoiceForm({ invoice, totals, errors, duplicateNumber, onChange }: Props) {
  const set = (patch: Partial<Invoice>) => onChange({ ...invoice, ...patch });
  const setCustomer = (patch: Partial<Invoice['customer']>) => set({ customer: { ...invoice.customer, ...patch } });
  const setItem = (id: string, patch: Partial<InvoiceItem>) =>
    set({ items: invoice.items.map((item) => (item.id === id ? { ...item, ...patch } : item)) });
  const removeItem = (id: string) => set({ items: invoice.items.filter((item) => item.id !== id) });
  const addItem = () => set({ items: [...invoice.items, blankItem()] });

  const numberError = errors.invoiceNumber ?? (duplicateNumber ? 'Already used by a saved invoice' : undefined);
  const rates = taxRates(invoice.taxMode, invoice.gstRate);

  return (
    <div className="form">
      <section className="card">
        <h2>Invoice details</h2>
        <div className="grid-2">
          <Field label="Invoice number" error={numberError}>
            <input
              value={invoice.invoiceNumber}
              onChange={(e) => set({ invoiceNumber: e.target.value })}
              aria-invalid={!!numberError}
            />
          </Field>
          <Field label="Invoice date" error={errors.invoiceDate}>
            <input type="date" value={invoice.invoiceDate} onChange={(e) => set({ invoiceDate: e.target.value })} />
          </Field>
        </div>
      </section>

      <section className="card">
        <h2>Bill to</h2>
        <Field label="Customer / company name *" error={errors['customer.name']}>
          <input
            value={invoice.customer.name}
            onChange={(e) => setCustomer({ name: e.target.value })}
            aria-invalid={!!errors['customer.name']}
          />
        </Field>
        <Field label="Address">
          <textarea rows={3} value={invoice.customer.address} onChange={(e) => setCustomer({ address: e.target.value })} />
        </Field>
        <Field label="GSTIN / UIN">
          <input
            value={invoice.customer.gstin}
            onChange={(e) => setCustomer({ gstin: e.target.value.toUpperCase() })}
            maxLength={20}
          />
        </Field>
      </section>

      <section className="card">
        <h2>Items</h2>
        <ol className="items-editor">
          {invoice.items.map((item, index) => {
            const line = totals.lines.find((l) => l.item.id === item.id);
            const err = (field: string) => errors[`items.${item.id}.${field}`];
            return (
              <li key={item.id} className="item-row">
                <div className="item-row-head">
                  <span className="item-no">Item {index + 1}</span>
                  <button
                    type="button"
                    className="link danger"
                    onClick={() => removeItem(item.id)}
                    disabled={invoice.items.length === 1}
                    title={invoice.items.length === 1 ? 'An invoice needs at least one item' : 'Remove this item'}
                  >
                    Remove
                  </button>
                </div>
                <Field label="Description" error={err('description')} hint="Extra lines (e.g. DC numbers) print under the item name.">
                  <textarea
                    rows={2}
                    value={item.description}
                    onChange={(e) => setItem(item.id, { description: e.target.value })}
                    aria-invalid={!!err('description')}
                  />
                </Field>
                <div className="grid-4">
                  <Field label="HSN code">
                    <input value={item.hsn} onChange={(e) => setItem(item.id, { hsn: e.target.value })} />
                  </Field>
                  <Field label="Quantity" error={err('quantity')}>
                    <input
                      inputMode="decimal"
                      value={item.quantity}
                      onChange={(e) => setItem(item.id, { quantity: e.target.value })}
                      aria-invalid={!!err('quantity')}
                    />
                  </Field>
                  <Field label="Rate (₹)" error={err('rate')}>
                    <input
                      inputMode="decimal"
                      value={item.rate}
                      onChange={(e) => setItem(item.id, { rate: e.target.value })}
                      aria-invalid={!!err('rate')}
                    />
                  </Field>
                  <Field label="Subtotal">
                    <output className="amount">{formatINR(line?.amount ?? 0)}</output>
                  </Field>
                </div>
              </li>
            );
          })}
        </ol>
        <button type="button" className="secondary" onClick={addItem}>
          + Add item
        </button>
      </section>

      <section className="card">
        <h2>GST</h2>
        <div className="grid-2">
          <Field label="Tax type">
            <select value={invoice.taxMode} onChange={(e) => set({ taxMode: e.target.value as TaxMode })}>
              <option value="CGST_SGST">CGST + SGST (within state)</option>
              <option value="IGST">IGST (inter-state)</option>
            </select>
          </Field>
          <Field
            label="GST rate (%)"
            error={errors.gstRate}
            hint={rates.map((r) => `${r.label} ${formatPercent(r.rate)}%`).join(' + ')}
          >
            <input
              inputMode="decimal"
              value={invoice.gstRate}
              onChange={(e) => set({ gstRate: e.target.value })}
              aria-invalid={!!errors.gstRate}
            />
          </Field>
        </div>

        <dl className="totals">
          <dt>Subtotal</dt>
          <dd>{formatINR(totals.subtotal)}</dd>
          {totals.taxes.map((t) => (
            <div key={t.label} className="contents">
              <dt>
                {t.label} {formatPercent(t.rate)}%
              </dt>
              <dd>{formatINR(t.amount)}</dd>
            </div>
          ))}
          <dt>Total GST</dt>
          <dd>{formatINR(totals.totalGst)}</dd>
          <dt className="grand">Total amount</dt>
          <dd className="grand">{formatINR(totals.total)}</dd>
        </dl>
      </section>
    </div>
  );
}

function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <label className={`field${error ? ' has-error' : ''}`}>
      <span className="field-label">{label}</span>
      {children}
      {error ? <span className="error">{error}</span> : hint ? <span className="hint">{hint}</span> : null}
    </label>
  );
}
