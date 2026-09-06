import { Award, Megaphone, Send, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  sendTeacherMessage,
  useDataStore,
} from "@/lib/data-store";
import { cn } from "@/lib/utils";
import type { Student } from "@/types";

/* ---------------- Awards & Alerts data (4 وسام + 3 أنواع تنبيه) ---------------- */

const AWARDS: { key: string; label: string; emoji: string; defaultText: (name: string) => string }[] = [
  {
    key: "star_of_week",
    label: "نجم الأسبوع",
    emoji: "🏅",
    defaultText: (n) =>
      `🌟 ${n}، مبروك! أنت نجم هذا الأسبوع — استمر على هذا المستوى المميز.`,
  },
  {
    key: "best_improvement",
    label: "أفضل تحسن",
    emoji: "📈",
    defaultText: (n) => `🚀 ${n}، تحسنك ملحوظ جداً — كل الشغل بدأ يؤتي ثماره، فخورين بك.`,
  },
  {
    key: "genius_solver",
    label: "عبقري الحل",
    emoji: "💡",
    defaultText: (n) =>
      `💡 ${n}، إجابتك كانت عبقرية — طريقة تفكيرك مختلفة ومبدعة، نحب نطوّرها معاك.`,
  },
  {
    key: "precision",
    label: "دقة عالية",
    emoji: "🎯",
    defaultText: (n) =>
      `🎯 ${n}، حضورك 100% ودرجاتها فوق 90% — دقة عالية في الالتزام والأداء، أحسنت.`,
  },
];

const ALERTS: { key: string; label: string; emoji: string; defaultText: (name: string) => string }[] = [
  {
    key: "contact_guardian",
    label: "تواصل مع ولي الأمر",
    emoji: "📞",
    defaultText: (n) =>
      `ولي أمر ${n} المحترم/ة، نود التنسيق معكم بخصوص مستوى الطالب/ة في آخر الحصص.`,
  },
  {
    key: "one_on_one",
    label: "حديث فردي مع الطالب",
    emoji: "💬",
    defaultText: (n) =>
      `${n}، محتاج/ة نتكلم شوية بعد الحصة عن بعض النقاط اللي هنحسّنها سوا.`,
  },
  {
    key: "internal_note",
    label: "ملاحظة داخلية",
    emoji: "📝",
    defaultText: (n) =>
      `ملاحظة: الطالب/ة ${n} يحتاج متابعة إضافية في الأسبوع القادم.`,
  },
];

/* ---------------- Component ---------------- */

/**
 * لوحة الأوسمة + التنبيهات.
 * - للمتفوقين → اختيار وسام من 4، يُرسَل مع نص تشجيعي (قابل للتعديل).
 * - للضعفاء → لا أوسمة إطلاقاً؛ فقط تنبيهات (3 أنواع).
 * - العزل: الطلاب يأتون من `visibleStudents` (مفلترين بالمجموعة) — المدرس لا يرى إلا طلابه.
 */
export function AwardsAndAlertsPanel({
  teacherId,
  students,
}: {
  teacherId: string;
  students: Student[];
}) {
  const state = useDataStore();
  const [openStudent, setOpenStudent] = useState<Student | null>(null);

  if (students.length === 0) return null;

  // التصنيف: حسب `classifyStudent` (مُعرَّف في data-store)
  // المتفوق: avg_score >= 85 وحضور >= 90 — هذا تبسيط للـ seed.
  const excellent = students.filter((s) => s.avg_score >= 85 && s.attendance_rate >= 90);
  const weak = students.filter((s) => s.avg_score < 60 || s.attendance_rate < 70);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-2">
        {/* Oسممة — للمتفوقين فقط */}
        <div className="rounded-2xl border-2 border-success/30 bg-success/5 p-4">
          <p className="mb-3 flex items-center gap-2 text-sm font-black text-success">
            <Award className="size-4" /> أوسمة تشجيعية للطلاب المتفوقين
          </p>
          {excellent.length === 0 ? (
            <p className="rounded-xl border-2 border-dashed border-border p-4 text-center text-xs font-bold text-muted-foreground">
              لا يوجد طلاب متفوقون في هذه المجموعة حالياً.
            </p>
          ) : (
            <div className="space-y-1.5">
              {excellent.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setOpenStudent(s)}
                  className="flex w-full items-center justify-between rounded-xl border-2 border-success/30 bg-background p-2 text-right text-xs font-black transition-colors hover:border-success"
                >
                  <span className="flex items-center gap-2">
                    <span>🏅</span>
                    <span>{s.full_name}</span>
                  </span>
                  <span className="text-success">إرسال وسام</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* تنبيهات — للضعفاء فقط (لا أوسمة) */}
        <div className="rounded-2xl border-2 border-warning/30 bg-warning/5 p-4">
          <p className="mb-3 flex items-center gap-2 text-sm font-black text-warning">
            <Megaphone className="size-4" /> تنبيهات للطلاب الذين يحتاجون متابعة
          </p>
          {weak.length === 0 ? (
            <p className="rounded-xl border-2 border-dashed border-border p-4 text-center text-xs font-bold text-muted-foreground">
              لا يوجد طلاب يحتاجون متابعة في هذه المجموعة.
            </p>
          ) : (
            <div className="space-y-1.5">
              {weak.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setOpenStudent(s)}
                  className="flex w-full items-center justify-between rounded-xl border-2 border-warning/30 bg-background p-2 text-right text-xs font-black transition-colors hover:border-warning"
                >
                  <span className="flex items-center gap-2">
                    <span>📣</span>
                    <span>{s.full_name}</span>
                  </span>
                  <span className="text-warning">إرسال تنبيه</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {openStudent ? (
        <MessageModal
          student={openStudent}
          isExcellent={excellent.some((s) => s.id === openStudent.id)}
          onClose={() => setOpenStudent(null)}
          onSend={(body, kind) => {
            sendTeacherMessage(openStudent.id, body, kind, teacherId);
            toast.success(kind === "award" ? "تم إرسال الوسام" : "تم إرسال التنبيه");
            setOpenStudent(null);
          }}
        />
      ) : null}
    </div>
  );
}

function MessageModal({
  student,
  isExcellent,
  onClose,
  onSend,
}: {
  student: Student;
  isExcellent: boolean;
  onClose: () => void;
  onSend: (body: string, kind: "award" | "alert") => void;
}) {
  const options = isExcellent ? AWARDS : ALERTS;
  const kind: "award" | "alert" = isExcellent ? "award" : "alert";
  const [optionIdx, setOptionIdx] = useState(0);
  // تهيئة لمرة واحدة عند فتح المودال فقط — تغيير الاختيار بعد كده بيحدّث body صراحةً
  // من onClick تحت. لو حطناها كشرط "لو body فاضي" داخل الـ render، أي مسح كامل يدوي
  // للنص من المدرس كان بيترجع النص الافتراضي تلقائياً فوراً، فمستحيل يبعت رسالة فاضية
  // أو معدَّلة بالكامل.
  const [body, setBody] = useState(() => options[0]?.defaultText(student.full_name) ?? "");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border-2 border-border bg-background p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3
            className={cn(
              "text-lg font-black",
              isExcellent ? "text-success" : "text-warning",
            )}
          >
            {isExcellent ? "🏅 إرسال وسام" : "📣 إرسال تنبيه"} — {student.full_name}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="size-4" />
          </button>
        </div>

        <p className="mb-2 text-xs font-black text-muted-foreground">
          {isExcellent ? "اختر الوسام" : "اختر نوع التنبيه"}
        </p>
        <div className="mb-3 flex flex-wrap gap-2">
          {options.map((o, i) => (
            <button
              key={o.key}
              type="button"
              onClick={() => {
                setOptionIdx(i);
                setBody(o.defaultText(student.full_name));
              }}
              className={cn(
                "rounded-xl border-2 px-3 py-2 text-xs font-black transition-colors",
                optionIdx === i
                  ? isExcellent
                    ? "border-success bg-success/15 text-success"
                    : "border-warning bg-warning/15 text-warning"
                  : "border-border bg-background text-foreground hover:border-primary",
              )}
            >
              {o.emoji} {o.label}
            </button>
          ))}
        </div>

        <p className="mb-1 text-xs font-black text-muted-foreground">النص (قابل للتعديل)</p>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          maxLength={500}
          className="w-full rounded-xl border-2 border-border bg-background p-2 text-sm font-bold outline-none focus:border-primary"
        />
        <p className="mt-1 text-end text-[11px] font-bold text-muted-foreground">
          {body.length}/500
        </p>

        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border-2 border-border px-4 py-2 text-sm font-black text-foreground hover:bg-muted"
          >
            إلغاء
          </button>
          <button
            type="button"
            disabled={!body.trim()}
            onClick={() => onSend(body, kind)}
            className={cn(
              "flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-black text-white transition-opacity hover:opacity-90 disabled:opacity-40",
              isExcellent ? "bg-success" : "bg-warning",
            )}
          >
            <Send className="size-4" /> إرسال
          </button>
        </div>
      </div>
    </div>
  );
}
