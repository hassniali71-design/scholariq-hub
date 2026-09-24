import { Quote } from "lucide-react";

import { AvatarUpload } from "@/components/shared/AvatarUpload";
import { formatNumber } from "@/lib/format";
import { getTodayQuote } from "@/lib/daily-quotes";
import { subjectDisplayName, teacherDisplayName } from "@/lib/teacher-identity";
import type { SubjectTheme } from "@/lib/subject-themes";
import type { Teacher } from "@/types";

interface SubjectRoomHeaderProps {
  teacher: Pick<Teacher, "honorific" | "full_name" | "avatar_data">;
  subjectName: string;
  themeKey: string | undefined;
  theme: SubjectTheme;
  groupsCount: number;
  studentsCount: number;
  /** عبارة المادة التي أطلقها المالك (Migration 0033) — لها أولوية على اقتباس اليوم الثابت. */
  ownerQuote?: string | null | undefined;
  /** رفع صورة المدرس الشخصية — نفس منطق صورة الطالب بالضبط، بلا أغلفة جاهزة. */
  onAvatarUpload: (dataUrl: string, mime: string) => void;
}

/**
 * "غرفة المادة" — كارت واحد: صورة المدرس الشخصية (يرفعها بنفسه، بنفس منطق صورة
 * الطالب تماماً — لا صور أغلفة جاهزة لكل مادة، كانت أصلاً تعتمد على ملفات ثابتة
 * غير موجودة فعلياً لأي مدرس حقيقي) + اسمه + المادة + الأرقام، كلهم مع بعض بدل
 * ما يكون اسم المدرس منفصل كـheader فوق الصفحة (AppShell.title) وصورته منفصلة
 * تحت في مكان تاني.
 */
export function SubjectRoomHeader({
  teacher,
  subjectName,
  themeKey,
  theme,
  groupsCount,
  studentsCount,
  ownerQuote,
  onAvatarUpload,
}: SubjectRoomHeaderProps) {
  const Icon = theme.icon;
  const quote = ownerQuote?.trim() || getTodayQuote(themeKey);
  const displayedSubject = subjectDisplayName(subjectName);

  return (
    <div className="space-y-4">
      <div
        className="relative overflow-hidden rounded-2xl p-6 md:p-8"
        style={{
          background: `linear-gradient(135deg, color-mix(in srgb, ${theme.primary} 22%, white), color-mix(in srgb, ${theme.primary} 8%, white))`,
        }}
      >
        <Icon
          aria-hidden
          className="pointer-events-none absolute -top-6 -left-6 size-40 md:size-48"
          style={{ color: theme.primary, opacity: 0.15 }}
        />
        {/* صورة المدرس + اسمه + المادة + الأرقام — كلهم في نفس الكارت */}
        <div className="relative flex flex-wrap items-center gap-5">
          <AvatarUpload
            imageData={teacher.avatar_data}
            alt={teacherDisplayName(teacher)}
            sizeClass="size-24 md:size-28"
            onUpload={onAvatarUpload}
          />
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
            <p className="mt-2 text-xs font-bold text-muted-foreground">
              اضغط على أيقونة الكاميرا لتحديث صورتك — تظهر للطلاب في صفحة "مدرّسيني".
            </p>
          </div>
        </div>
      </div>

      {quote ? (
        <div className="flex items-start gap-3 rounded-xl border-2 border-border bg-background p-4 md:p-5">
          <Quote className="size-5 shrink-0 text-muted-foreground md:size-6" />
          <p className="text-base font-extrabold text-foreground md:text-lg">{quote}</p>
        </div>
      ) : null}
    </div>
  );
}
