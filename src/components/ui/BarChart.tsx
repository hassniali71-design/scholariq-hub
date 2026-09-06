import { cn } from "@/lib/utils";

/**
 * شريط قياس أفقي ملوّن حسب القيمة (0..100).
 * tone: success (≥ 80 أخضر), warning (60-80 أصفر), destructive (< 60 أحمر).
 */
export function BarChart({
  value,
  tone,
  className,
  showLabel = true,
}: {
  value: number;
  tone?: "success" | "warning" | "destructive" | "primary";
  className?: string;
  showLabel?: boolean;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const autoTone: "success" | "warning" | "destructive" =
    clamped >= 80 ? "success" : clamped >= 60 ? "warning" : "destructive";
  const finalTone = tone ?? autoTone;
  const colors: Record<string, string> = {
    success: "bg-success",
    warning: "bg-warning",
    destructive: "bg-destructive",
    primary: "bg-primary",
  };
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="h-2 flex-1 overflow-hidden rounded-full border border-border bg-muted">
        <div
          className={cn("h-full transition-all", colors[finalTone])}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showLabel ? (
        <span
          className={cn(
            "min-w-[3ch] text-end text-xs font-black tabular-nums",
            finalTone === "success"
              ? "text-success"
              : finalTone === "warning"
                ? "text-warning"
                : finalTone === "destructive"
                  ? "text-destructive"
                  : "text-primary",
          )}
        >
          {Math.round(clamped)}٪
        </span>
      ) : null}
    </div>
  );
}
