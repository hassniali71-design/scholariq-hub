import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Clock, Dices, XCircle } from "lucide-react";
import { toast } from "sonner";

import { pickFairly } from "@/components/session/FairRandomPicker";
import { pickEncouragement } from "@/lib/encouragement";
import {
  getStudentsForGroup,
  recordAssessmentScore,
  recordRandomPick,
  useDataStore,
  type DataState,
} from "@/lib/data-store";
import { cn } from "@/lib/utils";
import type { Group, QuizQuestion, Student } from "@/types";

/**
 * Migration 0023 / خطة C (C3): مشغّل النشاط التفاعلي —
 * تايمر قابل للتعديل 5..30 ثانية، اختيار عشوائي للطالب عبر
 * `pickFairly`، عرض إجابة + عبارة تشجيع، تسجيل في
 * `assessment_scores` (category="activity") + `random_pick_logs`.
 *
 * يقبل قائمة QuizQuestion مُمرَّرة من `InteractiveActivityStudio`
 * (اللي يقرأ شيت Excel عبر dynamic import) — بدون تحميل xlsx هنا.
 */

export interface ActivityRunnerProps {
  group: Group;
  teacherId: string;
  sessionId: string;
  questions: QuizQuestion[];
  defaultSecondsPerQuestion?: number;
  onExit?: () => void;
}

export function ActivityRunner({
  group,
  teacherId,
  sessionId,
  questions,
  defaultSecondsPerQuestion = 15,
  onExit,
}: ActivityRunnerProps) {
  const state = useDataStore();
  const [secondsPerQuestion, setSecondsPerQuestion] = useState(defaultSecondsPerQuestion);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [picked, setPicked] = useState<Student | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [timeLeft, setTimeLeft] = useState(secondsPerQuestion);
  const [running, setRunning] = useState(false);
  const [score, setScore] = useState(0);
  const [asked, setAsked] = useState(0);
  const [encouragement, setEncouragement] = useState<string | null>(null);
  const [encouragementTone, setEncouragementTone] = useState<"correct" | "wrong" | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const students = useMemo(() => getStudentsForGroup(state, group.id), [state.students, group.id]);
  const attendedIds = useMemo(() => new Set(students.map((s) => s.id)), [students]);
  const currentQuestion = questions[questionIndex % questions.length] ?? null;

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    stopTimer();
    setTimeLeft(secondsPerQuestion);
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          stopTimer();
          toast.error("انتهى الوقت — لم يتم الرد");
          setRunning(false);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }, [secondsPerQuestion, stopTimer]);

  useEffect(() => () => stopTimer(), [stopTimer]);

  const handlePick = useCallback(() => {
    if (questions.length === 0) {
      toast.warning("لا توجد أسئلة في النشاط");
      return;
    }
    const next = pickFairly(students, state.randomPickLogs, sessionId, attendedIds);
    if (!next) {
      toast.warning("كل الطلاب تم اختيارهم مسبقاً في هذه الحصة");
      return;
    }
    recordRandomPick(group.id, next.id, sessionId);
    setPicked(next);
    setRevealed(false);
    setEncouragement(null);
    setEncouragementTone(null);
    setAsked((a) => a + 1);
    setRunning(true);
    startTimer();
  }, [students, state.randomPickLogs, sessionId, attendedIds, group.id, questions.length, startTimer]);

  const handleAnswer = useCallback(
    (choiceIndex: number) => {
      if (!picked || !currentQuestion || revealed) return;
      stopTimer();
      const isCorrect = choiceIndex === currentQuestion.correct_index;
      setRevealed(true);
      setEncouragement(pickEncouragement(isCorrect));
      setEncouragementTone(isCorrect ? "correct" : "wrong");
      if (isCorrect) {
        setScore((s) => s + 1);
        recordAssessmentScore({
          studentId: picked.id,
          teacherId,
          category: "activity",
          source: "manual",
          value: 1,
          maxValue: 1,
          sessionId,
          lessonId: currentQuestion.lesson_id,
        });
      }
    },
    [picked, currentQuestion, revealed, stopTimer, teacherId, sessionId],
  );

  const handleNext = useCallback(() => {
    stopTimer();
    setRunning(false);
    setPicked(null);
    setRevealed(false);
    setEncouragement(null);
    setEncouragementTone(null);
    setQuestionIndex((i) => i + 1);
  }, [stopTimer]);

  if (questions.length === 0) {
    return (
      <div className="rounded-xl border-2 border-dashed border-border p-6 text-center text-sm font-bold text-muted-foreground">
        لا توجد أسئلة. ارفع شيت Excel أولاً من «محرّك النشاط».
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-black text-foreground">
          <Dices className="size-4 text-primary" />
          <span>
            سؤال {Math.min(asked + (picked ? 1 : 0), questions.length)} / {questions.length}
          </span>
          <span className="ms-2 rounded-lg bg-success/12 px-2 py-0.5 text-xs text-success">
            ✓ {score}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-[11px] font-black text-muted-foreground">
            <Clock className="size-3.5" /> ث/سؤال
          </label>
          <select
            value={secondsPerQuestion}
            onChange={(e) => {
              const v = Number(e.target.value);
              setSecondsPerQuestion(v);
              if (running) {
                setTimeLeft(v);
                startTimer();
              }
            }}
            className="rounded-lg border-2 border-border bg-background px-2 py-1 text-xs font-black outline-none focus:border-primary"
          >
            {[5, 10, 15, 20, 25, 30].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          {onExit ? (
            <button
              type="button"
              onClick={onExit}
              className="rounded-lg border-2 border-border px-2 py-1 text-[11px] font-black text-muted-foreground hover:bg-muted"
            >
              خروج
            </button>
          ) : null}
        </div>
      </div>

      <div
        className={cn(
          "rounded-xl border-2 p-4",
          running && timeLeft <= 5 ? "border-destructive/50 bg-destructive/5" : "border-border bg-canvas/40",
        )}
      >
        {picked ? (
          <p className="mb-3 text-sm font-black text-primary">
            🎯 {picked.full_name}
          </p>
        ) : null}
        <p className="text-base font-black text-foreground">{currentQuestion?.text}</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {currentQuestion?.options.map((opt, i) => {
            const isCorrect = i === currentQuestion.correct_index;
            const isPicked =
              picked !== null && revealed && currentQuestion.correct_index === i;
            return (
              <button
                key={i}
                type="button"
                disabled={!picked || revealed}
                onClick={() => handleAnswer(i)}
                className={cn(
                  "rounded-xl border-2 px-3 py-2 text-sm font-black text-foreground transition-colors",
                  revealed && isCorrect
                    ? "border-success bg-success/15"
                    : revealed
                      ? "border-border bg-background opacity-60"
                      : "border-border bg-background hover:border-primary",
                )}
              >
                <span className="ms-1 inline-block w-6 text-muted-foreground">
                  {["أ", "ب", "ج", "د"][i] ?? i + 1}.
                </span>
                {opt}
                {revealed && isCorrect ? <CheckCircle2 className="ms-2 inline size-4 text-success" /> : null}
                {revealed && isPicked === false ? null : null}
              </button>
            );
          })}
        </div>
        {encouragement ? (
          <p
            className={cn(
              "mt-3 rounded-xl border-2 p-2 text-sm font-black",
              encouragementTone === "correct"
                ? "border-success/40 bg-success/10 text-success"
                : "border-destructive/40 bg-destructive/10 text-destructive",
            )}
          >
            {encouragementTone === "wrong" ? <XCircle className="me-1 inline size-4" /> : null}
            {encouragement}
          </p>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-2">
        {running ? (
          <div className="flex items-center gap-2">
            <Clock className={cn("size-5", timeLeft <= 5 ? "text-destructive" : "text-primary")} />
            <span
              className={cn(
                "kpi-number text-2xl",
                timeLeft <= 5 ? "text-destructive" : "text-foreground",
              )}
            >
              {timeLeft}s
            </span>
          </div>
        ) : (
          <p className="text-xs font-bold text-muted-foreground">
            اضغط «اسحب طالباً» لبدء السؤال التالي.
          </p>
        )}
        <div className="flex items-center gap-2">
          {revealed ? (
            <button
              type="button"
              onClick={handleNext}
              className="rounded-xl bg-navy px-4 py-2 text-xs font-black text-navy-foreground hover:opacity-90"
            >
              التالي
            </button>
          ) : (
            <button
              type="button"
              onClick={handlePick}
              className="flex items-center gap-2 rounded-xl bg-navy px-4 py-2 text-xs font-black text-navy-foreground hover:opacity-90"
            >
              <Dices className="size-4" />
              {picked ? "اسحب طالباً آخر" : "اسحب طالباً"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function useSessionIdRef(seed?: string): React.MutableRefObject<string> {
  const ref = useRef(seed ?? `act-${Date.now()}`);
  return ref;
}

/** مساعد لـ teacher.session: يجلب قائمة الطلاب بمعرّف المجموعة من الـ state. */
export function getGroupStudents(state: DataState, groupId: string): Student[] {
  return getStudentsForGroup(state, groupId);
}
