import { StatusBadge } from "@/components/dashboard/StatCard";
import { LessonLinkCard } from "@/components/curriculum/LessonLinkCard";
import { formatNumber, formatPercent } from "@/lib/format";
import type { CurriculumLesson, CurriculumUnit, Lesson } from "@/types";

const statusMeta: Record<
  CurriculumLesson["status"],
  { text: string; tone: "success" | "warning" | "neutral" }
> = {
  not_started: { text: "لم يبدأ", tone: "neutral" },
  in_progress: { text: "قيد التنفيذ", tone: "warning" },
  done: { text: "تم", tone: "success" },
};

/** One `CurriculumUnit` and its planned lessons — a pure read/derived view, no logic (§9-ب). */
export function UnitTree({
  unit,
  lessons,
  findLinkedLesson,
}: {
  unit: CurriculumUnit;
  lessons: CurriculumLesson[];
  findLinkedLesson: (lessonId: string) => Lesson | undefined;
}) {
  const done = lessons.filter((l) => l.status === "done").length;
  const progress = lessons.length > 0 ? Math.round((done / lessons.length) * 100) : 0;

  return (
    <div className="rounded-xl border-2 border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-black text-foreground">{unit.name}</p>
          <p className="text-xs font-bold text-muted-foreground">
            المدة المخططة: {formatNumber(unit.planned_duration_days)} يوم
          </p>
        </div>
        <StatusBadge tone={progress === 100 ? "success" : "primary"}>
          {formatNumber(done)} / {formatNumber(lessons.length)} — {formatPercent(progress)}
        </StatusBadge>
      </div>
      <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
      </div>

      <div className="mt-4 space-y-3">
        {lessons.map((l) => {
          const meta = statusMeta[l.status];
          const linked = l.linked_lesson_id ? findLinkedLesson(l.linked_lesson_id) : undefined;
          return (
            <div key={l.id} className="rounded-lg border-2 border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-extrabold text-foreground">{l.title}</p>
                <StatusBadge tone={meta.tone}>{meta.text}</StatusBadge>
              </div>
              {linked ? <LessonLinkCard lesson={linked} /> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
