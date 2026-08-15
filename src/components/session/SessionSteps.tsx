import { Check, ChevronLeft, ChevronRight, Pencil, X } from "lucide-react";
import { useEffect, useState } from "react";

import { StatusBadge } from "@/components/dashboard/StatCard";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AttendanceStatus, LessonSlide, LiveScore, QuestionKind, QuizQuestion } from "@/types";

export const QUESTION_KIND_LABELS: Record<QuestionKind, string> = {
  mcq: "اختيار من متعدد",
  true_false: "صح أم خطأ",
  ordering: "ترتيب",
  matching: "توصيل",
};

/* -------- Step 1: homework evaluation + quick attendance -------- */

export function HomeworkStep({
  scores,
  onScore,
  attendanceStatus,
  onAttendance,
}: {
  scores: LiveScore[];
  onScore: (studentId: string, value: number) => void;
  attendanceStatus: (studentId: string) => AttendanceStatus | null;
  onAttendance: (studentId: string, status: AttendanceStatus) => void;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {scores.map((s) => {
        const status = attendanceStatus(s.student_id);
        return (
          <div key={s.student_id} className="rounded-xl border-2 border-border p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="font-black text-foreground">{s.student_name}</p>
              {s.homework_score !== null ? (
                <StatusBadge tone={s.homework_score >= 7 ? "success" : "warning"}>
                  {formatNumber(s.homework_score)} / ١٠
                </StatusBadge>
              ) : (
                <StatusBadge tone="neutral">لم يُقيَّم</StatusBadge>
              )}
            </div>

            <div className="mt-3 flex gap-1.5">
              <button
                onClick={() => onAttendance(s.student_id, "present")}
                className={cn(
                  "flex-1 rounded-lg border-2 py-2 text-xs font-black transition-colors",
                  status === "present"
                    ? "border-success bg-success/10 text-success"
                    : "border-border hover:border-success",
                )}
              >
                حاضر
              </button>
              <button
                onClick={() => onAttendance(s.student_id, "absent")}
                className={cn(
                  "flex-1 rounded-lg border-2 py-2 text-xs font-black transition-colors",
                  status === "absent"
                    ? "border-destructive bg-destructive/10 text-destructive"
                    : "border-border hover:border-destructive",
                )}
              >
                غائب
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {[0, 2, 4, 6, 8, 10].map((v) => (
                <button
                  key={v}
                  onClick={() => onScore(s.student_id, v)}
                  className={cn(
                    "size-11 rounded-lg border-2 text-base font-black transition-colors",
                    s.homework_score === v
                      ? "border-navy bg-navy text-navy-foreground"
                      : "border-border hover:border-primary",
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* -------- Step 2: lesson presentation -------- */

export function LessonStep({
  slides,
  index,
  onPrev,
  onNext,
  onEdit,
}: {
  slides: LessonSlide[];
  index: number;
  onPrev: () => void;
  onNext: () => void;
  /** §18-2: always-available inline edit, saved immediately — no separate approval step. */
  onEdit: (slideId: string, title: string, bullets: string[]) => void;
}) {
  const slide = slides[index]!;
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(slide.title);
  const [draftBullets, setDraftBullets] = useState(slide.bullets.join("\n"));

  useEffect(() => {
    setDraftTitle(slide.title);
    setDraftBullets(slide.bullets.join("\n"));
    setEditing(false);
  }, [slide.id, slide.title, slide.bullets]);

  const save = () => {
    const bullets = draftBullets
      .split("\n")
      .map((b) => b.trim())
      .filter(Boolean);
    onEdit(slide.id, draftTitle.trim() || slide.title, bullets.length > 0 ? bullets : slide.bullets);
    setEditing(false);
  };

  return (
    <div>
      <div className="rounded-2xl border-2 border-border bg-canvas p-8 md:p-12">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-black text-primary">
            شريحة {formatNumber(slide.index)} من {formatNumber(slides.length)}
          </p>
          <button
            type="button"
            onClick={() => setEditing((e) => !e)}
            className="flex items-center gap-1.5 rounded-lg border-2 border-border px-3 py-1.5 text-xs font-black text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          >
            <Pencil className="size-3.5" /> {editing ? "إلغاء" : "تعديل"}
          </button>
        </div>

        {editing ? (
          <div className="mt-4 space-y-3">
            <input
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              className="w-full rounded-xl border-2 border-border bg-background px-4 py-3 text-xl font-black outline-none focus:border-primary"
            />
            <textarea
              value={draftBullets}
              onChange={(e) => setDraftBullets(e.target.value)}
              rows={4}
              placeholder="نقطة في كل سطر"
              className="w-full rounded-xl border-2 border-border bg-background px-4 py-3 text-sm font-bold outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={save}
              className="rounded-xl bg-navy px-5 py-2.5 text-sm font-black text-navy-foreground hover:opacity-90"
            >
              حفظ
            </button>
          </div>
        ) : (
          <>
            <h3 className="mt-3 text-3xl leading-snug font-black text-foreground md:text-4xl">
              {slide.title}
            </h3>
            <ul className="mt-6 space-y-4">
              {slide.bullets.map((b) => (
                <li
                  key={b}
                  className="flex items-start gap-3 text-xl font-extrabold text-foreground md:text-2xl"
                >
                  <span className="mt-2 size-3 shrink-0 rounded-full bg-primary" />
                  {b}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <button
          onClick={onPrev}
          disabled={index === 0}
          className="flex items-center gap-2 rounded-xl border-2 border-border px-5 py-3 text-sm font-black disabled:opacity-40"
        >
          <ChevronRight className="size-5" /> السابق
        </button>
        <div className="flex gap-1.5">
          {slides.map((s, i) => (
            <span
              key={s.id}
              className={cn("h-2.5 rounded-full", i === index ? "w-8 bg-primary" : "w-2.5 bg-muted")}
            />
          ))}
        </div>
        <button
          onClick={onNext}
          disabled={index === slides.length - 1}
          className="flex items-center gap-2 rounded-xl bg-navy px-5 py-3 text-sm font-black text-navy-foreground disabled:opacity-40"
        >
          التالي <ChevronLeft className="size-5" />
        </button>
      </div>
    </div>
  );
}

/* -------- §8 question-kind variety: ordering + matching interactive bodies -------- */

/**
 * "mcq"/"true_false" kinds: tap an option once, locks in. Exported (not just
 * used by `QuestionCard`) so the electronic-homework panel (§8 — "نفس البنك،
 * سياقان مختلفان") can reuse the exact same answer interaction.
 */
export function McqAnswerBody({
  question,
  answered,
  onAnswer,
}: {
  question: QuizQuestion;
  answered: boolean;
  onAnswer: (correct: boolean) => void;
}) {
  return (
    <div className="mt-6 grid gap-3 md:grid-cols-2">
      {question.options.map((opt, i) => (
        <button
          key={opt}
          disabled={answered}
          onClick={() => onAnswer(i === question.correct_index)}
          className={cn(
            "flex items-center justify-between rounded-xl border-2 px-5 py-4 text-lg font-black transition-colors",
            answered && i === question.correct_index
              ? "border-success bg-success/10 text-success"
              : answered
                ? "border-border opacity-50"
                : "border-border hover:border-primary",
          )}
        >
          {opt}
          {answered && i === question.correct_index ? <Check className="size-5" /> : null}
          {answered && i !== question.correct_index ? <X className="size-5 opacity-40" /> : null}
        </button>
      ))}
    </div>
  );
}

/** "ordering" kind: tap items in the order believed correct; `question.options` IS the correct order. */
export function OrderingAnswerBody({
  question,
  answered,
  onAnswer,
}: {
  question: QuizQuestion;
  answered: boolean;
  onAnswer: (correct: boolean) => void;
}) {
  const [shuffled, setShuffled] = useState<string[]>([]);
  const [picked, setPicked] = useState<string[]>([]);

  useEffect(() => {
    setShuffled([...question.options].sort(() => Math.random() - 0.5));
    setPicked([]);
  }, [question.id]);

  const pick = (item: string) => {
    if (answered || picked.includes(item)) return;
    const next = [...picked, item];
    setPicked(next);
    if (next.length === question.options.length) {
      onAnswer(next.every((v, i) => v === question.options[i]));
    }
  };

  return (
    <div className="mt-6 space-y-3">
      <div className="flex flex-wrap gap-2">
        {shuffled.map((item) => {
          const order = picked.indexOf(item);
          return (
            <button
              key={item}
              type="button"
              disabled={answered || order !== -1}
              onClick={() => pick(item)}
              className={cn(
                "flex items-center gap-2 rounded-xl border-2 px-4 py-3 text-sm font-black transition-colors disabled:opacity-70",
                order !== -1
                  ? "border-navy bg-navy text-navy-foreground"
                  : "border-border hover:border-primary",
              )}
            >
              {order !== -1 ? (
                <span className="flex size-5 items-center justify-center rounded-full bg-white/20 text-xs">
                  {order + 1}
                </span>
              ) : null}
              {item}
            </button>
          );
        })}
      </div>
      {answered ? (
        <div className="rounded-xl border-2 border-border p-3">
          <p className="text-xs font-black text-muted-foreground">الترتيب الصحيح:</p>
          <p className="mt-1 text-sm font-bold text-foreground">{question.options.join(" ← ")}</p>
        </div>
      ) : null}
    </div>
  );
}

/** "matching" kind: tap a left item then a right item to connect them, by index pairing. */
export function MatchingAnswerBody({
  question,
  answered,
  onAnswer,
}: {
  question: QuizQuestion;
  answered: boolean;
  onAnswer: (correct: boolean) => void;
}) {
  const targets = question.match_targets ?? [];
  const [shuffledTargets, setShuffledTargets] = useState<string[]>([]);
  const [selectedLeft, setSelectedLeft] = useState<number | null>(null);
  const [connections, setConnections] = useState<Record<number, number>>({});

  useEffect(() => {
    setShuffledTargets([...targets].sort(() => Math.random() - 0.5));
    setSelectedLeft(null);
    setConnections({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question.id]);

  const connectedTargets = new Set(Object.values(connections));

  const pickRight = (targetValue: string) => {
    if (answered || selectedLeft === null) return;
    const canonicalIndex = targets.indexOf(targetValue);
    if (connectedTargets.has(canonicalIndex)) return;
    const next = { ...connections, [selectedLeft]: canonicalIndex };
    setConnections(next);
    setSelectedLeft(null);
    if (Object.keys(next).length === question.options.length) {
      onAnswer(question.options.every((_, i) => next[i] === i));
    }
  };

  return (
    <div className="mt-6 space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          {question.options.map((opt, i) => (
            <button
              key={opt}
              type="button"
              disabled={answered || connections[i] !== undefined}
              onClick={() => setSelectedLeft(i)}
              className={cn(
                "w-full rounded-xl border-2 px-4 py-3 text-right text-sm font-black transition-colors disabled:opacity-70",
                connections[i] !== undefined
                  ? "border-success bg-success/10 text-success"
                  : selectedLeft === i
                    ? "border-navy bg-navy text-navy-foreground"
                    : "border-border hover:border-primary",
              )}
            >
              {opt}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {shuffledTargets.map((t) => {
            const canonicalIndex = targets.indexOf(t);
            const isConnected = connectedTargets.has(canonicalIndex);
            return (
              <button
                key={t}
                type="button"
                disabled={answered || isConnected || selectedLeft === null}
                onClick={() => pickRight(t)}
                className={cn(
                  "w-full rounded-xl border-2 px-4 py-3 text-right text-sm font-black transition-colors disabled:opacity-40",
                  isConnected ? "border-success bg-success/10 text-success" : "border-border hover:border-primary",
                )}
              >
                {t}
              </button>
            );
          })}
        </div>
      </div>
      {answered ? (
        <div className="rounded-xl border-2 border-border p-3">
          <p className="text-xs font-black text-muted-foreground">الحل الصحيح:</p>
          <div className="mt-1 space-y-1">
            {question.options.map((opt, i) => (
              <p key={opt} className="text-sm font-bold text-foreground">
                {opt} ← {targets[i]}
              </p>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* -------- Step 3: random question picker -------- */

export function QuestionCard({
  student,
  question,
  answered,
  onAnswer,
  onEdit,
}: {
  student: LiveScore | null;
  question: QuizQuestion | null;
  answered: boolean;
  onAnswer: (correct: boolean) => void;
  /** §18-2: always-available inline edit, saved immediately — no separate approval step. */
  onEdit: (questionId: string, text: string, options: string[], correctIndex: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draftText, setDraftText] = useState("");
  const [draftOptions, setDraftOptions] = useState<string[]>([]);
  const [draftCorrect, setDraftCorrect] = useState(0);

  useEffect(() => {
    if (!question) return;
    setDraftText(question.text);
    setDraftOptions(question.options);
    setDraftCorrect(question.correct_index);
    setEditing(false);
  }, [question]);

  if (!student || !question) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-border p-12 text-center">
        <p className="text-xl font-black text-muted-foreground">
          اضغط «اسحب طالباً عشوائياً» لبدء الجولة
        </p>
      </div>
    );
  }

  const save = () => {
    onEdit(question.id, draftText.trim() || question.text, draftOptions, draftCorrect);
    setEditing(false);
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border-2 border-navy bg-navy p-6 text-center text-navy-foreground">
        <p className="text-sm font-black text-white/70">الطالب المختار</p>
        <p className="mt-2 text-4xl font-black md:text-5xl">{student.student_name}</p>
      </div>

      <div className="rounded-2xl border-2 border-border p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <StatusBadge tone="primary">{QUESTION_KIND_LABELS[question.kind]}</StatusBadge>
          {/* §18-2's inline edit only ever covered mcq/true_false's text+options+correct_index shape;
              ordering/matching are new kinds introduced now with no editor built for them yet. */}
          {question.kind === "mcq" || question.kind === "true_false" ? (
            <button
              type="button"
              onClick={() => setEditing((e) => !e)}
              className="flex items-center gap-1.5 rounded-lg border-2 border-border px-3 py-1.5 text-xs font-black text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            >
              <Pencil className="size-3.5" /> {editing ? "إلغاء" : "تعديل"}
            </button>
          ) : null}
        </div>

        {editing ? (
          <div className="mt-4 space-y-3">
            <textarea
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              rows={2}
              className="w-full rounded-xl border-2 border-border bg-background px-4 py-3 text-lg font-black outline-none focus:border-primary"
            />
            <div className="space-y-2">
              {draftOptions.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`correct-option-${question.id}`}
                    checked={draftCorrect === i}
                    onChange={() => setDraftCorrect(i)}
                    className="size-4 shrink-0"
                  />
                  <input
                    value={opt}
                    onChange={(e) => {
                      const next = [...draftOptions];
                      next[i] = e.target.value;
                      setDraftOptions(next);
                    }}
                    className="flex-1 rounded-lg border-2 border-border bg-background px-3 py-2 text-sm font-bold outline-none focus:border-primary"
                  />
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={save}
              className="rounded-xl bg-navy px-5 py-2.5 text-sm font-black text-navy-foreground hover:opacity-90"
            >
              حفظ
            </button>
          </div>
        ) : (
          <>
            <p className="mt-4 text-2xl leading-snug font-black text-foreground md:text-3xl">
              {question.text}
            </p>
            {question.kind === "ordering" ? (
              <OrderingAnswerBody question={question} answered={answered} onAnswer={onAnswer} />
            ) : question.kind === "matching" ? (
              <MatchingAnswerBody question={question} answered={answered} onAnswer={onAnswer} />
            ) : (
              <McqAnswerBody question={question} answered={answered} onAnswer={onAnswer} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* -------- "حل تمارين الكتاب" (CURRICULUM_ENGINE_SPEC.md §1) — same component, two contexts -------- */

export function BookExerciseCard({
  title,
  value,
  onSave,
}: {
  title: string;
  /** Current saved pages text, or null if nothing entered yet this session. */
  value: string | null;
  onSave: (pagesText: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");

  useEffect(() => {
    setDraft(value ?? "");
  }, [value]);

  const save = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    onSave(trimmed);
    setEditing(false);
  };

  return (
    <div className="rounded-xl border-2 border-border p-4">
      <p className="font-black text-foreground underline decoration-2 underline-offset-4">{title}</p>
      {value && !editing ? (
        <p className="mt-2 text-sm font-bold text-muted-foreground">{value}</p>
      ) : null}

      {editing ? (
        <div className="mt-3 space-y-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="مثال: 4، 5، 6"
            className="w-full rounded-lg border-2 border-border bg-background px-3 py-2 text-sm font-bold outline-none focus:border-primary"
          />
          <button
            type="button"
            onClick={save}
            className="rounded-lg bg-navy px-4 py-2 text-xs font-black text-navy-foreground hover:opacity-90"
          >
            حفظ
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="mt-3 flex items-center gap-1.5 rounded-lg border-2 border-border px-3 py-1.5 text-xs font-black text-muted-foreground transition-colors hover:border-primary hover:text-primary"
        >
          <Pencil className="size-3.5" /> {value ? "تعديل الصفحات" : "أدخل الصفحات"}
        </button>
      )}
    </div>
  );
}

/* -------- Live scoreboard (shared) -------- */

export function LiveScoreboard({ scores }: { scores: LiveScore[] }) {
  return (
    <div className="space-y-2">
      {[...scores]
        .sort((a, b) => b.points - a.points)
        .map((s) => (
          <div
            key={s.student_id}
            className="flex items-center justify-between gap-3 rounded-xl border-2 border-border p-3"
          >
            <p className="min-w-0 truncate font-black text-foreground">{s.student_name}</p>
            <div className="flex shrink-0 items-center gap-2">
              {s.homework_score !== null ? (
                <StatusBadge tone="neutral">و {formatNumber(s.homework_score)}</StatusBadge>
              ) : null}
              {s.question_score !== null ? (
                <StatusBadge tone={s.question_score > 0 ? "success" : "destructive"}>
                  س {formatNumber(s.question_score)}
                </StatusBadge>
              ) : null}
              <span className="kpi-number text-lg">{formatNumber(s.points)}</span>
            </div>
          </div>
        ))}
    </div>
  );
}
