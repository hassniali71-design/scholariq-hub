import { Link, createFileRoute } from "@tanstack/react-router";
import { CalendarCheck, MessageSquareText, ShieldCheck, Target, Wallet } from "lucide-react";

import { AttendanceChart, ScoreTrendChart } from "@/components/dashboard/Charts";
import { Panel, StatCard, StatusBadge } from "@/components/dashboard/StatCard";
import { AppShell } from "@/components/layout/AppShell";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import {
  homeworkTasks,
  quizResults,
  studentAttendanceSeries,
  students,
  teacherNotes,
  whatsappLogs,
} from "@/lib/mock-data";

export const Route = createFileRoute("/parent/")({
  head: () => ({
    meta: [
      { title: "بوابة ولي الأمر — متابعة لحظية" },
      {
        name: "description",
        content: "متابعة حضور الابن ونتائجه اليومية وملاحظات المدرسين وحالة السداد لحظياً.",
      },
      { property: "og:title", content: "بوابة ولي الأمر — متابعة لحظية" },
      {
        property: "og:description",
        content: "كل ما يخص ابنك: الحضور، الدرجات، الواجبات، والإشعارات في مكان واحد.",
      },
    ],
  }),
  component: ParentPortal,
});

function ParentPortal() {
  const child = students[0]!;
  const trend = quizResults
    .map((q) => ({ label: q.date, score: Math.round((q.score / q.max_score) * 100) }))
    .reverse();

  return (
    <AppShell
      role="parent"
      title={`متابعة: ${child.full_name}`}
      description={`${child.grade} · ${child.group_name} · تحديث لحظي بعد كل حصة`}
      actions={
        <Link
          to="/parent/messages"
          className="flex items-center gap-2 rounded-xl border-2 border-navy px-4 py-2.5 text-sm font-black text-navy hover:bg-navy hover:text-navy-foreground"
        >
          <MessageSquareText className="size-4" /> سجل الواتساب
        </Link>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="نسبة الحضور" value={formatPercent(child.attendance_rate)} icon={CalendarCheck} tone="success" />
        <StatCard label="متوسط الدرجات" value={formatNumber(child.avg_score)} icon={Target} />
        <StatCard
          label="حالة السداد"
          value={child.payment_status === "paid" ? "مسدد" : formatCurrency(child.balance_due)}
          icon={Wallet}
          tone={child.payment_status === "paid" ? "success" : "destructive"}
        />
        <StatCard label="نقاط التحفيز" value={formatNumber(child.points)} icon={ShieldCheck} tone="warning" />
      </div>

      <Panel title="حالة اليوم" description="آخر تسجيل حضور وتقييم">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border-2 border-border p-4">
            <p className="text-sm font-black text-muted-foreground">الحضور</p>
            <p className="mt-2 text-xl font-black text-foreground">حضر الساعة ٣:٥٢ م</p>
            <StatusBadge tone="success" className="mt-3">
              داخل الحصة الآن
            </StatusBadge>
          </div>
          <div className="rounded-xl border-2 border-border p-4">
            <p className="text-sm font-black text-muted-foreground">تقييم الواجب</p>
            <p className="kpi-number mt-2 text-3xl">٨ / ١٠</p>
            <StatusBadge tone="primary" className="mt-3">
              أعلى من متوسط المجموعة
            </StatusBadge>
          </div>
          <div className="rounded-xl border-2 border-border p-4">
            <p className="text-sm font-black text-muted-foreground">سؤال الحصة</p>
            <p className="kpi-number mt-2 text-3xl">١٠ / ١٠</p>
            <StatusBadge tone="success" className="mt-3">
              إجابة صحيحة خلال ٤٢ ثانية
            </StatusBadge>
          </div>
        </div>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="منحنى النتائج" description="نسبة الدرجات في آخر التقييمات">
          <ScoreTrendChart data={trend} />
        </Panel>
        <Panel title="سجل الحضور" description="عدد الحصص المحضورة أسبوعياً">
          <AttendanceChart data={studentAttendanceSeries} />
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="ملاحظات المدرسين" description="توصيات المتابعة المنزلية">
          <div className="space-y-3">
            {teacherNotes.map((n) => (
              <div key={n.id} className="rounded-xl border-2 border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-black text-foreground">{n.teacher_name}</p>
                  <StatusBadge tone={n.tone === "positive" ? "success" : n.tone === "warning" ? "warning" : "neutral"}>
                    {n.subject} · {n.date}
                  </StatusBadge>
                </div>
                <p className="mt-2 text-sm font-extrabold text-foreground">{n.note}</p>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="الواجبات المطلوبة" description="تابع التسليم في موعده">
          <div className="space-y-3">
            {homeworkTasks.map((h) => (
              <div
                key={h.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-border p-4"
              >
                <div>
                  <p className="font-black text-foreground">{h.title}</p>
                  <p className="text-xs font-bold text-muted-foreground">
                    {h.subject} · التسليم {h.due_date}
                  </p>
                </div>
                <StatusBadge
                  tone={h.status === "graded" ? "success" : h.status === "submitted" ? "primary" : "warning"}
                >
                  {h.status === "graded" ? "مصحح" : h.status === "submitted" ? "تم التسليم" : "لم يُسلَّم"}
                </StatusBadge>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel
        title="آخر إشعارات الواتساب"
        description="سجل كامل لكل رسالة أُرسلت لولي الأمر"
        actions={
          <Link to="/parent/messages" className="text-sm font-black text-primary hover:underline">
            عرض السجل الكامل
          </Link>
        }
      >
        <div className="space-y-3">
          {whatsappLogs.slice(0, 3).map((w) => (
            <div key={w.id} className="rounded-xl border-2 border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-black text-muted-foreground">{w.sent_at}</p>
                <StatusBadge tone={w.delivered ? "success" : "destructive"}>
                  {w.delivered ? "تم التسليم" : "لم تُسلَّم"}
                </StatusBadge>
              </div>
              <p className="mt-2 text-sm font-extrabold text-foreground">{w.message}</p>
            </div>
          ))}
        </div>
      </Panel>
    </AppShell>
  );
}
