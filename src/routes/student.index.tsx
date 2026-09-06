import { createFileRoute } from "@tanstack/react-router";
import {
  Award,
  BookOpenCheck,
  CalendarCheck,
  FileUp,
  Flame,
  Heart,
  Minus,
  Send,
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
  getAverageBehaviorScore,
  getCurriculumProgress,
  getElectronicHomeworkForGroup,
  getElectronicHomeworkScore,
  getOverallStudentPerformance,
  getPerformanceLabel,
  getStudentAttendanceSeries,
  getSubjectPerformanceSummary,
  getTeacherLaunchesForGroup,
  getUpcomingGroupsForToday,
  recordAssessmentScore,
  useDataStore,
  type DataState,
} from "@/lib/data-store";
import { getSubjectTheme } from "@/lib/subject-themes";
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
  const { quizResults, homeworkTasks, leaderboard, subjects, groups, grades } = state;
  const me = useCurrentStudent();
  if (!me) return <AppShell role="student" title="جارٍ التحميل…" description="جارٍ تحميل بيانات الطالب"><div /></AppShell>;

  const myQuizzes = quizResults.filter((q) => q.student_id === me.id);
  const myHomework = homeworkTasks.filter((h) => h.student_id === me.id);
  const myRank = leaderboard.find((e) => e.student_id === me.id)?.rank;
  const trend = myQuizzes
    .map((q) => ({ label: q.date, score: Math.round((q.score / q.max_score) * 100) }))
    .reverse();

  const mySubjects = me.subject_ids
    .map((id) => subjects.find((s) => s.id === id))
    .filter((s): s is (typeof subjects)[number] => s !== undefined);
  const overallPerformance = getOverallStudentPerformance(state, me.id);

  const gradeId = me.group_id
    ? groups.find((g) => g.id === me.group_id)?.grade_id
    : grades.find((g) => g.name === me.grade)?.id;

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
          label="درجة السلوك"
          value={(() => {
            const b = getAverageBehaviorScore(state, me.id);
            return b === null ? "—" : `${Math.round(b * 10)}/10`;
          })()}
          icon={Heart}
          tone="primary"
          trend={(() => {
            const b = getAverageBehaviorScore(state, me.id);
            if (b === null) return "لم يُقيَّم بعد";
            if (b >= 0.8) return "ممتاز — استمر";
            if (b >= 0.5) return "جيد";
            return "يحتاج تحسين";
          })()}
        />
      </div>

      {me.group_id ? (() => {
        const upcoming = getUpcomingGroupsForToday(state).filter((u) => u.group.id === me.group_id);
        const session = upcoming[0];
        if (!session) {
          return (
            <Panel title="حصة اليوم" description={me.group_name}>
              <p className="text-sm font-bold text-muted-foreground">لا توجد حصة مجدوولة لليوم</p>
            </Panel>
          );
        }
        const statusLabel = session.status === "now" ? "حالياً الآن" : "لاحقاً اليوم";
        const statusTone = session.status === "now" ? "success" : "primary";
        const groupStudents = state.students.filter((s) => s.group_id === session.group.id);
        return (
          <Panel title="حصة اليوم" description={session.group.name}>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge tone={statusTone}>{statusLabel}</StatusBadge>
              <span className="text-sm font-bold text-muted-foreground">{session.group.time}</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-bold text-muted-foreground">المدرس</p>
                <p className="text-sm font-black text-foreground">{session.teacher?.full_name ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-muted-foreground">القاعة</p>
                <p className="text-sm font-black text-foreground">{session.group.room}</p>
              </div>
            </div>
            <div className="mt-3">
              <p className="text-xs font-bold text-muted-foreground">الحضور المسجَّل</p>
              <p className="kpi-number text-xl">
                {formatNumber(session.attendanceMarkedToday)} / {formatNumber(groupStudents.length)}
              </p>
            </div>
          </Panel>
        );
      })() : (
        <Panel title="حصة اليوم" description="لا توجد حصة مجدوولة">
          <p className="text-sm font-bold text-muted-foreground">لا توجد حصة مجدوولة</p>
        </Panel>
      )}

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

      {gradeId && mySubjects.length > 0 ? (
        <Panel title="موادي والمنهج" description="تقدمك في كل مادة">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {mySubjects.map((subject) => {
              const progress = getCurriculumProgress(state, subject.id, gradeId);
              const theme = getSubjectTheme(subject.theme_key);
              const pct =
                progress.lessonCount > 0
                  ? Math.round((progress.doneCount / progress.lessonCount) * 100)
                  : 0;
              return (
                <div key={subject.id} className="rounded-xl border-2 border-border p-4">
                  <div className="flex items-center gap-2">
                    <span
                      className="flex size-8 items-center justify-center rounded-lg"
                      style={{ backgroundColor: theme.primary + "15", color: theme.primary }}
                    >
                      <theme.icon className="size-4" />
                    </span>
                    <p className="font-black text-foreground">{subject.name}</p>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="kpi-number text-lg">{formatNumber(progress.unitCount)}</p>
                      <p className="text-xs font-bold text-muted-foreground">وحدات</p>
                    </div>
                    <div>
                      <p className="kpi-number text-lg">{formatNumber(progress.lessonCount)}</p>
                      <p className="text-xs font-bold text-muted-foreground">دروس</p>
                    </div>
                    <div>
                      <p className="kpi-number text-lg">{formatNumber(progress.doneCount)}</p>
                      <p className="text-xs font-bold text-muted-foreground">مكتمل</p>
                    </div>
                  </div>
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: theme.primary }}
                    />
                  </div>
                  {progress.nextLesson ? (
                    <p className="mt-2 text-xs font-bold text-muted-foreground">
                      الدرس القادم: {progress.nextLesson.title}
                    </p>
                  ) : (
                    <p className="mt-2 text-xs font-bold text-success">أكملت كل الدروس!</p>
                  )}
                </div>
              );
            })}
          </div>
        </Panel>
      ) : null}

      <ElectronicHomeworkSection state={state} studentId={me.id} />

      {me.group_id ? (
        <TeacherLaunchesPanel state={state} groupId={me.group_id} />
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="منحنى نتائجي" description="نسبة الدرجات في آخر التقييمات">
          <ScoreTrendChart data={trend} />
        </Panel>
        <Panel title="حضوري الأسبوعي" description="عدد الحصص المحضورة أسبوعياً">
          <AttendanceChart data={getStudentAttendanceSeries(state, me.id)} />
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

/* ---------------- Migration 0023 / خطة C (C6): مهام المدرس الجديدة للطالب ---------------- */

const STUDENT_LAUNCH_LABEL: Record<string, string> = {
  homework: "واجب بيتي",
  homework_with_correction: "واجب مع تصحيح",
  in_class_task: "مهمة داخل الحصة",
  interactive_activity: "نشاط تفاعلي",
  online_homework: "واجب إلكتروني",
  online_quiz: "اختبار إلكتروني",
  reading_assignment: "مراجعة / قراءة",
  oral_recitation: "تسميع",
};

function TeacherLaunchesPanel({ state, groupId }: { state: DataState; groupId: string }) {
  const launches = getTeacherLaunchesForGroup(state, groupId).slice(0, 10);
  if (launches.length === 0) return null;

  return (
    <Panel
      title="مهامي الجديدة من المدرس"
      description="آخر ما أطلقه مدرّسك — واجبات، أنشطة، مراجعات"
    >
      <div className="space-y-2">
        {launches.map((l) => {
          const isReading = l.launch_type === "reading_assignment";
          const isFile = isReading && !!l.file_data;
          const Icon = isFile ? FileUp : Send;
          return (
            <div
              key={l.id}
              className="flex flex-wrap items-start justify-between gap-2 rounded-xl border-2 border-border bg-background p-3"
            >
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-lg bg-primary/10 px-2 py-0.5 text-[11px] font-black text-primary">
                      {STUDENT_LAUNCH_LABEL[l.launch_type] ?? l.launch_type}
                    </span>
                    <p className="truncate text-sm font-black text-foreground">{l.title}</p>
                  </div>
                  {l.body ? (
                    <p className="mt-1 line-clamp-2 text-xs font-bold text-muted-foreground">
                      {l.body}
                    </p>
                  ) : null}
                  <p className="mt-1 text-[11px] font-bold text-muted-foreground">
                    {new Date(l.created_at).toLocaleString("ar-EG", { numberingSystem: "latn" })}
                    {l.due_at
                      ? ` · يُسلَّم قبل ${new Date(l.due_at).toLocaleString("ar-EG", { numberingSystem: "latn" })}`
                      : null}
                  </p>
                </div>
              </div>
              {isFile && l.file_data ? (
                <a
                  href={`data:${l.file_mime ?? "application/octet-stream"};base64,${l.file_data}`}
                  download={l.file_name ?? l.title}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="rounded-lg border-2 border-primary/40 bg-primary/10 px-3 py-1 text-[11px] font-black text-primary hover:bg-primary/20"
                >
                  تحميل
                </a>
              ) : null}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
