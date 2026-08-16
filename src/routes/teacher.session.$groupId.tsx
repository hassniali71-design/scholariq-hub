import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { CheckCircle2, Dices, Send, Timer, X } from "lucide-react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/dashboard/StatCard";
import { pickFairly } from "@/components/session/FairRandomPicker";
import { InteractiveSlideViewer } from "@/components/session/InteractiveSlideViewer";
import { SessionCurriculumNav } from "@/components/session/SessionCurriculumNav";
import { SessionReviewPanel } from "@/components/session/SessionReviewPanel";
import {
  BehaviorButtons,
  BookExerciseCard,
  HomeworkStep,
  LiveScoreboard,
  QuestionCard,
} from "@/components/session/SessionSteps";
import { SessionTimer } from "@/components/session/SessionTimer";
import { TimerExtendDialog } from "@/components/session/TimerExtendDialog";
import { useContentHash } from "@/hooks/use-content-hash";
import { useCountdown } from "@/hooks/use-countdown";
import { retryLessonPipeline, runLessonPipeline } from "@/lib/ai/lesson-pipeline";
import { formatNumber } from "@/lib/format";
import {
  REASONABLE_EXTENSION_RATIO,
  getAssessmentScoresForLesson,
  getCurriculumLessonsForUnit,
  getCurriculumUnitsForSubjectGrade,
  getData,
  getNextPlannedLesson,
  getQuestionsForLesson,
  getSessionRecordForLesson,
  getSessionRecordsForGroup,
  getSlidesForLesson,
  getBookExerciseTask,
  getStudentsForGroup,
  getSuggestedActivityForLesson,
  recordAssessmentScore,
  recordAttendance,
  recordBookExerciseTask,
  recordQuestionAnswer,
  recordRandomPick,
  recordSessionSummary,
  recordTimerExtension,
  releaseSessionTasks,
  scoreHomework as persistHomeworkScore,
  updateLessonSlide,
  updateQuizQuestion,
  useDataStore,
} from "@/lib/data-store";
import { SESSION_STEPS } from "@/lib/mock-data";
import { getSubjectTheme } from "@/lib/subject-themes";
import { cn } from "@/lib/utils";
import type { AttendanceStatus, LiveScore, SessionStepKey } from "@/types";

/** §7-هـ: teacher picks the question's timer duration when drawing, based on difficulty. */
const QUESTION_DURATIONS = [10, 15, 30] as const;

export const Route = createFileRoute("/teacher/session/$groupId")({
  /**
   * Bug fix (real browser trial): session mode used to hardcode `groups[0]`,
   * so every "ابدأ" button — no matter which group — landed on the same
   * group's session. Now the route requires a real group id; an invalid one
   * (bad/stale link) redirects back to the group list instead of crashing.
   * Safe to check here (not just client-side like AppShell's auth gate)
   * because `getData()` falls back to the seeded `SERVER_STATE` during SSR,
   * which always has every seeded group.
   */
  beforeLoad: ({ params }) => {
    const exists = getData().groups.some((g) => g.id === params.groupId);
    if (!exists) {
      throw redirect({ to: "/teacher" });
    }
  },
  head: () => ({
    meta: [
      { title: "وضع الحصة — المركز الكامل للمجموعة" },
      {
        name: "description",
        content:
          "المنهج، الطلاب، وكل أنواع التقييم لهذه المجموعة في مكان واحد — تسلسل الحصة الموقوت من تسعة بنود.",
      },
      { property: "og:title", content: "وضع الحصة — المركز الكامل للمجموعة" },
      {
        property: "og:description",
        content: "مركز قيادة الحصة: منهج، شرح، تقييم، وإطلاق مهام في شاشة واحدة.",
      },
    ],
  }),
  component: SessionMode,
});

function SessionMode() {
  const { groupId } = Route.useParams();
  const state = useDataStore();
  const { groups, liveScores, attendanceRecords, subjects } = state;
  /** `beforeLoad` already guarantees this group exists. */
  const group = groups.find((g) => g.id === groupId)!;
  const navigate = useNavigate();
  const sessionStudents = useMemo(
    () => getStudentsForGroup(state, group.id),
    [state.students, group.id],
  );
  /** §7-و: session mode only — never applied to AppShell (shared by every role). */
  const theme = getSubjectTheme(subjects.find((s) => s.id === group.subject_id)?.theme_key);
  const { computeHash } = useContentHash();
  const [uploading, setUploading] = useState(false);

  /**
   * CURRICULUM_ENGINE_SPEC.md §13-ب: the curriculum column drives which lesson
   * is on screen — an explicit teacher choice, not `getLatestReadyLesson`'s old
   * auto-pick. Defaults once to the group's next planned lesson as a sensible
   * starting point; the teacher can click any other lesson in the list instead.
   */
  const curriculumUnits = getCurriculumUnitsForSubjectGrade(state, group.subject_id, group.grade_id);
  const [selectedCurriculumLessonId, setSelectedCurriculumLessonId] = useState<string | null>(
    () => getNextPlannedLesson(state, group.subject_id, group.grade_id)?.id ?? null,
  );
  const selectedCurriculumLesson = state.curriculumLessons.find(
    (cl) => cl.id === selectedCurriculumLessonId,
  );
  const selectedLesson = selectedCurriculumLesson?.linked_lesson_id
    ? state.lessons.find((l) => l.id === selectedCurriculumLesson.linked_lesson_id)
    : undefined;
  const selectedLessonReady = selectedLesson?.ai_status === "ready" ? selectedLesson : undefined;
  const groupElectronicHomework = selectedLesson
    ? state.electronicHomeworks.find((eh) => eh.lesson_id === selectedLesson.id)
    : undefined;

  /** §13-ب: a lesson that's already been taught opens in review mode instead of the live flow. */
  const reviewSessionRecord = selectedLesson
    ? getSessionRecordForLesson(state, selectedLesson.id)
    : undefined;
  const isReviewMode = !!(selectedLesson && reviewSessionRecord);

  const activeSlides = selectedLessonReady
    ? getSlidesForLesson(state, selectedLessonReady.id)
    : state.lessonSlides.filter((s) => s.lesson_id === null);
  const activeQuestionPool = selectedLessonReady
    ? getQuestionsForLesson(state, selectedLessonReady.id)
    : state.sessionQuestions.filter((q) => q.lesson_id === null);
  const suggestedActivity = selectedLessonReady
    ? getSuggestedActivityForLesson(state, selectedLessonReady.id)
    : undefined;
  const lessonScores = selectedLesson ? getAssessmentScoresForLesson(state, selectedLesson.id) : [];

  const handleUploadFile = useCallback(
    async (file: File) => {
      setUploading(true);
      try {
        const contentHash = await computeHash(file);
        const result = await runLessonPipeline({
          file,
          contentHash,
          groupId: group.id,
          subjectId: group.subject_id,
          teacherId: group.teacher_id,
          subjectName: group.subject,
          curriculumLessonId: selectedCurriculumLessonId,
        });
        toast.success(
          result.reusedFromCache
            ? "نفس الملف اتعالج قبل كده — استخدمنا النتيجة المحفوظة فوراً"
            : "تم توليد عرض الدرس بنجاح",
        );
      } finally {
        setUploading(false);
      }
    },
    [computeHash, group.id, group.subject, group.subject_id, group.teacher_id, selectedCurriculumLessonId],
  );

  const handleRetryLesson = useCallback(async () => {
    if (!selectedLesson) return;
    setUploading(true);
    try {
      await retryLessonPipeline(selectedLesson.id, group.subject);
      toast.success("تم توليد عرض الدرس بنجاح");
    } finally {
      setUploading(false);
    }
  }, [selectedLesson, group.subject]);

  /** CURRICULUM_ENGINE_SPEC.md §13-ج step 1: no prior SessionRecord for this group → nothing to grade yet. */
  const isFirstSessionForGroup = useMemo(
    () => getSessionRecordsForGroup(state, group.id).length === 0,
    [state.sessionRecords, group.id],
  );
  const orderedSteps = useMemo(
    () => SESSION_STEPS.filter((s) => s.key !== "last_homework" || !isFirstSessionForGroup),
    [isFirstSessionForGroup],
  );
  const [stepIndex, setStepIndex] = useState(0);
  const [slideIndex, setSlideIndex] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [askedCount, setAskedCount] = useState(0);
  const [released, setReleased] = useState(false);
  const [eHomeworkReleased, setEHomeworkReleased] = useState(false);
  const [activityMarkedDone, setActivityMarkedDone] = useState(false);
  const [extendedByStep, setExtendedByStep] = useState<Record<string, number>>({});
  /** Anchors TimerExtension rows for this run — no SessionRecord to link to yet (Phase 3). */
  const sessionIdRef = useRef(`sess-${Date.now()}`);

  /** Live scoreboard is derived from the central store, so every rating
   *  persists beyond this page (student / parent / owner dashboards). */
  const scores: LiveScore[] = useMemo(
    () =>
      sessionStudents.map((s) => {
        const live = liveScores.find((l) => l.student_id === s.id);
        return (
          live ?? {
            student_id: s.id,
            student_name: s.full_name,
            homework_score: null,
            question_score: null,
            points: 0,
          }
        );
      }),
    [sessionStudents, liveScores],
  );

  const step = orderedSteps[stepIndex] ?? orderedSteps[0]!;
  const isQuestions = step.key === "questions";

  const attendanceStatus = useCallback(
    (studentId: string): AttendanceStatus | null =>
      attendanceRecords.find((a) => a.student_id === studentId)?.status ?? null,
    [attendanceRecords],
  );
  const markAttendance = useCallback((studentId: string, status: AttendanceStatus) => {
    recordAttendance(studentId, status, "manual", sessionIdRef.current);
  }, []);
  /** Present/late/unmarked count as "attended" for fair-pick eligibility — only explicit absence excludes. */
  const attendedStudentIds = useMemo(
    () => new Set(sessionStudents.filter((s) => attendanceStatus(s.id) !== "absent").map((s) => s.id)),
    [sessionStudents, attendanceStatus],
  );

  const stepTimer = useCountdown(step.duration, () =>
    toast.warning(`انتهى وقت مرحلة: ${step.title}`),
  );

  const extendedSeconds = extendedByStep[step.key] ?? 0;
  const reasonableExtension = step.duration * REASONABLE_EXTENSION_RATIO;
  const withinReasonableExtension = extendedSeconds <= reasonableExtension;

  const handleExtend = useCallback(
    (seconds: number, reason: string | null) => {
      stepTimer.setRemaining((r) => r + seconds);
      recordTimerExtension(sessionIdRef.current, step.key, seconds, reason);
      setExtendedByStep((prev) => ({ ...prev, [step.key]: (prev[step.key] ?? 0) + seconds }));
      toast.success(`تم تمديد المرحلة ${Math.round(seconds / 60)} دقيقة`);
    },
    [step.key, stepTimer],
  );

  const [questionDuration, setQuestionDuration] = useState<number>(QUESTION_DURATIONS[1]);
  const questionTimer = useCountdown(questionDuration, () => {
    setAnswered(true);
    toast.error("انتهى وقت السؤال — لم يتم الرد");
  });

  const picked = useMemo(
    () => scores.find((s) => s.student_id === pickedId) ?? null,
    [scores, pickedId],
  );
  const question =
    isQuestions && activeQuestionPool.length > 0
      ? (activeQuestionPool[questionIndex % activeQuestionPool.length] ?? null)
      : null;

  /**
   * CURRICULUM_ENGINE_SPEC.md §4: besides the live in-session point tracking
   * (`persistHomeworkScore`), also upserts a real `AssessmentScore` row with a
   * non-null `lesson_id` — previously nothing in the app ever wrote one, so §5's
   * per-subject rollup had no data to read.
   */
  const scoreHomework = useCallback(
    (studentId: string, value: number) => {
      persistHomeworkScore(studentId, value, sessionIdRef.current);
      recordAssessmentScore({
        studentId,
        teacherId: group.teacher_id,
        category: "homework",
        source: "manual",
        value,
        maxValue: 10,
        sessionId: sessionIdRef.current,
        lessonId: selectedLesson?.id ?? null,
      });
    },
    [group.teacher_id, selectedLesson],
  );

  /** §7-هـ: weighted fair pick — excludes anyone absent or already drawn this session. */
  const pickRandom = useCallback(() => {
    const next = pickFairly(sessionStudents, state.randomPickLogs, sessionIdRef.current, attendedStudentIds);
    if (!next) {
      toast.warning("كل الطلاب الحاضرين اتسحبوا في الحصة دي بالفعل");
      return;
    }
    recordRandomPick(group.id, next.id, sessionIdRef.current);
    setPickedId(next.id);
    setAnswered(false);
    setQuestionIndex((i) => i + 1);
    questionTimer.reset(questionDuration);
    questionTimer.start();
  }, [sessionStudents, state.randomPickLogs, attendedStudentIds, group.id, questionTimer, questionDuration]);

  const answer = useCallback(
    (correct: boolean) => {
      setAnswered(true);
      questionTimer.pause();
      setAskedCount((c) => c + 1);
      if (pickedId) {
        recordQuestionAnswer(pickedId, correct, sessionIdRef.current);
        // CURRICULUM_ENGINE_SPEC.md §4: same lesson_id linkage as scoreHomework above.
        recordAssessmentScore({
          studentId: pickedId,
          teacherId: group.teacher_id,
          category: "question",
          source: "auto",
          value: correct ? 10 : 0,
          maxValue: 10,
          sessionId: sessionIdRef.current,
          lessonId: selectedLesson?.id ?? null,
        });
      }
      toast[correct ? "success" : "error"](
        correct ? "إجابة صحيحة — +٥٠ نقطة" : "إجابة خاطئة — تم الرصد",
      );
    },
    [pickedId, questionTimer, group.teacher_id, selectedLesson],
  );

  const releaseTasks = () => {
    releaseSessionTasks(group.id);
    setReleased(true);
    toast.success("تم إطلاق الواجب والشيت الأسبوعي", {
      description: "أُرسلت الإشعارات لحسابات الطلاب وأولياء الأمور عبر واتساب.",
    });
  };

  const evaluated = scores.filter((s) => s.homework_score !== null).length;

  /** §7-ط: persists the actual SessionRecord once, when the teacher deliberately ends the session. */
  const handleEndSession = useCallback(() => {
    const attendeesCount = sessionStudents.filter((s) => attendanceStatus(s.id) !== "absent").length;
    const absenteesCount = sessionStudents.length - attendeesCount;
    const totalExtensionSeconds = Object.values(extendedByStep).reduce((sum, s) => sum + s, 0);
    const lessonStepDuration = SESSION_STEPS.find((s) => s.key === "lesson")!.duration;
    // Approximation, not a real stopwatch: planned lesson-step duration + any extension logged against it.
    const explanationDurationSeconds = lessonStepDuration + (extendedByStep["lesson"] ?? 0);
    const sessionStartMs = Number(sessionIdRef.current.slice("sess-".length));
    const durationSeconds = Math.max(0, Math.round((Date.now() - sessionStartMs) / 1000));
    const participantsCount = new Set(
      state.sessionEvents
        .filter((e) => e.session_id === sessionIdRef.current)
        .map((e) => e.student_id),
    ).size;

    recordSessionSummary({
      sessionId: sessionIdRef.current,
      groupId: group.id,
      teacherId: group.teacher_id,
      lessonId: selectedLesson?.id ?? null,
      attendeesCount,
      absenteesCount,
      questionsAskedCount: askedCount,
      participantsCount,
      homeworkLaunchStatus: released ? "sent" : "not_sent",
      eHomeworkLaunchStatus: eHomeworkReleased ? "sent" : "not_sent",
      activityCompletedInSession: activityMarkedDone,
      durationSeconds,
      explanationDurationSeconds,
      extensionSeconds: totalExtensionSeconds,
      generalNotes: null,
    });
    toast.success("تم حفظ ملخص الحصة");
    void navigate({ to: "/teacher" });
  }, [
    sessionStudents,
    attendanceStatus,
    extendedByStep,
    state.sessionEvents,
    group.id,
    group.teacher_id,
    selectedLesson,
    askedCount,
    released,
    eHomeworkReleased,
    activityMarkedDone,
    navigate,
  ]);

  return (
    <div dir="rtl" className="min-h-screen bg-canvas">
      {/* Presenter header — themed by the group's subject (§7-و) */}
      <header
        className="sticky top-0 z-20 border-b-2 border-border text-navy-foreground"
        style={{ backgroundColor: theme.primary }}
      >
        <div className="mx-auto flex max-w-[1700px] flex-wrap items-center justify-between gap-4 px-5 py-4 md:px-8">
          <div className="flex items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/15">
              <theme.icon className="size-6" />
            </span>
            <div>
              <p className="text-xs font-black text-white/70">وضع الحصة — المركز الكامل للمجموعة</p>
              <h1 className="text-2xl font-black md:text-3xl">{group.name}</h1>
              <p className="text-xs font-bold text-white/70">
                {group.teacher_name} · {group.room} · {formatNumber(group.enrolled)} طالب
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isReviewMode ? (
              <span className="rounded-xl bg-white/15 px-4 py-2 text-sm font-black">
                وضع مراجعة — {selectedLesson!.title}
              </span>
            ) : (
              <>
                <span className="hidden rounded-xl bg-white/15 px-4 py-2 text-sm font-black md:block">
                  المرحلة {formatNumber(stepIndex + 1)} من {formatNumber(orderedSteps.length)}
                </span>
                <button
                  type="button"
                  onClick={handleEndSession}
                  disabled={!selectedLesson}
                  className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-black text-navy hover:opacity-90 disabled:opacity-50"
                >
                  <X className="size-4" /> إنهاء الحصة
                </button>
              </>
            )}
          </div>
        </div>

        {/* Stepper */}
        {!isReviewMode ? (
          <div className="mx-auto grid max-w-[1700px] gap-2 px-5 pb-4 md:grid-cols-4 md:px-8 xl:grid-cols-8">
            {orderedSteps.map((s, i) => (
              <button
                key={s.key}
                onClick={() => setStepIndex(i)}
                className={cn(
                  "flex items-center gap-2 rounded-xl border-2 px-3 py-2.5 text-right transition-colors",
                  i === stepIndex
                    ? "border-white bg-white text-navy"
                    : i < stepIndex
                      ? "border-white/40 bg-white/10 text-white"
                      : "border-white/20 text-white/70 hover:bg-white/10",
                )}
              >
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-black",
                    i === stepIndex ? "bg-navy text-navy-foreground" : "bg-white/20 text-white",
                  )}
                >
                  {i < stepIndex ? <CheckCircle2 className="size-3.5" /> : i + 1}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-xs font-black">{s.title}</span>
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </header>

      <main className="mx-auto max-w-[1700px] px-5 py-6 md:px-8">
        <div className={cn("grid gap-6", isReviewMode ? "xl:grid-cols-[300px_1fr]" : "xl:grid-cols-[300px_1fr_320px]")}>
          {/* CURRICULUM_ENGINE_SPEC.md §13-ب: right column, this group's own curriculum */}
          <aside className="card-crisp p-5">
            <h3 className="mb-4 text-lg font-black">منهج المجموعة</h3>
            <SessionCurriculumNav
              units={curriculumUnits}
              getLessonsForUnit={(unitId) => getCurriculumLessonsForUnit(state, unitId)}
              selectedCurriculumLessonId={selectedCurriculumLessonId}
              onSelect={(id) => {
                setSelectedCurriculumLessonId(id);
                setStepIndex(0);
              }}
            />
          </aside>

          {isReviewMode && selectedLesson && reviewSessionRecord ? (
            <section className="card-crisp p-6">
              <SessionReviewPanel
                state={state}
                lesson={selectedLesson}
                sessionRecord={reviewSessionRecord}
                students={sessionStudents}
                teacherId={group.teacher_id}
              />
            </section>
          ) : !selectedCurriculumLessonId ? (
            <section className="card-crisp flex min-h-[400px] items-center justify-center p-6">
              <p className="text-center text-lg font-black text-muted-foreground">
                اختر درساً من المنهج على اليمين للبدء
              </p>
            </section>
          ) : (
            <section className="space-y-6">
              <div className="card-crisp p-6">
                <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-black text-foreground">{step.title}</h2>
                    <p className="mt-1 text-sm font-bold text-muted-foreground">{step.hint}</p>
                  </div>
                  <StatusBadge tone="primary">
                    <Timer className="size-3.5" /> تايمر المرحلة
                  </StatusBadge>
                </div>

                <SessionTimer
                  remaining={stepTimer.remaining}
                  running={stepTimer.running}
                  progress={stepTimer.progress}
                  onStart={stepTimer.start}
                  onPause={stepTimer.pause}
                  onReset={() => stepTimer.reset()}
                  size={step.key === "last_homework" ? "xl" : "lg"}
                />

                <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                  <TimerExtendDialog onExtend={handleExtend} />
                  {extendedSeconds > 0 ? (
                    <StatusBadge tone={withinReasonableExtension ? "success" : "warning"}>
                      تمديد {Math.round(extendedSeconds / 60)} دقيقة —{" "}
                      {withinReasonableExtension ? "ضمن الحد المعقول" : "تجاوز الحد المعقول"}
                    </StatusBadge>
                  ) : null}
                </div>
              </div>

              <div className="card-crisp p-6">
                {step.key === "last_homework" ? (
                  <>
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="text-lg font-black">رصد تقييم الواجب</h3>
                      <StatusBadge tone={evaluated === scores.length ? "success" : "warning"}>
                        {formatNumber(evaluated)} / {formatNumber(scores.length)} تم تقييمهم
                      </StatusBadge>
                    </div>
                    <HomeworkStep
                      scores={scores}
                      onScore={scoreHomework}
                      attendanceStatus={attendanceStatus}
                      onAttendance={markAttendance}
                    />
                  </>
                ) : null}

                {step.key === "lesson" ? (
                  <InteractiveSlideViewer
                    activeLesson={selectedLesson ?? null}
                    busy={uploading}
                    slides={activeSlides}
                    index={slideIndex}
                    onPrev={() => setSlideIndex((i) => Math.max(0, i - 1))}
                    onNext={() => setSlideIndex((i) => Math.min(activeSlides.length - 1, i + 1))}
                    onFile={(file) => void handleUploadFile(file)}
                    onRetry={() => void handleRetryLesson()}
                    onEditSlide={(slideId, title, bullets) => {
                      updateLessonSlide(slideId, title, bullets);
                      toast.success("تم حفظ التعديل");
                    }}
                  />
                ) : null}

                {step.key === "questions" ? (
                  <div className="space-y-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h3 className="text-lg font-black">محرك الأسئلة العشوائي</h3>
                      <div className="flex items-center gap-2">
                        <StatusBadge tone="neutral">
                          {formatNumber(askedCount)} سؤال تم رصده
                        </StatusBadge>
                        <button
                          onClick={pickRandom}
                          className="flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-black text-primary-foreground hover:opacity-90"
                        >
                          <Dices className="size-5" /> اسحب طالباً عشوائياً
                        </button>
                      </div>
                    </div>

                    {/* §7-هـ: duration chosen when drawing, based on question difficulty. */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-muted-foreground">مدة تايمر السؤال:</span>
                      {QUESTION_DURATIONS.map((seconds) => (
                        <button
                          key={seconds}
                          type="button"
                          disabled={picked !== null && !answered}
                          onClick={() => setQuestionDuration(seconds)}
                          className={cn(
                            "rounded-lg border-2 px-3 py-1.5 text-xs font-black transition-colors disabled:opacity-40",
                            questionDuration === seconds
                              ? "border-navy bg-navy text-navy-foreground"
                              : "border-border hover:border-primary",
                          )}
                        >
                          {formatNumber(seconds)} ثانية
                        </button>
                      ))}
                    </div>

                    {picked ? (
                      <div className="rounded-2xl border-2 border-border p-5">
                        <p className="mb-3 text-center text-sm font-black text-muted-foreground">
                          تايمر السؤال — {formatNumber(questionDuration)} ثانية
                        </p>
                        <SessionTimer
                          remaining={questionTimer.remaining}
                          running={questionTimer.running}
                          progress={questionTimer.progress}
                          onStart={questionTimer.start}
                          onPause={questionTimer.pause}
                          onReset={() => questionTimer.reset(questionDuration)}
                          size="xl"
                        />
                      </div>
                    ) : null}

                    <QuestionCard
                      student={picked}
                      question={question}
                      answered={answered}
                      onAnswer={answer}
                      onEdit={(questionId, text, options, correctIndex) => {
                        updateQuizQuestion(questionId, text, options, correctIndex);
                        toast.success("تم حفظ التعديل");
                      }}
                    />
                  </div>
                ) : null}

                {step.key === "book_exercise" ? (
                  <div className="space-y-4">
                    <h3 className="text-lg font-black">حل تمارين الكتاب — داخل الحصة</h3>
                    <BookExerciseCard
                      title="حل تمارين الكتاب — داخل الحصة"
                      value={
                        getBookExerciseTask(state, sessionIdRef.current, group.id, "in_session")
                          ?.pages_text ?? null
                      }
                      onSave={(pagesText) => {
                        recordBookExerciseTask({
                          sessionId: sessionIdRef.current,
                          groupId: group.id,
                          context: "in_session",
                          pagesText,
                        });
                        toast.success("تم حفظ صفحات التمارين");
                      }}
                    />
                  </div>
                ) : null}

                {step.key === "activity_review" ? (
                  <div className="space-y-4">
                    <h3 className="text-lg font-black">مراجعة النشاط المقترح</h3>
                    {suggestedActivity ? (
                      <div className="rounded-xl border-2 border-border p-5">
                        <p className="font-black text-foreground">{suggestedActivity.title}</p>
                        <p className="mt-2 text-sm font-bold text-muted-foreground">
                          {suggestedActivity.description}
                        </p>
                      </div>
                    ) : (
                      <p className="rounded-xl border-2 border-dashed border-border p-6 text-center text-sm font-bold text-muted-foreground">
                        النشاط المقترح هيظهر هنا بمجرد جاهزية الدرس
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => setActivityMarkedDone((v) => !v)}
                      className={cn(
                        "flex w-full items-center justify-center gap-2 rounded-xl border-2 px-5 py-3 text-sm font-black transition-colors",
                        activityMarkedDone
                          ? "border-success bg-success/10 text-success"
                          : "border-border hover:border-primary",
                      )}
                    >
                      <CheckCircle2 className="size-5" />
                      {activityMarkedDone
                        ? "تم تحديده كمنفَّذ بالفعل خلال الحصة ✓"
                        : "تحديد كمنفَّذ بالفعل خلال الحصة"}
                    </button>
                  </div>
                ) : null}

                {step.key === "release_homework" ? (
                  <div className="space-y-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h3 className="text-lg font-black">إطلاق واجب البيت — تمارين الكتاب</h3>
                      <StatusBadge tone={activityMarkedDone ? "success" : "neutral"}>
                        حالة النشاط: {activityMarkedDone ? "مكتمل بالفعل" : "ضمن الواجب المُطلَق"}
                      </StatusBadge>
                    </div>
                    <BookExerciseCard
                      title="حل تمارين الكتاب — كواجب منزلي"
                      value={
                        getBookExerciseTask(state, sessionIdRef.current, group.id, "homework")
                          ?.pages_text ?? null
                      }
                      onSave={(pagesText) => {
                        recordBookExerciseTask({
                          sessionId: sessionIdRef.current,
                          groupId: group.id,
                          context: "homework",
                          pagesText,
                        });
                        toast.success("تم حفظ صفحات التمارين");
                      }}
                    />
                    <button
                      onClick={releaseTasks}
                      disabled={released}
                      className="flex h-16 w-full items-center justify-center gap-3 rounded-2xl bg-navy text-lg font-black text-navy-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                      <Send className="size-6" />
                      {released ? "تم الإرسال لجميع الطلاب وأولياء الأمور ✓" : "إطلاق وإرسال الآن"}
                    </button>
                  </div>
                ) : null}

                {step.key === "release_e_homework" ? (
                  <div className="space-y-4">
                    <h3 className="text-lg font-black">إطلاق واجب الويب سايت</h3>
                    {groupElectronicHomework ? (
                      <div className="rounded-xl border-2 border-border p-5">
                        <p className="font-black text-foreground">
                          {formatNumber(groupElectronicHomework.questions.length)} سؤال
                        </p>
                        <p className="mt-1 text-xs font-bold text-muted-foreground">
                          آخر موعد للتسليم: {groupElectronicHomework.due_at}
                        </p>
                      </div>
                    ) : (
                      <p className="rounded-xl border-2 border-dashed border-border p-6 text-center text-sm font-bold text-muted-foreground">
                        الواجب الإلكتروني هيتاح بمجرد جاهزية الدرس
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setEHomeworkReleased(true);
                        toast.success("تم تأكيد إتاحة الواجب الإلكتروني");
                      }}
                      disabled={eHomeworkReleased || !groupElectronicHomework}
                      className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-navy text-sm font-black text-navy-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                      <Send className="size-5" />
                      {eHomeworkReleased ? "تم تأكيد الإتاحة ✓" : "تأكيد الإتاحة للطلاب"}
                    </button>
                  </div>
                ) : null}

                {step.key === "behavior" ? (
                  <div className="space-y-3">
                    <h3 className="text-lg font-black">تقييم السلوك</h3>
                    <div className="grid gap-3 md:grid-cols-2">
                      {scores.map((s) => (
                        <div key={s.student_id} className="rounded-xl border-2 border-border p-4">
                          <p className="font-black text-foreground">{s.student_name}</p>
                          <div className="mt-3">
                            <BehaviorButtons
                              current={
                                lessonScores.find(
                                  (a) => a.student_id === s.student_id && a.category === "behavior",
                                )?.value
                              }
                              onScore={(value) =>
                                recordAssessmentScore({
                                  studentId: s.student_id,
                                  teacherId: group.teacher_id,
                                  category: "behavior",
                                  source: "manual",
                                  value,
                                  maxValue: 10,
                                  sessionId: sessionIdRef.current,
                                  lessonId: selectedLesson?.id ?? null,
                                })
                              }
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="flex items-center justify-between gap-3">
                <button
                  onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
                  disabled={stepIndex === 0}
                  className="rounded-xl border-2 border-border px-6 py-3 text-sm font-black disabled:opacity-40"
                >
                  المرحلة السابقة
                </button>
                <button
                  onClick={() => setStepIndex((i) => Math.min(orderedSteps.length - 1, i + 1))}
                  disabled={stepIndex === orderedSteps.length - 1}
                  className="rounded-xl bg-navy px-6 py-3 text-sm font-black text-navy-foreground disabled:opacity-40"
                >
                  المرحلة التالية
                </button>
              </div>
            </section>
          )}

          {!isReviewMode ? (
            <aside className="space-y-6">
              <div className="card-crisp p-5">
                <h3 className="mb-4 text-lg font-black">لوحة الدرجات اللحظية</h3>
                <LiveScoreboard scores={scores} />
              </div>

              <div className="card-crisp p-5">
                <h3 className="mb-3 text-lg font-black">ملخص الحصة</h3>
                <div className="space-y-2 text-sm font-extrabold">
                  <SummaryRow label="الطلاب الحاضرون" value={formatNumber(scores.length)} />
                  <SummaryRow label="تم تقييم واجبهم" value={formatNumber(evaluated)} />
                  <SummaryRow label="أسئلة تم رصدها" value={formatNumber(askedCount)} />
                  <SummaryRow
                    label="حالة إطلاق المهام"
                    value={released ? "تم الإرسال" : "لم يُرسل بعد"}
                  />
                </div>
              </div>
            </aside>
          ) : null}
        </div>
      </main>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}
