/** Formatting helpers shared across the ERP modules. */

/**
 * Real browser trial caught this: `ar-EG`'s default numbering system renders
 * Eastern Arabic-Indic digits (٠١٢...), which the project's Tajawal font
 * doesn't reliably paint — showed up as tofu (◆) in KPI cards. Forcing the
 * `latn` numbering system keeps Arabic locale conventions (grouping, etc.)
 * but with Western digit glyphs (0-9), which every font supports.
 */
const ar = new Intl.NumberFormat("ar-EG", { numberingSystem: "latn" });

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

const arDate = new Intl.DateTimeFormat("ar-EG", {
  day: "numeric",
  month: "long",
  year: "numeric",
  numberingSystem: "latn",
});
const arTime = new Intl.DateTimeFormat("ar-EG", {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  numberingSystem: "latn",
});

/** PLATFORM_CLIENT_MANAGEMENT_SPEC.md §2 — "12 أغسطس 2026 — 3:52 م" style, latin digits (same tofu-avoidance reasoning as `ar` above). */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  // بعض السجلات القديمة محفوظة كوقت عربي مختصر ("اليوم 10:30") مش ISO — نعرضها كما هي
  // بدل ما Intl يرمي RangeError ويسقط الصفحة كلها.
  if (Number.isNaN(d.getTime())) return iso;
  return `${arDate.format(d)} — ${arTime.format(d)}`;
}
