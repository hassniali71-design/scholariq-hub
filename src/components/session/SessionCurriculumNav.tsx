import { curriculumLessonStatusMeta } from "@/components/curriculum/UnitTree";
import { StatusBadge } from "@/components/dashboard/StatCard";
import { cn } from "@/lib/utils";
import type { CurriculumLesson, CurriculumUnit } from "@/types";

/**
 * CURRICULUM_ENGINE_SPEC.md §13-ب — the curriculum column inside session mode.
 * A compact, clickable variant of `UnitTree` (kept separate from it rather than
 * adding an optional "clickable" mode there, so `teacher.curriculum.tsx`'s
 * already-working read-only display stays untouched). Units → lessons only —
 * exams (§12) are still explicitly deferred, not shown here.
 */
export function SessionCurriculumNav({
  units,
  getLessonsForUnit,
  selectedCurriculumLessonId,
  onSelect,
}: {
  units: CurriculumUnit[];
  getLessonsForUnit: (unitId: string) => CurriculumLesson[];
  selectedCurriculumLessonId: string | null;
  onSelect: (curriculumLessonId: string) => void;
}) {
  if (units.length === 0) {
    return (
      <p className="py-6 text-center text-xs font-bold text-muted-foreground">
        لا توجد خطة منهج مضافة لهذه المادة بعد
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {units.map((unit) => (
        <div key={unit.id}>
          <p className="mb-2 truncate text-xs font-black text-muted-foreground">{unit.name}</p>
          <div className="space-y-1.5">
            {getLessonsForUnit(unit.id).map((cl) => {
              const meta = curriculumLessonStatusMeta[cl.status];
              const selected = cl.id === selectedCurriculumLessonId;
              return (
                <button
                  key={cl.id}
                  type="button"
                  onClick={() => onSelect(cl.id)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-lg border-2 px-3 py-2 text-right text-xs font-black transition-colors",
                    selected
                      ? "border-navy bg-navy text-navy-foreground"
                      : "border-border hover:border-primary",
                  )}
                >
                  <span className="truncate">{cl.title}</span>
                  <StatusBadge tone={selected ? "neutral" : meta.tone}>{meta.text}</StatusBadge>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
