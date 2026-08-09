import { createFileRoute } from "@tanstack/react-router";
import { Award, BookOpenCheck, CalendarCheck, Flame, Target } from "lucide-react";

import { AttendanceChart, ScoreTrendChart } from "@/components/dashboard/Charts";
import { Panel, StatCard, StatusBadge } from "@/components/dashboard/StatCard";
import { AppShell } from "@/components/layout/AppShell";
import { formatNumber, formatPercent } from "@/lib/format";
import { useCurrentStudent } from "@/hooks/use-current-student";
import { useDataStore } from "@/lib/data-store";
import { studentAttendanceSeries } from "@/lib/mock-data";

export const Route = createFileRoute("/student/")({
  head: () => ({
    meta: [
      { title: "لوحة الطالب — أدائي ونقاطي" },
      {
        name: "description",
        content: "متابعة الحضور والدرجات اللحظية والواجبات والنقاط داخل السنتر التعليمي.",
      },
      { property: "og:title", content: "لوحة الطالب — أدائي ونقاطي" },
      {
        property: "og:description",
        content: "حضورك ودرجاتك وواجباتك ونقاط التحفيز في مكان واحد.",
      },
    ],
  }),
  component: StudentPortal,
});

function StudentPortal() {
  const { quizResults, homeworkTasks, leaderboard } = useDataStore();
  const me = useCurrentStudent();
  const myQuizzes = quizResults.filter((q) => q.student_id === me.id);
  const myHomework = homeworkTasks.filter((h) => h.student_id === me.id);
  const myRank = leaderboard.find((e) => e.student_id === me.id)?.rank;
  const trend = myQuizzes
    .map((q) => ({ label: q.date, score: Math.round((q.score / q.max_score) * 100) }))
    .reverse();

  return (
    <AppShell
      role="student"
      title={`أهلاً، ${me.full_name}`}
      description={`${me.grade} · ${me.group_name} · كود ${me.code}`}
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="نسبة الحضور" value={formatPercent(me.attendance_rate)} icon={CalendarCheck} tone="success" />
        <StatCard label="متوسط الدرجات" value={formatNumber(me.avg_score)} icon={Target} />
        <StatCard label="نقاط التحفيز" value={formatNumber(me.points)} icon={Award} tone="warning" />
        <StatCard label="ترتيبي" value={myRank ? formatNumber(myRank) : "—"} icon={Flame} trend="+١ عن الأسبوع الماضي" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="منحنى نتائجي" description="نسبة الدرجات في آخر التقييمات">
          <ScoreTrendChart data={trend} />
        </Panel>
        <Panel title="حضوري الشهري" description="عدد الحصص المحضورة أسبوعياً">
          <AttendanceChart data={studentAttendanceSeries} />
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="نتائج التقييمات" description="لحظياً بعد كل حصة">
          <div className="space-y-3">
            {myQuizzes.map((q) => {
              const pct = Math.round((q.score / q.max_score) * 100);
              return (
                <div key={q.id} className="rounded-xl border-2 border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-black text-foreground">{q.title}</p>
                    <StatusBadge tone={pct >= 85 ? "success" : pct >= 70 ? "warning" : "destructive"}>
                      {formatNumber(q.score)} / {formatNumber(q.max_score)}
                    </StatusBadge>
                  </div>
                  <p className="mt-1 text-xs font-bold text-muted-foreground">
                    {q.subject} · {q.date}
                  </p>
                  <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel title="واجباتي" description="المهام المطلوبة ومواعيد التسليم">
          <div className="space-y-3">
            {myHomework.map((h) => (
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
                  tone={
                    h.status === "graded"
                      ? "success"
                      : h.status === "submitted"
                        ? "primary"
                        : h.status === "late"
                          ? "destructive"
                          : "warning"
                  }
                >
                  <BookOpenCheck className="size-3.5" />
                  {h.status === "graded"
                    ? `مصحح ${formatNumber(h.grade ?? 0)}/١٠`
                    : h.status === "submitted"
                      ? "تم التسليم"
                      : h.status === "late"
                        ? "متأخر"
                        : "مطلوب"}
                </StatusBadge>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel title="لوحة الشرف — أعلى ٥" description="ترتيب النقاط داخل السنتر">
        <div className="space-y-2">
          {leaderboard.map((e) => (
            <div
              key={e.rank}
              className={
                e.student_id === me.id
                  ? "flex items-center justify-between gap-3 rounded-xl border-2 border-primary bg-primary/5 p-4"
                  : "flex items-center justify-between gap-3 rounded-xl border-2 border-border p-4"
              }
            >
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-lg bg-navy font-black text-navy-foreground">
                  {formatNumber(e.rank)}
                </span>
                <p className="font-black text-foreground">
                  {e.student_name} {e.student_id === me.id ? "(أنت)" : ""}
                </p>
              </div>
              <span className="kpi-number text-lg">{formatNumber(e.points)}</span>
            </div>
          ))}
        </div>
      </Panel>
    </AppShell>
  );
}
