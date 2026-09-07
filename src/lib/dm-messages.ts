import type { CenterNotification } from "@/types";

/**
 * رسائل حقيقية بين الطالب والمدرس — بدون جدول جديد ولا نموذج Threads معقّد،
 * بنفس نمط `OWNER_NOTE_KIND` في OwnerNotesCard.tsx (kind نصي بادئته تحدد
 * الأطراف)، مطبَّق هنا لزوج طالب/مدرس + اتجاه المرسل. "زي شات الفيس" بالظبط
 * كما طُلب — بدون Schema مخصّص للمحادثات.
 */
const DM_KIND_PREFIX = "dm";

export type DmSender = "student" | "teacher";

export function buildDmKind(studentId: string, teacherId: string, sender: DmSender): string {
  return `${DM_KIND_PREFIX}:${studentId}:${teacherId}:${sender}`;
}

export interface ParsedDmKind {
  studentId: string;
  teacherId: string;
  sender: DmSender;
}

export function parseDmKind(kind: string): ParsedDmKind | null {
  const parts = kind.split(":");
  if (parts.length !== 4 || parts[0] !== DM_KIND_PREFIX) return null;
  const [, studentId, teacherId, sender] = parts;
  if (sender !== "student" && sender !== "teacher") return null;
  return { studentId: studentId!, teacherId: teacherId!, sender };
}

/** رسائل زوج طالب/مدرس معيّن، مرتَّبة زمنياً (الأقدم أولاً). */
export function getDmThread(
  notifications: CenterNotification[],
  studentId: string,
  teacherId: string,
): CenterNotification[] {
  return notifications
    .filter((n) => {
      const parsed = parseDmKind(n.kind);
      return parsed?.studentId === studentId && parsed.teacherId === teacherId;
    })
    .sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
}
