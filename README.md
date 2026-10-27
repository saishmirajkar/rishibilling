# Yantrika Hydraulics — Billing

A small web app that creates GST invoices in the Yantrika Hydraulics invoice design and downloads them as print-quality A4 PDFs.

- Enter customer details and any number of items (description, HSN code, quantity, rate)
- Subtotal, CGST + SGST **or** IGST, total GST and total amount are calculated automatically
- Live on-screen preview, plus a **Preview Invoice** window showing the exact PDF
- **Download PDF** produces a real vector PDF (selectable text, embedded fonts), e.g. `Yantrika_Invoice_002.pdf`
- Long invoices continue onto extra pages, with the item table header repeated on each page
- Sequential invoice numbers (`001`, `002`, …), with a warning and a block on duplicates
- Saved invoice history: reopen any invoice or download its PDF again

No server, database or login is needed. Everything runs in the browser.

## Install and run

You need [Node.js](https://nodejs.org/) 20 or newer.

```bash
npm install        # once, to download dependencies
npm run dev        # start the app, then open http://localhost:5173
```

Other commands:

```bash
npm run build      # type-check and build a production version into dist/
npm run preview    # serve the production build locally
npm test           # run the calculation and PDF tests
npm run typecheck  # TypeScript checks only
```

The `dist/` folder produced by `npm run build` is a static website. You can open it on any static host, or with `npm run preview`.

## Using it

1. **Create Invoice** tab: the invoice number is filled in for you (editable) and the date defaults to today.
2. Fill in the customer and the items. In an item's description, the first line is the item name and any extra lines print underneath (useful for `DC NO- 049`, etc.).
3. Choose the tax type:
   - **CGST + SGST** (within Karnataka/same state): the GST rate is split equally, e.g. 18% → 9% + 9%
   - **IGST** (inter-state): the full rate is charged as a single IGST line
4. Click **Preview Invoice** to see the PDF, **Save Invoice** to store it, or **Download PDF**. Download also saves the invoice, so its number is never accidentally reused.
5. **Saved Invoices** tab: lists number, customer, date and total. **Open** loads an invoice back into the form for viewing or correction. **Download PDF** downloads it again.

### ⚠️ Where your invoices are stored

Saved invoices are kept in **this browser's local storage on this computer**. That is **not a cloud backup**:

- they will not appear on another computer, phone or browser;
- they are deleted if you clear the browser's site data or use a private/incognito window.

Keep the downloaded PDFs (for example in a backed-up folder) as your permanent records.

## Changing company details, bank details and GST

All defaults live in one file: **`src/config/company.ts`**.

```ts
export const COMPANY = {
  name: 'YANTRIKA HYDRAULICS',
  gstin: '29AADFY8991M1Z0',
  addressLines: ['683/1, UDYAMBAG , BELAGAVI', 'PIN-590008'],
  phone: '9986002200',
  email: 'hq@yantrikahydraulics.com',
  bank: { bankName: 'HDFC BANK', accountNumber: '50200124037512', ifsc: 'HDFC0001247', accountName: 'YANTRIKA HYDRAULICS' },
};

export const DEFAULT_GST_RATE = '18';          // total GST %; CGST/SGST get half each
export const DEFAULT_TAX_MODE = 'CGST_SGST';   // or 'IGST'
export const INVOICE_NUMBER_DIGITS = 3;        // 1 → "001"
export const FIRST_INVOICE_NUMBER = 1;
```

Edit the values and save; the running dev server updates automatically (for a production copy, run `npm run build` again). The GST rate and tax type can also be changed per invoice in the form.

Changes apply to **new** invoices. Each saved invoice keeps a copy of the company details it was created with, so old invoices don't change.

**Logo:** the top-left logo is `public/logo.svg`, a vector recreation of the mark in the original design. To use the official artwork, replace that file (SVG, PNG or JPG). If the file name changes, update `LOGO_URL` in `src/config/company.ts`.

## How the numbers are calculated

```
item subtotal = quantity × rate
subtotal      = sum of item subtotals
CGST = SGST   = subtotal × (GST rate ÷ 2)     — or IGST = subtotal × GST rate
total GST     = CGST + SGST  (or IGST)
total amount  = subtotal + total GST
```

Amounts are calculated in whole paise with exact integer arithmetic (no floating-point errors). Each tax amount is rounded to the nearest paisa (half up), and the displayed figures always add up exactly. Quantities may have up to 3 decimals; rates and the GST rate up to 2.

Worked example (also an automated test in `src/lib/invoice.test.ts`): 15,630 × ₹10 = ₹1,56,300.00. CGST 9% = ₹14,067.00 and SGST 9% = ₹14,067.00, so total GST = ₹28,134.00 and total = ₹1,84,434.00.

## Project structure

```
src/
  config/company.ts          ← company, bank and tax settings (edit me)
  lib/money.ts               ← exact money maths and Indian number formatting (₹1,56,300.00)
  lib/invoice.ts             ← invoice data, totals, validation
  lib/storage.ts             ← saving to browser local storage, invoice numbering
  pdf/layout.ts              ← template measurements (mm) shared by PDF and preview
  pdf/buildInvoicePdf.ts     ← draws the PDF with jsPDF + jspdf-autotable
  pdf/index.ts               ← loads fonts/logo in the browser; download & preview helpers
  components/InvoiceForm.tsx     ← the form
  components/InvoicePreview.tsx  ← on-screen invoice (HTML/CSS)
  components/SavedInvoices.tsx   ← saved invoice list
  components/PdfPreviewModal.tsx ← "Preview Invoice" window
  App.tsx                    ← tabs, saving, actions
  assets/fonts/              ← Kanit font (SIL Open Font License, see OFL.txt)
public/logo.svg              ← logo
```

The PDF is drawn directly as text and shapes, not as a screenshot of the page. It embeds the Kanit typeface, which matches the original design and includes the ₹ symbol.
