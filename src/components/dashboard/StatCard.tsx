import type { LucideIcon } from "lucide-react";
import { TrendingDown, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  /** e.g. "+12٪ عن الشهر الماضي" */
  trend?: string;
  trendDirection?: "up" | "down";
  tone?: "primary" | "success" | "warning" | "destructive";
}

const toneRing: Record<NonNullable<StatCardProps["tone"]>, string> = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/15 text-warning",
  destructive: "bg-destructive/10 text-destructive",
};

export function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  trendDirection = "up",
  tone = "primary",
}: StatCardProps) {
  return (
    <div className="card-crisp p-5 transition-shadow hover:shadow-lift">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-extrabold text-muted-foreground">{label}</p>
        <span className={cn("flex size-10 items-center justify-center rounded-xl", toneRing[tone])}>
          <Icon className="size-5" />
        </span>
      </div>
      <p className="kpi-number mt-4 text-3xl md:text-4xl">{value}</p>
      {trend ? (
        <p
          className={cn(
            "mt-2 flex items-center gap-1.5 text-xs font-extrabold",
            trendDirection === "up" ? "text-success" : "text-destructive",
          )}
        >
          {trendDirection === "up" ? (
            <TrendingUp className="size-4" />
          ) : (
            <TrendingDown className="size-4" />
          )}
          {trend}
        </p>
      ) : null}
    </div>
  );
}

interface PanelProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function Panel({ title, description, actions, className, children }: PanelProps) {
  return (
    <section className={cn("card-crisp p-5 md:p-6", className)}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-foreground md:text-xl">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm font-bold text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

type StatusTone = "success" | "warning" | "destructive" | "primary" | "neutral";

const statusTones: Record<StatusTone, string> = {
  success: "bg-success/12 text-success border-success/30",
  warning: "bg-warning/15 text-warning border-warning/40",
  destructive: "bg-destructive/10 text-destructive border-destructive/30",
  primary: "bg-primary/10 text-primary border-primary/30",
  neutral: "bg-muted text-muted-foreground border-border",
};

export function StatusBadge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: StatusTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border-2 px-2.5 py-1 text-xs font-black",
        statusTones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
