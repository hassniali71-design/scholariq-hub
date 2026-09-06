import { createFileRoute } from "@tanstack/react-router";
import {
  Banknote,
  BookOpen,
  CalendarDays,
  Clock,
  Download,
  GraduationCap,
  ListTodo,
  TrendingUp,
  UserCheck,
  Users,
  Wallet,
} from "lucide-react";
import { useEffect, useMemo } from "react";
import { toast } from "sonner";

import { CenterActivityPanels } from "@/components/dashboard/CenterActivityPanels";
import { EnhancedWeeklyAttendance } from "@/components/dashboard/EnhancedWeeklyAttendance";
import { LiveActiveGroupsCard } from "@/components/dashboard/LiveActiveGroupsCard";
import { Panel, StatCard, StatusBadge } from "@/components/dashboard/StatCard";
import { TodayOverviewPanels } from "@/components/dashboard/TodayOverviewPanels";
import { AppShell } from "@/components/layout/AppShell";
import { ActivityLogPanel } from "@/components/owner/ActivityLogPanel";
import { NotificationsPanel } from "@/components/owner/NotificationsPanel";
import { DailyTasksCard } from "@/components/tasks/DailyTasksCard";
import { downloadCenterExcel } from "@/lib/export-excel";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import {
  getFinanceSettings,
  pushNotification,
  useDataStore,
} from "@/lib/data-store";
import {
  buildActiveGroupsNow,
  buildDecisionAlerts,
  buildTeacherPerformance,
  computeOwnerKpis,
  WEEKDAYS,
} from "@/lib/owner-metrics";

export const Route = createFileRoute("/owner/")({
  head: () => ({
    meta: [
      { title: "برج التحكم — لوحة المالك" },
      {
        name: "description",
        content: "نظرة اليوم، الإشعارات المهمة، وسجل نشاط موحّد لكل ما يحدث داخل السنتر.",
      },
    ],
  }),
  component: OwnerDashboard,
});

function OwnerDashboard() {
  const state = useDataStore();
  const {
    students,
    teachers,
    groups,
    subjects,
    scheduleSlots,
    notifications,
    activityLog,
    tasks,
    staffPermissions,
  } = state;
  const settings = getFinanceSettings(state);

  const today = WEEKDAYS[new Date().getDay()]!;
  const todayGroups = useMemo(
    () => groups.filter((g) => g.weekday === today),
    [groups, today],
  );
  const teachersToday = useMemo(
    () => teachers.filter((t) => todayGroups.some((g) => g.teacher_id === t.id)),
    [teachers, todayGroups],
  );

  const kpis = useMemo(() => computeOwnerKpis(state), [state]);
  const performance = useMemo(() => buildTeacherPerformance(state), [state]);
  const activeNow = useMemo(() => buildActiveGroupsNow(state), [state]);
  const alerts = useMemo(() => buildDecisionAlerts(state), [state]);

  const openTasks = useMemo(
    () => tasks.filter((t) => t.status === "pending" || t.status === "in_progress"),
    [tasks],
  );
  const urgentTasks = useMemo(() => openTasks.filter((t) => t.is_urgent), [openTasks]);

  /**
   * توليد إشعار "تأخر تفعيل حصة" لمرة واحدة يومياً لكل مجموعة متأخرة.
   */
  useEffect(() => {
    const day = new Date().toDateString();
    for (const row of activeNow) {
      if (!row.started || row.activated || row.lateMinutes < 10) continue;
      const title = `تأخير في تفعيل حصة ${row.group.name}`;
      const already = notifications.some(
        (n) => n.title === title && new Date(n.created_at).toDateString() === day,
      );
      if (already) continue;
      pushNotification(
        "session_late",
        "critical",
        title,
        `${row.group.teacher_name} · ${row.group.time} · مرّ ${row.lateMinutes} دقيقة بدون رفع واجب أو تسجيل حضور`,
      );
    }
  }, [activeNow, notifications]);

  return (
    <AppShell
      role="owner"
      title="برج التحكم"
      description={`${state.center.name} — كل الأرقام محسوبة من البيانات الحقيقية المسجّلة`}
      actions={
        <button
          type="button"
          onClick={() => {
            try {
              void downloadCenterExcel({
                centerName: state.center.name,
                students: state.students,
                teachers: state.teachers,
                groups: state.groups,
                attendanceRecords: state.attendanceRecords,
                payments: state.payments,
                quizResults: state.quizResults,
                homeworkTasks: state.homeworkTasks,
              });
              toast.success("تم تحضير ملف النسخة الاحتياطية");
            } catch {
              toast.error("تعذّر إنشاء ملف التصدير");
            }
          }}
          className="flex items-center gap-2 rounded-xl border-2 border-border bg-background px-4 py-2.5 text-base font-black text-foreground transition-colors hover:border-primary"
        >
          <Download className="size-5" />
          تصدير نسخة احتياطية
        </button>
      }
    >
      {/* === 6 كروت وصفية (بدل كروتي المصروفات/الرواتب) === */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="عدد المواد الدراسية"
          value={formatNumber(subjects.length)}
          icon={BookOpen}
          trend="المتاح في مرجع المواد"
        />
        <StatCard
          label="عدد الطلاب"
          value={formatNumber(students.length)}
          icon={Users}
          trend={formatNumber(groups.length) + " مجموعة"}
        />
        <StatCard
          label="عدد المدرسين"
          value={formatNumber(teachers.length)}
          icon={GraduationCap}
          trend={formatNumber(teachersToday.length) + " مدرس لهم حصص اليوم"}
        />
        <StatCard
          label="عدد الموظفين"
          value={formatNumber(staffPermissions.length)}
          icon={Users}
          trend="في فريق العمل"
        />
        <StatCard
          label="حصص اليوم"
          value={formatNumber(todayGroups.length)}
          icon={CalendarDays}
          trend={`${formatNumber(scheduleSlots.length)} موعد إجمالي في الجدول`}
        />
        <StatCard
          label="إشعارات مفتوحة"
          value={formatNumber(notifications.filter((n) => !n.read_at).length)}
          icon={Clock}
          tone={notifications.filter((n) => !n.read_at && n.severity === "critical").length > 0 ? "destructive" : "primary"}
          trend={`${formatNumber(alerts.length)} تنبيه حوكمة`}
        />
      </div>

      {/* === كروت المؤشرات المالية المدمجة (إيراد، ربح، التزام) === */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="إيرادات الشهر"
          value={formatCurrency(kpis.monthRevenue)}
          icon={Banknote}
          tone="success"
          trend={kpis.inSafe > 0 ? `${formatCurrency(kpis.inSafe)} في الخزنة` : "لا يوجد رصيد في الخزنة"}
        />
        <StatCard
          label="صافي الربح"
          value={formatCurrency(kpis.netProfit)}
          icon={TrendingUp}
          tone={kpis.netProfit >= 0 ? "success" : "destructive"}
          trend={`هامش ${formatPercent(kpis.netMarginPct)}`}
        />
        <StatCard
          label="متوسط التزام المدرسين"
          value={formatPercent(kpis.teacherCompliance)}
          icon={GraduationCap}
          tone={kpis.teacherCompliance >= 80 ? "success" : "warning"}
          trend={`${formatNumber(teachers.length)} مدرس`}
        />
        <StatCard
          label="متوسط حضور السنتر"
          value={formatPercent(kpis.avgAttendance)}
          icon={UserCheck}
          tone={kpis.avgAttendance >= 85 ? "success" : "warning"}
          trend={`من ${formatNumber(state.attendanceRecords.length)} سجل حضور`}
        />
        <StatCard
          label="المستحقات المتأخرة"
          value={formatCurrency(kpis.overdueTotal)}
          icon={Wallet}
          tone={kpis.overdueTotal > 0 ? "destructive" : "success"}
          trend={`${formatNumber(students.filter((s) => s.balance_due > 0).length)} طالب`}
        />
        <StatCard
          label="اشتراكات قريبة من الانتهاء"
          value={formatNumber(
            students.filter(
              (s) => s.payment_status === "overdue" || s.balance_due > 0,
            ).length,
          )}
          icon={Wallet}
          tone="warning"
          trend={
            students.filter((s) => s.balance_due > 0).length > 0
              ? `${formatCurrency(kpis.overdueTotal)} مستحقات متأخرة`
              : "كل الاشتراكات سليمة"
          }
        />
      </div>

      {/* === المهام اليومية + المهام المستعجلة === */}
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <DailyTasksCard role="owner" />
        </div>
        <Panel
          title="المهام المستعجلة"
          description="مهام مفتوحة وعليها علامة مستعجل"
        >
          {urgentTasks.length === 0 ? (
            <p className="rounded-xl border-2 border-dashed border-border p-6 text-center text-sm font-bold text-muted-foreground">
              لا توجد مهام مستعجلة مفتوحة الآن.
            </p>
          ) : (
            <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
              {urgentTasks.slice(0, 10).map((t) => (
                <div
                  key={t.id}
                  className="rounded-xl border-2 border-destructive/40 bg-destructive/5 p-3"
                >
                  <p className="text-sm font-black text-foreground">🚨 {t.title}</p>
                  <p className="text-xs font-bold text-muted-foreground">
                    {t.assignee_name} · {t.task_type} · {formatDateTime(t.created_at)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* === نظرة اليوم (مع الكروت الستة) === */}
      <TodayOverviewPanels />

      {/* === جدول اليوم (مفصّل) === */}
      <Panel
        title={`جدول اليوم — ${today}`}
        description={`${formatNumber(todayGroups.length)} حصة · ${formatNumber(teachersToday.length)} مدرس`}
      >
        {todayGroups.length === 0 ? (
          <p className="rounded-xl border-2 border-dashed border-border p-6 text-center text-base font-bold text-muted-foreground">
            لا توجد حصص مجدولة لهذا اليوم في {state.center.name}.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-base">
              <thead>
                <tr className="border-b-2 border-border text-muted-foreground">
                  <th className="pb-3">المادة</th>
                  <th className="pb-3">المدرس</th>
                  <th className="pb-3">المرحلة</th>
                  <th className="pb-3">الساعة</th>
                  <th className="pb-3">القاعة</th>
                  <th className="pb-3">المجموعة</th>
                </tr>
              </thead>
              <tbody>
                {[...todayGroups]
                  .sort((a, b) => (a.time < b.time ? -1 : 1))
                  .map((g) => (
                    <tr key={g.id} className="border-b border-border last:border-0">
                      <td className="py-3 font-black text-foreground">{g.subject}</td>
                      <td className="py-3 font-bold text-foreground">{g.teacher_name}</td>
                      <td className="py-3 font-bold text-muted-foreground">{g.grade}</td>
                      <td className="py-3 font-extrabold">{g.time}</td>
                      <td className="py-3 font-extrabold">قاعة {g.room}</td>
                      <td className="py-3 font-extrabold">{g.name}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* === المجموعات النشطة + التنبيهات === */}
      <div className="grid gap-6 xl:grid-cols-2">
        <LiveActiveGroupsCard />
        <Panel
          title="تنبيهات تحتاج قراراً"
          description={`${formatNumber(alerts.length)} تنبيه محسوب لحظياً من حركة السنتر`}
        >
          <div className="max-h-[26rem] space-y-3 overflow-y-auto pl-1">
            {alerts.length === 0 ? (
              <p className="rounded-xl border-2 border-dashed border-border p-6 text-center text-sm font-bold text-muted-foreground">
                مفيش أي تنبيه مفتوح — كل حاجة تمام دلوقتي.
              </p>
            ) : (
              alerts.map((a) => (
                <div
                  key={a.id}
                  className={`rounded-xl border-2 p-4 ${
                    a.severity === "critical"
                      ? "border-destructive/40 bg-destructive/5"
                      : a.severity === "warning"
                        ? "border-warning/40 bg-warning/5"
                        : "border-border"
                  }`}
                >
                  <p className="text-base font-black text-foreground">{a.title}</p>
                  <p className="mt-1 text-sm font-bold text-muted-foreground">{a.body}</p>
                </div>
              ))
            )}
          </div>
        </Panel>
      </div>

      {/* === متوسط أداء السنتر (رسمين منفصلين) === */}
      <CenterActivityPanels />

      {/* === الحضور الأسبوعي (محسّن) === */}
      <EnhancedWeeklyAttendance />

      {/* === الإشعارات + سجل النشاط (scrollable + بحث + حذف) === */}
      <div className="grid gap-6 xl:grid-cols-2">
        <NotificationsPanel notifications={notifications} />
        <ActivityLogPanel entries={activityLog} />
      </div>

      {/* === إشغال المجموعات (مع الإعدادي أيضاً) === */}
      <Panel
        title="إشغال المجموعات"
        description={`${formatNumber(groups.length)} مجموعة عبر كل المراحل`}
      >
        {groups.length === 0 ? (
          <p className="rounded-xl border-2 border-dashed border-border p-6 text-center text-sm font-bold text-muted-foreground">
            لا توجد مجموعات بعد — أضف من /owner/schedule.
          </p>
        ) : (
          <div className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
            {groups.map((g) => {
              const pct = g.capacity ? Math.round((g.enrolled / g.capacity) * 100) : 0;
              return (
                <div key={g.id} className="rounded-xl border-2 border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-black text-foreground">{g.name}</p>
                    <StatusBadge
                      tone={pct >= 100 ? "destructive" : pct >= 85 ? "warning" : "success"}
                    >
                      {formatNumber(g.enrolled)} / {formatNumber(g.capacity)}
                    </StatusBadge>
                  </div>
                  <p className="mt-1 text-xs font-bold text-muted-foreground">
                    {g.teacher_name} · {g.grade} · {g.weekday} {g.time}
                  </p>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </AppShell>
  );
}

function formatDateTime(s: string) {
  return s.length === 0 ? "—" : s;
}

void ListTodo;
