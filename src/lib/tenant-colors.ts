/**
 * SUPABASE_MIGRATION_SPEC.md §11-أ — the platform owner picks one of these when creating a
 * new client (/platform/new-center), never free text. Deliberately separate from the 5
 * subject colors (DESIGN_ATMOSPHERE_SPEC.md) — this only ever touches AppShell's sidebar.
 * All dark enough that the sidebar's existing white/near-white text stays readable on any of
 * them (same reasoning as the current --navy default).
 */
export const TENANT_ACCENT_COLORS = [
  { key: "navy", label: "كحلي (الافتراضي)", hex: "#1E3A8A" },
  { key: "emerald", label: "أخضر غامق", hex: "#065F46" },
  { key: "violet", label: "بنفسجي", hex: "#5B21B6" },
  { key: "maroon", label: "عنابي", hex: "#7F1D1D" },
  { key: "teal", label: "أزرق بترولي", hex: "#115E59" },
  { key: "burnt-orange", label: "برتقالي محروق", hex: "#9A3412" },
  { key: "charcoal", label: "رمادي فحمي", hex: "#1F2937" },
  { key: "rose", label: "وردي غامق", hex: "#831843" },
] as const;

export const DEFAULT_TENANT_ACCENT = TENANT_ACCENT_COLORS[0].hex;
