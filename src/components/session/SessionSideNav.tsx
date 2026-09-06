import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export interface SessionSectionDef {
  key: string;
  title: string;
  hint: string;
  Icon: LucideIcon;
}

/**
 * القائمة الجانبية الطولية لأقسام وضع الحصة (البند 0).
 * كانت شريطاً أفقياً أعلى الصفحة بنصوص مقصوصة (`truncate`)؛
 * الآن عمود ثابت على يمين الشاشة، النص يلتف بالكامل بلا قص.
 */
export function SessionSideNav({
  sections,
  activeKey,
  onSelect,
}: {
  sections: SessionSectionDef[];
  activeKey: string;
  onSelect: (key: string) => void;
}) {
  return (
    <nav className="card-crisp sticky top-24 p-3">
      <p className="px-2 pb-2 text-xs font-black text-muted-foreground">أقسام الحصة</p>
      <ul className="space-y-1.5">
        {sections.map((s, i) => {
          const active = s.key === activeKey;
          return (
            <li key={s.key}>
              <button
                type="button"
                onClick={() => onSelect(s.key)}
                className={cn(
                  "flex w-full items-start gap-2.5 rounded-xl border-2 p-3 text-right transition-colors",
                  active
                    ? "border-navy bg-navy text-navy-foreground"
                    : "border-border bg-background hover:border-primary",
                )}
              >
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-black",
                    active ? "bg-white/20" : "bg-muted text-muted-foreground",
                  )}
                >
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <s.Icon className="size-4 shrink-0" />
                    <span className="text-sm font-black leading-6">{s.title}</span>
                  </span>
                  <span
                    className={cn(
                      "mt-1 block text-[11px] font-bold leading-5",
                      active ? "text-white/75" : "text-muted-foreground",
                    )}
                  >
                    {s.hint}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
