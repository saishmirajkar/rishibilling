/**
 * ─────────────────────────────────────────────────────────────
 *  COMPANY SETTINGS — edit this file to change what is printed
 *  on every NEW invoice (seller details, bank details, taxes).
 * ─────────────────────────────────────────────────────────────
 *
 * Invoices that have already been saved keep a copy of the
 * company details they were created with, so changing these
 * values does not alter old invoices.
 */

export interface CompanyDetails {
  name: string;
  gstin: string;
  /** Each entry is printed on its own line in the blue footer. */
  addressLines: string[];
  phone: string;
  email: string;
  bank: {
    bankName: string;
    accountNumber: string;
    ifsc: string;
    accountName: string;
  };
}

export const COMPANY: CompanyDetails = {
  name: 'YANTRIKA HYDRAULICS',
  gstin: '29AADFY8991M1Z0',
  addressLines: ['683/1, UDYAMBAG , BELAGAVI', 'PIN-590008'],
  phone: '9986002200',
  email: 'hq@yantrikahydraulics.com',
  bank: {
    bankName: 'HDFC BANK',
    accountNumber: '50200124037512',
    ifsc: 'HDFC0001247',
    accountName: 'YANTRIKA HYDRAULICS',
  },
};

/**
 * Logo shown in the top-left blue box. Replace public/logo.svg with your
 * own file (SVG, PNG or JPG all work) and update the path if the name changes.
 */
export const LOGO_URL = '/logo.svg';

/** Default total GST rate in percent. CGST/SGST each get half of it. */
export const DEFAULT_GST_RATE = '18';

/**
 * Default tax type for new invoices:
 *  - 'CGST_SGST' → intra-state supply (CGST + SGST, rate split equally)
 *  - 'IGST'      → inter-state supply (single IGST at the full rate)
 */
export const DEFAULT_TAX_MODE: 'CGST_SGST' | 'IGST' = 'CGST_SGST';

/** Auto-generated invoice numbers are zero-padded to this many digits (1 → "001"). */
export const INVOICE_NUMBER_DIGITS = 3;

/** First invoice number used on a fresh installation. */
export const FIRST_INVOICE_NUMBER = 1;
