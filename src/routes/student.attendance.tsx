import { createFileRoute, Navigate } from "@tanstack/react-router";
import { CalendarCheck, CheckCircle2, Clock, XCircle } from "lucide-react";
import { useEffect, useMemo } from "react";
import { toast } from "sonner";

import { StudentCalendarWeekAttendanceChart } from "@/components/dashboard/Charts";
import { Panel, StatCard, StatusBadge } from "@/components/dashboard/StatCard";
import { AppShell } from "@/components/layout/AppShell";
import { useCurrentStudent } from "@/hooks/use-current-student";
import { useDataStore } from "@/lib/data-store";
import { formatDateTime, formatNumber, formatPercent } from "@/lib/format";
import {
  buildStudentAttendanceByCalendarWeek,
  buildStudentRecentDays,
  type StudentDayCard,
} from "@/lib/owner-metrics";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/student/attendance")({
  head: () => ({
    meta: [
      { title: "الحضور والغياب — الطالب" },
      {
        name: "description",
        content: "سجل حضور وغياب حقيقي بالكامل: التأخيرات، تواريخ الحصص، ومعدل الحضور عبر الوقت.",
      },
    ],
  }),
  component: AttendancePage,
});

function AttendancePage() {
  const state = useDataStore();
  const me = useCurrentStudent();
  useEffect(() => {
    if (!me) toast.error("الجلسة منتهية — سجّل الدخول من جديد");
  }, [me]);
  const myRecords = useMemo(
    () =>
      state.attendanceRecords
        .filter((a) => a.student_id === me?.id)
        .sort((a, b) => (a.checked_in_at < b.checked_in_at ? 1 : -1)),
    [state.attendanceRecords, me?.id],
  );
  if (!me) return <Navigate to="/login" />;

  const presentCount = myRecords.filter((r) => r.status === "present").length;
  const lateCount = myRecords.filter((r) => r.status === "late").length;
  const absentCount = myRecords.filter((r) => r.status === "absent").length;
  const total = myRecords.length;
  const rate = total > 0 ? Math.round(((presentCount + lateCount) / total) * 100) : 0;
  const totalLateMinutes = myRecords.reduce((s, r) => s + (r.late_minutes ?? 0), 0);

  const recentDays = buildStudentRecentDays(state, me.id);
  const byCalendarWeek = buildStudentAttendanceByCalendarWeek(state, me.id);

  return (
    <AppShell
      role="student"
      title="الحضور والغياب"
      description="سجل حقيقي بالكامل — كل حصة حضرتها أو غبت عنها"
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="معدل الحضور" value={formatPercent(rate)} icon={CalendarCheck} tone={rate >= 85 ? "success" : "warning"} />
        <StatCard label="حصص حاضرة" value={formatNumber(presentCount)} icon={CheckCircle2} tone="success" />
        <StatCard label="حصص متأخر فيها" value={formatNumber(lateCount)} icon={Clock} tone="warning" />
        <StatCard label="حصص غائبة" value={formatNumber(absentCount)} icon={XCircle} tone="destructive" />
      </div>

      {totalLateMinutes > 0 ? (
        <p className="rounded-xl border-2 border-warning/30 bg-warning/5 p-4 text-sm font-bold text-foreground">
          إجمالي دقائق التأخير المسجَّلة: {formatNumber(totalLateMinutes)} دقيقة عبر {formatNumber(lateCount)} حصة.
        </p>
      ) : null}

      <Panel title="آخر ٧ أيام" description="حالتك الفعلية كل يوم — حضور/غياب/تأخير">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
          {recentDays.map((d) => (
            <DayCard key={d.dateIso} day={d} />
          ))}
        </div>
      </Panel>

      <Panel
        title="مقارنة أسبوعية"
        description="نسبة الحضور والغياب لكل أسبوع حقيقي بتاريخه، آخر ٤ أسابيع"
      >
        <StudentCalendarWeekAttendanceChart data={byCalendarWeek} />
      </Panel>

      <Panel title="سجل كل الحصص" description={`${formatNumber(total)} سجل حضور مسجَّل`}>
        {myRecords.length === 0 ? (
          <p className="rounded-xl border-2 border-dashed border-border p-6 text-center text-sm font-bold text-muted-foreground">
            لا يوجد أي سجل حضور بعد.
          </p>
        ) : (
          <div className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
            {myRecords.map((r) => (
              <div
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-border p-3"
              >
                <div>
                  <p className="text-sm font-black text-foreground">{r.group_name}</p>
                  <p className="text-xs font-bold text-muted-foreground">
                    {r.checked_in_at && r.checked_in_at !== "—" ? formatDateTime(r.checked_in_at) : "—"}
                    {r.late_minutes ? ` · متأخر ${formatNumber(r.late_minutes)} دقيقة` : ""}
                  </p>
                </div>
                <StatusBadge
                  tone={r.status === "present" ? "success" : r.status === "late" ? "warning" : "destructive"}
                >
                  {r.status === "present" ? "حاضر" : r.status === "late" ? "متأخر" : "غائب"}
                </StatusBadge>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </AppShell>
  );
}

const DAY_STATUS_META: Record<
  StudentDayCard["status"],
  { text: string; icon: typeof CheckCircle2; classes: string }
> = {
  present: {
    text: "حاضر",
    icon: CheckCircle2,
    classes: "border-success/40 bg-success/5 text-success",
  },
  late: { text: "متأخر", icon: Clock, classes: "border-warning/40 bg-warning/5 text-warning" },
  absent: {
    text: "غائب",
    icon: XCircle,
    classes: "border-destructive/40 bg-destructive/5 text-destructive",
  },
  none: {
    text: "لا توجد حصة",
    icon: CalendarCheck,
    classes: "border-dashed border-border text-muted-foreground",
  },
};

function DayCard({ day }: { day: StudentDayCard }) {
  const meta = DAY_STATUS_META[day.status];
  const Icon = meta.icon;
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 rounded-xl border-2 p-3 text-center",
        meta.classes,
      )}
    >
      <Icon className="size-5" />
      <p className="text-xs font-black">{day.label}</p>
      <p className="text-[11px] font-bold opacity-80">{meta.text}</p>
    </div>
  );
}
