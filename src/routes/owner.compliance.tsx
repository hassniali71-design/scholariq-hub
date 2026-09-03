import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Clock, ShieldAlert, Timer } from "lucide-react";

import { Panel, StatCard, StatusBadge } from "@/components/dashboard/StatCard";
import { AppShell } from "@/components/layout/AppShell";
import { formatNumber, formatPercent } from "@/lib/format";
import { getTimerCompliance, useDataStore } from "@/lib/data-store";
import { SESSION_STEPS } from "@/lib/mock-data";

export const Route = createFileRoute("/owner/compliance")({
  head: () => ({
    meta: [
      { title: "التزام المدرسين بالتايمر — لوحة المالك" },
      {
        name: "description",
        content: "مؤشرات SLA لالتزام المدرسين بخطوات الحصة الثمان وتايمر كل خطوة.",
      },
      { property: "og:title", content: "التزام المدرسين بالتايمر" },
      { property: "og:description", content: "قياس التزام كل مدرس بخطوات الحصة الثمان ورصد المخالفات." },
    ],
  }),
  component: CompliancePage,
});

function CompliancePage() {
  const state = useDataStore();
  const { teachers, sessionRecords, timerExtensions } = state;

  const compliance = new Map(teachers.map((t) => [t.id, getTimerCompliance(state, t.id)]));
  const avg = teachers.length
    ? Math.round(
        teachers.reduce((s, t) => s + (compliance.get(t.id) ?? 0), 0) / teachers.length,
      )
    : 0;
  const breaches = teachers.reduce((s, t) => s + t.sla_breaches, 0);

  const completedSessions = sessionRecords.length;
  const totalExtensionSeconds = timerExtensions.reduce(
    (s, e) => s + Number(e.added_seconds || 0),
    0,
  );
  const avgLateSeconds = (() => {
    const late: number[] = [];
    for (const r of sessionRecords) {
      const schedAt = new Date(r.date).getTime();
      if (!Number.isFinite(schedAt)) continue;
      const firstEvent = state.sessionEvents
        .filter((e) => e.session_id === r.id)
        .map((e) => new Date(e.at).getTime())
        .filter((v) => Number.isFinite(v))
        .sort((a, b) => a - b)[0];
      if (firstEvent === undefined) continue;
      const delta = (firstEvent - schedAt) / 1000;
      if (delta > 0) late.push(delta);
    }
    if (late.length === 0) return 0;
    return Math.round(late.reduce((s, v) => s + v, 0) / late.length);
  })();
  const avgLateMin = Math.floor(avgLateSeconds / 60);
  const avgLateSec = avgLateSeconds % 60;
  const avgLateText = `${avgLateMin}:${String(avgLateSec).padStart(2, "0")} دقيقة`;
  const extMin = Math.floor(totalExtensionSeconds / 60);

  const teacherStats = new Map(
    teachers.map((t) => {
      const list = state.students.filter((s) => s.subject_ids.includes(t.subject_id));
      const avgScore = list.length
        ? Math.round(list.reduce((s, st) => s + st.avg_score, 0) / list.length)
        : 0;
      const attendance = list.length
        ? Math.round(list.reduce((s, st) => s + st.attendance_rate, 0) / list.length)
        : 0;
      return [t.id, { count: list.length, avgScore, attendance }];
    }),
  );

  const hasRealSessions = sessionRecords.length > 0;

  return (
    <AppShell
      role="owner"
      title="التزام المدرسين (SLA)"
      description="قياس الالتزام بمراحل الحصة الثمان وتوقيتها المعتمد"
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="متوسط الالتزام العام"
          value={formatPercent(avg)}
          icon={Timer}
          tone={avg >= 90 ? "success" : "warning"}
          trend={teachers.length > 0 ? `${formatNumber(teachers.length)} مدرس` : "لا يوجد مدرسون"}
        />
        <StatCard
          label="إجمالي المخالفات"
          value={formatNumber(breaches)}
          icon={ShieldAlert}
          tone={breaches > 0 ? "destructive" : "success"}
          trend={breaches > 0 ? "مُسجَّلة في بيانات المدرسين" : "لا توجد مخالفات"}
        />
        <StatCard
          label="حصص مكتملة المراحل"
          value={formatNumber(completedSessions)}
          icon={CheckCircle2}
          tone={completedSessions > 0 ? "success" : "primary"}
          trend={hasRealSessions ? "من سجل الحصص الفعلي" : "لا توجد حصص مُسجَّلة بعد"}
        />
        <StatCard
          label="إجمالي تمديد التايمر"
          value={totalExtensionSeconds > 0 ? `${formatNumber(extMin)} د` : "0 د"}
          icon={Clock}
          tone={totalExtensionSeconds > 0 ? "warning" : "primary"}
          trend={
            avgLateSeconds > 0
              ? `متوسط تأخير البدء: ${avgLateText}`
              : "لم يُسجَّل تأخير في البدء"
          }
        />
      </div>

      <Panel
        title="الالتزام حسب مرحلة الحصة"
        description={
          hasRealSessions
            ? "نسبة الحصص التي احترمت توقيت المرحلة"
            : "لا توجد حصص حقيقية مُسجَّلة بعد — هذا القسم سيُملأ تلقائياً بعد أول حصة فعلية"
        }
      >
        {!hasRealSessions ? (
          <p className="rounded-xl border-2 border-dashed border-border p-6 text-center text-base font-bold text-muted-foreground">
            لا توجد حصص حقيقية مُسجَّلة بعد — هذا القسم سيُملأ تلقائياً بعد أول حصة فعلية.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {SESSION_STEPS.map((step, i) => {
              const stepTimers = timerExtensions.filter((e) => e.step_key === step.key);
              const planned = step.duration * Math.max(1, sessionRecords.length);
              const used = planned - stepTimers.reduce((s, e) => s + Number(e.added_seconds || 0), 0);
              const value = planned > 0 ? Math.min(100, Math.max(0, Math.round((used / planned) * 100))) : 0;
              return (
                <div key={step.key} className="rounded-xl border-2 border-border p-4">
                  <div className="flex items-center justify-between">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-navy text-sm font-black text-navy-foreground">
                      {i + 1}
                    </span>
                    <StatusBadge
                      tone={value >= 90 ? "success" : value >= 80 ? "warning" : "destructive"}
                    >
                      {formatPercent(value)}
                    </StatusBadge>
                  </div>
                  <p className="mt-3 font-black text-foreground">{step.title}</p>
                  <p className="mt-1 text-xs font-bold text-muted-foreground">
                    المدة المعتمدة: {Math.round(step.duration / 60)} دقيقة
                  </p>
                  <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${value}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      <Panel title="بطاقة التزام كل مدرس" description="ترتيب تنازلي حسب نسبة الالتزام">
        {teachers.length === 0 ? (
          <p className="rounded-xl border-2 border-dashed border-border p-6 text-center text-base font-bold text-muted-foreground">
            لا يوجد مدرسون مُسجَّلون بعد.
          </p>
        ) : (
          <div className="space-y-4">
            {[...teachers]
              .sort((a, b) => (compliance.get(b.id) ?? 0) - (compliance.get(a.id) ?? 0))
              .map((t) => {
                const value = compliance.get(t.id) ?? 0;
                return (
                  <div key={t.id} className="rounded-xl border-2 border-border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-black text-foreground">{t.full_name}</p>
                        <p className="text-xs font-bold text-muted-foreground">
                          {t.subject} · {formatNumber(t.groups)} مجموعات · {formatNumber(t.students)}{" "}
                          طالب
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge tone={t.sla_breaches > 5 ? "destructive" : "neutral"}>
                          {formatNumber(t.sla_breaches)} مخالفة
                        </StatusBadge>
                        <span className="kpi-number text-2xl">{formatPercent(value)}</span>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <MiniStat
                        label="متوسط درجات طلابه"
                        value={formatPercent(teacherStats.get(t.id)?.avgScore ?? 0)}
                      />
                      <MiniStat
                        label="نسبة حضور طلابه"
                        value={formatPercent(teacherStats.get(t.id)?.attendance ?? 0)}
                      />
                      <MiniStat
                        label="عدد طلابه الفعلي"
                        value={formatNumber(teacherStats.get(t.id)?.count ?? 0)}
                      />
                    </div>
                    <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className={
                          value >= 90
                            ? "h-full rounded-full bg-success"
                            : value >= 80
                              ? "h-full rounded-full bg-warning"
                              : "h-full rounded-full bg-destructive"
                        }
                        style={{ width: `${value}%` }}
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

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border-2 border-border bg-canvas p-3">
      <p className="text-sm font-bold text-muted-foreground">{label}</p>
      <p className="kpi-number text-xl">{value}</p>
    </div>
  );
}
