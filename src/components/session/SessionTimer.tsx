import { Pause, Play, RotateCcw } from "lucide-react";

import { formatClock } from "@/lib/format";
import { cn } from "@/lib/utils";

interface SessionTimerProps {
  remaining: number;
  running: boolean;
  progress: number;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  size?: "lg" | "xl";
}

/** Oversized countdown built for smart interactive displays. */
export function SessionTimer({
  remaining,
  running,
  progress,
  onStart,
  onPause,
  onReset,
  size = "lg",
}: SessionTimerProps) {
  const danger = remaining <= 30;

  return (
    <div className="flex flex-col items-center gap-4">
      <p
        className={cn(
          "kpi-number tabular-nums",
          size === "xl" ? "text-7xl md:text-9xl" : "text-6xl md:text-7xl",
          danger && "text-destructive",
        )}
      >
        {formatClock(remaining)}
      </p>

      <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-1000 ease-linear",
            danger ? "bg-destructive" : "bg-primary",
          )}
          style={{ width: `${Math.min(progress * 100, 100)}%` }}
        />
      </div>

      <div className="flex items-center gap-2">
        {running ? (
          <button
            onClick={onPause}
            className="flex items-center gap-2 rounded-xl border-2 border-border px-5 py-3 text-sm font-black hover:border-primary"
          >
            <Pause className="size-5" /> إيقاف مؤقت
          </button>
        ) : (
          <button
            onClick={onStart}
            className="flex items-center gap-2 rounded-xl bg-navy px-6 py-3 text-sm font-black text-navy-foreground hover:opacity-90"
          >
            <Play className="size-5" /> تشغيل التايمر
          </button>
        )}
        <button
          onClick={onReset}
          className="flex items-center gap-2 rounded-xl border-2 border-border px-5 py-3 text-sm font-black hover:border-primary"
        >
          <RotateCcw className="size-5" /> إعادة
        </button>
      </div>
    </div>
  );
}
