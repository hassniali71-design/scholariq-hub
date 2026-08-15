import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { CheckCircle2, Dices, Send, Timer, X } from "lucide-react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/dashboard/StatCard";
import { pickFairly } from "@/components/session/FairRandomPicker";
import { InteractiveSlideViewer } from "@/components/session/InteractiveSlideViewer";
import {
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
  getLatestReadyLesson,
  getLessonsForGroup,
  getQuestionsForLesson,
  getSlidesForLesson,
  getBookExerciseTask,
  getSessionRecordsForGroup,
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

/**
 * On-screen presentation order (spec §7-ب: شرح ← واجب/غياب ← أنشطة ← إطلاق).
 * `SESSION_STEPS` in mock-data.ts now declares the same order (CURRICULUM_ENGINE_SPEC.md §3).
 */
const SESSION_FLOW: SessionStepKey[] = ["lesson", "homework", "questions", "release"];

export const Route = createFileRoute("/teacher/session")({
  head: () => ({
    meta: [
      { title: "وضع الحصة — محرك التايمر الرباعي" },
      {
        name: "description",
        content:
          "شاشة عرض الحصة بالتايمرات: الشرح، تقييم الواجب ورصد الغياب، سحب طالب عشوائي بتوزيع عادل وتايمر قابل للاختيار، وإطلاق الواجب.",
      },
      { property: "og:title", content: "وضع الحصة — محرك التايمر الرباعي" },
      {
        property: "og:description",
        content: "مركز قيادة الحصة للشاشات الذكية بتايمرات دقيقة ورصد درجات لحظي.",
      },
    ],
  }),
  component: SessionMode,
});

function SessionMode() {
  const state = useDataStore();
  const { groups, students, liveScores, attendanceRecords, subjects } = state;
  const group = groups[0]!;
  const navigate = useNavigate();
  /** "Today's" 6 students standing in for the group's real roster (demo data). */
  const sessionStudents = useMemo(() => students.slice(0, 6), [students]);
  /** §7-و: session mode only — never applied to AppShell (shared by every role). */
  const theme = getSubjectTheme(subjects.find((s) => s.id === group.subject_id)?.theme_key);
  const { computeHash } = useContentHash();
  const [uploading, setUploading] = useState(false);

  /* Lesson pipeline: latest upload attempt drives the upload box's state;
   * the latest *ready* lesson (which may be an older one) drives what's on
   * screen, so a failed re-upload doesn't blank out a lesson that already
   * worked (§7-د: "فشل AI لا يعطّل الحصة"). */
  const groupLessons = getLessonsForGroup(state, group.id);
  const activeLesson = groupLessons[0] ?? null;
  const latestReadyLesson = getLatestReadyLesson(state, group.id);
  const activeSlides = latestReadyLesson
    ? getSlidesForLesson(state, latestReadyLesson.id)
    : state.lessonSlides.filter((s) => s.lesson_id === null);
  const activeQuestionPool = latestReadyLesson
    ? getQuestionsForLesson(state, latestReadyLesson.id)
    : state.sessionQuestions.filter((q) => q.lesson_id === null);

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
    [computeHash, group.id, group.subject, group.subject_id, group.teacher_id],
  );

  const handleRetryLesson = useCallback(async () => {
    if (!activeLesson) return;
    setUploading(true);
    try {
      await retryLessonPipeline(activeLesson.id, group.subject);
      toast.success("تم توليد عرض الدرس بنجاح");
    } finally {
      setUploading(false);
    }
  }, [activeLesson, group.subject]);
  /** CURRICULUM_ENGINE_SPEC.md §3: no prior SessionRecord for this group → nothing to grade yet. */
  const isFirstSessionForGroup = useMemo(
    () => getSessionRecordsForGroup(state, group.id).length === 0,
    [state.sessionRecords, group.id],
  );
  const orderedSteps = useMemo(
    () =>
      SESSION_FLOW.filter((key) => key !== "homework" || !isFirstSessionForGroup).map(
        (key) => SESSION_STEPS.find((s) => s.key === key)!,
      ),
    [isFirstSessionForGroup],
  );
  const [stepIndex, setStepIndex] = useState(0);
  const [slideIndex, setSlideIndex] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [askedCount, setAskedCount] = useState(0);
  const [released, setReleased] = useState(false);
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

  const step = orderedSteps[stepIndex]!;
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
        lessonId: latestReadyLesson?.id ?? null,
      });
    },
    [group.teacher_id, latestReadyLesson],
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
          lessonId: latestReadyLesson?.id ?? null,
        });
      }
      toast[correct ? "success" : "error"](
        correct ? "إجابة صحيحة — +٥٠ نقطة" : "إجابة خاطئة — تم الرصد",
      );
    },
    [pickedId, questionTimer, group.teacher_id, latestReadyLesson],
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
      lessonId: latestReadyLesson?.id ?? null,
      attendeesCount,
      absenteesCount,
      questionsAskedCount: askedCount,
      participantsCount,
      homeworkLaunchStatus: released ? "sent" : "not_sent",
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
    latestReadyLesson,
    askedCount,
    released,
    navigate,
  ]);

  return (
    <div dir="rtl" className="min-h-screen bg-canvas">
      {/* Presenter header — themed by the group's subject (§7-و) */}
      <header
        className="sticky top-0 z-20 border-b-2 border-border text-navy-foreground"
        style={{ backgroundColor: theme.primary }}
      >
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-4 px-5 py-4 md:px-8">
          <div className="flex items-center gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/15">
              <theme.icon className="size-6" />
            </span>
            <div>
              <p className="text-xs font-black text-white/70">وضع الحصة — شاشة العرض</p>
              <h1 className="text-2xl font-black md:text-3xl">{group.name}</h1>
              <p className="text-xs font-bold text-white/70">
                {group.teacher_name} · {group.room} · {formatNumber(group.enrolled)} طالب
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden rounded-xl bg-white/15 px-4 py-2 text-sm font-black md:block">
              المرحلة {formatNumber(stepIndex + 1)} من {formatNumber(orderedSteps.length)}
            </span>
            <button
              type="button"
              onClick={handleEndSession}
              className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-black text-navy hover:opacity-90"
            >
              <X className="size-4" /> إنهاء الحصة
            </button>
          </div>
        </div>

        {/* Stepper */}
        <div className="mx-auto grid max-w-[1600px] gap-2 px-5 pb-4 md:grid-cols-4 md:px-8">
          {orderedSteps.map((s, i) => (
            <button
              key={s.key}
              onClick={() => setStepIndex(i)}
              className={cn(
                "flex items-center gap-3 rounded-xl border-2 px-4 py-3 text-right transition-colors",
                i === stepIndex
                  ? "border-white bg-white text-navy"
                  : i < stepIndex
                    ? "border-white/40 bg-white/10 text-white"
                    : "border-white/20 text-white/70 hover:bg-white/10",
              )}
            >
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-black",
                  i === stepIndex ? "bg-navy text-navy-foreground" : "bg-white/20 text-white",
                )}
              >
                {i < stepIndex ? <CheckCircle2 className="size-4" /> : i + 1}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-black">{s.title}</span>
                <span className="block text-[11px] font-bold opacity-70">
                  {Math.round(s.duration / 60)} دقيقة
                </span>
              </span>
            </button>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-5 py-6 md:px-8">
        <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
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
                size={step.key === "homework" ? "xl" : "lg"}
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
              {step.key === "homework" ? (
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
                  activeLesson={activeLesson}
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

              {step.key === "release" ? (
                <div className="space-y-5">
                  <h3 className="text-lg font-black">إطلاق المهام والأنشطة</h3>
                  <div className="grid gap-3 md:grid-cols-2">
                    <TaskCard
                      title="الواجب المنزلي"
                      text="مسائل صفحة ٨٤ : ٨٩ — آخر موعد بعد ٤٨ ساعة"
                    />
                    <TaskCard title="الشيت الأسبوعي" text="شيت الباب الثالث — ٢٥ سؤال" />
                    <TaskCard title="ملخص الحصة PDF" text="يُرسل تلقائياً لحسابات الطلاب" />
                    <TaskCard
                      title="تقرير ولي الأمر"
                      text="درجات الواجب والأسئلة + ملاحظة المدرس"
                    />
                    {/* CURRICULUM_ENGINE_SPEC.md §1: نفس المكوّن، مرتان بـcontext مختلف */}
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
                  </div>
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
        </div>
      </main>
    </div>
  );
}

function TaskCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl border-2 border-border p-4">
      <p className="font-black text-foreground">{title}</p>
      <p className="mt-1 text-xs font-bold text-muted-foreground">{text}</p>
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
