import { createFileRoute, Navigate } from "@tanstack/react-router";
import { Award, Crown, Flame, Sparkles, Trophy } from "lucide-react";
import { useEffect, useMemo } from "react";
import { toast } from "sonner";

import { Panel, StatCard } from "@/components/dashboard/StatCard";
import { AppShell } from "@/components/layout/AppShell";
import { formatNumber } from "@/lib/format";
import { useCurrentStudent } from "@/hooks/use-current-student";
import { getEarnedBadges, useDataStore, type EarnedBadge } from "@/lib/data-store";

export const Route = createFileRoute("/student/leaderboard")({
  head: () => ({
    meta: [
      { title: "لوحة الشرف والنقاط — الطالب" },
      {
        name: "description",
        content: "ترتيبك داخل مجموعتك حسب نقاط التحفيز، والشارات المكتسبة فعلياً.",
      },
    ],
  }),
  component: LeaderboardPage,
});

const BADGE_ICON: Record<EarnedBadge["key"], typeof Trophy> = {
  question_streak: Trophy,
  full_attendance: Award,
  no_late_homework: Sparkles,
  improving: Flame,
};

function LeaderboardPage() {
  const state = useDataStore();
  const student = useCurrentStudent();
  useEffect(() => {
    if (!student) toast.error("الجلسة منتهية — سجّل الدخول من جديد");
  }, [student]);

  // الترتيب داخل سياق مجموعته الأساسية فقط — من معه في نفس المجموعة تحديداً،
  // مش كل طلاب السنتر مجمَّعين بلا تمييز.
  const groupmates = useMemo(() => {
    if (!student?.group_id) return [];
    return [...state.students]
      .filter((s) => s.group_id === student.group_id)
      .sort((a, b) => b.points - a.points)
      .map((s, i) => ({ rank: i + 1, student_id: s.id, student_name: s.full_name, points: s.points }));
  }, [state.students, student?.group_id]);

  const badges = useMemo(
    () => (student ? getEarnedBadges(state, student.id) : []),
    [state, student],
  );

  if (!student) return <Navigate to="/login" />;

  const top = groupmates[0] ?? null;
  const me = groupmates.find((e) => e.student_id === student.id) ?? {
    rank: groupmates.length + 1,
    student_id: student.id,
    student_name: student.full_name,
    points: student.points,
  };

  return (
    <AppShell
      role="student"
      title="لوحة الشرف"
      description={student.group_id ? `ترتيبك داخل مجموعة ${student.group_name}` : "لسه مش مسجَّل في مجموعة"}
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="نقاطي" value={formatNumber(me.points)} icon={Sparkles} tone="warning" />
        <StatCard label="ترتيبي في مجموعتي" value={formatNumber(me.rank)} icon={Trophy} />
        <StatCard
          label="الفارق عن الأول في مجموعتي"
          value={formatNumber(top ? top.points - me.points : 0)}
          icon={Crown}
          tone="destructive"
          trendDirection="down"
          trend="نقطة للوصول للقمة"
        />
      </div>

      {groupmates.length === 0 ? (
        <Panel title="الترتيب" description="لسه مافيش بيانات">
          <p className="rounded-xl border-2 border-dashed border-border p-6 text-center text-sm font-bold text-muted-foreground">
            لسه مش مسجَّل في مجموعة، أو مجموعتك لسه بلا طلاب مسجَّلين نقاط.
          </p>
        </Panel>
      ) : (
        <>
          <Panel title="المنصة" description="أعلى ثلاثة في مجموعتك">
            <div className="grid gap-4 md:grid-cols-3">
              {groupmates.slice(0, 3).map((e) => (
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
                  <p className={e.rank === 1 ? "mt-2 text-3xl font-black" : "kpi-number mt-2 text-3xl"}>
                    {formatNumber(e.points)}
                  </p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="ترتيب مجموعتي بالكامل" description="محدّث بعد كل حصة">
            <div className="space-y-2">
              {groupmates.map((e) => (
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
        </>
      )}

      <Panel title="شاراتي" description="تُمنح تلقائياً حسب أدائك الحقيقي فقط">
        {badges.length === 0 ? (
          <p className="rounded-xl border-2 border-dashed border-border p-6 text-center text-sm font-bold text-muted-foreground">
            لسه معندكش شارات — استمر في الحضور والإجابة على الأسئلة وتسليم الواجبات في موعدها.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {badges.map((b) => {
              const Icon = BADGE_ICON[b.key];
              return (
                <div key={b.key} className="rounded-xl border-2 border-success/30 bg-success/5 p-4 text-center">
                  <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-success/15 text-success">
                    <Icon className="size-6" />
                  </span>
                  <p className="mt-3 font-black text-foreground">{b.title}</p>
                  <p className="mt-1 text-xs font-bold text-muted-foreground">{b.text}</p>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </AppShell>
  );
}
