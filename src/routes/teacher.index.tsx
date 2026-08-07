import { Link, createFileRoute } from "@tanstack/react-router";
import { CalendarDays, MonitorPlay, Timer, TrendingUp, Users } from "lucide-react";

import { PerformanceChart } from "@/components/dashboard/Charts";
import { Panel, StatCard, StatusBadge } from "@/components/dashboard/StatCard";
import { AppShell } from "@/components/layout/AppShell";
import { formatNumber, formatPercent } from "@/lib/format";
import { SESSION_STEPS, groups, performanceSeries, students, teachers } from "@/lib/mock-data";

export const Route = createFileRoute("/teacher/")({
  head: () => ({
    meta: [
      { title: "لوحة المدرس — مركز قيادة الحصص" },
      {
        name: "description",
        content: "مجموعات المدرس ومواعيد الحصص ونسبة الالتزام بالتايمر وبدء وضع الحصة.",
      },
      { property: "og:title", content: "لوحة المدرس — مركز قيادة الحصص" },
      {
        property: "og:description",
        content: "إدارة المجموعات والحصص وبدء وضع العرض التفاعلي بالتايمرات.",
      },
    ],
  }),
  component: TeacherHome,
});

function TeacherHome() {
  const me = teachers[0]!;

  return (
    <AppShell
      role="teacher"
      title={`أهلاً، ${me.full_name}`}
      description={`${me.subject} · ${formatNumber(me.groups)} مجموعات · ${formatNumber(me.students)} طالب`}
      actions={
        <Link
          to="/teacher/session"
          className="flex items-center gap-2 rounded-xl bg-navy px-5 py-3 text-sm font-black text-navy-foreground transition-opacity hover:opacity-90"
        >
          <MonitorPlay className="size-5" /> بدء وضع الحصة
        </Link>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="طلابي" value={formatNumber(me.students)} icon={Users} />
        <StatCard
          label="التزامي بالتايمر"
          value={formatPercent(me.timer_compliance)}
          icon={Timer}
          tone="success"
        />
        <StatCard label="حصص هذا الأسبوع" value={formatNumber(9)} icon={CalendarDays} />
        <StatCard label="متوسط درجات طلابي" value={formatNumber(88)} icon={TrendingUp} tone="success" />
      </div>

      <Panel title="مراحل الحصة المعتمدة" description="محرك التايمر الرباعي المطبق داخل الفصل">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {SESSION_STEPS.map((s, i) => (
            <div key={s.key} className="rounded-xl border-2 border-border p-4">
              <span className="flex size-9 items-center justify-center rounded-lg bg-navy font-black text-navy-foreground">
                {i + 1}
              </span>
              <p className="mt-3 font-black text-foreground">{s.title}</p>
              <p className="mt-1 text-xs font-bold text-muted-foreground">{s.hint}</p>
              <p className="kpi-number mt-3 text-2xl">{Math.round(s.duration / 60)} دقيقة</p>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="جدول مجموعاتي" description="المواعيد والقاعات">
          <div className="space-y-3">
            {groups.map((g) => (
              <div
                key={g.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-border p-4"
              >
                <div>
                  <p className="font-black text-foreground">{g.name}</p>
                  <p className="text-xs font-bold text-muted-foreground">
                    {g.grade} · {g.room} · {formatNumber(g.enrolled)} طالب
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge tone="primary">
                    {g.weekday} {g.time}
                  </StatusBadge>
                  <Link
                    to="/teacher/session"
                    className="rounded-xl border-2 border-navy px-3 py-2 text-xs font-black text-navy hover:bg-navy hover:text-navy-foreground"
                  >
                    ابدأ
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="مستوى الطلاب" description="متوسط الدرجات حسب المادة">
          <PerformanceChart data={performanceSeries} />
        </Panel>
      </div>

      <Panel title="طلاب يحتاجون متابعة" description="أقل من ٨٠٪ حضور أو درجات">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {students
            .filter((s) => s.attendance_rate < 90 || s.avg_score < 80)
            .map((s) => (
              <div key={s.id} className="rounded-xl border-2 border-border p-4">
                <p className="font-black text-foreground">{s.full_name}</p>
                <p className="text-xs font-bold text-muted-foreground">{s.group_name}</p>
                <div className="mt-3 flex gap-2">
                  <StatusBadge tone={s.attendance_rate < 80 ? "destructive" : "warning"}>
                    حضور {formatPercent(s.attendance_rate)}
                  </StatusBadge>
                  <StatusBadge tone={s.avg_score < 70 ? "destructive" : "warning"}>
                    متوسط {formatNumber(s.avg_score)}
                  </StatusBadge>
                </div>
              </div>
            ))}
        </div>
      </Panel>
    </AppShell>
  );
}
