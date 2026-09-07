import { Quote } from "lucide-react";

import { formatNumber } from "@/lib/format";
import { getTodayQuote } from "@/lib/daily-quotes";
import { subjectDisplayName, teacherDisplayName } from "@/lib/teacher-identity";
import type { SubjectTheme } from "@/lib/subject-themes";
import type { Teacher } from "@/types";

interface SubjectRoomHeaderProps {
  teacher: Pick<Teacher, "honorific" | "full_name" | "cover_image_key" | "avatar_data">;
  subjectName: string;
  themeKey: string | undefined;
  theme: SubjectTheme;
  groupsCount: number;
  studentsCount: number;
}

/**
 * DESIGN_ATMOSPHERE_SPEC.md §3 + §1.4 — "غرفة المادة" بصورة غلاف:
 *  1. صورة غلاف مستطيلة عرض-كامل (aspect-[3/1])، إما من `cover_image_key`
 *     أو placeholder ملوّن بـ theme.primary.
 *  2. اسم المدرس بصيغة "مستر [الاسم]" فوق.
 *  3. "مستر/آنسة [الاسم] — [المادة]" تحت الصورة.
 *  4. اقتباس اليوم في بطاقة منفصلة (تباين عالٍ).
 */
export function SubjectRoomHeader({
  teacher,
  subjectName,
  themeKey,
  theme,
  groupsCount,
  studentsCount,
}: SubjectRoomHeaderProps) {
  const Icon = theme.icon;
  const quote = getTodayQuote(themeKey);
  const coverKey = teacher.cover_image_key?.trim();
  const coverUrl = coverKey ? `/branding/covers/${coverKey}.jpg` : null;
  const displayedSubject = subjectDisplayName(subjectName);

  return (
    <div className="space-y-4">
      <div
        className="relative overflow-hidden rounded-2xl"
        style={{ backgroundColor: `color-mix(in srgb, ${theme.primary} 10%, white)` }}
      >
        {/* صورة الغلاف — aspect-[3/1] مستطيلة عرض-كامل */}
        <div
          className="relative aspect-[3/1] w-full overflow-hidden"
          style={{ backgroundColor: theme.primary }}
        >
          {coverUrl ? (
            <img
              src={coverUrl}
              alt={`غلاف ${displayedSubject}`}
              className="size-full object-cover"
              onError={(e) => {
                // Fallback إذا الملف مفقود: أخفِ الـ img واعرض الـ placeholder.
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          ) : null}
          {/* placeholder overlay — يُعرض دائماً تحت الصورة، يصبح شفاف عند وجود صورة */}
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background: `linear-gradient(135deg, color-mix(in srgb, ${theme.primary} 35%, white), color-mix(in srgb, ${theme.primary} 12%, white))`,
              mixBlendMode: coverUrl ? "multiply" : "normal",
              opacity: coverUrl ? 0.25 : 1,
            }}
          />
          <Icon
            aria-hidden
            className="pointer-events-none absolute -top-4 -left-4 size-40 md:size-48"
            style={{ color: "white", opacity: 0.18 }}
          />
        </div>

        {/* اسم المدرس + المادة + الأرقام — تحت الصورة */}
        <div className="relative flex flex-wrap items-center gap-4 p-6 md:p-8">
          {teacher.avatar_data ? (
            <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-white/60">
              <img
                src={teacher.avatar_data}
                alt={teacherDisplayName(teacher)}
                className="size-full object-cover"
              />
            </span>
          ) : (
            <span
              className="flex size-14 shrink-0 items-center justify-center rounded-2xl"
              style={{
                backgroundColor: `color-mix(in srgb, ${theme.primary} 18%, white)`,
                color: theme.primary,
              }}
            >
              <Icon className="size-7" />
            </span>
          )}
          <div className="min-w-0">
            <h2 className="truncate text-2xl font-black text-foreground md:text-3xl">
              {teacherDisplayName(teacher)}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-black text-white"
                style={{ backgroundColor: theme.primary }}
              >
                <Icon className="size-3.5" />
                {displayedSubject}
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
