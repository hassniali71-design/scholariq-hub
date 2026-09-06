import { BarChart3 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Panel } from "@/components/dashboard/StatCard";
import { StudentScoreKeyboard } from "@/components/teacher/StudentScoreKeyboard";
import { recordAssessmentScore, useDataStore } from "@/lib/data-store";
import { cn } from "@/lib/utils";
import type { AssessmentScore, Student } from "@/types";

type Category = AssessmentScore["category"];

/** كل أنواع التقييم ما عدا «واجب الويب سايت» (e_homework) — يُرصد إلكترونياً. */
const CATEGORIES: { key: Category; label: string; color: string }[] = [
  { key: "homework", label: "الواجب", color: "bg-primary" },
  { key: "activity", label: "نشاط داخل الحصة", color: "bg-success" },
  { key: "question", label: "سؤال شفوي", color: "bg-info" },
  { key: "behavior", label: "السلوك", color: "bg-warning" },
  { key: "other", label: "أخرى", color: "bg-navy" },
];

/**
 * البند 3 — جدول التقييمات الموحّد الكبير.
 * كارت واحد لكل طلاب المجموعة + فلتر نوع التقييم (بما فيه السلوك و«أخرى»).
 * الضغط على اسم الطالب يفتح لوحة المفاتيح الثابتة، وكل رقم مرصود
 * يظهر فوراً كشريط ملوّن (Bar) بطول نسبة الدرجة.
 */
export function AssessmentsTable({
  students,
  teacherId,
  sessionId,
  lessonId,
}: {
  students: Student[];
  teacherId: string;
  sessionId: string;
  lessonId: string | null;
}) {
  const state = useDataStore();
  const [category, setCategory] = useState<Category>("homework");
  const [openStudentId, setOpenStudentId] = useState<string | null>(null);
  const [draft, setDraft] = useState(0);

  const active = CATEGORIES.find((c) => c.key === category)!;

  const scoreOf = useMemo(() => {
    const map = new Map<string, AssessmentScore>();
    for (const s of state.assessmentScores) {
      if (s.category !== category) continue;
      if (lessonId && s.lesson_id && s.lesson_id !== lessonId) continue;
      const prev = map.get(s.student_id);
      if (!prev || s.recorded_at > prev.recorded_at) map.set(s.student_id, s);
    }
    return map;
  }, [state.assessmentScores, category, lessonId]);

  return (
    <Panel
      title="التقييمات — طلاب المجموعة"
      description="اختر نوع التقييم، ثم اضغط على اسم الطالب لتظهر لوحة المفاتيح ورصد الدرجة."
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-black text-muted-foreground">نوع التقييم:</span>
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => {
              setCategory(c.key);
              setOpenStudentId(null);
            }}
            className={cn(
              "rounded-lg border-2 px-3 py-1.5 text-xs font-black transition-colors",
              category === c.key
                ? "border-navy bg-navy text-navy-foreground"
                : "border-border hover:border-primary",
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
        {students.length === 0 ? (
          <p className="rounded-xl border-2 border-dashed border-border p-6 text-center text-sm font-bold text-muted-foreground">
            لا يوجد طلاب في هذه المجموعة بعد.
          </p>
        ) : (
          students.map((s) => {
            const rec = scoreOf.get(s.id);
            const value = rec?.value ?? null;
            const max = rec?.max_value ?? 10;
            const open = openStudentId === s.id;
            return (
              <div key={s.id} className="rounded-xl border-2 border-border bg-background p-3">
                <button
                  type="button"
                  onClick={() => {
                    setOpenStudentId(open ? null : s.id);
                    setDraft(value ?? 0);
                  }}
                  className="flex w-full items-center justify-between gap-3 text-right"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-black text-foreground">{s.full_name}</span>
                    <span className="mt-1.5 block h-3 w-full overflow-hidden rounded-full bg-muted">
                      <span
                        className={cn("block h-full rounded-full transition-all", active.color)}
                        style={{ width: value === null ? "0%" : `${(value / max) * 100}%` }}
                      />
                    </span>
                  </span>
                  <span
                    className={cn(
                      "flex items-center gap-1 rounded-lg border-2 px-2.5 py-1 text-xs font-black",
                      value === null
                        ? "border-border text-muted-foreground"
                        : "border-navy text-navy",
                    )}
                  >
                    <BarChart3 className="size-3.5" />
                    {value === null ? "بدون" : `${value} / ${max}`}
                  </span>
                </button>

                {open ? (
                  <div className="mt-3 space-y-2">
                    <StudentScoreKeyboard value={draft} onChange={setDraft} min={0} max={10} />
                    <button
                      type="button"
                      onClick={() => {
                        recordAssessmentScore({
                          studentId: s.id,
                          teacherId,
                          category,
                          source: "manual",
                          value: draft,
                          maxValue: 10,
                          sessionId,
                          lessonId,
                        });
                        setOpenStudentId(null);
                        toast.success(`تم رصد ${active.label} للطالب ${s.full_name}: ${draft}/10`);
                      }}
                      className="w-full rounded-xl bg-navy py-2 text-xs font-black text-navy-foreground hover:opacity-90"
                    >
                      حفظ الدرجة
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </Panel>
  );
}
