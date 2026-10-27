/**
 * Decimal-safe money helpers.
 *
 * Floating-point numbers cannot represent values like 0.1 exactly, so all
 * amounts are kept as whole numbers:
 *   - money      → paise (₹1 = 100 paise)
 *   - quantity   → thousandths (1.5 units = 1500)
 *   - tax rates  → thousandths of a percent (9% = 9000)
 * Multiplication is done with BigInt and rounded half-up to the nearest paisa.
 */

export const QTY_DECIMALS = 3;
export const RATE_DECIMALS = 2;
export const GST_RATE_DECIMALS = 2;

export type ParseResult =
  | { ok: true; value: number }
  | { ok: false; error: string };

/**
 * Parses a non-negative decimal string (commas allowed, e.g. "1,56,300.50")
 * into an integer scaled by 10^decimals. "10.5" with decimals=2 → 1050.
 */
export function parseScaled(input: string, decimals: number): ParseResult {
  const text = input.replace(/,/g, '').trim();
  if (text === '') return { ok: false, error: 'Required' };
  const match = /^(\d*)(?:\.(\d*))?$/.exec(text);
  if (!match || (match[1] === '' && !match[2])) {
    return { ok: false, error: 'Enter a valid non-negative number' };
  }
  const whole = match[1] || '0';
  const frac = match[2] ?? '';
  if (frac.length > decimals) {
    return { ok: false, error: `Use at most ${decimals} decimal place${decimals === 1 ? '' : 's'}` };
  }
  const value = Number(whole + frac.padEnd(decimals, '0'));
  if (!Number.isSafeInteger(value)) return { ok: false, error: 'Number is too large' };
  return { ok: true, value };
}

/** Integer division of non-negative BigInts, rounding half up. */
function divRoundHalfUp(numerator: bigint, denominator: bigint): bigint {
  return (numerator * 2n + denominator) / (denominator * 2n);
}

/** Line amount in paise = quantity (thousandths) × rate (paise). */
export function lineAmountPaise(qtyThousandths: number, ratePaise: number): number {
  return Number(divRoundHalfUp(BigInt(qtyThousandths) * BigInt(ratePaise), 1000n));
}

/** Tax in paise = amount (paise) × rate (thousandths of a percent) / 100. */
export function taxPaise(amountPaise: number, rateMilliPercent: number): number {
  return Number(divRoundHalfUp(BigInt(amountPaise) * BigInt(rateMilliPercent), 100_000n));
}

/** Groups digits the Indian way: 156300 → "1,56,300". */
export function groupIndian(digits: string): string {
  if (digits.length <= 3) return digits;
  const last3 = digits.slice(-3);
  const rest = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${rest},${last3}`;
}

/** Formats a scaled integer as a decimal string with Indian grouping. */
function formatScaled(value: number, decimals: number, keepTrailingZeros: boolean): string {
  const negative = value < 0;
  const digits = Math.abs(Math.trunc(value)).toString().padStart(decimals + 1, '0');
  const whole = groupIndian(digits.slice(0, digits.length - decimals));
  let frac = decimals > 0 ? digits.slice(-decimals) : '';
  if (!keepTrailingZeros) frac = frac.replace(/0+$/, '');
  return (negative ? '-' : '') + whole + (frac ? `.${frac}` : '');
}

/** 15630000 paise → "1,56,300.00" */
export function formatAmount(paise: number): string {
  return formatScaled(paise, 2, true);
}

/** 15630000 paise → "₹1,56,300.00" */
export function formatINR(paise: number): string {
  return `₹${formatAmount(paise)}`;
}

/** 15630000 thousandths → "15,630"; 12500 → "12.5" */
export function formatQuantity(qtyThousandths: number): string {
  return formatScaled(qtyThousandths, QTY_DECIMALS, false);
}

/** 9000 → "9"; 2500 → "2.5" (thousandths of a percent to a percent string) */
export function formatPercent(rateMilliPercent: number): string {
  return formatScaled(rateMilliPercent, 3, false);
}
