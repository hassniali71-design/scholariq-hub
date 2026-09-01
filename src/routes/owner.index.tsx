import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  Banknote,
  BellRing,
  CalendarDays,
  CheckCheck,
  Clock,
  Download,
  GraduationCap,
  History,
  PiggyBank,
  Receipt,
  TrendingUp,
  UserCheck,
  Users,
  Wallet,
} from "lucide-react";
import { useEffect, useMemo } from "react";
import { toast } from "sonner";

import { CenterDayChart, TeacherPerformanceChart, WeeklyAttendanceChart } from "@/components/dashboard/Charts";
import { Panel, StatCard, StatusBadge } from "@/components/dashboard/StatCard";
import { AppShell } from "@/components/layout/AppShell";
import { downloadCenterExcel } from "@/lib/export-excel";
import { formatCurrency, formatDateTime, formatNumber, formatPercent } from "@/lib/format";
import {
  getFinanceSettings,
  markAllNotificationsRead,
  markNotificationRead,
  pushNotification,
  useDataStore,
} from "@/lib/data-store";
import {
  buildActiveGroupsNow,
  buildDailyCenterActivity,
  buildDecisionAlerts,
  buildTeacherPerformance,
  buildWeeklyAttendance,
  computeOwnerKpis,
  WEEKDAYS,
} from "@/lib/owner-metrics";
import type { ActivityEntry, CenterNotification } from "@/types";

export const Route = createFileRoute("/owner/")({
  head: () => ({
    meta: [
      { title: "برج التحكم — لوحة المالك" },
      {
        name: "description",
        content: "نظرة اليوم، الإشعارات المهمة، وسجل نشاط موحّد لكل ما يحدث داخل السنتر.",
      },
      { property: "og:title", content: "برج التحكم — لوحة المالك" },
      {
        property: "og:description",
        content: "أرقام حقيقية للطلاب والمدرسين والإيرادات مع إشعارات فورية وسجل نشاط موحّد.",
      },
    ],
  }),
  component: OwnerDashboard,
});

function OwnerDashboard() {
  const state = useDataStore();
  const { students, teachers, groups, attendanceRecords, notifications, activityLog } = state;
  const settings = getFinanceSettings(state);

  const today = WEEKDAYS[new Date().getDay()]!;
  const todayGroups = useMemo(() => groups.filter((g) => g.weekday === today), [groups, today]);
  const teachersToday = useMemo(
    () => teachers.filter((t) => todayGroups.some((g) => g.teacher_id === t.id)),
    [teachers, todayGroups],
  );

  const kpis = useMemo(() => computeOwnerKpis(state), [state]);
  const performance = useMemo(() => buildTeacherPerformance(state), [state]);
  const dayActivity = useMemo(() => buildDailyCenterActivity(state), [state]);
  const weeklyAttendance = useMemo(() => buildWeeklyAttendance(state), [state]);
  const activeNow = useMemo(() => buildActiveGroupsNow(state), [state]);
  const alerts = useMemo(() => buildDecisionAlerts(state), [state]);

  const unread = notifications.filter((n) => !n.read_at);
  const timeline = useMemo(
    () => buildTimeline(activityLog, notifications),
    [activityLog, notifications],
  );

  /**
   * حوكمة الحصص: أي حصة عدّى ميعادها والمدرس لم يفعّلها (لا حضور ولا واجب) تتحوّل
   * لإشعار حقيقي مرة واحدة فقط في اليوم، فيظهر في صندوق التنبيهات وسجل النشاط.
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
      {/* الكروت الثمانية الحقيقية */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="إيرادات الشهر"
          value={formatCurrency(kpis.monthRevenue)}
          icon={Banknote}
          tone="success"
          trend={`${formatCurrency(kpis.inSafe)} في الخزنة`}
        />
        <StatCard
          label="صافي الربح"
          value={formatCurrency(kpis.netProfit)}
          icon={TrendingUp}
          tone={kpis.netProfit >= 0 ? "success" : "destructive"}
          trend={`هامش ${formatPercent(kpis.netMarginPct)}`}
        />
        <StatCard
          label="إجمالي الطلاب النشطين"
          value={formatNumber(kpis.activeStudents)}
          icon={Users}
          trend={`${formatNumber(groups.length)} مجموعة`}
        />
        <StatCard
          label="متوسط التزام المدرسين"
          value={formatPercent(kpis.teacherCompliance)}
          icon={GraduationCap}
          tone={kpis.teacherCompliance >= 80 ? "success" : "warning"}
          trend={`${formatNumber(teachers.length)} مدرس`}
        />
        <StatCard
          label="إجمالي المصروفات العامة"
          value={formatCurrency(kpis.expensesTotal)}
          icon={Receipt}
          tone={kpis.expensesTotal > 0 ? "warning" : "success"}
        />
        <StatCard label="إجمالي الرواتب" value={formatCurrency(kpis.salariesTotal)} icon={PiggyBank} />
        <StatCard
          label="المستحقات المتأخرة"
          value={formatCurrency(kpis.overdueTotal)}
          icon={Wallet}
          tone={kpis.overdueTotal > 0 ? "destructive" : "success"}
          trend={`${formatNumber(students.filter((s) => s.balance_due > 0).length)} طالب`}
        />
        <StatCard
          label="متوسط حضور السنتر"
          value={formatPercent(kpis.avgAttendance)}
          icon={UserCheck}
          tone={kpis.avgAttendance >= 85 ? "success" : "warning"}
        />
      </div>

      {/* نظرة اليوم */}
      <div className="card-crisp p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-xl font-black text-foreground">
            <CalendarDays className="size-6 text-primary" />
            نظرة اليوم — {today}
          </p>
          <StatusBadge tone={todayGroups.length > 0 ? "success" : "neutral"}>
            {formatNumber(todayGroups.length)} حصة اليوم
          </StatusBadge>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border-2 border-border p-4">
            <p className="text-sm font-bold text-muted-foreground">حصص اليوم</p>
            <p className="kpi-number text-3xl">{formatNumber(todayGroups.length)}</p>
            <p className="mt-1 text-sm font-bold text-muted-foreground">
              {todayGroups
                .slice(0, 3)
                .map((g) => `${g.name} (${g.time})`)
                .join(" · ") || "لا توجد حصص مجدولة اليوم"}
            </p>
          </div>
          <div className="rounded-xl border-2 border-border p-4">
            <p className="text-sm font-bold text-muted-foreground">المدرسون على رأس العمل اليوم</p>
            <p className="kpi-number text-3xl">{formatNumber(teachersToday.length)}</p>
            <p className="mt-1 text-sm font-bold text-muted-foreground">
              {teachersToday.map((t) => t.full_name).join(" · ") || "لا يوجد"}
            </p>
          </div>
          <div className="rounded-xl border-2 border-border p-4">
            <p className="text-sm font-bold text-muted-foreground">تسجيلات الحضور المسجّلة</p>
            <p className="kpi-number text-3xl">{formatNumber(attendanceRecords.length)}</p>
            <p className="mt-1 text-sm font-bold text-muted-foreground">
              نظام الرسوم الحالي:{" "}
              {settings.billing_mode === "monthly"
                ? "اشتراك شهري"
                : settings.billing_mode === "per_session"
                  ? "بالحصة"
                  : "بالسيزون"}
            </p>
          </div>
        </div>
      </div>

      {/* المجموعات النشطة الآن + التنبيهات التي تحتاج قراراً */}
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel
          title="المجموعات النشطة الآن"
          description="محسوبة من الساعة الحالية + تفعيل المدرس للحصة فعلياً"
        >
          <div className="space-y-3">
            {activeNow.length === 0 ? (
              <EmptyState text="لا توجد حصص مجدولة اليوم." />
            ) : (
              activeNow.map((row) => (
                <div
                  key={row.group.id}
                  className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 p-4 ${
                    row.started && !row.activated
                      ? "border-destructive/40 bg-destructive/5"
                      : row.activated
                        ? "border-success/40 bg-success/5"
                        : "border-border"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-base font-black text-foreground">{row.group.name}</p>
                    <p className="text-sm font-bold text-muted-foreground">
                      {row.group.teacher_name} · {row.group.time} · قاعة {row.group.room}
                    </p>
                  </div>
                  <StatusBadge
                    tone={
                      row.started && row.activated
                        ? "success"
                        : row.started
                          ? "destructive"
                          : "neutral"
                    }
                  >
                    {row.started && row.activated
                      ? "نشطة الآن"
                      : row.started
                        ? `متأخرة ${formatNumber(row.lateMinutes)} دقيقة`
                        : "لم تبدأ بعد"}
                  </StatusBadge>
                </div>
              ))
            )}
          </div>
        </Panel>

        <Panel
          title="تنبيهات تحتاج قراراً"
          description={`${formatNumber(alerts.length)} تنبيه محسوب لحظياً من حركة السنتر`}
        >
          <div className="max-h-[26rem] space-y-3 overflow-y-auto pl-1">
            {alerts.length === 0 ? (
              <EmptyState text="مفيش أي تنبيه مفتوح — كل حاجة تمام دلوقتي." />
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
                  <p className="flex items-center gap-2 text-base font-black text-foreground">
                    <AlertTriangle className="size-5 text-warning" />
                    {a.title}
                  </p>
                  <p className="mt-1 text-sm font-bold text-muted-foreground">{a.body}</p>
                </div>
              ))
            )}
          </div>
        </Panel>
      </div>

      {/* الرسوم البيانية */}
      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="تقييم أداء المدرسين" description="الالتزام بالمواعيد + تسليم الحضور والتقييمات + مستوى الطلاب">
          {performance.length === 0 ? (
            <EmptyState text="لا يوجد مدرسون مسجّلون بعد." />
          ) : (
            <>
              <TeacherPerformanceChart data={performance.map((p) => ({ ...p }))} />
              <div className="mt-4 space-y-2">
                {performance.map((p) => (
                  <div
                    key={p.teacherId}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border-2 border-border p-3"
                  >
                    <p className="text-base font-black text-foreground">
                      {p.name} <span className="text-muted-foreground">· {p.subject}</span>
                    </p>
                    <p className="text-sm font-bold text-muted-foreground">
                      مواعيد {formatPercent(p.punctuality)} · تسليم {formatPercent(p.delivery)} · طلاب{" "}
                      {formatPercent(p.rating)}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}
        </Panel>

        <Panel title="متوسط أداء وحضور السنتر حسب اليوم" description="حضور مسجّل وحركة الحصص لكل يوم">
          <CenterDayChart data={dayActivity} />
        </Panel>
      </div>

      <Panel
        title="الحضور الأسبوعي"
        description="حضور وغياب حقيقي موزّع على أيام الأسبوع"
        className="min-h-[32rem]"
      >
        <WeeklyAttendanceChart data={weeklyAttendance} />
      </Panel>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel
          title="الإشعارات المهمة"
          description={`${formatNumber(unread.length)} إشعار غير مقروء`}
        >
          <div className="space-y-3">
            {unread.length > 0 ? (
              <button
                type="button"
                onClick={() => markAllNotificationsRead()}
                className="flex items-center gap-2 rounded-xl border-2 border-border px-4 py-2 text-sm font-black text-foreground hover:border-primary"
              >
                <CheckCheck className="size-4" />
                تعليم الكل كمقروء
              </button>
            ) : null}
            {notifications.length === 0 ? (
              <EmptyState text="لا توجد إشعارات بعد — أي دفعة أو غياب أو تأخير هيظهر هنا فوراً." />
            ) : (
              notifications.slice(0, 12).map((n) => <NotificationRow key={n.id} n={n} />)
            )}
          </div>
        </Panel>

        <Panel title="سجل النشاط الموحّد" description="كل الأحداث المهمة بترتيب زمني في مكان واحد">
          <div className="space-y-3">
            {timeline.length === 0 ? (
              <EmptyState text="السجل فاضي دلوقتي — أول دفعة أو حضور أو استلام خزنة هيتسجل هنا." />
            ) : (
              timeline.slice(0, 15).map((e) => (
                <div key={e.id} className="flex gap-3 rounded-xl border-2 border-border p-4">
                  <span className="mt-1 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <History className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-base font-black text-foreground">{e.title}</p>
                    <p className="text-sm font-bold text-muted-foreground">
                      {formatDateTime(e.created_at)}
                      {e.detail ? ` · ${e.detail}` : ""}
                      {e.amount ? ` · ${formatCurrency(Number(e.amount))}` : ""}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="المدرسون" description="عدد الطلاب والمجموعات لكل مدرس">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-base">
              <thead>
                <tr className="border-b-2 border-border text-muted-foreground">
                  <th className="pb-3">المدرس</th>
                  <th className="pb-3">المادة</th>
                  <th className="pb-3">الطلاب</th>
                  <th className="pb-3">المجموعات</th>
                </tr>
              </thead>
              <tbody>
                {teachers.map((t) => {
                  const enrolled = students.filter((s) => s.subject_ids.includes(t.subject_id));
                  return (
                    <tr key={t.id} className="border-b border-border last:border-0">
                      <td className="py-3 font-black text-foreground">{t.full_name}</td>
                      <td className="py-3 font-bold text-muted-foreground">{t.subject}</td>
                      <td className="py-3 font-extrabold">{formatNumber(enrolled.length)}</td>
                      <td className="py-3 font-extrabold">
                        {formatNumber(groups.filter((g) => g.teacher_id === t.id).length)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="إشغال المجموعات" description="المسجّلون مقابل السعة">
          <div className="max-h-[28rem] space-y-3 overflow-y-auto pl-1">
            {groups.map((g) => {
              const pct = g.capacity ? Math.round((g.enrolled / g.capacity) * 100) : 0;
              return (
                <div key={g.id} className="rounded-xl border-2 border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-base font-black text-foreground">{g.name}</p>
                    <StatusBadge tone={pct >= 100 ? "destructive" : pct >= 85 ? "warning" : "success"}>
                      {formatNumber(g.enrolled)} / {formatNumber(g.capacity)}
                    </StatusBadge>
                  </div>
                  <p className="mt-1 text-sm font-bold text-muted-foreground">
                    {g.teacher_name} · {g.grade} · {g.weekday} {g.time}
                  </p>
                  <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="حصص متأخرة التفعيل اليوم"
          value={formatNumber(activeNow.filter((r) => r.started && !r.activated).length)}
          icon={Clock}
          tone="destructive"
        />
        <StatCard
          label="طلاب عليهم مستحقات"
          value={formatNumber(students.filter((s) => s.balance_due > 0).length)}
          icon={AlertTriangle}
          tone="warning"
        />
        <StatCard
          label="إشعارات حرجة مفتوحة"
          value={formatNumber(unread.filter((n) => n.severity === "critical").length)}
          icon={BellRing}
          tone="destructive"
        />
      </div>
    </AppShell>
  );
}

function NotificationRow({ n }: { n: CenterNotification }) {
  const toneClass =
    n.severity === "critical"
      ? "border-destructive/40 bg-destructive/5"
      : n.severity === "warning"
        ? "border-warning/40 bg-warning/5"
        : "border-success/40 bg-success/5";
  return (
    <div className={`rounded-xl border-2 p-4 ${n.read_at ? "border-border opacity-70" : toneClass}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-base font-black text-foreground">{n.title}</p>
          <p className="text-sm font-bold text-muted-foreground">
            {formatDateTime(n.created_at)}
            {n.body ? ` · ${n.body}` : ""}
          </p>
        </div>
        {n.read_at ? (
          <StatusBadge tone="neutral">مقروء</StatusBadge>
        ) : (
          <button
            type="button"
            onClick={() => markNotificationRead(n.id)}
            className="rounded-lg border-2 border-border px-3 py-1.5 text-sm font-black text-foreground hover:border-primary"
          >
            تم الاطلاع
          </button>
        )}
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <p className="rounded-xl border-2 border-dashed border-border p-6 text-center text-base font-bold text-muted-foreground">
      {text}
    </p>
  );
}

/** يدمج سجل النشاط مع الإشعارات في خط زمني واحد. */
function buildTimeline(
  activity: ActivityEntry[],
  notifications: CenterNotification[],
): ActivityEntry[] {
  const fromNotifications: ActivityEntry[] = notifications.map((n) => ({
    id: `n-${n.id}`,
    center_id: n.center_id,
    kind: n.kind,
    title: n.title,
    detail: n.body,
    actor: null,
    amount: null,
    created_at: n.created_at,
  }));
  const seen = new Set(activity.map((a) => `${a.kind}|${a.title}`));
  return [...activity, ...fromNotifications.filter((n) => !seen.has(`${n.kind}|${n.title}`))].sort(
    (a, b) => (a.created_at < b.created_at ? 1 : -1),
  );
}
