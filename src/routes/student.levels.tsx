import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { toast } from "sonner";

import { SubjectGauge } from "@/components/dashboard/Charts";
import { Panel, StatusBadge } from "@/components/dashboard/StatCard";
import { AppShell } from "@/components/layout/AppShell";
import { useCurrentStudent } from "@/hooks/use-current-student";
import {
  getFourTierLabel,
  getOverallStudentPerformance,
  getPerformanceLayers,
  useDataStore,
} from "@/lib/data-store";
import { formatNumber } from "@/lib/format";

export const Route = createFileRoute("/student/levels")({
  head: () => ({
    meta: [
      { title: "المستويات — الطالب" },
      {
        name: "description",
        content: "تفاصيل رقمية كاملة لكل مادة وكل طبقة أداء، مع تفسير واضح لكل رقم.",
      },
    ],
  }),
  component: LevelsPage,
});

function TierCard({ label, pct, hasData }: { label: string; pct: number; hasData: boolean }) {
  const tier = getFourTierLabel(pct);
  return (
    <div className="rounded-xl border-2 border-border p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-black text-foreground">{label}</p>
        <span className="kpi-number text-xl">{hasData ? formatNumber(pct) : "—"}%</span>
      </div>
      <StatusBadge tone={hasData ? tier.tone : "neutral"} className="mt-2">
        {hasData ? tier.text : "لا يوجد تقييم مسجَّل بعد لهذه الطبقة"}
      </StatusBadge>
    </div>
  );
}

function LevelsPage() {
  const state = useDataStore();
  const me = useCurrentStudent();
  useEffect(() => {
    if (!me) toast.error("الجلسة منتهية — سجّل الدخول من جديد");
  }, [me]);

  if (!me) return <Navigate to="/login" />;

  const overall = getOverallStudentPerformance(state, me.id);
  const layers = getPerformanceLayers(state, me.id);
  const overallTier = getFourTierLabel(overall.overallAvg);

  return (
    <AppShell
      role="student"
      title="المستويات"
      description="تفاصيل رقمية كاملة لكل مادة وكل طبقة أداء — بتفسير واضح لكل رقم"
    >
      <Panel title="مستواك العام" description="متوسط كل موادك">
        <div className="flex flex-wrap items-center gap-6">
          <div>
            <p className="kpi-number text-5xl">{formatNumber(overall.overallAvg)}%</p>
            <StatusBadge tone={overallTier.tone} className="mt-2">
              {overallTier.text}
            </StatusBadge>
          </div>
        </div>
      </Panel>

      <Panel title="مستواك في كل مادة" description="Gauge منفصل لكل مادة على حدة">
        {overall.bySubject.length === 0 ? (
          <p className="rounded-xl border-2 border-dashed border-border p-6 text-center text-sm font-bold text-muted-foreground">
            لسه مفيش تقييمات مسجَّلة في أي مادة.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4">
            {overall.bySubject.map(({ subject, summary }) => (
              <SubjectGauge key={subject.id} label={subject.name} value={summary.overallAvg} />
            ))}
          </div>
        )}
      </Panel>

      <Panel title="التفاصيل حسب طبقة الأداء" description="كل طبقة بمتوسطها الحقيقي وتفسيرها">
        <div className="grid gap-4 sm:grid-cols-2">
          {layers.map((l) => (
            <TierCard key={l.key} label={l.label} pct={l.pct} hasData={l.hasData} />
          ))}
        </div>
      </Panel>

      <Panel title="تفاصيل كل مادة على حدة" description="رقم منفصل لكل مادة، مش مجمَّع">
        <div className="space-y-2">
          {overall.bySubject.map(({ subject, summary }) => {
            const tier = getFourTierLabel(summary.overallAvg);
            return (
              <div
                key={subject.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-border p-3"
              >
                <div>
                  <p className="text-sm font-black text-foreground">{subject.name}</p>
                  <p className="text-xs font-bold text-muted-foreground">
                    {formatNumber(summary.lessonsRecordedCount)} حصة مسجَّلة ·{" "}
                    {summary.trend === "up"
                      ? "في تحسّن"
                      : summary.trend === "down"
                        ? "في تراجع"
                        : "مستقر"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="kpi-number text-lg">{formatNumber(summary.overallAvg)}%</span>
                  <StatusBadge tone={tier.tone}>{tier.text}</StatusBadge>
                </div>
              </div>
            );
          })}
        </div>
      </Panel>
    </AppShell>
  );
}
