import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { LOGO_URL } from '../config/company';
import { calculateTotals, companyFor, formatDate, type Invoice } from '../lib/invoice';
import { formatAmount, formatINR, formatPercent, formatQuantity } from '../lib/money';
import { FONT_SIZE, LAYOUT, PAGE } from '../pdf/layout';
import './InvoicePreview.css';

const PT_TO_MM = 25.4 / 72;
/** Distance from the top of a `line-height: 1` box to the Kanit baseline, in ems. */
const BASELINE_EM = 0.8525;
const MM_TO_PX = 96 / 25.4;

/** Absolutely positions text so its baseline sits at `baseline` mm, like the PDF does. */
function at(x: number | { right: number }, baseline: number, pt: number): CSSProperties {
  const horizontal = typeof x === 'number' ? { left: `${x}mm` } : { right: `${PAGE.width - x.right}mm` };
  return { ...horizontal, top: `${baseline - BASELINE_EM * pt * PT_TO_MM}mm`, fontSize: `${pt}pt` };
}

/** On-screen replica of the invoice. The PDF is generated separately but uses the same measurements. */
export function InvoicePreview({ invoice }: { invoice: Invoice }) {
  const company = companyFor(invoice);
  const totals = calculateTotals(invoice);
  const { table, totals: tl, bank, notes, footer, meta } = LAYOUT;

  const totalRows: [string, string][] = [
    ['SUBTOTAL', formatINR(totals.subtotal)],
    ...totals.taxes.map((t): [string, string] => [`${t.label} ${formatPercent(t.rate)}%`, formatINR(t.amount)]),
    ['TOTAL GST', formatINR(totals.totalGst)],
    ['TOTAL AMOUNT', formatINR(totals.total)],
  ];
  const bankRows: [string, string][] = [
    ['BANK NAME', company.bank.bankName],
    ['ACCOUNT NUMBER', company.bank.accountNumber],
    ['IFSC CODE', company.bank.ifsc],
    ['ACCOUNT NAME', company.bank.accountName],
  ];

  // Positions inside the "tail" block, measured from the first grey rule.
  const firstTotal = tl.firstBaselineGap;
  const lastTotal = firstTotal + (totalRows.length - 1) * tl.rowGap;
  const rule2 = lastTotal + tl.ruleGap;
  const bankHeading = rule2 + bank.headingGap;
  const firstBank = bankHeading + bank.firstRowGap;
  const tailHeight = firstBank + 3 * bank.rowGap + 4;

  const headFontMm = FONT_SIZE.tableHead * PT_TO_MM;
  const tableTop = table.headBaseline - 2 - headFontMm * 0.85 - LAYOUT.billBox.minBottom;
  const tableMinHeight = LAYOUT.itemsRule - 4 - table.headBaseline + 2 + headFontMm * 0.85;

  const customerLines = [
    invoice.customer.name,
    ...invoice.customer.address.split(/\r?\n/),
    invoice.customer.gstin.trim() ? `GSTIN/ UIN - ${invoice.customer.gstin.trim()}` : '',
  ].filter((line) => line.trim());

  const [addressFirst = '', ...addressRest] = company.addressLines;

  // Scale the 210 mm page to fit the available width.
  const frameRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [sheetHeight, setSheetHeight] = useState(PAGE.height * MM_TO_PX);
  useLayoutEffect(() => {
    const frame = frameRef.current;
    const sheet = sheetRef.current;
    if (!frame || !sheet) return;
    const update = () => {
      setScale(Math.min(1.25, frame.clientWidth / (PAGE.width * MM_TO_PX)));
      setSheetHeight(sheet.offsetHeight);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(frame);
    observer.observe(sheet);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="preview-frame" ref={frameRef} style={{ height: sheetHeight * scale }}>
      <div className="sheet" ref={sheetRef} style={{ transform: `scale(${scale})` }} aria-label="Invoice preview">
        {/* Header */}
        <div className="sheet-header">
          <div className="logo-box">
            <img src={LOGO_URL} alt="" />
          </div>
          <div className="t light" style={at({ right: LAYOUT.gstin.right }, LAYOUT.gstin.baseline, FONT_SIZE.gstin)}>
            GSTIN : {company.gstin}
          </div>
          <div className="t regular" style={at(LAYOUT.companyName.x, LAYOUT.companyName.baseline, FONT_SIZE.companyName)}>
            {company.name}
          </div>
          <div className="t regular" style={at({ right: LAYOUT.invoiceTitle.right }, LAYOUT.invoiceTitle.baseline, FONT_SIZE.invoiceTitle)}>
            INVOICE
          </div>
        </div>

        {/* Bill to + invoice number/date */}
        <div className="bill-row">
          <div className="bill-box">
            <div className="t medium white" style={at(LAYOUT.billToLabel.x, LAYOUT.billToLabel.baseline - LAYOUT.billBox.y, FONT_SIZE.billToLabel)}>
              BILL TO:
            </div>
            <div className="customer-lines">
              {customerLines.map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </div>
          </div>
          <div className="meta-box">
            <div className="t medium" style={at(meta.x - LAYOUT.metaBox.x, meta.numberLabel - LAYOUT.billBox.y, FONT_SIZE.metaLabel)}>
              INVOICE NUMBER
            </div>
            <div className="t light" style={at(meta.x - LAYOUT.metaBox.x, meta.numberValue - LAYOUT.billBox.y, FONT_SIZE.metaValue)}>
              {invoice.invoiceNumber}
            </div>
            <div className="t medium" style={at(meta.x - LAYOUT.metaBox.x, meta.dateLabel - LAYOUT.billBox.y, FONT_SIZE.metaLabel)}>
              DATE
            </div>
            <div className="t light" style={at(meta.x - LAYOUT.metaBox.x, meta.dateValue - LAYOUT.billBox.y, FONT_SIZE.metaValue)}>
              {formatDate(invoice.invoiceDate)}
            </div>
          </div>
        </div>

        {/* Items */}
        <div className="items-wrap" style={{ marginTop: `${tableTop}mm`, minHeight: `${tableMinHeight}mm` }}>
          <table className="items">
            <colgroup>
              {table.columns.map((w, i) => (
                <col key={i} style={{ width: `${w}mm` }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th colSpan={2} className="left">ITEMS</th>
                <th>HSN CODE</th>
                <th>QTY.</th>
                <th>RATE.</th>
                <th className="right">SUBTOTAL</th>
              </tr>
            </thead>
            <tbody>
              {totals.lines.map((line, i) => (
                <tr key={line.item.id}>
                  <td className="idx">{i + 1}-</td>
                  <td className="desc">{line.item.description.replace(/\s+$/, '')}</td>
                  <td>{line.item.hsn}</td>
                  <td>{formatQuantity(line.quantity)}</td>
                  <td>{formatAmount(line.rate)}</td>
                  <td className="right">{formatAmount(line.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals and bank details */}
        <div className="tail" style={{ height: `${tailHeight}mm`, marginTop: '4mm' }}>
          <div className="soft-rule" style={{ top: 0 }} />
          {totalRows.map(([label, value], i) => {
            const y = firstTotal + i * tl.rowGap;
            return (
              <div key={label}>
                <div className="t medium" style={at(tl.labelX, y, FONT_SIZE.totals)}>{label}</div>
                <div className="t medium" style={at(tl.colonX, y, FONT_SIZE.totals)}>:</div>
                <div className="t medium" style={at({ right: tl.valueRight }, y, FONT_SIZE.totals)}>{value}</div>
              </div>
            );
          })}
          <div className="soft-rule" style={{ top: `${rule2}mm` }} />
          <div className="t medium" style={at(bank.headingX, bankHeading, FONT_SIZE.bankHeading)}>BANK DETAILS :</div>
          {bankRows.map(([label, value], i) => {
            const y = firstBank + i * bank.rowGap;
            return (
              <div key={label}>
                <div className="t medium" style={at(bank.labelX, y, FONT_SIZE.bankRow)}>{label}</div>
                <div className="t medium" style={at(bank.colonX, y, FONT_SIZE.bankRow)}>:</div>
                <div className="t light" style={at(bank.valueX, y, FONT_SIZE.bankRow)}>{value}</div>
              </div>
            );
          })}
        </div>

        <div className="spacer" />

        {/* Notes */}
        <div className="notes" style={{ height: `${footer.top - 262}mm` }}>
          <div className="t medium" style={at(notes.x, notes.headingBaseline - 262, FONT_SIZE.notesHeading)}>NOTES</div>
          <div className="t light" style={at(notes.x, notes.textBaseline - 262, FONT_SIZE.notesText)}>
            If you have any questions regarding this invoice, please contact us at{' '}
            <span className="medium">{company.email}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="sheet-footer" style={{ height: `${PAGE.height - footer.top}mm` }}>
          <div className="t regular white" style={at(footer.x, footer.line1 - footer.top, FONT_SIZE.footerAddress)}>{addressFirst}</div>
          <div className="t regular white" style={at(footer.x, footer.line2 - footer.top, FONT_SIZE.footerAddress)}>
            {addressRest.join(', ')}
          </div>
          <div className="t regular white" style={at({ right: footer.phoneRight }, footer.phoneBaseline - footer.top, FONT_SIZE.footerPhone)}>
            PH - {company.phone}
          </div>
        </div>
      </div>
    </div>
  );
}
