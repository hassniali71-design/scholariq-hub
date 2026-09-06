import { Pause, Play, RotateCcw, Timer } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Panel } from "@/components/dashboard/StatCard";
import { cn } from "@/lib/utils";

/**
 * Migration 0023 / خطة C (C9): تايمر حر للحصة — المدرس يدخل المدة
 * (مثلاً 15د للشرح، 5د للنشاط) → يبدأ العد التنازلي. "تجاوز الوقت"
 * تظهر كـ info خفيف (غير ملزم) — التايمر يستمر عداداً تصاعدياً بعد
 * الصفر.
 */
export function SessionFreeTimer() {
  const [minutes, setMinutes] = useState(15);
  const [remaining, setRemaining] = useState(15 * 60);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(() => {
      setRemaining((r) => Math.max(r - 1, -1 * 60 * 60));
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running]);

  const handleStartMinutes = (m: number) => {
    setMinutes(m);
    setRemaining(m * 60);
    setRunning(false);
  };

  const handleReset = () => {
    setRunning(false);
    setRemaining(minutes * 60);
  };

  const overtime = remaining < 0;
  const absSeconds = Math.abs(remaining);
  const displayMin = Math.floor(absSeconds / 60);
  const displaySec = absSeconds % 60;
  const timeLabel = `${String(displayMin).padStart(2, "0")}:${String(displaySec).padStart(2, "0")}`;

  return (
    <Panel title="تايمر الحصة الحر" description="للتنظيم الذاتي — ليس ملزماً">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Timer className="size-4 text-primary" />
            <span className="text-xs font-black text-muted-foreground">مدة (د):</span>
            {[5, 10, 15, 20, 30, 45].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => handleStartMinutes(m)}
                className={cn(
                  "rounded-lg border-2 px-2 py-1 text-[11px] font-black",
                  minutes === m
                    ? "border-navy bg-navy text-navy-foreground"
                    : "border-border bg-background text-foreground hover:border-primary",
                )}
              >
                {m}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setRunning((r) => !r)}
              className={cn(
                "flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-black",
                running
                  ? "bg-warning/15 text-warning hover:bg-warning/25"
                  : "bg-success/15 text-success hover:bg-success/25",
              )}
            >
              {running ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
              {running ? "إيقاف" : "ابدأ"}
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1 rounded-xl border-2 border-border bg-background px-3 py-1.5 text-xs font-black text-foreground hover:bg-muted"
            >
              <RotateCcw className="size-3.5" /> تصفير
            </button>
          </div>
        </div>

        <div
          className={cn(
            "rounded-xl border-2 p-6 text-center",
            overtime
              ? "border-warning/50 bg-warning/10"
              : "border-border bg-canvas/40",
          )}
        >
          <p
            className={cn(
              "kpi-number",
              overtime ? "text-warning" : "text-foreground",
              "text-5xl md:text-6xl",
            )}
          >
            {overtime ? `+${timeLabel}` : timeLabel}
          </p>
          {overtime ? (
            <p className="mt-2 text-xs font-black text-warning">
              ⏰ تجاوز الوقت — أكمل على راحتك
            </p>
          ) : (
            <p className="mt-2 text-xs font-bold text-muted-foreground">
              متبقي من {minutes} دقيقة
            </p>
          )}
        </div>
      </div>
    </Panel>
  );
}
