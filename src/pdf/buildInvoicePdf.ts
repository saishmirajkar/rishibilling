/**
 * Draws the invoice as a real (vector, selectable-text) A4 PDF using jsPDF.
 *
 * This file has no browser dependencies: fonts and the logo are passed in,
 * which lets the same code run in tests under Node.
 */
import { jsPDF } from 'jspdf';
import { autoTable, type CellInput, type RowInput } from 'jspdf-autotable';
import { calculateTotals, companyFor, formatDate, type Invoice } from '../lib/invoice';
import { formatAmount, formatINR, formatPercent, formatQuantity } from '../lib/money';
import { COLORS, FONT_SIZE, LAYOUT, PAGE } from './layout';

export interface PdfAssets {
  /** Base64-encoded TTF files */
  fonts: { light: string; regular: string; medium: string };
  logo?: { dataUrl: string; width: number; height: number };
}

type FontName = 'KanitLight' | 'Kanit' | 'KanitMedium';
const PT_TO_MM = 25.4 / 72;
/** Vertical spacing between lines of multi-line text, as a multiple of the font size. */
const LINE_HEIGHT_FACTOR = 1.3;

export function buildInvoicePdf(invoice: Invoice, assets: PdfAssets): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
  const company = companyFor(invoice);
  const totals = calculateTotals(invoice);

  doc.setProperties({
    title: `Invoice ${invoice.invoiceNumber} - ${company.name}`,
    subject: `Invoice for ${invoice.customer.name}`,
    author: company.name,
    creator: `${company.name} Billing`,
  });

  registerFonts(doc, assets);
  doc.setLineHeightFactor(LINE_HEIGHT_FACTOR);

  const text = (
    value: string | string[],
    x: number,
    y: number,
    font: FontName,
    size: number,
    color: string = COLORS.ink,
    align: 'left' | 'right' | 'center' = 'left',
    charSpace = 0,
  ) => {
    doc.setFont(font, 'normal');
    doc.setFontSize(size);
    doc.setTextColor(color);
    doc.text(value, x, y, { align, baseline: 'alphabetic', charSpace });
  };

  const hline = (x1: number, x2: number, y: number, color: string, width: number) => {
    doc.setDrawColor(color);
    doc.setLineWidth(width);
    doc.line(x1, y, x2, y);
  };

  const paintedPages = new Set<number>();
  const paintBackground = () => {
    const page = doc.getCurrentPageInfo().pageNumber;
    if (paintedPages.has(page)) return;
    paintedPages.add(page);
    doc.setFillColor(COLORS.paper);
    doc.rect(0, 0, PAGE.width, PAGE.height, 'F');
  };

  // ── Page 1 header ────────────────────────────────────────────────
  paintBackground();

  const { logoBox } = LAYOUT;
  doc.setFillColor(COLORS.blue);
  doc.rect(logoBox.x, logoBox.y, logoBox.w, logoBox.h, 'F');
  if (assets.logo) {
    const { width, height, dataUrl } = assets.logo;
    const scale = LAYOUT.logoMaxSize / Math.max(width, height);
    const w = width * scale;
    const h = height * scale;
    doc.addImage(dataUrl, 'PNG', logoBox.x + (logoBox.w - w) / 2, logoBox.y + (logoBox.h - h) / 2, w, h);
  }

  text(`GSTIN : ${company.gstin}`, LAYOUT.gstin.right, LAYOUT.gstin.baseline, 'KanitLight', FONT_SIZE.gstin, COLORS.ink, 'right');
  // jsPDF does not apply font kerning, so large headings are tightened slightly to match the design.
  text(company.name, LAYOUT.companyName.x, LAYOUT.companyName.baseline, 'Kanit', FONT_SIZE.companyName, COLORS.ink, 'left', -0.12);
  text('INVOICE', LAYOUT.invoiceTitle.right, LAYOUT.invoiceTitle.baseline, 'Kanit', FONT_SIZE.invoiceTitle, COLORS.ink, 'right');

  // Customer lines (wrapped). The blue box grows if the address is long.
  const { customer: cust, billBox } = LAYOUT;
  doc.setFont('KanitLight', 'normal');
  doc.setFontSize(FONT_SIZE.customer);
  const customerLines: string[] = [];
  const addWrapped = (value: string) => {
    for (const part of value.split(/\r?\n/)) {
      if (part.trim()) customerLines.push(...(doc.splitTextToSize(part.trim(), cust.maxWidth) as string[]));
    }
  };
  addWrapped(invoice.customer.name);
  addWrapped(invoice.customer.address);
  if (invoice.customer.gstin.trim()) addWrapped(`GSTIN/ UIN - ${invoice.customer.gstin.trim()}`);

  const lastCustomerBaseline = cust.firstBaseline + Math.max(customerLines.length - 1, 0) * cust.lineGap;
  const billBottom = Math.max(billBox.minBottom, lastCustomerBaseline + 6);
  const shift = billBottom - billBox.minBottom;

  doc.setFillColor(COLORS.blue);
  doc.rect(billBox.x, billBox.y, billBox.w, billBottom - billBox.y, 'F');
  text('BILL TO:', LAYOUT.billToLabel.x, LAYOUT.billToLabel.baseline, 'KanitMedium', FONT_SIZE.billToLabel, COLORS.white);
  customerLines.forEach((line, i) => {
    text(line, cust.x, cust.firstBaseline + i * cust.lineGap, 'KanitLight', FONT_SIZE.customer, COLORS.white);
  });

  hline(LAYOUT.metaBox.x, PAGE.width, billBox.y, COLORS.rule, 0.3);
  hline(LAYOUT.metaBox.x, PAGE.width, billBottom, COLORS.rule, 0.3);
  const { meta } = LAYOUT;
  text('INVOICE NUMBER', meta.x, meta.numberLabel, 'KanitMedium', FONT_SIZE.metaLabel);
  text(invoice.invoiceNumber, meta.x, meta.numberValue, 'KanitLight', FONT_SIZE.metaValue);
  text('DATE', meta.x, meta.dateLabel, 'KanitMedium', FONT_SIZE.metaLabel);
  text(formatDate(invoice.invoiceDate), meta.x, meta.dateValue, 'KanitLight', FONT_SIZE.metaValue);

  // ── Items table ──────────────────────────────────────────────────
  const { table } = LAYOUT;
  const headPadTop = 2;
  const headFontMm = FONT_SIZE.tableHead * PT_TO_MM;
  const startY = table.headBaseline + shift - headPadTop - headFontMm * 0.85;

  const head: RowInput[] = [
    [
      { content: 'ITEMS', colSpan: 2, styles: { halign: 'left', cellPadding: { top: headPadTop, bottom: 1.6, left: 2, right: 1 } } },
      'HSN CODE',
      'QTY.',
      'RATE.',
      { content: 'SUBTOTAL', styles: { halign: 'right' } },
    ],
  ];
  const body: RowInput[] = totals.lines.map((line, index): CellInput[] => [
    `${index + 1}-`,
    line.item.description.replace(/\s+$/, ''),
    line.item.hsn,
    formatQuantity(line.quantity),
    formatAmount(line.rate),
    formatAmount(line.amount),
  ]);

  const [wIdx, wDesc, wHsn, wQty, wRate, wSub] = table.columns;
  autoTable(doc, {
    head,
    body,
    startY,
    theme: 'plain',
    margin: {
      left: table.left,
      right: PAGE.width - table.right,
      top: LAYOUT.continuationTop,
      bottom: PAGE.height - LAYOUT.footer.top + 5,
    },
    tableWidth: table.right - table.left,
    showHead: 'everyPage',
    rowPageBreak: 'avoid',
    styles: {
      font: 'KanitMedium',
      fontStyle: 'normal',
      fontSize: FONT_SIZE.tableNumber,
      textColor: COLORS.ink,
      cellPadding: { top: 3, bottom: 2.5, left: 1, right: 1 },
      valign: 'top',
      overflow: 'linebreak',
    },
    headStyles: {
      font: 'KanitMedium',
      fontSize: FONT_SIZE.tableHead,
      halign: 'center',
      valign: 'top',
      cellPadding: { top: headPadTop, bottom: 1.6, left: 1, right: 1 },
      lineColor: COLORS.rule,
      lineWidth: { bottom: 0.3 },
    },
    columnStyles: {
      0: { cellWidth: wIdx, font: 'KanitLight', fontSize: FONT_SIZE.description, cellPadding: { top: 3, bottom: 2.5, left: 0.5, right: 0 } },
      1: { cellWidth: wDesc, font: 'KanitLight', fontSize: FONT_SIZE.description },
      2: { cellWidth: wHsn, halign: 'center' },
      3: { cellWidth: wQty, halign: 'center' },
      4: { cellWidth: wRate, halign: 'center' },
      5: { cellWidth: wSub, halign: 'right', cellPadding: { top: 3, bottom: 2.5, left: 1, right: 0.3 } },
    },
    willDrawPage: () => paintBackground(),
  });

  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

  // ── Totals, bank details (the "tail") ────────────────────────────
  const { totals: tl, bank } = LAYOUT;
  const totalRows: [string, string][] = [
    ['SUBTOTAL', formatINR(totals.subtotal)],
    ...totals.taxes.map((t): [string, string] => [`${t.label} ${formatPercent(t.rate)}%`, formatINR(t.amount)]),
    ['TOTAL GST', formatINR(totals.totalGst)],
    ['TOTAL AMOUNT', formatINR(totals.total)],
  ];
  const tailHeight =
    tl.firstBaselineGap + (totalRows.length - 1) * tl.rowGap + tl.ruleGap + bank.headingGap + bank.firstRowGap + 3 * bank.rowGap;

  // Place the tail on this page if it fits, compressing the spacing a little if
  // necessary; otherwise start a new page for it.
  const MIN_SCALE = 0.62;
  const minRule = finalY + 4;
  let rule1 = Math.max(minRule, LAYOUT.itemsRule + shift);
  let scale = 1;
  if (rule1 + tailHeight > LAYOUT.tailLimit) {
    rule1 = Math.max(minRule, LAYOUT.tailLimit - tailHeight);
    if (rule1 + tailHeight > LAYOUT.tailLimit) {
      scale = (LAYOUT.tailLimit - minRule) / tailHeight;
      if (scale < MIN_SCALE) {
        doc.addPage();
        paintBackground();
        rule1 = LAYOUT.continuationTop;
        scale = 1;
      }
    }
  }

  hline(table.left, table.right, rule1, COLORS.softRule, 0.25);

  doc.setFont('KanitMedium', 'normal');
  doc.setFontSize(FONT_SIZE.totals);
  const widestValue = Math.max(...totalRows.map(([, v]) => doc.getTextWidth(v)));
  const colonX = Math.min(tl.colonX, tl.valueRight - widestValue - 4);

  let y = rule1 + tl.firstBaselineGap * scale;
  totalRows.forEach(([label, value], i) => {
    if (i > 0) y += tl.rowGap * scale;
    text(label, tl.labelX, y, 'KanitMedium', FONT_SIZE.totals);
    text(':', colonX, y, 'KanitMedium', FONT_SIZE.totals);
    text(value, tl.valueRight, y, 'KanitMedium', FONT_SIZE.totals, COLORS.ink, 'right');
  });
  const rule2 = y + tl.ruleGap * scale;
  hline(table.left, table.right, rule2, COLORS.softRule, 0.25);

  y = rule2 + bank.headingGap * scale;
  text('BANK DETAILS :', bank.headingX, y, 'KanitMedium', FONT_SIZE.bankHeading);
  y += bank.firstRowGap * scale;
  const bankRows: [string, string][] = [
    ['BANK NAME', company.bank.bankName],
    ['ACCOUNT NUMBER', company.bank.accountNumber],
    ['IFSC CODE', company.bank.ifsc],
    ['ACCOUNT NAME', company.bank.accountName],
  ];
  bankRows.forEach(([label, value], i) => {
    if (i > 0) y += bank.rowGap * scale;
    text(label, bank.labelX, y, 'KanitMedium', FONT_SIZE.bankRow);
    text(':', bank.colonX, y, 'KanitMedium', FONT_SIZE.bankRow);
    text(value, bank.valueX, y, 'KanitLight', FONT_SIZE.bankRow);
  });

  // ── Notes (bottom of the last page) ─────────────────────────────
  const { notes } = LAYOUT;
  text('NOTES', notes.x, notes.headingBaseline, 'KanitMedium', FONT_SIZE.notesHeading);
  const noteText = 'If you have any questions regarding this invoice, please contact us at ';
  text(noteText, notes.x, notes.textBaseline, 'KanitLight', FONT_SIZE.notesText);
  doc.setFont('KanitLight', 'normal');
  doc.setFontSize(FONT_SIZE.notesText);
  const emailX = notes.x + doc.getTextWidth(noteText);
  text(company.email, emailX, notes.textBaseline, 'KanitMedium', FONT_SIZE.notesText);

  // ── Footer and continuation headers on every page ────────────────
  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);
    const { footer } = LAYOUT;
    doc.setFillColor(COLORS.blue);
    doc.rect(0, footer.top, PAGE.width, PAGE.height - footer.top, 'F');
    const [line1 = '', ...rest] = company.addressLines;
    text(line1, footer.x, footer.line1, 'Kanit', FONT_SIZE.footerAddress, COLORS.white);
    if (rest.length) text(rest.join(', '), footer.x, footer.line2, 'Kanit', FONT_SIZE.footerAddress, COLORS.white);
    text(`PH - ${company.phone}`, footer.phoneRight, footer.phoneBaseline, 'Kanit', FONT_SIZE.footerPhone, COLORS.white, 'right');

    if (pageCount > 1) {
      text(`Page ${page} of ${pageCount}`, PAGE.width / 2, footer.phoneBaseline, 'KanitLight', FONT_SIZE.pageNumber, COLORS.white, 'center');
    }
    if (page > 1) {
      text(company.name, table.left, 13, 'Kanit', 12);
      text(`INVOICE ${invoice.invoiceNumber}  ·  ${formatDate(invoice.invoiceDate)}  (continued)`, table.right, 13, 'KanitLight', 10, COLORS.ink, 'right');
      hline(table.left, table.right, 16, COLORS.softRule, 0.25);
    }
  }

  return doc;
}

function registerFonts(doc: jsPDF, assets: PdfAssets) {
  const fonts: [FontName, string][] = [
    ['KanitLight', assets.fonts.light],
    ['Kanit', assets.fonts.regular],
    ['KanitMedium', assets.fonts.medium],
  ];
  for (const [name, data] of fonts) {
    doc.addFileToVFS(`${name}.ttf`, data);
    doc.addFont(`${name}.ttf`, name, 'normal');
  }
}
