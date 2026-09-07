import { AlertTriangle, ClipboardList, Clock, Save, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Panel, StatusBadge } from "@/components/dashboard/StatCard";
import { useCurrentTeacher } from "@/hooks/use-current-teacher";
import {
  getHomeworkAttemptsForLaunch,
  getPendingCorrectionsForTeacher,
  scoreHomeworkAttempt,
  useDataStore,
  type PendingCorrection,
} from "@/lib/data-store";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

import { StudentScoreKeyboard } from "./StudentScoreKeyboard";

/**
 * Migration 0023 / خطة B (B2): "تصحيح الواجبات" — المدرس يصحّح محاولات الطلاب
 * على الإطلاقات الإلكترونية اللي حصّتها انتهت قبل >24 ساعة.
 *
 * - لكل محاولة: لوحة مفاتيح رقمية 0..max، يحفظ بـ `scoreHomeworkAttempt`.
 * - يدعم `due_at` (إن وُجد) يظهر كمؤقت "مضى على التسليم X ساعة".
 */
export function CorrectionPanel({ variant = "session" }: { variant?: "session" | "dashboard" }) {
  const state = useDataStore();
  const teacher = useCurrentTeacher();
  const [scores, setScores] = useState<Record<string, { value: number; max: number }>>({});
  const [openLaunchId, setOpenLaunchId] = useState<string | null>(null);

  const pending = useMemo(
    () => (teacher ? getPendingCorrectionsForTeacher(state, teacher.id) : []),
    [state, teacher],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, PendingCorrection[]>();
    for (const p of pending) {
      const arr = map.get(p.launch.id) ?? [];
      arr.push(p);
      map.set(p.launch.id, arr);
    }
    return Array.from(map.entries());
  }, [pending]);

  if (!teacher) {
    return (
      <Panel title="تصحيح الواجبات" description="يلزم تسجيل الدخول كمدرس">
        <p className="rounded-xl border-2 border-dashed border-border p-6 text-center text-sm font-bold text-muted-foreground">
          لا يوجد مدرس مسجّل دخوله.
        </p>
      </Panel>
    );
  }

  return (
    <Panel
      title="تصحيح الواجبات المعلّقة"
      description="محاولات الطلاب على الإطلاقات الإلكترونية اللي مضى عليها أكثر من 24 ساعة"
      actions={
        <StatusBadge tone={pending.length > 0 ? "warning" : "success"}>
          {pending.length} محاولة معلّقة
        </StatusBadge>
      }
    >
      {grouped.length === 0 ? (
        <p className="rounded-xl border-2 border-dashed border-border p-6 text-center text-sm font-bold text-muted-foreground">
          ممتاز — لا توجد محاولات تحتاج تصحيح. المحاولات تظهر هنا بعد 24 ساعة من التسليم.
        </p>
      ) : (
        <div
          className={cn("space-y-3", variant === "session" ? "max-h-96 overflow-y-auto pr-1" : "")}
        >
          {grouped.map(([launchId, items]) => {
            const launch = items[0]!.launch;
            const attempts = getHomeworkAttemptsForLaunch(state, launchId);
            const isOpen = openLaunchId === launchId;
            return (
              <div key={launchId} className="rounded-xl border-2 border-border bg-background p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <ClipboardList className="size-3.5 text-primary" />
                      <p className="truncate text-sm font-black text-foreground">{launch.title}</p>
                    </div>
                    <p className="mt-1 text-[11px] font-bold text-muted-foreground">
                      أُطلق{" "}
                      {new Date(launch.created_at).toLocaleString("ar-EG", {
                        numberingSystem: "latn",
                      })}
                      {launch.due_at
                        ? ` · يُسلَّم قبل ${new Date(launch.due_at).toLocaleString("ar-EG", { numberingSystem: "latn" })}`
                        : null}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpenLaunchId(isOpen ? null : launchId)}
                    className="rounded-xl border-2 border-primary/40 bg-primary/10 px-3 py-1 text-[11px] font-black text-primary hover:bg-primary/20"
                  >
                    {isOpen ? "إخفاء" : `تصحيح (${formatNumber(attempts.length)})`}
                  </button>
                </div>

                {isOpen ? (
                  <div className="mt-3 space-y-3">
                    {items.map((it) => {
                      const draft = scores[it.attempt.id];
                      const currentValue = draft?.value ?? 0;
                      const maxValue = draft?.max ?? 10;
                      return (
                        <div
                          key={it.attempt.id}
                          className="rounded-xl border-2 border-border bg-canvas/40 p-3"
                        >
                          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                            <p className="min-w-0 truncate text-sm font-black text-foreground">
                              {it.student?.full_name ?? it.attempt.student_name}
                            </p>
                            <div className="flex items-center gap-2">
                              {it.overdue ? (
                                <span className="flex items-center gap-1 rounded-lg border-2 border-destructive/30 bg-destructive/10 px-2 py-0.5 text-[10px] font-black text-destructive">
                                  <AlertTriangle className="size-3" /> متأخر
                                </span>
                              ) : null}
                              <span className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground">
                                <Clock className="size-3" />
                                {hoursAgo(it.attempt.submitted_at)}
                              </span>
                            </div>
                          </div>
                          <StudentScoreKeyboard
                            value={currentValue}
                            max={maxValue}
                            onChange={(v) =>
                              setScores((prev) => ({
                                ...prev,
                                [it.attempt.id]: { value: v, max: maxValue },
                              }))
                            }
                          />
                          <div className="mt-2 flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                setScores((prev) => {
                                  const next = { ...prev };
                                  delete next[it.attempt.id];
                                  return next;
                                })
                              }
                              className="flex items-center gap-1 rounded-lg border-2 border-border px-2 py-1 text-[11px] font-black text-muted-foreground hover:bg-muted"
                            >
                              <Trash2 className="size-3" /> مسح
                            </button>
                            <button
                              type="button"
                              disabled={currentValue === 0 && !it.attempt.score}
                              onClick={() => {
                                scoreHomeworkAttempt(it.attempt.id, currentValue, maxValue);
                                toast.success(
                                  `تم تصحيح ${it.student?.full_name ?? it.attempt.student_name}: ${currentValue}/${maxValue}`,
                                );
                                setScores((prev) => {
                                  const next = { ...prev };
                                  delete next[it.attempt.id];
                                  return next;
                                });
                              }}
                              className="flex items-center gap-1 rounded-lg bg-navy px-3 py-1 text-[11px] font-black text-navy-foreground hover:opacity-90 disabled:opacity-40"
                            >
                              <Save className="size-3" /> حفظ
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

function hoursAgo(iso: string): string {
  const ms = Date.now() - Date.parse(iso);
  if (!Number.isFinite(ms)) return "—";
  const hours = Math.floor(ms / (60 * 60 * 1000));
  if (hours < 1) return "الآن";
  if (hours < 24) return `منذ ${hours} ساعة`;
  const days = Math.floor(hours / 24);
  return `منذ ${days} يوم`;
}
