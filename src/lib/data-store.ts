import { useCallback, useSyncExternalStore } from "react";

import {
  CURRENT_TENANT,
  attendanceToday as seedAttendance,
  booklets as seedBooklets,
  grades as seedGrades,
  groups as seedGroups,
  homeworkTasks as seedHomework,
  payments as seedPayments,
  quizResults as seedQuizResults,
  students as seedStudents,
  subjects as seedSubjects,
  teacherNotes as seedTeacherNotes,
  teachers as seedTeachers,
  whatsappLogs as seedWhatsapp,
} from "@/lib/mock-data";
import type {
  AttendanceRecord,
  AttendanceStatus,
  BookletItem,
  Grade,
  Group,
  HomeworkTask,
  LeaderboardEntry,
  LiveScore,
  PaymentMethod,
  PaymentRecord,
  QuizResult,
  Student,
  Subject,
  Teacher,
  TeacherNote,
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

export function recordAttendance(
  studentId: string,
  status: AttendanceStatus,
  method: AttendanceRecord["method"],
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
    return {
      ...state,
      attendanceRecords: [record, ...state.attendanceRecords],
      whatsappLogs: [log, ...state.whatsappLogs],
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
export function scoreHomework(studentId: string, value: number) {
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

    return {
      ...state,
      students,
      leaderboard: buildLeaderboard(students),
      liveScores: [...state.liveScores.filter((s) => s.student_id !== student.id), nextScore],
      homeworkTasks: exists
        ? state.homeworkTasks.map((h) => (h.id === taskId ? graded : h))
        : [graded, ...state.homeworkTasks],
    };
  });
}

/** Random-question answer inside session mode — updates points + leaderboard. */
export function recordQuestionAnswer(studentId: string, correct: boolean) {
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
    return {
      ...state,
      students,
      leaderboard: buildLeaderboard(students),
      liveScores: [...state.liveScores.filter((s) => s.student_id !== student.id), nextScore],
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

/** Clears the per-session live scoreboard (start of a new session). */
export function resetLiveScores() {
  update((state) => ({ ...state, liveScores: [] }));
}
