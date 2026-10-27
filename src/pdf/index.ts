import { LOGO_URL } from '../config/company';
import { pdfFileName, type Invoice } from '../lib/invoice';
import lightFontUrl from '../assets/fonts/Kanit-Light.ttf?url';
import regularFontUrl from '../assets/fonts/Kanit-Regular.ttf?url';
import mediumFontUrl from '../assets/fonts/Kanit-Medium.ttf?url';
import { buildInvoicePdf, type PdfAssets } from './buildInvoicePdf';

let assetsPromise: Promise<PdfAssets> | null = null;

/** Loads fonts and logo once and reuses them for every PDF. */
function loadAssets(): Promise<PdfAssets> {
  assetsPromise ??= (async () => {
    const [light, regular, medium, logo] = await Promise.all([
      fetchBase64(lightFontUrl),
      fetchBase64(regularFontUrl),
      fetchBase64(mediumFontUrl),
      loadLogo(LOGO_URL).catch(() => undefined), // a missing logo leaves the blue box empty
    ]);
    return { fonts: { light, regular, medium }, logo };
  })();
  assetsPromise.catch(() => {
    assetsPromise = null; // allow a retry after a network hiccup
  });
  return assetsPromise;
}

async function fetchBase64(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load ${url}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Draws the logo (SVG, PNG or JPG) onto a canvas and returns it as a PNG. */
async function loadLogo(url: string): Promise<PdfAssets['logo']> {
  const img = new Image();
  img.src = url;
  await img.decode();
  const maxPixels = 400;
  const scale = maxPixels / Math.max(img.naturalWidth, img.naturalHeight);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return { dataUrl: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height };
}

export async function downloadInvoicePdf(invoice: Invoice): Promise<void> {
  const doc = buildInvoicePdf(invoice, await loadAssets());
  doc.save(pdfFileName(invoice));
}

/** Returns an object URL for showing the PDF in the preview window. Revoke it when done. */
export async function invoicePdfUrl(invoice: Invoice): Promise<string> {
  const doc = buildInvoicePdf(invoice, await loadAssets());
  return URL.createObjectURL(doc.output('blob'));
}
