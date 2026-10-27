/**
 * Shared measurements of the invoice template, in millimetres on an A4 page
 * (210 × 297 mm). They were measured from the original invoice design and are
 * used by both the PDF generator and the on-screen preview.
 */

export const PAGE = { width: 210, height: 297 };

export const COLORS = {
  blue: '#3968B0',
  paper: '#FFFCF7',
  ink: '#111111',
  white: '#FFFFFF',
  rule: '#1E1A17',
  softRule: '#AAA8A5',
};

/** Font sizes in points. */
export const FONT_SIZE = {
  gstin: 10.7,
  companyName: 27.3,
  invoiceTitle: 33.3,
  billToLabel: 12,
  customer: 10.5,
  metaLabel: 12,
  metaValue: 12,
  tableHead: 11.5,
  description: 13.5,
  tableNumber: 11.5,
  totals: 12,
  bankHeading: 15.5,
  bankRow: 9.8,
  notesHeading: 9.8,
  notesText: 10,
  footerAddress: 12,
  footerPhone: 10.5,
  pageNumber: 8.5,
};

export const LAYOUT = {
  logoBox: { x: 0, y: 0, w: 39.5, h: 42.3 },
  logoMaxSize: 25,
  gstin: { right: 206.3, baseline: 6.9 },
  companyName: { x: 42.3, baseline: 24.9 },
  invoiceTitle: { right: 200.4, baseline: 39.3 },
  billBox: { x: 0, y: 42.3, w: 113.4, minBottom: 77.2 },
  billToLabel: { x: 16.1, baseline: 48.0 },
  customer: { x: 37.1, firstBaseline: 50.1, lineGap: 5.27, maxWidth: 73 },
  metaBox: { x: 113.4 },
  meta: { x: 119.8, numberLabel: 50.6, numberValue: 57.3, dateLabel: 66.4, dateValue: 73.3 },
  table: {
    left: 19.3,
    right: 193,
    headBaseline: 95.4,
    /** Column widths: index, description, HSN, qty, rate, subtotal (sum = 173.7) */
    columns: [9, 60.7, 27, 25, 22.5, 29.5],
  },
  /** First grey rule under the items (on a one-item invoice). */
  itemsRule: 136.2,
  totals: {
    labelX: 118.5,
    colonX: 164.5,
    valueRight: 192.7,
    firstBaselineGap: 13.7,
    rowGap: 10,
    ruleGap: 4.5,
  },
  bank: {
    headingX: 23,
    headingGap: 10.2,
    firstRowGap: 15.2,
    rowGap: 7.9,
    labelX: 54.9,
    colonX: 91.1,
    valueX: 97.2,
  },
  /** The bank details must end above this line so the notes fit. */
  tailLimit: 258,
  notes: { x: 7.8, headingBaseline: 267.7, textBaseline: 273.4 },
  footer: { top: 277.2, x: 7.8, line1: 285.9, line2: 291.4, phoneRight: 204.4, phoneBaseline: 293.1 },
  /** Top of the content area on continuation pages. */
  continuationTop: 22,
};
