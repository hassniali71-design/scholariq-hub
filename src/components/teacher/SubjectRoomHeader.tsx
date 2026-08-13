import { Quote } from "lucide-react";

import { formatNumber } from "@/lib/format";
import { getTodayQuote } from "@/lib/daily-quotes";
import type { SubjectTheme } from "@/lib/subject-themes";

interface SubjectRoomHeaderProps {
  teacherName: string;
  subjectName: string;
  themeKey: string | undefined;
  theme: SubjectTheme;
  groupsCount: number;
  studentsCount: number;
}

/**
 * DESIGN_ATMOSPHERE_SPEC.md §3 — "غرفة المادة": tinted card with a large faded
 * floating subject icon, teacher name + colored subject badge, and a daily
 * quote underneath on a neutral background (kept separate from the tinted
 * card so the quote text stays legible regardless of the subject color).
 */
export function SubjectRoomHeader({
  teacherName,
  subjectName,
  themeKey,
  theme,
  groupsCount,
  studentsCount,
}: SubjectRoomHeaderProps) {
  const Icon = theme.icon;
  const quote = getTodayQuote(themeKey);

  return (
    <div className="space-y-4">
      <div
        className="relative overflow-hidden rounded-xl p-6 md:p-8"
        style={{ backgroundColor: `color-mix(in srgb, ${theme.primary} 10%, white)` }}
      >
        <Icon
          aria-hidden
          className="subject-room-icon pointer-events-none absolute -top-4 -left-4 size-40 md:size-48"
          style={{ color: theme.primary, opacity: 0.16 }}
        />
        <div className="relative flex flex-wrap items-center gap-4">
          <span
            className="flex size-14 shrink-0 items-center justify-center rounded-2xl"
            style={{
              backgroundColor: `color-mix(in srgb, ${theme.primary} 18%, white)`,
              color: theme.primary,
            }}
          >
            <Icon className="size-7" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-2xl font-black text-foreground md:text-3xl">
              {teacherName}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-black text-white"
                style={{ backgroundColor: theme.primary }}
              >
                <Icon className="size-3.5" />
                {subjectName}
              </span>
              <span className="text-xs font-bold text-muted-foreground">
                {formatNumber(groupsCount)} مجموعات · {formatNumber(studentsCount)} طالب
              </span>
            </div>
          </div>
        </div>
      </div>

      {quote ? (
        <div className="flex items-start gap-3 rounded-xl border-2 border-border bg-background p-4">
          <Quote className="size-5 shrink-0 text-muted-foreground" />
          <p className="text-sm font-extrabold text-foreground">{quote}</p>
        </div>
      ) : null}
    </div>
  );
}
