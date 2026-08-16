import { createFileRoute } from "@tanstack/react-router";
import {
  Award,
  BookOpenCheck,
  CalendarCheck,
  Flame,
  Minus,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useEffect, useState } from "react";

import {
  McqAnswerBody,
  MatchingAnswerBody,
  OrderingAnswerBody,
  QUESTION_KIND_LABELS,
} from "@/components/session/SessionSteps";
import { AttendanceChart, ScoreTrendChart } from "@/components/dashboard/Charts";
import { Panel, StatCard, StatusBadge } from "@/components/dashboard/StatCard";
import { AppShell } from "@/components/layout/AppShell";
import { formatNumber, formatPercent } from "@/lib/format";
import { useCurrentStudent } from "@/hooks/use-current-student";
import {
  diagnoseWeakPoint,
  getElectronicHomeworkForGroup,
  getElectronicHomeworkScore,
  getOverallStudentPerformance,
  getPerformanceLabel,
  getSubjectPerformanceSummary,
  recordAssessmentScore,
  useDataStore,
  type DataState,
} from "@/lib/data-store";
import { studentAttendanceSeries } from "@/lib/mock-data";
import type { ElectronicHomework } from "@/types";

const trendMeta = {
  up: { icon: TrendingUp, tone: "success" as const, label: "في تحسّن" },
  down: { icon: TrendingDown, tone: "destructive" as const, label: "في تراجع" },
  same: { icon: Minus, tone: "neutral" as const, label: "مستقر" },
};

/**
 * CURRICULUM_ENGINE_SPEC.md §8 — "واجب الويب سايت": same question bank and
 * answer components as the in-session random-question picker, reused here in
 * a second context. Auto-submits once every question is answered (source:
 * "auto"), which also flips `getElectronicHomeworkScore` so the parent swaps
 * this panel for the "تم التسليم" summary on the next render.
 */
function ElectronicHomeworkPanel({
  homework,
  studentId,
  teacherId,
}: {
  homework: ElectronicHomework;
  studentId: string;
  teacherId: string;
}) {
  const [results, setResults] = useState<Record<number, boolean>>({});
  const allAnswered = Object.keys(results).length === homework.questions.length;

  useEffect(() => {
    if (!allAnswered) return;
    const correctCount = Object.values(results).filter(Boolean).length;
    recordAssessmentScore({
      studentId,
      teacherId,
      category: "e_homework",
      source: "auto",
      value: correctCount,
      maxValue: homework.questions.length,
      lessonId: homework.lesson_id,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allAnswered]);

  return (
    <div className="space-y-4">
      {homework.questions.map((q, i) => (
        <div key={q.id} className="rounded-xl border-2 border-border p-4">
          <div className="flex items-center justify-between gap-2">
            <StatusBadge tone="primary">{QUESTION_KIND_LABELS[q.kind]}</StatusBadge>
            {results[i] !== undefined ? (
              <StatusBadge tone={results[i] ? "success" : "destructive"}>
                {results[i] ? "إجابة صحيحة" : "إجابة خاطئة"}
              </StatusBadge>
            ) : null}
          </div>
          <p className="mt-3 text-lg font-black text-foreground">{q.text}</p>
          {q.kind === "ordering" ? (
            <OrderingAnswerBody
              question={q}
              answered={results[i] !== undefined}
              onAnswer={(correct) => setResults((prev) => ({ ...prev, [i]: correct }))}
            />
          ) : q.kind === "matching" ? (
            <MatchingAnswerBody
              question={q}
              answered={results[i] !== undefined}
              onAnswer={(correct) => setResults((prev) => ({ ...prev, [i]: correct }))}
            />
          ) : (
            <McqAnswerBody
              question={q}
              answered={results[i] !== undefined}
              onAnswer={(correct) => setResults((prev) => ({ ...prev, [i]: correct }))}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function ElectronicHomeworkSection({ state, studentId }: { state: DataState; studentId: string }) {
  const student = state.students.find((s) => s.id === studentId);
  const homework = student?.group_id
    ? getElectronicHomeworkForGroup(state, student.group_id)
    : undefined;
  if (!homework) return null;

  const lesson = state.lessons.find((l) => l.id === homework.lesson_id);
  const score = getElectronicHomeworkScore(state, studentId, homework.lesson_id);

  return (
    <Panel title="الواجب الإلكتروني" description={`آخر موعد للتسليم: ${homework.due_at}`}>
      {score ? (
        <div className="rounded-xl border-2 border-success bg-success/10 p-4 text-center">
          <p className="font-black text-success">
            تم التسليم — الدرجة: {formatPercent(Math.round((score.value / score.max_value) * 100))}
          </p>
        </div>
      ) : lesson ? (
        <ElectronicHomeworkPanel
          homework={homework}
          studentId={studentId}
          teacherId={lesson.created_by_teacher_id}
        />
      ) : null}
    </Panel>
  );
}

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
  const state = useDataStore();
  const { quizResults, homeworkTasks, leaderboard, subjects } = state;
  const me = useCurrentStudent();
  const myQuizzes = quizResults.filter((q) => q.student_id === me.id);
  const myHomework = homeworkTasks.filter((h) => h.student_id === me.id);
  const myRank = leaderboard.find((e) => e.student_id === me.id)?.rank;
  const trend = myQuizzes
    .map((q) => ({ label: q.date, score: Math.round((q.score / q.max_score) * 100) }))
    .reverse();

  /** CURRICULUM_ENGINE_SPEC.md §7: real multi-subject enrollment, replacing §5's interim single-group derivation. */
  const mySubjects = me.subject_ids
    .map((id) => subjects.find((s) => s.id === id))
    .filter((s): s is (typeof subjects)[number] => s !== undefined);
  const overallPerformance = getOverallStudentPerformance(state, me.id);

  return (
    <AppShell
      role="student"
      title={`أهلاً، ${me.full_name}`}
      description={`${me.grade} · ${me.group_name} · كود ${me.code}`}
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="نسبة الحضور"
          value={formatPercent(me.attendance_rate)}
          icon={CalendarCheck}
          tone="success"
        />
        <StatCard label="متوسط الدرجات" value={formatNumber(me.avg_score)} icon={Target} />
        <StatCard
          label="نقاط التحفيز"
          value={formatNumber(me.points)}
          icon={Award}
          tone="warning"
        />
        <StatCard
          label="ترتيبي"
          value={myRank ? formatNumber(myRank) : "—"}
          icon={Flame}
          trend="+١ عن الأسبوع الماضي"
        />
      </div>

      {mySubjects.length > 0 ? (
        <Panel title="مستواك العام" description="متوسط مُجمَّع عبر كل المواد المشترك فيها">
          <div className="flex flex-col items-center gap-1 py-4">
            <p className="kpi-number text-5xl">{formatPercent(overallPerformance.overallAvg)}</p>
            <p className="text-sm font-bold text-muted-foreground">
              عبر {formatNumber(overallPerformance.bySubject.length)} مادة
            </p>
          </div>
        </Panel>
      ) : null}

      {mySubjects.length > 0 ? (
        <Panel title="مستواك حسب المادة" description="متوسط كل درجاتك المرتبطة بدروس فعلية">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {mySubjects.map((subject) => {
              const summary = getSubjectPerformanceSummary(state, me.id, subject.id);
              const meta = trendMeta[summary.trend];
              /**
               * CURRICULUM_ENGINE_SPEC.md §6-ج: combines the subject-scoped rollup
               * (headline % + label) with the general cross-category diagnosis
               * (weak point) into one descriptive sentence, matching the spec's
               * own worked example.
               */
              const label = getPerformanceLabel(summary.overallAvg);
              const diagnosis = diagnoseWeakPoint(state, me.id);
              return (
                <div key={subject.id} className="rounded-xl border-2 border-border p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-black text-foreground">مستواك في {subject.name}</p>
                    <StatusBadge tone={meta.tone}>
                      <meta.icon className="size-3.5" /> {meta.label}
                    </StatusBadge>
                  </div>
                  {summary.lessonsRecordedCount > 0 ? (
                    <>
                      <p className="kpi-number mt-3 text-3xl">{formatPercent(summary.overallAvg)}</p>
                      <p className="mt-1 text-xs font-black text-primary">{label}</p>
                      <p className="mt-1 text-xs font-bold text-muted-foreground">
                        عبر {formatNumber(summary.lessonsRecordedCount)} درس مسجَّل
                      </p>
                      {diagnosis.hasWeakPoint ? (
                        <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-xs font-bold text-foreground">
                          {diagnosis.text}
                        </p>
                      ) : null}
                    </>
                  ) : (
                    <p className="mt-3 text-sm font-bold text-muted-foreground">
                      لا توجد درجات مسجَّلة بعد
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </Panel>
      ) : null}

      <ElectronicHomeworkSection state={state} studentId={me.id} />

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
                    <StatusBadge
                      tone={pct >= 85 ? "success" : pct >= 70 ? "warning" : "destructive"}
                    >
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
