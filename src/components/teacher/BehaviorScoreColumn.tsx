import { useState } from "react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/dashboard/StatCard";
import { useCurrentTeacher } from "@/hooks/use-current-teacher";
import { getAssessmentScore, recordBehaviorScore, useDataStore } from "@/lib/data-store";
import { cn } from "@/lib/utils";
import type { Student } from "@/types";

import { StudentScoreKeyboard } from "./StudentScoreKeyboard";

/**
 * Migration 0023 / خطة المرحلة B (B5/B6): عمود "السلوك" قابل للتعديل —
 * المدرس يضغط على خانة الطالب فتظهر لوحة مفاتيح رقمية (0..10).
 * يُحفظ في `assessment_scores` بفئة `behavior` — نفس النمط الموجود
 * للـ `homework`/`activity` في `recordAssessmentScore`.
 */
export function BehaviorScoreColumn({
  students,
  showKeyboard = true,
  compact = false,
}: {
  students: Student[];
  showKeyboard?: boolean;
  compact?: boolean;
}) {
  const state = useDataStore();
  const teacher = useCurrentTeacher();
  const [openFor, setOpenFor] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  return (
    <div className="space-y-1.5">
      {students.map((s) => {
        const score = getAssessmentScore(state, s.id, "behavior");
        const current = score?.value ?? 0;
        const isOpen = openFor === s.id;
        return (
          <div
            key={s.id}
            className={cn(
              "rounded-xl border-2 p-2",
              score ? "border-success/30 bg-success/5" : "border-border bg-background",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="min-w-0 flex-1 truncate text-xs font-black text-foreground">
                {s.full_name}
              </p>
              <button
                type="button"
                onClick={() => setOpenFor(isOpen ? null : s.id)}
                disabled={!teacher}
                className="shrink-0"
                aria-label="تعديل درجة السلوك"
              >
                {score ? (
                  <StatusBadge tone="success">{current}/10</StatusBadge>
                ) : (
                  <StatusBadge tone="neutral">لم يُقيَّم</StatusBadge>
                )}
              </button>
            </div>
            {isOpen && showKeyboard ? (
              <div className="mt-2">
                <StudentScoreKeyboard
                  value={current}
                  onChange={(next) => {
                    if (!teacher) return;
                    setBusyId(s.id);
                    try {
                      recordBehaviorScore(s.id, teacher.id, next, 10);
                      if (next === 0) toast.success(`تم مسح درجة السلوك لـ ${s.full_name}`);
                      else toast.success(`سلوك ${s.full_name}: ${next}/10`);
                    } finally {
                      setBusyId(null);
                    }
                  }}
                />
              </div>
            ) : null}
            {compact && score ? (
              <p className="mt-1 text-[10px] font-bold text-muted-foreground">
                {new Date(score.recorded_at).toLocaleDateString("ar-EG", { numberingSystem: "latn" })}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
