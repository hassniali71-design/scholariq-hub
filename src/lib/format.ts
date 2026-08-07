/** Formatting helpers shared across the ERP modules. */

const ar = new Intl.NumberFormat("ar-EG");

export function formatNumber(value: number): string {
  return ar.format(value);
}

export function formatCurrency(value: number): string {
  return `${ar.format(value)} ج.م`;
}

export function formatPercent(value: number): string {
  return `${ar.format(value)}٪`;
}

/** Seconds -> mm:ss with latin digits (tabular, readable from a distance). */
export function formatClock(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const m = Math.floor(safe / 60)
    .toString()
    .padStart(2, "0");
  const s = (safe % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}
