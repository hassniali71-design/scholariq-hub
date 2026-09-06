import { BookCheck, CheckCircle2, ClipboardCheck, MessageCircle, Timer, UserCheck, Users } from "lucide-react";

import { StatusBadge } from "@/components/dashboard/StatCard";
import { formatNumber, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Teacher } from "@/types";

/**
 * §0.3 — بطاقة مدرس عمودية Vertical Card.
 *
 * 6 مؤشرات:
 *  3 تراكميون (season — طوال الموسم):
 *    - متوسط درجات طلابه
 *    - نسبة حضور طلابه
 *    - عدد طلابه
 *  3 أسبوعيون (week — من أفعاله في وضع الحصة):
 *    - إطلاق واجبات (recordAssessmentScore category=homework + e_homework هذا الأسبوع)
 *    - تصحيح واجبات (سجلات status !== pending هذا الأسبوع)
 *    - تفاعل مع الطلاب (recordRandomPick + addTeacherNote هذا الأسبوع)
 */
export interface WeeklyMetrics {
  homeworkLaunchedWeek: number;
  homeworkGradedWeek: number;
  engagementWeek: number;
}

export interface SeasonMetrics {
  /** 0..100, متوسط درجات الطلاب المرتبطين بالمدرس. */
  avgScore: number;
  /** 0..100, نسبة حضور الطلاب المرتبطين بالمدرس. */
  attendance: number;
  /** Migration 0023 / خطة B (B8): 0..100, متوسط درجة السلوك المُقيَّمة من المدرس. */
  behavior: number | null;
}

export function TeacherComplianceCard({
  teacher,
  weekly,
  season,
  rank,
}: {
  teacher: Teacher;
  weekly: WeeklyMetrics;
  season: SeasonMetrics;
  rank: number;
}) {
  return (
    <div
      className={cn(
        "card-crisp flex h-full flex-col gap-3 p-4",
        rank === 1 && "border-success/40",
        rank === 2 && "border-primary/40",
        rank === 3 && "border-warning/40",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-base font-black text-foreground">{teacher.full_name}</p>
          <p className="text-xs font-bold text-muted-foreground">
            {teacher.subject} · {formatNumber(teacher.groups)} مجموعات
          </p>
        </div>
        <StatusBadge
          tone={
            teacher.timer_compliance >= 90
              ? "success"
              : teacher.timer_compliance >= 80
                ? "warning"
                : "destructive"
          }
        >
          {formatPercent(teacher.timer_compliance)} التزام
        </StatusBadge>
      </div>

      {/* 3 تراكميون */}
      <div className="space-y-2">
        <p className="text-xs font-black tracking-wide text-muted-foreground">
          طوال الموسم
        </p>
        <SeasonMetric
          icon={Users}
          label="عدد الطلاب"
          value={formatNumber(teacher.students)}
        />
        <SeasonMetric
          icon={CheckCircle2}
          label="متوسط درجات الطلاب"
          value={formatPercent(season.avgScore)}
        />
        <SeasonMetric
          icon={UserCheck}
          label="نسبة حضور الطلاب"
          value={formatPercent(season.attendance)}
        />
        <SeasonMetric
          icon={MessageCircle}
          label="متوسط درجة السلوك"
          value={season.behavior === null ? "—" : formatPercent(season.behavior)}
        />
      </div>

      <div className="border-t-2 border-border" />

      {/* 3 أسبوعيون */}
      <div className="space-y-2">
        <p className="text-xs font-black tracking-wide text-muted-foreground">
          هذا الأسبوع
        </p>
        <WeekMetric
          icon={ClipboardCheck}
          label="إطلاق واجبات"
          value={formatNumber(weekly.homeworkLaunchedWeek)}
          tone="primary"
        />
        <WeekMetric
          icon={BookCheck}
          label="تصحيح/متابعة واجبات"
          value={formatNumber(weekly.homeworkGradedWeek)}
          tone="success"
        />
        <WeekMetric
          icon={MessageCircle}
          label="تفاعل مع الطلاب"
          value={formatNumber(weekly.engagementWeek)}
          tone="warning"
        />
      </div>
    </div>
  );
}

function SeasonMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Timer;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-canvas/50 px-2.5 py-1.5">
      <span className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </span>
      <span className="text-sm font-black text-foreground">{value}</span>
    </div>
  );
}

function WeekMetric({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Timer;
  label: string;
  value: string;
  tone: "primary" | "success" | "warning";
}) {
  const ring =
    tone === "primary"
      ? "bg-primary/10 text-primary"
      : tone === "success"
        ? "bg-success/10 text-success"
        : "bg-warning/10 text-warning";
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-border px-2.5 py-1.5">
      <span className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
        <span className={cn("flex size-5 items-center justify-center rounded-md", ring)}>
          <Icon className="size-3" />
        </span>
        {label}
      </span>
      <span className="text-sm font-black text-foreground">{value}</span>
    </div>
  );
}
