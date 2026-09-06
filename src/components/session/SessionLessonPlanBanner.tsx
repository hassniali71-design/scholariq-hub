import { BookCheck, ScrollText } from "lucide-react";

import { getLessonPlansForGroup, markLessonPlanState, useDataStore } from "@/lib/data-store";
import { cn } from "@/lib/utils";

/**
 * بانر يظهر داخل وضع الحصة — يُذكّر المدرس بخطط الدروس التي لم يُتمّمها بعد
 * لمجموعته الحالية. يعرض أول خطة معلّقة (لم تُعلَّم) مع زر "تعليم كـ تم تدريسه".
 */
export function SessionLessonPlanBanner({
  groupId,
  teacherId,
}: {
  groupId: string;
  teacherId: string;
}) {
  const state = useDataStore();
  const plans = getLessonPlansForGroup(state, teacherId, groupId);
  const pending = plans.find((p) => !p.taught_done);
  if (!pending) return null;

  return (
    <div
      className={cn(
        "mb-3 flex items-start gap-3 rounded-xl border-2 border-primary/40 bg-primary/5 p-3",
      )}
    >
      <ScrollText className="mt-0.5 size-4 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-black tracking-wide text-primary">خطة الدرس المعلّقة</p>
        <p className="truncate text-sm font-black text-foreground">{pending.lesson_name}</p>
        {pending.unit ? (
          <p className="truncate text-[11px] font-bold text-muted-foreground">
            الوحدة: {pending.unit}
          </p>
        ) : null}
        {pending.notes ? (
          <p className="mt-1 truncate text-[11px] font-bold text-muted-foreground">
            📝 {pending.notes}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => {
          markLessonPlanState(pending.id, "taught", true);
        }}
        className="flex shrink-0 items-center gap-1 rounded-lg bg-success px-2 py-1 text-[11px] font-black text-white transition-opacity hover:opacity-90"
      >
        <BookCheck className="size-3" /> تم التدريس
      </button>
    </div>
  );
}
