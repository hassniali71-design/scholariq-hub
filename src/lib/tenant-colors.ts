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

/**
 * هوية بصرية ديناميكية: بدل ما لون العميل يلوّن القائمة الجانبية بس، هنا بنشتق منه
 * مجموعة متناسقة من درجات فاتحة/متوسطة (خلفية، كروت، حدود، ظلال) باستخدام
 * `color-mix()` — نفس الأداة المستخدمة بالفعل في SubjectRoomHeader.tsx لدرجات
 * ألوان المواد. القيم دي بتحل محل متغيرات Tailwind الأساسية في styles.css
 * (--card, --canvas, --border, --primary, ...) عبر `@theme inline` هناك، فأي
 * مكوّن موجود بالفعل بيستخدم bg-card/bg-canvas/border-border/shadow-card
 * هياخد الهوية الجديدة تلقائياً من غير أي تعديل فيه.
 *
 * 4 مستويات تدرّج واضحة للعين (كانت 3-22% سابقاً — قريبة من الأبيض لدرجة إنها
 * كانت شبه مش ظاهرة، وده كان طلب صريح بالتعديل):
 *  المستوى ١ — الكروت (--card): أفتح درجة، لسه تفرق عن الأبيض بوضوح.
 *  المستوى ٢ — خلفية الصفحة/التمييز الخفيف (--canvas, --secondary, --muted).
 *  المستوى ٣ — التمييز الأوضح (--accent) لعناصر بارزة زي الشارات.
 *  المستوى ٤ — الحدود (--border, --border-strong) بتباين واضح مع الكروت.
 */
export function getTenantPaletteVars(accentColor?: string | null): Record<string, string> {
  const hex = accentColor?.trim() || DEFAULT_TENANT_ACCENT;
  const mix = (pct: number) => `color-mix(in srgb, ${hex} ${pct}%, white)`;
  return {
    "--primary": hex,
    "--primary-foreground": "#ffffff",
    "--ring": hex,
    "--sidebar": hex,
    "--sidebar-primary": "#ffffff",
    "--sidebar-primary-foreground": hex,
    "--sidebar-accent": mix(70),
    "--sidebar-border": mix(65),
    "--sidebar-ring": mix(55),
    "--card": mix(8),
    "--canvas": mix(14),
    "--accent": mix(22),
    "--accent-foreground": hex,
    "--secondary": mix(14),
    "--secondary-foreground": hex,
    "--muted": mix(14),
    "--border": mix(32),
    "--border-strong": mix(46),
    "--shadow-card": `0 1px 2px color-mix(in srgb, ${hex} 18%, transparent), 0 8px 24px color-mix(in srgb, ${hex} 12%, transparent)`,
    "--shadow-lift": `0 12px 40px color-mix(in srgb, ${hex} 22%, transparent)`,
  };
}
