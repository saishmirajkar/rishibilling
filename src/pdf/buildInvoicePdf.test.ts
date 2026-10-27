import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { blankInvoice, type Invoice } from '../lib/invoice';
import { buildInvoicePdf, type PdfAssets } from './buildInvoicePdf';

const font = (name: string) => readFileSync(new URL(`../assets/fonts/${name}`, import.meta.url)).toString('base64');
const assets: PdfAssets = {
  fonts: { light: font('Kanit-Light.ttf'), regular: font('Kanit-Regular.ttf'), medium: font('Kanit-Medium.ttf') },
};

function invoiceWithItems(count: number): Invoice {
  const inv = blankInvoice('002');
  inv.customer = { name: 'HYDROMATIK', address: 'survey no 67/1A Navage village\nBelagum 590014.', gstin: '29AACFH5045E1ZK' };
  inv.items = Array.from({ length: count }, (_, i) => ({
    id: `i${i}`,
    description: `11/16 ORFS X 9/16 ORB\nDC NO- 0${49 + i}`,
    hsn: '9985',
    quantity: '100',
    rate: '10',
  }));
  return inv;
}

describe('buildInvoicePdf', () => {
  it('fits a short invoice on one A4 page', () => {
    const doc = buildInvoicePdf(invoiceWithItems(3), assets);
    expect(doc.getNumberOfPages()).toBe(1);
    const { width, height } = doc.internal.pageSize;
    expect([Math.round(width), Math.round(height)]).toEqual([210, 297]);
    expect(doc.output().startsWith('%PDF-')).toBe(true);
  });

  it('continues long invoices onto more pages', () => {
    expect(buildInvoicePdf(invoiceWithItems(30), assets).getNumberOfPages()).toBeGreaterThan(1);
  });
});
