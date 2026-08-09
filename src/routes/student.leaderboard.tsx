import { createFileRoute } from "@tanstack/react-router";
import { Crown, Medal, Sparkles, Trophy } from "lucide-react";

import { Panel, StatCard } from "@/components/dashboard/StatCard";
import { AppShell } from "@/components/layout/AppShell";
import { formatNumber } from "@/lib/format";
import { useCurrentStudent } from "@/hooks/use-current-student";
import { useDataStore } from "@/lib/data-store";

export const Route = createFileRoute("/student/leaderboard")({
  head: () => ({
    meta: [
      { title: "لوحة الشرف والنقاط — الطالب" },
      {
        name: "description",
        content: "ترتيب الطلاب حسب نقاط التحفيز والشارات المكتسبة داخل السنتر.",
      },
      { property: "og:title", content: "لوحة الشرف والنقاط — الطالب" },
      {
        property: "og:description",
        content: "تنافس على نقاط التحفيز واجمع الشارات مع كل حصة.",
      },
    ],
  }),
  component: LeaderboardPage,
});

const badges = [
  { icon: Trophy, title: "بطل الأسئلة", text: "١٢ إجابة صحيحة متتالية" },
  { icon: Medal, title: "الالتزام الكامل", text: "حضور ١٠٠٪ لمدة شهر" },
  { icon: Sparkles, title: "واجب بلا تأخير", text: "٨ واجبات في موعدها" },
  { icon: Crown, title: "الأعلى تقدماً", text: "+١٥٪ تحسن في الدرجات" },
];

function LeaderboardPage() {
  const { leaderboard } = useDataStore();
  const student = useCurrentStudent();
  const top = leaderboard[0]!;
  const me = leaderboard.find((e) => e.student_id === student.id) ?? {
    rank: leaderboard.length + 1,
    student_id: student.id,
    student_name: student.full_name,
    points: student.points,
  };

  return (
    <AppShell role="student" title="لوحة الشرف" description="نظام النقاط والتحفيز داخل السنتر">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="نقاطي" value={formatNumber(me.points)} icon={Sparkles} tone="warning" />
        <StatCard label="ترتيبي" value={formatNumber(me.rank)} icon={Trophy} />
        <StatCard
          label="الفارق عن المركز الأول"
          value={formatNumber(top.points - me.points)}
          icon={Crown}
          tone="destructive"
          trendDirection="down"
          trend="نقطة للوصول للقمة"
        />
      </div>

      <Panel title="المنصة" description="أعلى ثلاثة طلاب هذا الشهر">
        <div className="grid gap-4 md:grid-cols-3">
          {leaderboard.slice(0, 3).map((e) => (
            <div
              key={e.rank}
              className={
                e.rank === 1
                  ? "rounded-2xl border-2 border-navy bg-navy p-6 text-center text-navy-foreground"
                  : "rounded-2xl border-2 border-border p-6 text-center"
              }
            >
              <span className="text-3xl">{e.rank === 1 ? "🥇" : e.rank === 2 ? "🥈" : "🥉"}</span>
              <p className="mt-3 text-lg font-black">{e.student_name}</p>
              <p
                className={
                  e.rank === 1 ? "mt-2 text-3xl font-black" : "kpi-number mt-2 text-3xl"
                }
              >
                {formatNumber(e.points)}
              </p>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="الترتيب الكامل" description="محدّث بعد كل حصة">
        <div className="space-y-2">
          {leaderboard.map((e) => (
            <div
              key={e.rank}
              className={
                e.student_id === student.id
                  ? "flex items-center justify-between gap-3 rounded-xl border-2 border-primary bg-primary/5 p-4"
                  : "flex items-center justify-between gap-3 rounded-xl border-2 border-border p-4"
              }
            >
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-lg bg-muted font-black">
                  {formatNumber(e.rank)}
                </span>
                <p className="font-black text-foreground">{e.student_name}</p>
              </div>
              <span className="kpi-number text-lg">{formatNumber(e.points)}</span>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="شاراتي" description="تُمنح تلقائياً حسب الأداء">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {badges.map((b) => (
            <div key={b.title} className="rounded-xl border-2 border-border p-4 text-center">
              <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <b.icon className="size-6" />
              </span>
              <p className="mt-3 font-black text-foreground">{b.title}</p>
              <p className="mt-1 text-xs font-bold text-muted-foreground">{b.text}</p>
            </div>
          ))}
        </div>
      </Panel>
    </AppShell>
  );
}
