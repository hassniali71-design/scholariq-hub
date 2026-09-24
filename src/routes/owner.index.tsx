import { createFileRoute } from "@tanstack/react-router";
import {
  Banknote,
  BookOpen,
  CalendarDays,
  Clock,
  Download,
  GraduationCap,
  TrendingUp,
  UserCheck,
  Users,
  Wallet,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { CenterActivityPanels } from "@/components/dashboard/CenterActivityPanels";
import { EnhancedWeeklyAttendance } from "@/components/dashboard/EnhancedWeeklyAttendance";
import { LiveActiveGroupsCard } from "@/components/dashboard/LiveActiveGroupsCard";
import { Panel, StatCard, StatusBadge } from "@/components/dashboard/StatCard";
import { TodayOverviewPanels } from "@/components/dashboard/TodayOverviewPanels";
import { AppShell } from "@/components/layout/AppShell";
import { ActivityLogPanel } from "@/components/owner/ActivityLogPanel";
import { NotificationsPanel } from "@/components/owner/NotificationsPanel";
import { SubjectQuotesCard } from "@/components/owner/SubjectQuotesCard";
import { OwnerNotesCard } from "@/components/teacher/OwnerNotesCard";
import { DailyTasksCard } from "@/components/tasks/DailyTasksCard";
import { downloadCenterExcel } from "@/lib/export-excel";
import { formatCurrency, formatDateTime, formatNumber, formatPercent } from "@/lib/format";
import {
  getEnrolledCount,
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
  /**
   * كل مجموعة ممكن يكون ليها أكثر من موعد أسبوعي (نفس المجموعة تقابل يومين
   * مختلفين). `group.weekday` حقل قديم بيحمل يوم واحد بس، فكان بيخفي أي موعد
   * تاني لنفس المجموعة يقع في يوم مختلف — ده بالظبط سبب ظهور حصص أقل من
   * الحقيقي في "جدول اليوم". المصدر الصحيح هو `scheduleSlots` (سجل منفصل لكل
   * موعد أسبوعي فعلي)، هو نفسه المستخدم بالفعل في بوابة الكاشير للموظف.
   */
  const todaySlots = useMemo(
    () => scheduleSlots.filter((s) => s.weekday === today),
    [scheduleSlots, today],
  );
  const teachersToday = useMemo(
    () => teachers.filter((t) => todaySlots.some((s) => s.teacher_id === t.id)),
    [teachers, todaySlots],
  );

  const kpis = useMemo(() => computeOwnerKpis(state), [state]);
  const performance = useMemo(() => buildTeacherPerformance(state), [state]);
  const activeNow = useMemo(() => buildActiveGroupsNow(state), [state]);
  const alerts = useMemo(() => buildDecisionAlerts(state), [state]);

  /**
   * لوحة المالك بتحمّل عدد كبير من اللوحات الثقيلة (كل واحدة بتعمل useDataStore()
   * وتكرار على بيانات المركز كامل بشكل منفصل) — بتحصل كلها بشكل متزامن وقت أول
   * render، فبتعلّق اللوحة لحظياً على الأجهزة الأبطأ. المستخدم بيحس إنها "علّقت"
   * فيعمل ريفريش، وده بيرجّعه لشاشة الدخول من الأول — يظهر كأنه "لازم يسجل دخول
   * مرتين" رغم إن الجلسة سليمة. الحل: نعرض الكروت الأساسية فوراً، ونأجّل اللوحات
   * الثقيلة لتيك واحد بعدها (setTimeout 0) عشان أول رسم للصفحة يبقى سريع.
   */
  const [heavyPanelsReady, setHeavyPanelsReady] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setHeavyPanelsReady(true), 0);
    return () => window.clearTimeout(id);
  }, []);

  const openTasks = useMemo(
    () => tasks.filter((t) => t.status === "pending" || t.status === "in_progress"),
    [tasks],
  );
  const urgentTasks = useMemo(() => openTasks.filter((t) => t.is_urgent), [openTasks]);

  /**
   * توليد إشعار "تأخر تفعيل حصة" لمرة واحدة يومياً لكل مجموعة متأخرة.
   *
   * الدليل على "already" لازم يكون **مستقل عن محتوى `notifications` نفسه** —
   * كان بيتحقق سابقاً بالبحث في `notifications.some(...)`، فلو المالك حذف
   * الإشعار ده بنفسه (والحصة لسه متأخرة فعلاً)، `notifications` بيتغيّر →
   * الـeffect بيعيد التشغيل فوراً (هو أصلاً dependency) → "already" بترجع
   * false تاني لأن الإشعار اتمسح → بيتولّد نفس الإشعار من جديد على طول. ده
   * بالظبط البج المُبلَّغ: "بعد ما تحذف الإشعار يرجع تاني". الحل: تتبّع
   * "تم التنبيه عليه اليوم" في `useRef` منفصل تماماً عن قائمة الإشعارات —
   * الحذف بقى حذف فعلي، مش بيتراجع لحد ما نفس الحصة تتأخر تاني بكرة.
   */
  const alertedTodayRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const day = new Date().toDateString();
    for (const row of activeNow) {
      if (!row.started || row.activated || row.lateMinutes < 10) continue;
      const alertKey = `${row.slotId}-${day}`;
      if (alertedTodayRef.current.has(alertKey)) continue;
      alertedTodayRef.current.add(alertKey);
      pushNotification(
        "session_late",
        "critical",
        `تأخير في تفعيل حصة ${row.group.name}`,
        `${row.group.teacher_name} · ${row.time} · مرّ ${row.lateMinutes} دقيقة بدون رفع واجب أو تسجيل حضور`,
      );
    }
  }, [activeNow]);

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
          value={formatNumber(todaySlots.length)}
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
      {heavyPanelsReady ? <TodayOverviewPanels /> : <HeavyPanelSkeleton />}

      {/* === جدول اليوم (مفصّل) === */}
      <Panel
        title={`جدول اليوم — ${today}`}
        description={`${formatNumber(todaySlots.length)} حصة · ${formatNumber(teachersToday.length)} مدرس`}
      >
        {todaySlots.length === 0 ? (
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
                {[...todaySlots]
                  .sort((a, b) => (a.time < b.time ? -1 : 1))
                  .map((s) => (
                    <tr key={s.id} className="border-b border-border last:border-0">
                      <td className="py-3 font-black text-foreground">{s.subject}</td>
                      <td className="py-3 font-bold text-foreground">{s.teacher_name}</td>
                      <td className="py-3 font-bold text-muted-foreground">{s.grade}</td>
                      <td className="py-3 font-extrabold">{s.time}</td>
                      <td className="py-3 font-extrabold">قاعة {s.room}</td>
                      <td className="py-3 font-extrabold">
                        {groups.find((g) => g.id === s.group_id)?.name ?? "—"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* === المجموعات النشطة + التنبيهات === */}
      <div className="grid gap-6 xl:grid-cols-2">
        {heavyPanelsReady ? <LiveActiveGroupsCard /> : <HeavyPanelSkeleton />}
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
      {heavyPanelsReady ? <CenterActivityPanels /> : <HeavyPanelSkeleton />}

      {/* === الحضور الأسبوعي (محسّن) === */}
      {heavyPanelsReady ? <EnhancedWeeklyAttendance /> : <HeavyPanelSkeleton />}

      {/* === الإشعارات + سجل النشاط (scrollable + بحث + حذف) === */}
      <div className="grid gap-6 xl:grid-cols-2">
        <NotificationsPanel notifications={notifications} />
        {heavyPanelsReady ? <ActivityLogPanel entries={activityLog} /> : <HeavyPanelSkeleton />}
      </div>

      {/* === عبارات المواد + ملاحظة للمدرس/الموظف === */}
      <div className="grid gap-6 xl:grid-cols-2">
        <SubjectQuotesCard />
        <OwnerNotesCard canCompose audience="teacher" />
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
              // العدد الحقيقي (الروستر الفعلي)، مش g.enrolled المخزَّن اللي ممكن
              // ينحرف عن الواقع لو أي مزامنة فشلت بصمت (راجع getEnrolledCount).
              const enrolled = getEnrolledCount(state, g.id);
              const pct = g.capacity ? Math.round((enrolled / g.capacity) * 100) : 0;
              return (
                <div key={g.id} className="rounded-xl border-2 border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-black text-foreground">{g.name}</p>
                    <StatusBadge
                      tone={pct >= 100 ? "destructive" : pct >= 85 ? "warning" : "success"}
                    >
                      {formatNumber(enrolled)} / {formatNumber(g.capacity)}
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

/** بديل خفيف الوزن للوحات الثقيلة أثناء الـtick الأول من الرسم — انظر heavyPanelsReady فوق. */
function HeavyPanelSkeleton() {
  return (
    <div className="card-crisp flex h-40 items-center justify-center p-5">
      <p className="text-sm font-bold text-muted-foreground">جارٍ التحميل…</p>
    </div>
  );
}
