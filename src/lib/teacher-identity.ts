import type { Teacher } from "@/types";

/**
 * صيغة المخاطبة: "مستر" / "آنسة" / "مس" — بالعربية فقط (اللغة موحَّدة لكل المراكز).
 * مدرس اللغة الإنجليزية اسمه "Mr John" مكافئ لـ "مستر/آنسة" في الـ UI الموحَّد.
 * القاعدة: الـ default هو "مستر" (mr). عند الحاجة لتمييز الجنس فيمكن تعديله.
 */
export function teacherHonorific(teacher: Pick<Teacher, "honorific" | "full_name">): string {
  const h = teacher.honorific ?? "mr";
  if (h === "miss") return "آنسة";
  if (h === "mrs") return "مس";
  return "مستر";
}

/**
 * الاسم المعروض = "مستر [الاسم]".
 * الاستخدام: في كل مكان يعرض اسم المدرس (teacher.index, SubjectRoomHeader, schedule, إلخ).
 */
export function teacherDisplayName(teacher: Pick<Teacher, "honorific" | "full_name">): string {
  // إذا كان الاسم أصلاً يبدأ بـ "Mr" أو "مستر" أو "م."، لا نضيف صيغة أخرى.
  const raw = teacher.full_name?.trim() ?? "";
  if (!raw) return `${teacherHonorific(teacher)} (بدون اسم)`;
  if (/^(مستر|آنسة|مس|م\.|Mr|Miss|Mrs)\b/.test(raw)) return raw;
  return `${teacherHonorific(teacher)} ${raw}`;
}

/** المادة بصيغة العرض: "عربي" (افتراضي) — يستخدم subject.name كما هو. */
export function subjectDisplayName(subjectName: string | undefined | null): string {
  if (!subjectName) return "مادة";
  // "إنجليزي" -> "إنجلش" (تخصيص صريح حسب طلب المستخدم)
  if (subjectName.trim() === "إنجليزي") return "إنجلش";
  return subjectName;
}
