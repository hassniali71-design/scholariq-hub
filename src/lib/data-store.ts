import { useCallback, useSyncExternalStore } from "react";

import {
  CURRENT_TENANT,
  SESSION_STEPS,
  attendanceToday as seedAttendance,
  booklets as seedBooklets,
  grades as seedGrades,
  groups as seedGroups,
  homeworkTasks as seedHomework,
  lessonSlides as seedLessonSlides,
  payments as seedPayments,
  quizResults as seedQuizResults,
  sessionQuestions as seedSessionQuestions,
  students as seedStudents,
  subjects as seedSubjects,
  teacherNotes as seedTeacherNotes,
  teachers as seedTeachers,
  whatsappLogs as seedWhatsapp,
} from "@/lib/mock-data";
import type {
  AssessmentScore,
  AttendanceRecord,
  AttendanceStatus,
  BookletItem,
  Grade,
  Group,
  HomeworkTask,
  LeaderboardEntry,
  Lesson,
  LessonSlide,
  LiveScore,
  PaymentMethod,
  PaymentRecord,
  QuizQuestion,
  QuizResult,
  RandomPickLog,
  SessionEvent,
  SessionRecord,
  SessionStepKey,
  Student,
  Subject,
  Teacher,
  TeacherNote,
  TimerExtension,
  WhatsAppLog,
} from "@/types";

/**
 * Central client-side data store (single source of truth).
 *
 * Mirrors the `src/lib/auth.ts` pattern: localStorage persistence + a
 * subscribe/emit bus so every role portal reacts to the same events.
 *
 * Every entity keeps its `center_id`, so replacing the read/write helpers with
 * Supabase queries (guarded by RLS on `center_id`) is a drop-in change:
 * only `readState` / `writeState` and the mutation bodies need to talk to the
 * network instead of localStorage — component code stays identical.
 */

const STORAGE_KEY = "erp.data.v1";
const CENTER_ID = CURRENT_TENANT.center_id;

export interface ShiftClosure {
  id: string;
  center_id: string;
  expected: number;
  counted: number;
  diff: number;
  closed_at: string;
}

export interface DataState {
  students: Student[];
  teachers: Teacher[];
  groups: Group[];
  subjects: Subject[];
  grades: Grade[];
  attendanceRecords: AttendanceRecord[];
  payments: PaymentRecord[];
  booklets: BookletItem[];
  quizResults: QuizResult[];
  homeworkTasks: HomeworkTask[];
  whatsappLogs: WhatsAppLog[];
  teacherNotes: TeacherNote[];
  leaderboard: LeaderboardEntry[];
  liveScores: LiveScore[];
  shiftClosures: ShiftClosure[];
  lessons: Lesson[];
  lessonSlides: LessonSlide[];
  sessionQuestions: QuizQuestion[];
  timerExtensions: TimerExtension[];
  randomPickLogs: RandomPickLog[];
  sessionEvents: SessionEvent[];
  sessionRecords: SessionRecord[];
  assessmentScores: AssessmentScore[];
}

/* ---------------- Derived helpers ---------------- */

export function buildLeaderboard(students: Student[]): LeaderboardEntry[] {
  return [...students]
    .sort((a, b) => b.points - a.points)
    .slice(0, 5)
    .map((s, i) => ({
      rank: i + 1,
      student_id: s.id,
      student_name: s.full_name,
      points: s.points,
    }));
}

function nowTime() {
  return new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
}

function todayLabel() {
  return `اليوم ${nowTime()}`;
}

let eventCounter = 0;

/** Durable per-event log entry (§7-ح) — built inline so callers stay atomic with their `update()`. */
function buildSessionEvent(
  sessionId: string,
  studentId: string,
  kind: SessionEvent["kind"],
  payload: Record<string, unknown>,
): SessionEvent {
  eventCounter += 1;
  return {
    id: `sev-${Date.now()}-${eventCounter}`,
    session_id: sessionId,
    student_id: studentId,
    at: todayLabel(),
    kind,
    payload,
  };
}

/* ---------------- Seed ---------------- */

function seedState(): DataState {
  const students = seedStudents.map((s) => ({ ...s }));
  return {
    students,
    teachers: seedTeachers.map((t) => ({ ...t })),
    groups: seedGroups.map((g) => ({ ...g })),
    subjects: seedSubjects.map((s) => ({ ...s })),
    grades: seedGrades.map((g) => ({ ...g })),
    attendanceRecords: seedAttendance.map((a) => ({ ...a })),
    payments: seedPayments.map((p) => ({ ...p })),
    booklets: seedBooklets.map((b) => ({ ...b })),
    quizResults: seedQuizResults.map((q) => ({ ...q })),
    homeworkTasks: seedHomework.map((h) => ({ ...h })),
    whatsappLogs: seedWhatsapp.map((w) => ({ ...w })),
    teacherNotes: seedTeacherNotes.map((n) => ({ ...n })),
    leaderboard: buildLeaderboard(students),
    liveScores: [],
    shiftClosures: [],
    lessons: [],
    lessonSlides: seedLessonSlides.map((s) => ({ ...s })),
    sessionQuestions: seedSessionQuestions.map((q) => ({ ...q })),
    timerExtensions: [],
    randomPickLogs: [],
    sessionEvents: [],
    sessionRecords: [],
    assessmentScores: [],
  };
}

/** Immutable snapshot used during SSR / before hydration. */
const SERVER_STATE: DataState = seedState();

/* ---------------- Store core (subscribe / emit) ---------------- */

const listeners = new Set<() => void>();
let cache: DataState | null = null;

function emit() {
  listeners.forEach((l) => l());
}

export function subscribeData(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function readState(): DataState {
  if (typeof window === "undefined") return SERVER_STATE;
  if (cache) return cache;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<DataState>;
      cache = { ...seedState(), ...parsed };
      return cache;
    } catch {
      /* fall through to seed */
    }
  }
  cache = seedState();
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  return cache;
}

function writeState(next: DataState) {
  cache = next;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  emit();
}

function update(mutator: (state: DataState) => DataState) {
  writeState(mutator(readState()));
}

export function getData(): DataState {
  return readState();
}

/** Wipes persisted data and returns to the seeded snapshot. */
export function resetData() {
  writeState(seedState());
}

/* ---------------- React binding ---------------- */

export function useDataStore(): DataState {
  return useSyncExternalStore(subscribeData, readState, () => SERVER_STATE);
}

/** Selector variant to avoid re-rendering on unrelated table changes. */
export function useDataSelector<T>(selector: (state: DataState) => T): T {
  const get = useCallback(() => selector(readState()), [selector]);
  const getServer = useCallback(() => selector(SERVER_STATE), [selector]);
  return useSyncExternalStore(subscribeData, get, getServer);
}

/* ---------------- Lookups ---------------- */

export function findStudentByCode(state: DataState, code: string): Student | undefined {
  return state.students.find((s) => s.code.toLowerCase() === code.trim().toLowerCase());
}

export function findStudentById(state: DataState, id: string): Student | undefined {
  return state.students.find((s) => s.id === id);
}

/**
 * Resolves the student the current session is about.
 * Parents authenticate with their child's student code, so the same
 * resolution works for both `student` and `parent` roles.
 */
export function resolveCurrentStudent(state: DataState, identifier?: string | null): Student {
  const match = identifier ? findStudentByCode(state, identifier) : undefined;
  return match ?? state.students[0]!;
}

/**
 * Teacher-scoped reads — the logical equivalent of Supabase RLS on `teacher_id`
 * until a real backend exists (see CLAUDE.md §4-د / TEACHER_MODULE_SPEC.md §4-د).
 * Always filter internally; never return another teacher's rows, even for a
 * bad/missing id (empty array, not an error that would leak existence).
 */
export function getGroupsForTeacher(state: DataState, teacherId: string): Group[] {
  return state.groups.filter((g) => g.teacher_id === teacherId);
}

export function getStudentsForTeacher(state: DataState, teacherId: string): Student[] {
  const groupIds = new Set(getGroupsForTeacher(state, teacherId).map((g) => g.id));
  return state.students.filter((s) => s.group_id !== null && groupIds.has(s.group_id));
}

export function getStudentsForGroup(state: DataState, groupId: string): Student[] {
  return state.students.filter((s) => s.group_id === groupId);
}

/** The current (general, not tied to one past session) score for a student in a category — §8. */
export function getAssessmentScore(
  state: DataState,
  studentId: string,
  category: AssessmentScore["category"],
): AssessmentScore | undefined {
  return state.assessmentScores.find(
    (a) => a.student_id === studentId && a.category === category && a.session_id === null,
  );
}

/**
 * Documented default (spec §7-ج doesn't give an exact %) — extension budget before
 * compliance visibly degrades. Shared by the live per-step badge (teacher.session.tsx)
 * and the aggregate calculation below, so the two stay consistent.
 */
export const REASONABLE_EXTENSION_RATIO = 0.2;

const PLANNED_SESSION_SECONDS = SESSION_STEPS.reduce((sum, s) => sum + s.duration, 0);
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Per-session compliance (§18-1): 100% if the session finished within the planned
 * total duration or within a "reasonable" extension budget on top of it (mirrors
 * §7-ج's rule — no penalty for finishing early or for a modest overrun); beyond
 * that, degrades gradually rather than dropping straight to 0. The decay rate
 * (1 point per 30s of excess) is a documented default, same category as the ratio above.
 */
function sessionComplianceScore(record: SessionRecord): number {
  const overrun = Math.max(0, record.duration_seconds - PLANNED_SESSION_SECONDS);
  const reasonable = PLANNED_SESSION_SECONDS * REASONABLE_EXTENSION_RATIO;
  if (overrun <= reasonable) return 100;
  const excess = overrun - reasonable;
  return Math.max(40, 100 - excess / 30);
}

/**
 * Real timer-compliance aggregate (§18-1) — average per-session compliance over the
 * teacher's `SessionRecord`s from the last 30 days. `SessionRecord.id` is the
 * session id minted at session start (`sess-<ms>`, see teacher.session.tsx), so its
 * creation time is recovered from the id itself rather than a separate timestamp.
 * Falls back to the static seeded `Teacher.timer_compliance` when a teacher has no
 * real session data yet, so the KPI shows zero visual diff until real usage exists.
 */
export function getTimerCompliance(state: DataState, teacherId: string): number {
  const cutoff = Date.now() - THIRTY_DAYS_MS;
  const records = state.sessionRecords.filter((r) => {
    if (r.teacher_id !== teacherId) return false;
    const createdAtMs = Number(r.id.slice("sess-".length));
    return !Number.isNaN(createdAtMs) && createdAtMs >= cutoff;
  });
  if (records.length === 0) {
    return state.teachers.find((t) => t.id === teacherId)?.timer_compliance ?? 0;
  }
  const avg = records.reduce((sum, r) => sum + sessionComplianceScore(r), 0) / records.length;
  return Math.round(avg);
}

export type StudentClassification = "excellent" | "needs_attention" | "average";

/**
 * Default 3-tier thresholds proposed in TEACHER_MODULE_SPEC.md §6-د.
 * Pending explicit owner confirmation (spec §15 decision #3) — same
 * treat-the-documented-default-as-current-truth approach used for decision #7.
 */
export function classifyStudent(student: Student): StudentClassification {
  if (student.avg_score >= 85 && student.attendance_rate >= 90) return "excellent";
  if (student.avg_score < 60 || student.attendance_rate < 75) return "needs_attention";
  return "average";
}

/** Deterministic reason text for §6-هـ — no AI involved. */
export function classificationReason(student: Student): string {
  const reasons: string[] = [];
  if (student.attendance_rate < 75) reasons.push("ضعف الحضور");
  if (student.avg_score < 60) reasons.push("انخفاض متوسط الدرجات");
  return reasons.length > 0 ? reasons.join(" + ") : "متابعة عامة";
}

/* ---------------- Mutations ---------------- */

/** `sessionId`: only passed from inside session mode — logs a durable SessionEvent too (§7-ح). */
export function recordAttendance(
  studentId: string,
  status: AttendanceStatus,
  method: AttendanceRecord["method"],
  sessionId?: string,
) {
  update((state) => {
    const student = findStudentById(state, studentId);
    if (!student) return state;
    const record: AttendanceRecord = {
      id: `at-${Date.now()}`,
      center_id: student.center_id,
      student_id: student.id,
      student_name: student.full_name,
      group_name: student.group_name,
      status,
      checked_in_at: status === "absent" ? "—" : nowTime(),
      method,
    };
    const log: WhatsAppLog = {
      id: `wa-${Date.now()}`,
      center_id: student.center_id,
      student_id: student.id,
      sent_at: todayLabel(),
      template: status === "absent" ? "absence" : "attendance",
      message:
        status === "absent"
          ? `تنبيه: لم يتم تسجيل حضور الطالب ${student.full_name} في حصة ${student.group_name}.`
          : `تم تسجيل حضور الطالب ${student.full_name} في حصة ${student.group_name} الساعة ${record.checked_in_at}.`,
      delivered: true,
    };
    const sessionEvents = sessionId
      ? [buildSessionEvent(sessionId, student.id, "attendance", { status, method }), ...state.sessionEvents]
      : state.sessionEvents;
    return {
      ...state,
      attendanceRecords: [record, ...state.attendanceRecords],
      whatsappLogs: [log, ...state.whatsappLogs],
      sessionEvents,
    };
  });
}

export function recordPayment(
  studentCode: string,
  amount: number,
  method: PaymentMethod,
  item: string,
) {
  update((state) => {
    const student = findStudentByCode(state, studentCode);
    if (!student) return state;
    const payment: PaymentRecord = {
      id: `pm-${Date.now()}`,
      center_id: student.center_id,
      student_name: student.full_name,
      student_code: student.code,
      amount,
      method,
      item,
      created_at: nowTime(),
    };
    const remaining = Math.max(0, student.balance_due - amount);
    const students = state.students.map((s) =>
      s.id === student.id
        ? {
            ...s,
            balance_due: remaining,
            payment_status: remaining === 0 ? "paid" : s.payment_status,
          }
        : s,
    ) as Student[];
    const log: WhatsAppLog = {
      id: `wa-${Date.now()}`,
      center_id: student.center_id,
      student_id: student.id,
      sent_at: todayLabel(),
      template: "payment",
      message: `تم سداد مبلغ ${amount} جنيه — ${item}.`,
      delivered: true,
    };
    return {
      ...state,
      students,
      payments: [payment, ...state.payments],
      whatsappLogs: [log, ...state.whatsappLogs],
    };
  });
}

export function deliverBooklet(bookletId: string) {
  update((state) => ({
    ...state,
    booklets: state.booklets.map((b) =>
      b.id === bookletId && b.in_stock > 0
        ? { ...b, in_stock: b.in_stock - 1, delivered: b.delivered + 1 }
        : b,
    ),
  }));
}

export function closeShift(countedAmount: number) {
  update((state) => {
    const expected = state.payments.reduce((sum, p) => sum + p.amount, 0);
    const closure: ShiftClosure = {
      id: `sh-${Date.now()}`,
      center_id: CENTER_ID,
      expected,
      counted: countedAmount,
      diff: countedAmount - expected,
      closed_at: todayLabel(),
    };
    return { ...state, shiftClosures: [closure, ...state.shiftClosures] };
  });
}

function ensureLiveScore(state: DataState, student: Student): LiveScore {
  return (
    state.liveScores.find((s) => s.student_id === student.id) ?? {
      student_id: student.id,
      student_name: student.full_name,
      homework_score: null,
      question_score: null,
      points: 0,
    }
  );
}

/** Homework evaluation inside session mode — persists to the student record. */
export function scoreHomework(studentId: string, value: number, sessionId?: string) {
  update((state) => {
    const student = findStudentById(state, studentId);
    if (!student) return state;
    const current = ensureLiveScore(state, student);
    const delta = (value - (current.homework_score ?? 0)) * 5;
    const nextScore: LiveScore = {
      ...current,
      homework_score: value,
      points: current.points + delta,
    };
    const students = state.students.map((s) =>
      s.id === student.id ? { ...s, points: s.points + delta } : s,
    );

    const taskId = `hw-live-${student.id}`;
    const graded: HomeworkTask = {
      id: taskId,
      center_id: student.center_id,
      student_id: student.id,
      subject: student.group_name.split(" - ")[0] ?? "الحصة",
      title: "تقييم واجب الحصة",
      due_date: "اليوم",
      status: "graded",
      grade: value,
    };
    const exists = state.homeworkTasks.some((h) => h.id === taskId);
    const sessionEvents = sessionId
      ? [buildSessionEvent(sessionId, student.id, "homework_score", { value }), ...state.sessionEvents]
      : state.sessionEvents;

    return {
      ...state,
      students,
      leaderboard: buildLeaderboard(students),
      liveScores: [...state.liveScores.filter((s) => s.student_id !== student.id), nextScore],
      homeworkTasks: exists
        ? state.homeworkTasks.map((h) => (h.id === taskId ? graded : h))
        : [graded, ...state.homeworkTasks],
      sessionEvents,
    };
  });
}

/** Random-question answer inside session mode — updates points + leaderboard. */
export function recordQuestionAnswer(studentId: string, correct: boolean, sessionId?: string) {
  update((state) => {
    const student = findStudentById(state, studentId);
    if (!student) return state;
    const current = ensureLiveScore(state, student);
    const gain = correct ? 50 : 0;
    const nextScore: LiveScore = {
      ...current,
      question_score: correct ? 10 : 0,
      points: current.points + gain,
    };
    const students = state.students.map((s) =>
      s.id === student.id ? { ...s, points: s.points + gain } : s,
    );
    const sessionEvents = sessionId
      ? [buildSessionEvent(sessionId, student.id, "question_answer", { correct }), ...state.sessionEvents]
      : state.sessionEvents;
    return {
      ...state,
      students,
      leaderboard: buildLeaderboard(students),
      liveScores: [...state.liveScores.filter((s) => s.student_id !== student.id), nextScore],
      sessionEvents,
    };
  });
}

/** Releases homework + weekly sheet to every student of the group and notifies guardians. */
export function releaseSessionTasks(groupId: string) {
  update((state) => {
    const group = state.groups.find((g) => g.id === groupId);
    if (!group) return state;
    const members = state.students.filter((s) => s.group_name === group.name);
    const stamp = Date.now();

    const tasks: HomeworkTask[] = members.map((s, i) => ({
      id: `hw-${stamp}-${i}`,
      center_id: s.center_id,
      student_id: s.id,
      subject: group.subject,
      title: "الواجب المنزلي — مسائل صفحة ٨٤ : ٨٩",
      due_date: "بعد ٤٨ ساعة",
      status: "pending",
    }));

    const logs: WhatsAppLog[] = members.map((s, i) => ({
      id: `wa-${stamp}-${i}`,
      center_id: s.center_id,
      student_id: s.id,
      sent_at: todayLabel(),
      template: "homework",
      message: `تم إطلاق واجب جديد لـ ${s.full_name} في ${group.subject} — آخر موعد بعد ٤٨ ساعة.`,
      delivered: true,
    }));

    return {
      ...state,
      homeworkTasks: [...tasks, ...state.homeworkTasks],
      whatsappLogs: [...logs, ...state.whatsappLogs],
    };
  });
}

/** Teacher dashboard "أضف ملاحظتك" quick note (§6-هـ) — persists to the student's record. */
export function addTeacherNote(studentId: string, teacherId: string, note: string) {
  update((state) => {
    const student = findStudentById(state, studentId);
    const teacher = state.teachers.find((t) => t.id === teacherId);
    if (!student || !teacher || !note.trim()) return state;
    const entry: TeacherNote = {
      id: `tn-${Date.now()}`,
      center_id: student.center_id,
      student_id: student.id,
      teacher_id: teacher.id,
      teacher_name: teacher.full_name,
      subject: teacher.subject,
      date: todayLabel(),
      note: note.trim(),
      tone: "neutral",
    };
    return { ...state, teacherNotes: [entry, ...state.teacherNotes] };
  });
}

/* ---------------- Session mode: lessons (PDF → AI pipeline, §7-د/10) ---------------- */

export function findLessonByHash(state: DataState, contentHash: string): Lesson | undefined {
  return state.lessons.find((l) => l.content_hash === contentHash);
}

export function getLessonsForGroup(state: DataState, groupId: string): Lesson[] {
  return state.lessons.filter((l) => l.group_id === groupId);
}

/** Most recently uploaded lesson that finished generating — what session mode presents. */
export function getLatestReadyLesson(state: DataState, groupId: string): Lesson | undefined {
  // `state.lessons` is newest-first (createLesson prepends), so the first match is the latest.
  return getLessonsForGroup(state, groupId).find((l) => l.ai_status === "ready");
}

export function getSlidesForLesson(state: DataState, lessonId: string): LessonSlide[] {
  return state.lessonSlides
    .filter((s) => s.lesson_id === lessonId)
    .sort((a, b) => a.index - b.index);
}

export function getQuestionsForLesson(state: DataState, lessonId: string): QuizQuestion[] {
  return state.sessionQuestions.filter((q) => q.lesson_id === lessonId);
}

/** Starts the pipeline: inserts a `processing` Lesson row. Returns its id. */
export function createLesson(
  groupId: string,
  subjectId: string,
  teacherId: string,
  sourceFileName: string,
  contentHash: string,
): string {
  const id = `lsn-${Date.now()}`;
  update((state) => {
    const lesson: Lesson = {
      id,
      center_id: CENTER_ID,
      group_id: groupId,
      subject_id: subjectId,
      title: sourceFileName.replace(/\.pdf$/i, ""),
      source_file_name: sourceFileName,
      extracted_text: null,
      content_hash: contentHash,
      ai_status: "processing",
      ai_error: null,
      taught_status: "not_started",
      taught_at: null,
      actual_duration_seconds: null,
      created_by_teacher_id: teacherId,
    };
    return { ...state, lessons: [lesson, ...state.lessons] };
  });
  return id;
}

export function setLessonExtractedText(lessonId: string, text: string) {
  update((state) => ({
    ...state,
    lessons: state.lessons.map((l) => (l.id === lessonId ? { ...l, extracted_text: text } : l)),
  }));
}

/** Pipeline success — stores the generated slides + questions and flips the lesson to "ready". */
export function completeLessonGeneration(
  lessonId: string,
  slides: Array<Omit<LessonSlide, "id" | "lesson_id">>,
  questions: Array<Omit<QuizQuestion, "id" | "lesson_id" | "source">>,
) {
  update((state) => {
    const newSlides: LessonSlide[] = slides.map((s, i) => ({
      ...s,
      id: `sl-${lessonId}-${i}`,
      lesson_id: lessonId,
    }));
    const newQuestions: QuizQuestion[] = questions.map((q, i) => ({
      ...q,
      id: `q-${lessonId}-${i}`,
      lesson_id: lessonId,
      source: "ai_generated",
    }));
    return {
      ...state,
      lessons: state.lessons.map((l) => (l.id === lessonId ? { ...l, ai_status: "ready" } : l)),
      lessonSlides: [...state.lessonSlides, ...newSlides],
      sessionQuestions: [...state.sessionQuestions, ...newQuestions],
    };
  });
}

/** Pipeline failure — session mode keeps working; teacher can retry or teach manually. */
export function markLessonFailed(lessonId: string, error: string) {
  update((state) => ({
    ...state,
    lessons: state.lessons.map((l) =>
      l.id === lessonId ? { ...l, ai_status: "failed", ai_error: error } : l,
    ),
  }));
}

/** "إعادة المحاولة" — reuses the stored extracted_text, no re-upload needed. */
export function retryLessonGeneration(lessonId: string) {
  update((state) => ({
    ...state,
    lessons: state.lessons.map((l) =>
      l.id === lessonId ? { ...l, ai_status: "processing", ai_error: null } : l,
    ),
  }));
}

/** Logs a timer extension inside session mode (§7-ج). */
export function recordTimerExtension(
  sessionId: string,
  stepKey: SessionStepKey,
  addedSeconds: number,
  reason: string | null,
) {
  update((state) => {
    const entry: TimerExtension = {
      id: `tx-${Date.now()}`,
      session_id: sessionId,
      step_key: stepKey,
      added_seconds: addedSeconds,
      reason,
      at: todayLabel(),
    };
    return { ...state, timerExtensions: [entry, ...state.timerExtensions] };
  });
}

/**
 * §18-2: always-available inline edit for a generated (or legacy static) slide —
 * saves immediately, no separate approval step (matches spec §15 decision #2).
 */
export function updateLessonSlide(slideId: string, title: string, bullets: string[]) {
  update((state) => ({
    ...state,
    lessonSlides: state.lessonSlides.map((s) => (s.id === slideId ? { ...s, title, bullets } : s)),
  }));
}

/** §18-2: same, for a question — text/options/correct answer, saved immediately. */
export function updateQuizQuestion(
  questionId: string,
  text: string,
  options: string[],
  correctIndex: number,
) {
  update((state) => ({
    ...state,
    sessionQuestions: state.sessionQuestions.map((q) =>
      q.id === questionId ? { ...q, text, options, correct_index: correctIndex } : q,
    ),
  }));
}

/** Logs a fair-pick draw (§7-هـ) — feeds `pickFairly`'s weighting on future draws. */
export function recordRandomPick(groupId: string, studentId: string, sessionId: string) {
  update((state) => {
    const entry: RandomPickLog = {
      id: `rpl-${Date.now()}`,
      group_id: groupId,
      student_id: studentId,
      session_id: sessionId,
      picked_at: todayLabel(),
    };
    return { ...state, randomPickLogs: [entry, ...state.randomPickLogs] };
  });
}

export interface SessionSummaryInput {
  sessionId: string;
  groupId: string;
  teacherId: string;
  lessonId: string | null;
  attendeesCount: number;
  absenteesCount: number;
  questionsAskedCount: number;
  participantsCount: number;
  homeworkLaunchStatus: "not_sent" | "sent";
  durationSeconds: number;
  explanationDurationSeconds: number;
  extensionSeconds: number;
  generalNotes: string | null;
}

/** §7-ط — persisted once, when the teacher actually ends the session (not on every step change). */
export function recordSessionSummary(input: SessionSummaryInput) {
  update((state) => {
    const record: SessionRecord = {
      id: input.sessionId,
      center_id: CENTER_ID,
      group_id: input.groupId,
      lesson_id: input.lessonId,
      teacher_id: input.teacherId,
      date: todayLabel(),
      attendees_count: input.attendeesCount,
      absentees_count: input.absenteesCount,
      questions_asked_count: input.questionsAskedCount,
      participants_count: input.participantsCount,
      homework_launch_status: input.homeworkLaunchStatus,
      duration_seconds: input.durationSeconds,
      explanation_duration_seconds: input.explanationDurationSeconds,
      extension_seconds: input.extensionSeconds,
      general_notes: input.generalNotes,
    };
    return { ...state, sessionRecords: [record, ...state.sessionRecords] };
  });
}

export interface AssessmentScoreInput {
  studentId: string;
  teacherId: string;
  category: AssessmentScore["category"];
  source: AssessmentScore["source"];
  value: number;
  maxValue: number;
  sessionId?: string | null;
  lessonId?: string | null;
}

/**
 * Records/edits an assessment score (§8) — a real ledger value, not an append-only
 * event log. Upserts by (student, category, session): calling it again for the
 * same combination *updates the existing record in place*, which is what makes
 * "تعديل درجة قديمة بأثر رجعي" (Phase 4's testable criterion) actually work.
 * Deliberately separate from `scoreHomework`'s live in-session points/HomeworkTask
 * update (§7-أ: session mode vs. this independent management section).
 */
export function recordAssessmentScore(input: AssessmentScoreInput) {
  update((state) => {
    const student = findStudentById(state, input.studentId);
    if (!student) return state;
    const sessionId = input.sessionId ?? null;
    const existing = state.assessmentScores.find(
      (a) =>
        a.student_id === input.studentId &&
        a.category === input.category &&
        a.session_id === sessionId,
    );
    const entry: AssessmentScore = {
      id: existing?.id ?? `asc-${Date.now()}`,
      center_id: student.center_id,
      student_id: student.id,
      session_id: sessionId,
      lesson_id: input.lessonId ?? null,
      category: input.category,
      source: input.source,
      value: input.value,
      max_value: input.maxValue,
      recorded_by_teacher_id: input.teacherId,
      recorded_at: todayLabel(),
    };
    const assessmentScores = existing
      ? state.assessmentScores.map((a) => (a.id === existing.id ? entry : a))
      : [entry, ...state.assessmentScores];
    return { ...state, assessmentScores };
  });
}

/** Clears the per-session live scoreboard (start of a new session). */
export function resetLiveScores() {
  update((state) => ({ ...state, liveScores: [] }));
}
