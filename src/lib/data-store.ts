import { useCallback, useSyncExternalStore } from "react";

import {
  CURRENT_TENANT,
  SESSION_STEPS,
  attendanceToday as seedAttendance,
  booklets as seedBooklets,
  curriculumLessons as seedCurriculumLessons,
  curriculumUnits as seedCurriculumUnits,
  gradeSubjects as seedGradeSubjects,
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
  BookExerciseTask,
  BookletItem,
  CurriculumLesson,
  CurriculumUnit,
  ElectronicHomework,
  Grade,
  GradeSubject,
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
  SuggestedActivity,
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

/**
 * Bumped to v2 for CURRICULUM_ENGINE_SPEC.md §8's grade overhaul (secondary →
 * primary stages). `readState` merges cached localStorage over a fresh seed, so
 * without this bump any browser that already seeded v1 would keep the old
 * ثانوي grades mixed with the new `gradeSubjects` table — a broken combination.
 */
const STORAGE_KEY = "erp.data.v2";
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
  gradeSubjects: GradeSubject[];
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
  curriculumUnits: CurriculumUnit[];
  curriculumLessons: CurriculumLesson[];
  bookExerciseTasks: BookExerciseTask[];
  suggestedActivities: SuggestedActivity[];
  electronicHomeworks: ElectronicHomework[];
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
    gradeSubjects: seedGradeSubjects.map((gs) => ({ ...gs })),
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
    curriculumUnits: seedCurriculumUnits.map((u) => ({ ...u })),
    curriculumLessons: seedCurriculumLessons.map((l) => ({ ...l })),
    bookExerciseTasks: [],
    suggestedActivities: [],
    electronicHomeworks: [],
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

export interface CreateStudentInput {
  /** The login code from `auth.ts`'s `createStudent` — must match so `resolveCurrentStudent` finds this record. */
  code: string;
  fullName: string;
  groupId: string;
  guardianName: string;
  guardianPhone: string;
  subjectIds: string[];
}

/**
 * §7: the "إضافة طالب" screen used to only create an `auth.ts` login account —
 * no `Student` record ever got created, so a newly-provisioned student's code
 * matched nothing here and `resolveCurrentStudent` silently fell back to
 * `students[0]`. This is the missing half: a real `Student` row, seeded from
 * the chosen group (grade/group_name mirror it) with sensible zeroed stats.
 * Returns null if the group id doesn't exist.
 */
export function createStudentRecord(input: CreateStudentInput): Student | null {
  const state = getData();
  const group = state.groups.find((g) => g.id === input.groupId);
  if (!group) return null;

  const student: Student = {
    id: `st-${Date.now()}`,
    center_id: CENTER_ID,
    code: input.code,
    full_name: input.fullName,
    grade: group.grade,
    group_name: group.name,
    group_id: group.id,
    guardian_name: input.guardianName,
    guardian_phone: input.guardianPhone,
    payment_status: "pending",
    balance_due: 0,
    points: 0,
    attendance_rate: 0,
    avg_score: 0,
    subject_ids: input.subjectIds,
  };

  update((s) => {
    const students = [...s.students, student];
    const groups = s.groups.map((g) =>
      g.id === group.id ? { ...g, enrolled: g.enrolled + 1 } : g,
    );
    return { ...s, students, groups, leaderboard: buildLeaderboard(students) };
  });

  return student;
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

/** A group's past sessions, newest-first (§18-3's attendance grid columns). */
export function getSessionRecordsForGroup(state: DataState, groupId: string): SessionRecord[] {
  return state.sessionRecords.filter((r) => r.group_id === groupId);
}

/** Subjects a grade actually studies (CURRICULUM_ENGINE_SPEC.md §8), via `GradeSubject`. */
export function getSubjectsForGrade(state: DataState, gradeId: string): Subject[] {
  const subjectIds = new Set(
    state.gradeSubjects.filter((gs) => gs.grade_id === gradeId).map((gs) => gs.subject_id),
  );
  return state.subjects.filter((s) => subjectIds.has(s.id));
}

/* ---------------- Curriculum plan — "ذاكرة التشغيل" (§9) ---------------- */

export function getCurriculumUnitsForSubjectGrade(
  state: DataState,
  subjectId: string,
  gradeId: string,
): CurriculumUnit[] {
  return state.curriculumUnits
    .filter((u) => u.subject_id === subjectId && u.grade_id === gradeId)
    .sort((a, b) => a.order - b.order);
}

export function getCurriculumLessonsForUnit(state: DataState, unitId: string): CurriculumLesson[] {
  return state.curriculumLessons
    .filter((l) => l.unit_id === unitId)
    .sort((a, b) => a.order - b.order);
}

/** First not-yet-done planned lesson across a subject/grade's units, in curriculum order. */
function getNextPlannedLesson(
  state: DataState,
  subjectId: string,
  gradeId: string,
): CurriculumLesson | undefined {
  for (const unit of getCurriculumUnitsForSubjectGrade(state, subjectId, gradeId)) {
    const next = getCurriculumLessonsForUnit(state, unit.id).find((l) => l.status !== "done");
    if (next) return next;
  }
  return undefined;
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

/** §6-أ: final approved thresholds — six tiers, not five. Do not adjust. */
export function getPerformanceLabel(avgPercent: number): string {
  if (avgPercent >= 85) return "متفوق";
  if (avgPercent >= 65) return "جيد جداً";
  if (avgPercent >= 40) return "متوسط، يحتاج تحسين";
  if (avgPercent >= 25) return "ضعيف";
  if (avgPercent >= 10) return "يحتاج متابعة عاجلة";
  return "خطر — يحتاج تدخل فوري";
}

export interface WeakPointDiagnosis {
  hasWeakPoint: boolean;
  text: string;
}

const WEAK_POINT_CATEGORIES: { label: string; category: AssessmentScore["category"] }[] = [
  { label: "الواجب المنزلي", category: "homework" },
  { label: "الواجب الإلكتروني", category: "e_homework" },
  { label: "النشاط", category: "activity" },
  { label: "السلوك", category: "behavior" },
];

/**
 * §6-ب: compares a student's general standing (`getAssessmentScore`'s single
 * current value per category, not lesson-scoped — those four categories are
 * recorded generally in teacher.assessments.tsx, not per-subject) across the
 * four retroactive categories to flag whichever lags behind. A category with
 * no recorded score yet is excluded rather than treated as 0 — missing data
 * isn't the same as a weak result.
 */
export function diagnoseWeakPoint(state: DataState, studentId: string): WeakPointDiagnosis {
  const components = WEAK_POINT_CATEGORIES.map(({ label, category }) => {
    const score = getAssessmentScore(state, studentId, category);
    return score ? { label, value: Math.round((score.value / score.max_value) * 100) } : null;
  }).filter((c): c is { label: string; value: number } => c !== null);

  if (components.length < 2) {
    return { hasWeakPoint: false, text: "لا توجد بيانات كافية بعد لتشخيص نقطة ضعف" };
  }

  const sorted = [...components].sort((a, b) => a.value - b.value);
  const weakest = sorted[0]!;
  const strongest = sorted[sorted.length - 1]!;

  if (strongest.value - weakest.value < 10) {
    return { hasWeakPoint: false, text: "الأداء متوازن عبر كل الجوانب" };
  }
  return {
    hasWeakPoint: true,
    text: `نقطة ضعفه: ${weakest.label} (متوسط ${weakest.value}% مقابل باقي الأنشطة ${strongest.value}%+)`,
  };
}

/** Lesson creation order recovered from its `lsn-<ms>` id — same technique as getTimerCompliance. */
function lessonCreatedMs(lessonId: string): number {
  return Number(lessonId.slice("lsn-".length));
}

/**
 * Every `AssessmentScore` tied (via `lesson_id`) to a lesson in this subject (§5).
 * Scores with a null `lesson_id` (general/retroactive entries from teacher.assessments.tsx)
 * have no subject to attribute them to, so they're excluded here by design.
 */
export function getStudentScoresForSubject(
  state: DataState,
  studentId: string,
  subjectId: string,
): AssessmentScore[] {
  const lessonIds = new Set(
    state.lessons.filter((l) => l.subject_id === subjectId).map((l) => l.id),
  );
  return state.assessmentScores.filter(
    (a) => a.student_id === studentId && a.lesson_id !== null && lessonIds.has(a.lesson_id),
  );
}

function averagePercent(scores: AssessmentScore[]): number {
  if (scores.length === 0) return 0;
  const sum = scores.reduce((s, a) => s + (a.value / a.max_value) * 100, 0);
  return Math.round(sum / scores.length);
}

export interface SubjectPerformanceSummary {
  overallAvg: number;
  trend: "up" | "down" | "same";
  lessonsRecordedCount: number;
}

/** Student's rollup for one subject (§5) — updates automatically as new lesson scores land. */
export function getSubjectPerformanceSummary(
  state: DataState,
  studentId: string,
  subjectId: string,
): SubjectPerformanceSummary {
  const scores = getStudentScoresForSubject(state, studentId, subjectId);
  const lessonIds = [...new Set(scores.map((s) => s.lesson_id!))].sort(
    (a, b) => lessonCreatedMs(b) - lessonCreatedMs(a),
  );
  const [latestLessonId, previousLessonId] = lessonIds;
  const currentAvg = latestLessonId
    ? averagePercent(scores.filter((s) => s.lesson_id === latestLessonId))
    : 0;
  const previousAvg = previousLessonId
    ? averagePercent(scores.filter((s) => s.lesson_id === previousLessonId))
    : 0;
  return {
    overallAvg: averagePercent(scores),
    trend:
      latestLessonId && previousLessonId
        ? currentAvg > previousAvg
          ? "up"
          : currentAvg < previousAvg
            ? "down"
            : "same"
        : "same",
    lessonsRecordedCount: lessonIds.length,
  };
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
      session_id: sessionId ?? null,
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

/** The recorded status for a student in one specific past session — a grid cell (§18-3). */
export function getAttendanceForSession(
  state: DataState,
  studentId: string,
  sessionId: string,
): AttendanceRecord | undefined {
  return state.attendanceRecords.find(
    (a) => a.student_id === studentId && a.session_id === sessionId,
  );
}

/**
 * §18-3: retroactive per-cell edit for the attendance grid (student × past session) —
 * upserts by (student, session), unlike `recordAttendance`'s append-only live check-in
 * log. Calling it again for the same cell corrects it in place.
 */
export function updateAttendanceForSession(
  studentId: string,
  sessionId: string,
  status: AttendanceStatus,
) {
  update((state) => {
    const student = findStudentById(state, studentId);
    if (!student) return state;
    const existing = getAttendanceForSession(state, studentId, sessionId);
    const record: AttendanceRecord = {
      id: existing?.id ?? `at-${Date.now()}`,
      center_id: student.center_id,
      student_id: student.id,
      student_name: student.full_name,
      group_name: student.group_name,
      status,
      checked_in_at: existing?.checked_in_at ?? (status === "absent" ? "—" : nowTime()),
      method: existing?.method ?? "manual",
      session_id: sessionId,
    };
    const attendanceRecords = existing
      ? state.attendanceRecords.map((a) => (a.id === existing.id ? record : a))
      : [record, ...state.attendanceRecords];
    return { ...state, attendanceRecords };
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
/**
 * §9-ب "ذاكرة التشغيل": uploading a new lesson auto-links it to the group's next
 * not-done planned `CurriculumLesson` (same subject/grade) and flips that plan
 * entry to "in_progress" — no separate manual step, no independent logic here,
 * just data written once at the moment the event actually happens.
 */
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

    const group = state.groups.find((g) => g.id === groupId);
    const planned = group ? getNextPlannedLesson(state, subjectId, group.grade_id) : undefined;
    const curriculumLessons = planned
      ? state.curriculumLessons.map((l) =>
          l.id === planned.id ? { ...l, linked_lesson_id: id, status: "in_progress" as const } : l,
        )
      : state.curriculumLessons;

    return { ...state, lessons: [lesson, ...state.lessons], curriculumLessons };
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
  activity: Omit<SuggestedActivity, "id" | "lesson_id">,
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
    const newActivity: SuggestedActivity = {
      ...activity,
      id: `act-${lessonId}`,
      lesson_id: lessonId,
    };
    /**
     * §8: "واجب الويب سايت" reuses the exact same generated question bank as the
     * in-session random pool ("نفس البنك، سياقان مختلفان") — not a separately
     * generated set.
     */
    const lessonGroupId = state.lessons.find((l) => l.id === lessonId)?.group_id;
    const newElectronicHomeworks = lessonGroupId
      ? [
          ...state.electronicHomeworks,
          {
            id: `eh-${lessonId}`,
            lesson_id: lessonId,
            group_id: lessonGroupId,
            questions: newQuestions,
            due_at: "خلال ٣ أيام",
          },
        ]
      : state.electronicHomeworks;
    return {
      ...state,
      lessons: state.lessons.map((l) => (l.id === lessonId ? { ...l, ai_status: "ready" } : l)),
      lessonSlides: [...state.lessonSlides, ...newSlides],
      sessionQuestions: [...state.sessionQuestions, ...newQuestions],
      suggestedActivities: [...state.suggestedActivities, newActivity],
      electronicHomeworks: newElectronicHomeworks,
    };
  });
}

/** §8: a group's electronic homework for its latest-ready lesson, if any. */
export function getElectronicHomeworkForGroup(
  state: DataState,
  groupId: string,
): ElectronicHomework | undefined {
  return [...state.electronicHomeworks].reverse().find((h) => h.group_id === groupId);
}

/** §8: the one suggested activity generated for a lesson. */
export function getSuggestedActivityForLesson(
  state: DataState,
  lessonId: string,
): SuggestedActivity | undefined {
  return state.suggestedActivities.find((a) => a.lesson_id === lessonId);
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

    // §9-ب: ending a session that taught a linked lesson marks its curriculum entry "done".
    const curriculumLessons = input.lessonId
      ? state.curriculumLessons.map((l) =>
          l.linked_lesson_id === input.lessonId ? { ...l, status: "done" as const } : l,
        )
      : state.curriculumLessons;

    return {
      ...state,
      sessionRecords: [record, ...state.sessionRecords],
      curriculumLessons,
    };
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
    const lessonId = input.lessonId ?? null;
    /**
     * Upsert key includes `lesson_id` (CURRICULUM_ENGINE_SPEC.md §8's electronic
     * homework fix): without it, a student's 2nd/3rd electronic homework
     * (session_id always null, only lesson_id differs) would silently overwrite
     * the previous lesson's score instead of recording a new one — breaking
     * §5's per-lesson trend rollup for the "e_homework" category. Session-mode
     * calls (real sessionId) and teacher.assessments.tsx's general retroactive
     * calls (session_id and lesson_id both null) are unaffected by this.
     */
    const existing = state.assessmentScores.find(
      (a) =>
        a.student_id === input.studentId &&
        a.category === input.category &&
        a.session_id === sessionId &&
        a.lesson_id === lessonId,
    );
    const entry: AssessmentScore = {
      id: existing?.id ?? `asc-${Date.now()}`,
      center_id: student.center_id,
      student_id: student.id,
      session_id: sessionId,
      lesson_id: lessonId,
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

/** §8: has this student already completed this lesson's electronic homework? */
export function getElectronicHomeworkScore(
  state: DataState,
  studentId: string,
  lessonId: string,
): AssessmentScore | undefined {
  return state.assessmentScores.find(
    (a) => a.student_id === studentId && a.category === "e_homework" && a.lesson_id === lessonId,
  );
}

export interface BookExerciseTaskInput {
  sessionId: string;
  groupId: string;
  context: BookExerciseTask["context"];
  pagesText: string;
}

/** "حل تمارين الكتاب" (§1) — upserts by (session, group, context): re-entering pages edits in place. */
export function recordBookExerciseTask(input: BookExerciseTaskInput) {
  update((state) => {
    const group = state.groups.find((g) => g.id === input.groupId);
    if (!group) return state;
    const existing = state.bookExerciseTasks.find(
      (t) =>
        t.session_id === input.sessionId &&
        t.student_group_id === input.groupId &&
        t.context === input.context,
    );
    const entry: BookExerciseTask = {
      id: existing?.id ?? `bet-${Date.now()}`,
      center_id: group.center_id,
      session_id: input.sessionId,
      student_group_id: input.groupId,
      pages_text: input.pagesText,
      context: input.context,
      created_at: existing?.created_at ?? todayLabel(),
    };
    const bookExerciseTasks = existing
      ? state.bookExerciseTasks.map((t) => (t.id === existing.id ? entry : t))
      : [entry, ...state.bookExerciseTasks];
    return { ...state, bookExerciseTasks };
  });
}

export function getBookExerciseTask(
  state: DataState,
  sessionId: string,
  groupId: string,
  context: BookExerciseTask["context"],
): BookExerciseTask | undefined {
  return state.bookExerciseTasks.find(
    (t) => t.session_id === sessionId && t.student_group_id === groupId && t.context === context,
  );
}

/** Clears the per-session live scoreboard (start of a new session). */
export function resetLiveScores() {
  update((state) => ({ ...state, liveScores: [] }));
}
