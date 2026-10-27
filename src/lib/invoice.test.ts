import { describe, expect, it } from 'vitest';
import { blankInvoice, calculateTotals, pdfFileName, validateInvoice, type Invoice } from './invoice';
import { formatINR, formatQuantity, groupIndian, lineAmountPaise, parseScaled, taxPaise } from './money';
import { suggestInvoiceNumber, type StoreData } from './storage';

function invoiceWith(items: [string, string][], patch: Partial<Invoice> = {}): Invoice {
  const inv = blankInvoice('002');
  inv.customer.name = 'HYDROMATIK';
  inv.items = items.map(([quantity, rate], i) => ({ id: `i${i}`, description: `Item ${i}`, hsn: '9985', quantity, rate }));
  return { ...inv, ...patch };
}

describe('money helpers', () => {
  it('parses decimals into scaled integers', () => {
    expect(parseScaled('10', 2)).toEqual({ ok: true, value: 1000 });
    expect(parseScaled('1,56,300.5', 2)).toEqual({ ok: true, value: 15630050 });
    expect(parseScaled('.5', 3)).toEqual({ ok: true, value: 500 });
    expect(parseScaled('-1', 2).ok).toBe(false);
    expect(parseScaled('abc', 2).ok).toBe(false);
    expect(parseScaled('1.234', 2).ok).toBe(false);
    expect(parseScaled('', 2).ok).toBe(false);
  });

  it('formats in the Indian numbering system', () => {
    expect(groupIndian('156300')).toBe('1,56,300');
    expect(groupIndian('123456789')).toBe('12,34,56,789');
    expect(groupIndian('999')).toBe('999');
    expect(formatINR(15630000)).toBe('₹1,56,300.00');
    expect(formatINR(5)).toBe('₹0.05');
    expect(formatQuantity(15630000)).toBe('15,630');
    expect(formatQuantity(2500)).toBe('2.5');
  });

  it('multiplies without floating-point drift and rounds half up', () => {
    // 3 × ₹0.10 is exactly ₹0.30 (0.1 * 3 in floating point is 0.30000000000000004)
    expect(lineAmountPaise(3000, 10)).toBe(30);
    // 2.5 × ₹1,499.99 = ₹3,749.975 → ₹3,749.98
    expect(lineAmountPaise(2500, 149999)).toBe(374998);
    // 9% of ₹0.50 = ₹0.045 → ₹0.05
    expect(taxPaise(50, 9000)).toBe(5);
    // very large values stay exact
    expect(lineAmountPaise(1_000_000_000, 10_000_000)).toBe(10_000_000_000_000);
  });
});

describe('calculateTotals', () => {
  it('matches the reference invoice (15,630 × ₹10 at 18% CGST + SGST)', () => {
    // Manual calculation:
    //   subtotal  = 15,630 × 10            = 1,56,300.00
    //   CGST 9%   = 1,56,300 × 0.09        =   14,067.00
    //   SGST 9%   = 1,56,300 × 0.09        =   14,067.00
    //   total GST = 14,067 + 14,067        =   28,134.00
    //   total     = 1,56,300 + 28,134      = 1,84,434.00
    const t = calculateTotals(invoiceWith([['15630', '10']]));
    expect(t.subtotal).toBe(15630000);
    expect(t.taxes).toEqual([
      { label: 'CGST', rate: 9000, amount: 1406700 },
      { label: 'SGST', rate: 9000, amount: 1406700 },
    ]);
    expect(t.totalGst).toBe(2813400);
    expect(t.total).toBe(18443400);
  });

  it('handles several items and IGST', () => {
    // 15,630 × 10       = 1,56,300.00
    // 2.5 × 1,499.99    =     3,749.98 (3,749.975 rounded)
    // 120 × 45.50       =     5,460.00
    // subtotal          = 1,65,509.98
    // IGST 18%          =    29,791.80 (29,791.7964 rounded)
    // total             = 1,95,301.78
    const t = calculateTotals(
      invoiceWith([['15630', '10'], ['2.5', '1499.99'], ['120', '45.5']], { taxMode: 'IGST' }),
    );
    expect(t.lines.map((l) => l.amount)).toEqual([15630000, 374998, 546000]);
    expect(t.subtotal).toBe(16550998);
    expect(t.taxes).toEqual([{ label: 'IGST', rate: 18000, amount: 2979180 }]);
    expect(t.total).toBe(19530178);
  });

  it('splits other GST rates equally, e.g. 5% → 2.5% + 2.5%', () => {
    // 3 × 333.33 = 999.99; 2.5% = 24.99975 → 25.00 each; total 1,049.99
    const t = calculateTotals(invoiceWith([['3', '333.33']], { gstRate: '5' }));
    expect(t.taxes.map((x) => [x.rate, x.amount])).toEqual([[2500, 2500], [2500, 2500]]);
    expect(t.total).toBe(99999 + 5000);
    // Displayed values always add up: subtotal + total GST = total
    expect(t.subtotal + t.totalGst).toBe(t.total);
  });
});

describe('validateInvoice', () => {
  it('accepts a complete invoice', () => {
    expect(validateInvoice(invoiceWith([['1', '0']]), []).messages).toEqual([]);
  });

  it('requires customer name, positive quantity and valid rate', () => {
    const inv = invoiceWith([['0', '-5']]);
    inv.customer.name = ' ';
    const { errors } = validateInvoice(inv, []);
    expect(errors['customer.name']).toBeDefined();
    expect(errors['items.i0.quantity']).toMatch(/greater than 0/);
    expect(errors['items.i0.rate']).toBeDefined();
  });

  it('rejects an invoice number already used ("2" equals "002")', () => {
    expect(validateInvoice(invoiceWith([['1', '1']]), ['2']).errors.invoiceNumber).toMatch(/already used/i);
    expect(validateInvoice(invoiceWith([['1', '1']]), ['003']).errors.invoiceNumber).toBeUndefined();
  });
});

describe('invoice numbering', () => {
  const store = (numbers: string[], nextNumber: number): StoreData => ({
    invoices: numbers.map((n) => ({ ...blankInvoice(n), id: n })),
    nextNumber,
  });

  it('starts at 001 and skips numbers that are already used', () => {
    expect(suggestInvoiceNumber(store([], 1))).toBe('001');
    expect(suggestInvoiceNumber(store(['001'], 2))).toBe('002');
    expect(suggestInvoiceNumber(store(['002', '3'], 2))).toBe('004');
  });

  it('builds a safe PDF file name', () => {
    expect(pdfFileName(blankInvoice('002'))).toBe('Yantrika_Invoice_002.pdf');
    expect(pdfFileName(blankInvoice('YH/2026-27/15'))).toBe('Yantrika_Invoice_YH-2026-27-15.pdf');
  });
});
