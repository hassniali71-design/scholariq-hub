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
      {
        property: "og:description",
        content: "قياس التزام كل مدرس بخطوات الحصة الثمان ورصد المخالفات.",
      },
    ],
  }),
  component: CompliancePage,
});

/**
 * Per-step compliance snapshot (mock aggregation of session telemetry).
 * CURRICULUM_ENGINE_SPEC.md §13-ج's 8 timed steps — matches SessionStepKey.
 */
const stepCompliance = [
  { key: "last_homework", value: 94 },
  { key: "lesson", value: 88 },
  { key: "questions", value: 81 },
  { key: "book_exercise", value: 90 },
  { key: "activity_review", value: 92 },
  { key: "release_homework", value: 85 },
  { key: "release_e_homework", value: 83 },
  { key: "behavior", value: 76 },
] as const;

function CompliancePage() {
  const state = useDataStore();
  const { teachers } = state;
  /** §18-1: real aggregate from SessionRecord/TimerExtension, falling back to the
   *  seeded static value per teacher until they have actual session data. */
  const compliance = new Map(teachers.map((t) => [t.id, getTimerCompliance(state, t.id)]));
  const avg = Math.round(
    teachers.reduce((s, t) => s + (compliance.get(t.id) ?? 0), 0) / teachers.length,
  );
  const breaches = teachers.reduce((s, t) => s + t.sla_breaches, 0);

  /** طلاب كل مدرس = المشتركون في مادته — منها متوسط الدرجات ونسبة الحضور الحقيقية. */
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

  return (
    <AppShell
      role="owner"
      title="التزام المدرسين (SLA)"
      description="قياس الالتزام بمراحل الحصة الأربع وتوقيتاتها المعتمدة"
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="متوسط الالتزام العام"
          value={formatPercent(avg)}
          icon={Timer}
          tone={avg >= 90 ? "success" : "warning"}
        />
        <StatCard
          label="إجمالي المخالفات"
          value={formatNumber(breaches)}
          icon={ShieldAlert}
          tone="destructive"
          trendDirection="down"
          trend="خلال آخر ٣٠ يوم"
        />
        <StatCard
          label="حصص مكتملة المراحل"
          value={formatNumber(412)}
          icon={CheckCircle2}
          tone="success"
        />
        <StatCard label="متوسط تأخير البدء" value="٤:١٢ دقيقة" icon={Clock} tone="warning" />
      </div>

      <Panel title="الالتزام حسب مرحلة الحصة" description="نسبة الحصص التي احترمت توقيت المرحلة">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SESSION_STEPS.map((step, i) => {
            const value = stepCompliance.find((s) => s.key === step.key)!.value;
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
      </Panel>

      <Panel title="بطاقة التزام كل مدرس" description="ترتيب تنازلي حسب نسبة الالتزام">
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
