import { useCallback, useSyncExternalStore } from "react";
import { toast } from "sonner";

import { getSession } from "@/lib/auth";
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
import { DEFAULT_TENANT_ACCENT } from "@/lib/tenant-colors";
import {
  deleteRows,
  fetchCenterData,
  insertRow,
  updateRow,
  upsertRow,
  type TableName,
} from "@/lib/data-functions.server";
import type {
  ActivityEntry,
  AssessmentScore,
  Expense,
  AttendanceRecord,
  AttendanceStatus,
  BookExerciseTask,
  BookletItem,
  BookletSale,
  CenterNotification,
  CurriculumLesson,
  CurriculumUnit,
  ElectronicHomework,
  FinanceSettings,
  Grade,
  GradeSubject,
  Group,
  GroupActivation,
  GroupResource,
  HomeworkAttempt,
  HomeworkTask,
  LeaderboardEntry,
  Lesson,
  LessonSlide,
  LiveScore,
  PaperCredit,
  PaperTransaction,
  PaymentMethod,
  PaymentRecord,
  QuizQuestion,
  PayrollRecord,
  PayrollBasis,
  QuizResult,
  RandomPickLog,
  ScheduleSlot,
  StudentBillingPlan,
  MonthlyClosing,
  SubjectPrice,
  SafeHandover,
  SessionEvent,
  SessionRecord,
  SessionStepKey,
  StaffPermissionKey,
  StaffPermissionRecord,
  LessonPlan,
  PlatformTeacherNote,
  Student,
  Subject,
  SuggestedActivity,
  Task,
  TaskAssigneeRole,
  TaskPriority,
  TaskStatus,
  TaskType,
  Teacher,
  TeacherLaunch,
  TeacherNote,
  TimerExtension,
  WhatsAppLog,
} from "@/types";

/**
 * Central client-side data store (single source of truth).
 *
 * SUPABASE_MIGRATION_SPEC.md §5: now backed by Supabase instead of localStorage, behind
 * `USE_SUPABASE` for a fast revert. The public API (every exported function/hook below) is
 * unchanged on purpose — every route file that already calls these keeps working with zero
 * edits; only what happens *inside* each function changed.
 *
 * Pattern per mutation: apply the change to the in-memory state immediately (same as before
 * — instant UI feedback, no route needs to `await` a mutation it never awaited previously),
 * then fire a matching Supabase write in the background via `syncInsert`/`syncUpdate`/
 * `syncUpsert`/`syncDelete`. A failed background write shows a toast but never blocks or
 * rolls back the local UI — this app has no offline-conflict story yet (documented gap,
 * same spirit as §7's deferred RLS).
 */
export const USE_SUPABASE = true;

/* ---------------- Supabase sync helpers ---------------- */

function currentIdentifier(): string | null {
  return getSession()?.identifier ?? null;
}

function reportSyncFailure(table: string, err: unknown) {
  console.error(`[data-store] Supabase sync failed for ${table}:`, err);
  toast.error("تعذّر الحفظ على الخادم", {
    description: "التغيير ظاهر عندك الآن لكنه لسه مايتزامنش.",
  });
}

/**
 * `row`/`patch` accept any plain object (every `DataState` row type — `Student`, `Lesson`,
 * etc.) rather than `Record<string, unknown>`: those interfaces have no index signature, so
 * TS rejects passing them where `Record<string, unknown>` is expected even though the actual
 * shape is fine — the server function's own validator is the real runtime check.
 */
type PlainRow = Record<string, unknown>;

function syncInsert(table: TableName, row: object) {
  if (!USE_SUPABASE) return;
  const identifier = currentIdentifier();
  if (!identifier) return;
  void insertRow({ data: { identifier, table, row: row as PlainRow } }).catch((err) =>
    reportSyncFailure(table, err),
  );
}

function syncBulkInsert(table: TableName, rows: object[]) {
  if (!USE_SUPABASE || rows.length === 0) return;
  const identifier = currentIdentifier();
  if (!identifier) return;
  for (const row of rows) {
    void insertRow({ data: { identifier, table, row: row as PlainRow } }).catch((err) =>
      reportSyncFailure(table, err),
    );
  }
}

function syncUpdate(table: TableName, id: string, patch: object, idColumn?: string) {
  if (!USE_SUPABASE) return;
  const identifier = currentIdentifier();
  if (!identifier) return;
  void updateRow({
    data: { identifier, table, id, patch: patch as PlainRow, ...(idColumn ? { idColumn } : {}) },
  }).catch((err) => reportSyncFailure(table, err));
}

function syncUpsert(table: TableName, row: object, onConflict = "id") {
  if (!USE_SUPABASE) return;
  const identifier = currentIdentifier();
  if (!identifier) return;
  void upsertRow({ data: { identifier, table, row: row as PlainRow, onConflict } }).catch((err) =>
    reportSyncFailure(table, err),
  );
}

function syncDeleteIds(table: TableName, ids: string[], idColumn?: string) {
  if (!USE_SUPABASE || ids.length === 0) return;
  const identifier = currentIdentifier();
  if (!identifier) return;
  void deleteRows({
    data: { identifier, table, ids, ...(idColumn ? { idColumn } : {}) },
  }).catch((err) => reportSyncFailure(table, err));
}

function syncDeleteAll(table: TableName) {
  if (!USE_SUPABASE) return;
  const identifier = currentIdentifier();
  if (!identifier) return;
  void deleteRows({ data: { identifier, table } }).catch((err) => reportSyncFailure(table, err));
}

/**
 * Root cause of a recurring class of bug (hit twice now): `readState` merges
 * cached localStorage over a fresh seed, so any browser that already seeded
 * under a given key keeps stale content FOREVER for that key, no matter how
 * many times mock-data.ts changes afterward — a manually-bumped version
 * string only helps if every single seed edit remembers to bump it, which
 * didn't happen (e.g. the grade overhaul bumped v1→v2, but §7's subject_ids,
 * the 5 test students, the gr-1 grade fix, and Teacher.user_id all landed
 * under "v2" unbumped — real users' browsers silently kept null `user_id`
 * long after the fix shipped, exactly what caused this bug report).
 *
 * Fix: derive the key from an actual fingerprint of the seed data itself, so
 * ANY future edit to any seed array auto-invalidates old snapshots — no
 * manual step to forget again. (Still used as the `USE_SUPABASE = false`
 * fallback storage key, and as the in-memory placeholder seed either way.)
 */
function fingerprintSeed(): string {
  const raw = JSON.stringify([
    seedStudents,
    seedTeachers,
    seedGroups,
    seedSubjects,
    seedGrades,
    seedGradeSubjects,
    seedAttendance,
    seedPayments,
    seedBooklets,
    seedQuizResults,
    seedHomework,
    seedWhatsapp,
    seedTeacherNotes,
    seedLessonSlides,
    seedSessionQuestions,
    seedCurriculumUnits,
    seedCurriculumLessons,
  ]);
  // Non-cryptographic (djb2) — just needs to change when content changes, not resist tampering.
  let hash = 5381;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash * 33) ^ raw.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

const STORAGE_KEY = `erp.data.v3.${fingerprintSeed()}`;

export interface ShiftClosure {
  id: string;
  center_id: string;
  expected: number;
  counted: number;
  diff: number;
  closed_at: string;
}

export interface CenterInfo {
  id: string;
  name: string;
  branch: string;
  /** §11-أ — sidebar-only accent, null falls back to the default navy in AppShell. */
  accent_color: string | null;
  /** §11-ب — this center's /login/$slug path segment, null if never assigned one. */
  slug: string | null;
}

export interface DataState {
  /**
   * The actual tenant this data belongs to — read dynamically after hydration (§8: every
   * client onboarded via /platform/new-center must see their own center's name everywhere,
   * not the seeded demo tenant's). Defaults to the seed tenant only as the SSR/pre-hydration
   * placeholder, same as every other field here.
   */
  center: CenterInfo;
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
  /* برج تحكم المالك */
  financeSettings: FinanceSettings[];
  safeHandovers: SafeHandover[];
  notifications: CenterNotification[];
  activityLog: ActivityEntry[];
  staffPermissions: StaffPermissionRecord[];
  /* محرك الماليات والجدولة (db/0010) */
  expenses: Expense[];
  payrollRecords: PayrollRecord[];
  subjectPrices: SubjectPrice[];
  scheduleSlots: ScheduleSlot[];
  /* نظام المهام (db/0012) */
  tasks: Task[];
  /* مخزون الورق ومبيعات الملازم (db/0017/0018) */
  paperCredits: PaperCredit[];
  paperTransactions: PaperTransaction[];
  bookletSales: BookletSale[];
  /* خطط الدروس ورسائل مدير المنصة (db/0019) */
  lessonPlans: LessonPlan[];
  platformTeacherNotes: PlatformTeacherNote[];
  /** Migration 0022: monthly closing snapshots for the treasury "إغلاق شهري" feature. */
  monthlyClosings: MonthlyClosing[];
  /** Migration 0023 (المرحلة A): روابط شرح/PDF/مرفقات لكل مجموعة. */
  groupResources: GroupResource[];
  /** Migration 0023 (المرحلة A): الإطلاقات (واجبات، أنشطة، اختبارات تفاعلية، مراجعات). */
  teacherLaunches: TeacherLaunch[];
  /** Migration 0023 (المرحلة A): محاولات الطلاب على الواجبات الإلكترونية. */
  homeworkAttempts: HomeworkAttempt[];
  /** Migration 0026: إشارة "نشطة الآن" مستقلة — فعل الموظف فقط، انظر تعليق GroupActivation. */
  groupActivations: GroupActivation[];
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

/** `numberingSystem: "latn"` — same tofu-glyph fix as format.ts, applied here too. */
function nowTime() {
  return new Date().toLocaleTimeString("ar-EG", {
    hour: "2-digit",
    minute: "2-digit",
    numberingSystem: "latn",
  });
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
    center: {
      id: CURRENT_TENANT.center_id,
      name: CURRENT_TENANT.name,
      branch: CURRENT_TENANT.branch,
      accent_color: DEFAULT_TENANT_ACCENT,
      slug: null,
    },
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
    financeSettings: [],
    safeHandovers: [],
    notifications: [],
    activityLog: [],
    staffPermissions: [],
    expenses: [],
    payrollRecords: [],
    subjectPrices: [],
    scheduleSlots: [],
    tasks: [],
    paperCredits: [],
    paperTransactions: [],
    bookletSales: [],
    lessonPlans: [],
    platformTeacherNotes: [],
    monthlyClosings: [],
    groupResources: [],
    teacherLaunches: [],
    homeworkAttempts: [],
    groupActivations: [],
  };
}

/** Immutable snapshot used during SSR / before hydration — and the `USE_SUPABASE` loading placeholder. */
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

/**
 * §5/§9 isolation: tracks which logged-in identifier `cache` currently holds data for, so
 * switching accounts in the same browser tab (logout → login as a different center) forces
 * a fresh fetch instead of briefly showing the previous tenant's cached rows. `null` means
 * "logged out" (or not yet hydrated) — the seed placeholder is served in that state.
 */
let hydratedForIdentifier: string | null = null;
let hydrating = false;

export function isHydrating(): boolean {
  return hydrating;
}

/**
 * §0 fix — Drop the in-memory cache to the seed placeholder so `useSyncExternalStore`
 * can't paint the previous tenant's rows for the RTT between the identifier change and
 * the Supabase response. We also force `hydratedForIdentifier = null` (so the next
 * `bootstrapFromSupabase` does a real fetch) and emit so React re-renders immediately
 * with the empty placeholder. Without this, a refresh or a signOut→signIn-as-other-tenant
 * flashes the *previous* center's data for ~50-300ms.
 */
function resetCacheToPlaceholder() {
  if (cache === null) cache = seedState();
  else cache = seedState();
  hydratedForIdentifier = null;
  emit();
}

function bootstrapFromSupabase() {
  if (!USE_SUPABASE || typeof window === "undefined") return;
  const identifier = currentIdentifier();

  if (!identifier) {
    if (hydratedForIdentifier !== null) {
      resetCacheToPlaceholder();
    }
    return;
  }
  if (hydrating) return;
  if (hydratedForIdentifier === identifier) return;

  // §0 fix — identifier changed (refresh after signOut, or a new tenant signing in).
  // Wipe the cache *before* kicking off the fetch so the UI never paints stale rows.
  if (hydratedForIdentifier !== null && hydratedForIdentifier !== identifier) {
    resetCacheToPlaceholder();
  }

  hydrating = true;
  fetchCenterData({ data: { identifier } })
    .then((result) => {
      const {
        centerId: _centerId,
        center,
        ...collections
      } = result as {
        centerId: string;
        center: CenterInfo;
      } & Record<string, unknown[]>;
      cache = { ...seedState(), ...collections, center } as DataState;
      cache.leaderboard = buildLeaderboard(cache.students);
      hydratedForIdentifier = identifier;
      emit();
    })
    .catch((err) => {
      console.error("[data-store] fetchCenterData failed:", err);
      toast.error("تعذّر تحميل بيانات المركز من الخادم");
    })
    .finally(() => {
      hydrating = false;
    });
}

function readState(): DataState {
  if (typeof window === "undefined") return SERVER_STATE;

  if (USE_SUPABASE) {
    if (!cache) cache = seedState();
    bootstrapFromSupabase();
    return cache;
  }

  // Legacy localStorage path — kept behind the flag per §5 for a fast revert.
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
  if (typeof window !== "undefined" && !USE_SUPABASE) {
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

/** Wipes persisted data and returns to the seeded snapshot (local cache only — does not touch Supabase). */
export function resetData() {
  hydratedForIdentifier = null;
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
 * Resolves the student the current session is about, or `null` if no
 * student matches the session's identifier (invalid/stale session, or no
 * session at all). Parents authenticate with their child's student code,
 * so the same resolution works for both `student` and `parent` roles.
 *
 * Real fix for the same bug class `resolveCurrentTeacher` already fixed
 * (see its comment): this used to fall back to `state.students[0]!`, which
 * meant an invalid/stale student or parent session silently showed a
 * DIFFERENT family's grades, balance, and WhatsApp log instead of being
 * rejected — a real cross-family data leak, not just a display glitch.
 *
 * Breaking change vs the previous `Student` return: consumers MUST check
 * for `null` and redirect to `/login` (same pattern as `useCurrentTeacher`
 * callers).
 */
export function resolveCurrentStudent(state: DataState, identifier?: string | null): Student | null {
  if (!identifier) return null;
  return findStudentByCode(state, identifier) ?? null;
}

/** صورة بروفايل الطالب (base64) — Migration 0025، نفس نمط تخزين ملفات teacher_launches. */
export function setStudentAvatar(studentId: string, dataUrl: string, mime: string): void {
  update((state) => ({
    ...state,
    students: state.students.map((s) =>
      s.id === studentId ? { ...s, avatar_data: dataUrl, avatar_mime: mime } : s,
    ),
  }));
  syncUpdate("students", studentId, { avatar_data: dataUrl, avatar_mime: mime });
}

/**
 * Resolves the teacher the current session belongs to, by login identifier
 * (`Teacher.user_id`, same join-key mechanism as `Student.code` above —
 * `Session` never carries a real account id, only `identifier`). Real fix
 * for TEACHER_MODULE_SPEC.md §15 decision #7's Phase 1 placeholder: every
 * teacher account used to resolve to `teachers[0]` regardless of who
 * actually logged in.
 */
/**
 * Resolves the teacher the current session belongs to, by login identifier
 * (`Teacher.user_id`, same join-key mechanism as `Student.code` above —
 * `Session` never carries a real account id, only `identifier`).
 *
 * Returns `null` when no match — caller MUST handle this. The previous
 * `?? state.teachers[0]!` fallback caused the cross-teacher flash bug:
 * during SSR / pre-hydration `useSession()` is `null`, so every teacher
 * saw the seeded `tc-1` ("أ. علي حسونة") for ~3s after navigation.
 * Returning `null` forces consumers to redirect instead of silently
 * rendering another teacher's data.
 */
export function resolveCurrentTeacher(
  state: DataState,
  identifier?: string | null,
): Teacher | null {
  if (!identifier) return null;
  return state.teachers.find((t) => t.user_id === identifier) ?? null;
}

export interface CreateStudentInput {
  /** The login code from `auth.ts`'s `createStudent` — must match so `resolveCurrentStudent` finds this record. */
  code: string;
  fullName: string;
  /** الصف المختار من الدروب ليست (المرحلة ← الصف) — هو أساس الربط الآن، والمجموعة اختيارية. */
  gradeId: string;
  /** مجموعة اختيارية؛ لو مش متحددة يحاول يلاقي مجموعة مناسبة للصف + أول مادة. */
  groupId?: string | null;
  guardianName: string;
  guardianPhone: string;
  subjectIds: string[];
  /** سعر كل مادة لهذا الطالب تحديداً — `{ [subject_id]: price }`. */
  subjectFees?: Record<string, number>;
  billingPlan?: StudentBillingPlan;
}

/** المراحل الدراسية المتاحة (لا يوجد ثانوي — محذوف عمداً من قاعدة البيانات). */
export type StageKey = "primary" | "prep";

export const STAGES: { key: StageKey; label: string }[] = [
  { key: "primary", label: "ابتدائي" },
  { key: "prep", label: "إعدادي" },
];

/** المرحلة مشتقّة من اسم الصف نفسه (البيانات مصدر الحقيقة، مش قائمة مكتوبة يدوياً). */
export function getStageOfGrade(grade: Grade): StageKey | null {
  if (grade.name.includes("الإعدادي") || grade.name.includes("الاعدادي")) return "prep";
  if (grade.name.includes("الابتدائي")) return "primary";
  return null;
}

/** صفوف المرحلة المختارة، مرتّبة. */
export function getGradesForStage(state: DataState, stage: StageKey): Grade[] {
  return state.grades.filter((g) => getStageOfGrade(g) === stage).sort((a, b) => a.order - b.order);
}

/** إجمالي المستحق على الطالب من أسعار مواده الشخصية. */
export function sumSubjectFees(fees: Record<string, number> | null | undefined): number {
  return Object.values(fees ?? {}).reduce((sum, v) => sum + (Number(v) || 0), 0);
}

/**
 * §7: the "إضافة طالب" screen used to only create an `auth.ts` login account —
 * no `Student` record ever got created, so a newly-provisioned student's code
 * matched nothing here and `resolveCurrentStudent` silently fell back to
 * `students[0]`.
 *
 * الآن الطالب يُنشأ من (المرحلة ← الصف ← المواد) مباشرة، والمجموعة اختيارية:
 * لو فيه مجموعة لنفس الصف وأول مادة مختارة يتربط بيها تلقائياً، وإلا يفضل بدون
 * مجموعة (`group_id = null`) لحد ما تتعمل له مجموعة. الرسوم شخصية لكل مادة.
 * Returns null if the grade id doesn't exist.
 */
export function createStudentRecord(input: CreateStudentInput): Student | null {
  const state = getData();
  const grade = state.grades.find((g) => g.id === input.gradeId);
  if (!grade) return null;

  const firstSubject = input.subjectIds[0] ?? null;
  const group =
    state.groups.find((g) => g.id === input.groupId) ??
    state.groups.find((g) => g.grade_id === grade.id && g.subject_id === firstSubject) ??
    null;

  const fees = input.subjectFees ?? {};
  const balanceDue = sumSubjectFees(fees);

  const student: Student = {
    id: `st-${Date.now()}`,
    center_id: state.center.id,
    code: input.code,
    full_name: input.fullName,
    grade: grade.name,
    group_name: group?.name ?? grade.name,
    group_id: group?.id ?? null,
    guardian_name: input.guardianName,
    guardian_phone: input.guardianPhone,
    payment_status: balanceDue > 0 ? "pending" : "paid",
    balance_due: balanceDue,
    points: 0,
    attendance_rate: 0,
    avg_score: 0,
    subject_ids: input.subjectIds,
    billing_plan: input.billingPlan ?? "monthly",
    subject_fees: fees,
  };

  update((s) => {
    const students = [...s.students, student];
    const groups = group
      ? s.groups.map((g) => (g.id === group.id ? { ...g, enrolled: g.enrolled + 1 } : g))
      : s.groups;
    return { ...s, students, groups, leaderboard: buildLeaderboard(students) };
  });
  syncInsert("students", student);
  if (group) syncUpdate("groups", group.id, { enrolled: group.enrolled + 1 });

  return student;
}

/** تعديل أسعار مواد طالب بعد إنشائه (يعيد حساب المستحق عليه). */
export function setStudentSubjectFees(studentId: string, fees: Record<string, number>) {
  const balanceDue = sumSubjectFees(fees);
  update((state) => ({
    ...state,
    students: state.students.map((s) =>
      s.id === studentId ? { ...s, subject_fees: fees, balance_due: balanceDue } : s,
    ),
  }));
  syncUpdate("students", studentId, { subject_fees: fees, balance_due: balanceDue });
}

export interface CreateTeacherInput {
  /** The login identifier from `auth.ts`'s `createTeacher` (e.g. "TCH-4073") — must match so `resolveCurrentTeacher` finds this record. */
  userId: string;
  fullName: string;
  subjectId: string;
  /** المراحل التي يدرّسها المدرس — يسمح بأكثر من مرحلة (ابتدائي/إعدادي/ثانوي). */
  stages?: ("primary" | "prep" | "secondary")[];
  /** §0.3 — الراتب المتوقع (المتفق عليه). لا يُخصم من الخزنة — الخصم الفعلي عند الدفع. */
  expectedSalaryBasis?: PayrollBasis;
  expectedSalaryValue?: number;
}

/**
 * Same fix as `createStudentRecord` above, for teachers: "إضافة مدرس" used to only create an
 * `auth.ts` login account — no `Teacher` record ever got created, so a newly-provisioned
 * teacher's account had nothing for `resolveCurrentTeacher` to match against and silently
 * fell back to `teachers[0]`. Returns null if the subject id doesn't exist.
 */
export function createTeacherRecord(input: CreateTeacherInput): Teacher | null {
  const state = getData();
  const subject = state.subjects.find((s) => s.id === input.subjectId);
  if (!subject) return null;

  const stages: ("primary" | "prep" | "secondary")[] =
    input.stages && input.stages.length > 0 ? input.stages : ["primary"];

  const teacher: Teacher = {
    id: `tc-${Date.now()}`,
    center_id: state.center.id,
    user_id: input.userId,
    full_name: input.fullName,
    subject: subject.name,
    subject_id: subject.id,
    groups: 0,
    students: 0,
    timer_compliance: 0,
    sla_breaches: 0,
    monthly_revenue: 0,
    stages,
    primary_stage: stages[0]!,
    expected_salary_basis: input.expectedSalaryBasis,
    expected_salary_value: input.expectedSalaryValue ?? 0,
  };

  update((s) => ({ ...s, teachers: [...s.teachers, teacher] }));
  syncInsert("teachers", teacher);

  return teacher;
}

/**
 * Teacher-scoped reads — the logical equivalent of Supabase RLS on `teacher_id`
 * until a real backend exists (see CLAUDE.md §4-د / TEACHER_MODULE_SPEC.md §4-د).
 * Always filter internally; never return another teacher's rows, even for a
 * bad/missing id (empty array, not an error that would leak existence).
 */
/**
 * Teacher-scoped reads — the logical equivalent of Supabase RLS on `teacher_id`
 * until a real backend exists (see CLAUDE.md §4-د / TEACHER_MODULE_SPEC.md §4-د).
 * Always filter internally; never return another teacher's rows, even for a
 * bad/missing id (empty array, not an error that would leak existence).
 *
 * Migration 0022: dual-key match — `teacher_id` (legacy) OR `teacher_user_id`
 * (added in 0022). Survives the client/server `id` divergence when a Supabase
 * bootstrap replaces a teacher record with a server-minted id while old
 * `Group.teacher_id` values still hold the client-minted one.
 */
export function getGroupsForTeacher(state: DataState, teacherId: string): Group[] {
  const teacher = state.teachers.find((t) => t.id === teacherId);
  const teacherUserId = teacher?.user_id ?? null;
  return state.groups.filter(
    (g) =>
      g.teacher_id === teacherId ||
      (teacherUserId !== null && g.teacher_user_id === teacherUserId),
  );
}

export function getStudentsForTeacher(state: DataState, teacherId: string): Student[] {
  const groupIds = new Set(getGroupsForTeacher(state, teacherId).map((g) => g.id));
  return state.students.filter((s) => s.group_id !== null && groupIds.has(s.group_id));
}

export function getStudentsForGroup(state: DataState, groupId: string): Student[] {
  return state.students.filter((s) => s.group_id === groupId);
}

/** كل التقييمات المسجَّلة لكل طلاب مجموعة معيّنة (يُستخدم في GroupMetricsPanel). */
export function getAssessmentScoresForGroup(
  state: DataState,
  groupId: string,
): AssessmentScore[] {
  const studentIds = new Set(
    state.students.filter((s) => s.group_id === groupId).map((s) => s.id),
  );
  return state.assessmentScores.filter((a) => studentIds.has(a.student_id));
}

/** A group's past sessions, newest-first (§18-3's attendance grid columns). */
export function getSessionRecordsForGroup(state: DataState, groupId: string): SessionRecord[] {
  return state.sessionRecords.filter((r) => r.group_id === groupId);
}

/** §13-ب: a lesson with a `SessionRecord` has been taught — the real "is this done?" signal (`Lesson.taught_status` is never actually written anywhere, so it can't be used for this). */
export function getSessionRecordForLesson(
  state: DataState,
  lessonId: string,
): SessionRecord | undefined {
  return state.sessionRecords.find((r) => r.lesson_id === lessonId);
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

/**
 * First not-yet-done planned lesson across a subject/grade's units, in curriculum
 * order. §13-ب: exported so the session sidebar can pre-select it as a sensible
 * default — `createLesson` no longer picks it automatically, the teacher does.
 */
export function getNextPlannedLesson(
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

/** §13-ب review mode: every score recorded against one specific lesson (any student, any category). */
export function getAssessmentScoresForLesson(
  state: DataState,
  lessonId: string,
): AssessmentScore[] {
  return state.assessmentScores.filter((a) => a.lesson_id === lessonId);
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

export interface OverallStudentPerformance {
  overallAvg: number;
  bySubject: { subject: Subject; summary: SubjectPerformanceSummary }[];
}

/**
 * CURRICULUM_ENGINE_SPEC.md §13-هـ: an aggregation layer above `getSubjectPerformanceSummary`
 * (§5, unchanged) — not a new calculation, just averages the per-subject rollups across every
 * subject the student is enrolled in (`subject_ids`, §7).
 */
export function getOverallStudentPerformance(
  state: DataState,
  studentId: string,
): OverallStudentPerformance {
  const student = state.students.find((s) => s.id === studentId);
  const bySubject = (student?.subject_ids ?? [])
    .map((subjectId) => {
      const subject = state.subjects.find((s) => s.id === subjectId);
      return subject
        ? { subject, summary: getSubjectPerformanceSummary(state, studentId, subjectId) }
        : null;
    })
    .filter(
      (entry): entry is { subject: Subject; summary: SubjectPerformanceSummary } => entry !== null,
    );

  const overallAvg =
    bySubject.length > 0
      ? Math.round(bySubject.reduce((sum, b) => sum + b.summary.overallAvg, 0) / bySubject.length)
      : 0;

  return { overallAvg, bySubject };
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
  /** دقائق التأخير — تُستخدم مع الحالة "متأخر" (يدوي أو تعديل رجعي). */
  lateMinutes?: number,
) {
  let record: AttendanceRecord | null = null;
  let log: WhatsAppLog | null = null;
  let event: SessionEvent | null = null;
  update((state) => {
    const student = findStudentById(state, studentId);
    if (!student) return state;
    record = {
      id: `at-${Date.now()}`,
      center_id: student.center_id,
      student_id: student.id,
      student_name: student.full_name,
      group_name: student.group_name,
      status,
      checked_in_at: status === "absent" ? "—" : nowTime(),
      method,
      session_id: sessionId ?? null,
      late_minutes: status === "late" ? Math.max(0, Math.round(lateMinutes ?? 0)) : 0,
    };
    log = {
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
    let sessionEvents = state.sessionEvents;
    if (sessionId) {
      event = buildSessionEvent(sessionId, student.id, "attendance", { status, method });
      sessionEvents = [event, ...state.sessionEvents];
    }
    return {
      ...state,
      attendanceRecords: [record, ...state.attendanceRecords],
      whatsappLogs: [log, ...state.whatsappLogs],
      sessionEvents,
    };
  });
  if (record) syncInsert("attendance_records", record);
  if (log) syncInsert("whatsapp_logs", log);
  if (event) syncInsert("session_events", event);
}

/**
 * Migration 0026 — يسجّل المجموعة كـ"نشطة الآن" لعرض "المجموعات النشطة" عند المالك.
 * يُستدعى فقط من داخل `startGroupSession` و`markAttendanceForGroup` (فعل الموظف)،
 * أبداً من أي مسار يخص وضع الحصة عند المدرس — هذا هو الفصل المطلوب بالضبط.
 * تحقّق سريع من عدم تكرار تسجيل نفس المجموعة أكثر من مرة في نفس اليوم.
 */
function activateGroupNow(groupId: string) {
  const state = readState();
  const group = state.groups.find((g) => g.id === groupId);
  if (!group) return;
  const now = new Date();
  const alreadyToday = state.groupActivations.some(
    (a) => a.group_id === groupId && sameDay(a.activated_at, now),
  );
  if (alreadyToday) return;
  let activation: GroupActivation | null = null;
  update((s) => {
    activation = {
      id: `gact-${Date.now()}`,
      center_id: group.center_id,
      group_id: groupId,
      activated_at: now.toISOString(),
    };
    return { ...s, groupActivations: [activation, ...s.groupActivations] };
  });
  if (activation) syncInsert("group_activations", activation);
}

/**
 * Migration 0023 / خطة C (C14): "بدأت الحصة" — الموظف يفتح الحصة ويُسجّل
 * كل طلاب المجموعة كـ "حاضر" في انتظار تأكيد المدرس. لا يمسح الحالات
 * اليدوية الموجودة (المتأخر/الغائب) — فقط الطلاب بلا سجل لليوم.
 *
 * sessionId يُربط بـ `sess-${Date.now()}` للاستخدام في SessionEvent
 * و `getAttendanceForSession` لاحقاً.
 */
export function startGroupSession(groupId: string): { sessionId: string; marked: number } {
  const sessionId = `sess-${Date.now()}`;
  const state = readState();
  const students = getStudentsForGroup(state, groupId);
  activateGroupNow(groupId);
  let marked = 0;
  for (const s of students) {
    // تخطّي الطلاب اللي عندهم سجل حضور/تأخر لليوم
    const alreadyToday = state.attendanceRecords.some((r) => {
      if (r.student_id !== s.id) return false;
      return r.checked_in_at && r.checked_in_at !== "—";
    });
    if (alreadyToday) continue;
    recordAttendance(s.id, "present", "manual", sessionId);
    marked += 1;
  }
  return { sessionId, marked };
}

/**
 * Migration 0023 / خطة C (C14): قائمة المجموعات اللي حصّتها "النهارده/قريباً"
 * بناءً على `scheduleSlots.weekday` و `time`. تُستخدم في بوابة الكاشير
 * للموظف ليتحمّس لبدء الحصة.
 */
export interface UpcomingGroup {
  group: Group;
  teacher: Teacher | undefined;
  /** "now" = الحصة الجارية (يوم مطابق + الوقت ±30 دقيقة). "today" = باقي اليوم. */
  status: "now" | "today" | "later";
  /** كم دقيقة تفصلنا عن وقت الحصة. */
  minutesUntil: number;
  /** عدد الطلاب اللي تم تسجيل حضورهم اليوم بالفعل. */
  attendanceMarkedToday: number;
}

export function getUpcomingGroupsForToday(
  state: DataState,
  now: Date = new Date(),
): UpcomingGroup[] {
  const weekday = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"][now.getDay()] ?? "";
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const result: UpcomingGroup[] = [];
  for (const slot of state.scheduleSlots) {
    if (!slot.group_id) continue;
    const group = state.groups.find((g) => g.id === slot.group_id);
    if (!group) continue;
    if (slot.weekday !== weekday) continue;
    const parts = (slot.time ?? "0:0").split(":");
    const hh = Number(parts[0]) || 0;
    const mm = Number(parts[1]) || 0;
    const slotMin = hh * 60 + mm;
    const delta = slotMin - nowMin;
    let status: UpcomingGroup["status"];
    if (delta >= -30 && delta <= 30) status = "now";
    else if (delta > 30 && delta <= 24 * 60) status = "today";
    else status = "later";
    const teacher = state.teachers.find((t) => t.id === group.teacher_id);
    const attendanceMarkedToday = state.attendanceRecords.filter((r) => {
      if (r.student_id == null) return false;
      const stu = state.students.find((s) => s.id === r.student_id);
      return stu?.group_id === group.id && r.checked_in_at && r.checked_in_at !== "—";
    }).length;
    result.push({ group, teacher, status, minutesUntil: delta, attendanceMarkedToday });
  }
  // ترتيب: الحصة اللي وقتها دلوقتي أولاً، ثم الأقرب
  result.sort((a, b) => {
    if (a.status === "now" && b.status !== "now") return -1;
    if (b.status === "now" && a.status !== "now") return 1;
    return Math.abs(a.minutesUntil) - Math.abs(b.minutesUntil);
  });
  return result;
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
  let record: AttendanceRecord | null = null;
  update((state) => {
    const student = findStudentById(state, studentId);
    if (!student) return state;
    const existing = getAttendanceForSession(state, studentId, sessionId);
    record = {
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
      ? state.attendanceRecords.map((a) => (a.id === existing.id ? record! : a))
      : [record, ...state.attendanceRecords];
    return { ...state, attendanceRecords };
  });
  if (record) {
    const r = record as AttendanceRecord;
    syncUpsert("attendance_records", r);
    logActivity(
      "attendance",
      `${r.status === "absent" ? "غياب" : r.status === "late" ? "تأخير" : "حضور"}: ${r.student_name}`,
      r.group_name,
      r.student_name,
      null,
    );
    if (r.status !== "present") {
      pushNotification(
        r.status === "absent" ? "absence" : "late",
        r.status === "absent" ? "critical" : "warning",
        r.status === "absent" ? `غياب: ${r.student_name}` : `تأخير: ${r.student_name}`,
        r.group_name,
      );
    }
  }
}

export function recordPayment(
  studentCode: string,
  amount: number,
  method: PaymentMethod,
  item: string,
  referenceNumber?: string | null,
) {
  let payment: PaymentRecord | null = null;
  let log: WhatsAppLog | null = null;
  let updatedStudentId: string | null = null;
  let updatedBalanceDue = 0;
  let updatedPaymentStatus: Student["payment_status"] = "pending";
  update((state) => {
    const student = findStudentByCode(state, studentCode);
    if (!student) return state;
    const ref = referenceNumber?.trim() ?? "";
    const finalItem = method === "cash" || !ref ? item : `${item} | مرجع: ${ref}`;
    payment = {
      id: `pm-${Date.now()}`,
      center_id: student.center_id,
      student_name: student.full_name,
      student_code: student.code,
      amount,
      method,
      item: finalItem,
      created_at: nowTime(),
    };
    const remaining = Math.max(0, student.balance_due - amount);
    updatedStudentId = student.id;
    updatedBalanceDue = remaining;
    updatedPaymentStatus = remaining === 0 ? "paid" : student.payment_status;
    const students = state.students.map((s): Student =>
      s.id === student.id
        ? { ...s, balance_due: remaining, payment_status: updatedPaymentStatus }
        : s,
    );
    log = {
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
  if (payment) syncInsert("payments", payment);
  if (log) syncInsert("whatsapp_logs", log);
  if (updatedStudentId) {
    syncUpdate("students", updatedStudentId, {
      balance_due: updatedBalanceDue,
      payment_status: updatedPaymentStatus,
    });
  }
  if (payment) {
    const p = payment as PaymentRecord;
    logActivity("payment", `دفعة من ${p.student_name}`, p.item, p.student_code, p.amount);
    pushNotification(
      "payment",
      "info",
      `تحصيل ${p.amount} ج.م — ${p.student_name}`,
      `${p.item} · ${p.student_code}`,
    );
  }
}

export function deliverBooklet(bookletId: string) {
  let nextInStock: number | null = null;
  let nextDelivered: number | null = null;
  update((state) => ({
    ...state,
    booklets: state.booklets.map((b) => {
      if (b.id !== bookletId || b.in_stock <= 0) return b;
      nextInStock = b.in_stock - 1;
      nextDelivered = b.delivered + 1;
      return { ...b, in_stock: nextInStock, delivered: nextDelivered };
    }),
  }));
  if (nextInStock !== null) {
    syncUpdate("booklets", bookletId, { in_stock: nextInStock, delivered: nextDelivered });
  }
}

/* ---------------- §1 — بوابة الحضور (mutator مخصص بنوافذ 10/50) ---------------- */

const ATTENDANCE_GRACE_MIN = 10;
const ATTENDANCE_WINDOW_MIN = 50;

function parseSlotToMs(time: string, now: Date): number | null {
  const match = /(\d{1,2})[:.](\d{2})/.exec(time);
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (/م|pm/i.test(time) && hours < 12) hours += 12;
  if (/ص|am/i.test(time) && hours === 12) hours = 0;
  const d = new Date(now);
  d.setHours(hours, minutes, 0, 0);
  return d.getTime();
}

export type MarkAttendanceResult = "ok" | "WINDOW_CLOSED" | "STUDENT_NOT_FOUND" | "GROUP_NOT_FOUND";

/**
 * Mutator مخصص لبوابة الحضور (staff.index.tsx):
 *  - نافذة 10 دقائق: أي تسجيل = `present` بدون late_minutes.
 *  - 11-50 دقيقة: لو الطالب مسجَّل absent وضُغط "حضور" → late مع دقائق.
 *  - بعد 50 دقيقة: الزرارين معطلين + تُسجَّل absence تلقائياً.
 *  - `checked_in_at` يُكتب ISO كامل (timestamp مع وقت/ثانية) لتطابق عمود timestamptz.
 */
export function markAttendanceForGroup(
  groupId: string,
  studentId: string,
  intent: "present" | "absent",
): MarkAttendanceResult {
  let result: MarkAttendanceResult = "ok";
  let record: AttendanceRecord | null = null;
  let log: WhatsAppLog | null = null;
  update((state) => {
    const group = state.groups.find((g) => g.id === groupId);
    if (!group) {
      result = "GROUP_NOT_FOUND";
      return state;
    }
    const student = state.students.find((s) => s.id === studentId);
    if (!student) {
      result = "STUDENT_NOT_FOUND";
      return state;
    }
    const now = new Date();
    const startMs = parseSlotToMs(group.time, now);
    const elapsedMin = startMs ? (now.getTime() - startMs) / 60000 : 0;

    const existing = state.attendanceRecords.find(
      (a) =>
        a.student_id === studentId &&
        a.group_name === group.name &&
        sameDay(a.checked_in_at, now),
    );

    if (existing?.locked) {
      result = "WINDOW_CLOSED";
      return state;
    }

    let status: AttendanceStatus;
    let lateMinutes = 0;
    if (elapsedMin > ATTENDANCE_WINDOW_MIN) {
      if (!existing) {
        status = "absent";
        record = {
          id: `at-${Date.now()}`,
          center_id: student.center_id,
          student_id: student.id,
          student_name: student.full_name,
          group_name: group.name,
          status,
          checked_in_at: "—",
          method: "manual",
          session_id: null,
          late_minutes: 0,
          locked: true,
        };
        const lateLog: WhatsAppLog = {
          id: `wa-${Date.now()}`,
          center_id: student.center_id,
          student_id: student.id,
          sent_at: todayLabel(),
          template: "absence",
          message: `تنبيه: لم يتم تسجيل حضور الطالب ${student.full_name} في حصة ${group.name}.`,
          delivered: true,
        };
        log = lateLog;
        result = "WINDOW_CLOSED";
        return {
          ...state,
          attendanceRecords: [record, ...state.attendanceRecords],
          whatsappLogs: [lateLog, ...state.whatsappLogs],
        };
      }
      result = "WINDOW_CLOSED";
      return state;
    }

    if (intent === "absent") {
      status = "absent";
    } else if (existing?.status === "absent") {
      if (elapsedMin > ATTENDANCE_GRACE_MIN) {
        status = "late";
        lateMinutes = Math.max(1, Math.round(elapsedMin));
      } else {
        status = "present";
      }
    } else {
      status = elapsedMin > ATTENDANCE_GRACE_MIN ? "late" : "present";
      if (status === "late") lateMinutes = Math.max(1, Math.round(elapsedMin));
    }

    record = {
      id: existing?.id ?? `at-${Date.now()}`,
      center_id: student.center_id,
      student_id: student.id,
      student_name: student.full_name,
      group_name: group.name,
      status,
      checked_in_at: status === "absent" ? "—" : new Date().toISOString(),
      method: "manual",
      session_id: null,
      late_minutes: lateMinutes,
      locked: elapsedMin > ATTENDANCE_WINDOW_MIN,
    };

    log = {
      id: `wa-${Date.now()}`,
      center_id: student.center_id,
      student_id: student.id,
      sent_at: todayLabel(),
      template: status === "absent" ? "absence" : "attendance",
      message:
        status === "absent"
          ? `تنبيه: لم يتم تسجيل حضور الطالب ${student.full_name} في حصة ${group.name}.`
          : `تم تسجيل حضور الطالب ${student.full_name} في حصة ${group.name}.`,
      delivered: true,
    };

    const attendanceRecords = existing
      ? state.attendanceRecords.map((a) => (a.id === existing.id ? record! : a))
      : [record, ...state.attendanceRecords];
    return {
      ...state,
      attendanceRecords,
      whatsappLogs: [log, ...state.whatsappLogs],
    };
  });
  if (record) syncUpsert("attendance_records", record);
  if (log) syncInsert("whatsapp_logs", log);
  if (record) activateGroupNow(groupId);
  return result;
}

function sameDay(iso: string, ref: Date): boolean {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) {
    const label = iso;
    return label.startsWith("اليوم") || label === "—";
  }
  const d = new Date(t);
  return (
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate()
  );
}

/* ---------------- §3 — الملازم وبيع الكتب (mutators) ---------------- */

export function addBookletItem(input: {
  title: string;
  subject: string;
  kind: BookletItem["kind"];
  pageCount: number;
  price: number;
  paperPerUnit: number;
  initialStock: number;
}): BookletItem | null {
  let row: BookletItem | null = null;
  update((state) => {
    row = {
      id: `bk-${Date.now()}`,
      center_id: state.center.id,
      title: input.title.trim(),
      subject: input.subject.trim(),
      price: Number(input.price) || 0,
      in_stock: Math.max(0, Number(input.initialStock) || 0),
      delivered: 0,
      kind: input.kind,
      page_count: Math.max(0, Number(input.pageCount) || 0),
      printed: 0,
      paper_per_unit: Math.max(1, Number(input.paperPerUnit) || 1),
    };
    return { ...state, booklets: [row, ...state.booklets] };
  });
  if (row) syncInsert("booklets", row);
  return row;
}

export function sellBookletToStudent(input: {
  bookletId: string;
  studentId: string;
  quantity: number;
  sellerId: string;
  sellerName: string;
}): BookletSale | null {
  let sale: BookletSale | null = null;
  let updatedBooklet: { id: string; in_stock: number; delivered: number } | null = null;
  let paperTx: PaperTransaction | null = null;
  let studentPatch: { id: string; balance_due: number; payment_status: Student["payment_status"] } | null = null;
  let paymentRow: PaymentRecord | null = null;
  const finalize = (state: DataState) => {
    if (!sale || !updatedBooklet || !studentPatch || !paymentRow) return state;
    return {
      ...state,
      booklets: state.booklets.map((b) => (b.id === updatedBooklet!.id ? { ...b, ...updatedBooklet! } : b)),
      students: state.students.map((s) => (s.id === studentPatch!.id ? { ...s, ...studentPatch! } : s)),
      bookletSales: [sale, ...state.bookletSales],
      paperTransactions: paperTx ? [paperTx, ...state.paperTransactions] : state.paperTransactions,
      payments: [paymentRow, ...state.payments],
    };
  };
  update((state) => {
    const booklet = state.booklets.find((b) => b.id === input.bookletId);
    const student = state.students.find((s) => s.id === input.studentId);
    if (!booklet || !student) return state;
    const qty = Math.max(1, Math.floor(input.quantity));
    if (booklet.in_stock < qty) return state;

    const unitPrice = Number(booklet.price) || 0;
    const totalAmount = qty * unitPrice;
    const paperConsumed = qty * (booklet.paper_per_unit || 1);
    const nowLabel = new Date().toISOString();

    sale = {
      id: `bs-${Date.now()}`,
      center_id: student.center_id,
      student_id: student.id,
      student_name: student.full_name,
      student_code: student.code,
      booklet_id: booklet.id,
      booklet_title: booklet.title,
      quantity: qty,
      unit_price: unitPrice,
      total_amount: totalAmount,
      paper_consumed: paperConsumed,
      sold_by: input.sellerName || input.sellerId,
      sold_at: nowLabel,
    };
    updatedBooklet = {
      id: booklet.id,
      in_stock: booklet.in_stock - qty,
      delivered: booklet.delivered + qty,
    };
    paperTx = {
      id: `pt-${Date.now()}`,
      center_id: state.center.id,
      staff_id: input.sellerId,
      staff_name: input.sellerName,
      delta_sheets: -paperConsumed,
      reason: "sale",
      related_booklet_id: booklet.id,
      related_sale_id: sale.id,
      created_at: nowLabel,
    };
    const remaining = Math.max(0, student.balance_due - totalAmount);
    studentPatch = {
      id: student.id,
      balance_due: remaining,
      payment_status: remaining === 0 ? "paid" : student.payment_status,
    };
    paymentRow = {
      id: `pm-${Date.now()}`,
      center_id: student.center_id,
      student_name: student.full_name,
      student_code: student.code,
      amount: totalAmount,
      method: "cash",
      item: `بيع: ${booklet.title} × ${qty}`,
      created_at: nowTime(),
    };
    return finalize(state);
  });
  if (sale) syncInsert("booklet_sales", sale);
  if (updatedBooklet !== null) {
    const ub: { id: string; in_stock: number; delivered: number } = updatedBooklet;
    syncUpdate("booklets", ub.id, {
      in_stock: ub.in_stock,
      delivered: ub.delivered,
    });
  }
  if (paperTx) syncInsert("paper_transactions", paperTx);
  if (studentPatch !== null) {
    const sp: { id: string; balance_due: number; payment_status: Student["payment_status"] } = studentPatch;
    syncUpdate("students", sp.id, {
      balance_due: sp.balance_due,
      payment_status: sp.payment_status,
    });
  }
  if (paymentRow) syncInsert("payments", paymentRow);
  return sale;
}

export function preorderBooklet(input: {
  bookletId: string;
  quantity: number;
}): boolean {
  let updated: { id: string; printed: number } | null = null;
  let paperTx: PaperTransaction | null = null;
  const finalize = (state: DataState) => {
    if (!updated || !paperTx) return state;
    return {
      ...state,
      booklets: state.booklets.map((b) => (b.id === updated!.id ? { ...b, printed: updated!.printed } : b)),
      paperTransactions: [paperTx!, ...state.paperTransactions],
    };
  };
  update((state) => {
    const booklet = state.booklets.find((b) => b.id === input.bookletId);
    if (!booklet) return state;
    const qty = Math.max(1, Math.floor(input.quantity));
    updated = { id: booklet.id, printed: booklet.printed + qty };
    paperTx = {
      id: `pt-${Date.now()}`,
      center_id: state.center.id,
      staff_id: "system",
      staff_name: "النظام",
      delta_sheets: -qty * (booklet.paper_per_unit || 1),
      reason: "preorder",
      related_booklet_id: booklet.id,
      related_sale_id: null,
      created_at: new Date().toISOString(),
    };
    return finalize(state);
  });
  if (updated !== null) {
    const u: { id: string; printed: number } = updated;
    syncUpdate("booklets", u.id, { printed: u.printed });
  }
  if (paperTx) syncInsert("paper_transactions", paperTx);
  return !!updated;
}

export function adminPrintBooklet(input: {
  bookletId: string;
  quantity: number;
  staffId: string;
  staffName: string;
  reason: string;
}): Expense | null {
  let paperTx: PaperTransaction | null = null;
  let printedRow: { id: string; printed: number } | null = null;
  let expense: Expense | null = null;
  const finalize = (state: DataState) => {
    if (!printedRow || !paperTx || !expense) return state;
    return {
      ...state,
      booklets: state.booklets.map((b) => (b.id === printedRow!.id ? { ...b, printed: printedRow!.printed } : b)),
      paperTransactions: [paperTx!, ...state.paperTransactions],
      expenses: [expense, ...state.expenses],
    };
  };
  update((state) => {
    const booklet = state.booklets.find((b) => b.id === input.bookletId);
    if (!booklet) return state;
    const qty = Math.max(1, Math.floor(input.quantity));
    const paperConsumed = qty * (booklet.paper_per_unit || 1);
    printedRow = { id: booklet.id, printed: booklet.printed + qty };
    paperTx = {
      id: `pt-${Date.now()}`,
      center_id: state.center.id,
      staff_id: input.staffId,
      staff_name: input.staffName,
      delta_sheets: -paperConsumed,
      reason: "admin_print",
      related_booklet_id: booklet.id,
      related_sale_id: null,
      created_at: new Date().toISOString(),
    };
    expense = {
      id: `exp-${Date.now()}`,
      center_id: state.center.id,
      category: "printing",
      title: `طباعة إدارية: ${booklet.title} × ${qty}`,
      amount: 0,
      spent_at: new Date().toISOString(),
      note: input.reason,
      created_at: new Date().toISOString(),
    };
    return finalize(state);
  });
  if (printedRow !== null) {
    const pr: { id: string; printed: number } = printedRow;
    syncUpdate("booklets", pr.id, { printed: pr.printed });
  }
  if (paperTx) syncInsert("paper_transactions", paperTx);
  if (expense) syncInsert("expenses", expense);
  return expense;
}

export function issuePaperCredit(input: {
  staffId: string;
  staffName: string;
  totalSheets: number;
  unitPrice: number;
  note?: string | null;
}): { credit: PaperCredit; tx: PaperTransaction } | null {
  let credit: PaperCredit | null = null;
  let tx: PaperTransaction | null = null;
  update((state) => {
    const now = new Date().toISOString();
    credit = {
      id: `pc-${Date.now()}`,
      center_id: state.center.id,
      staff_id: input.staffId,
      staff_name: input.staffName,
      total_sheets: Math.max(0, Math.floor(input.totalSheets)),
      unit_price: Number(input.unitPrice) || 0,
      issued_at: now,
      note: input.note ?? null,
      created_at: now,
    };
    tx = {
      id: `pt-${Date.now()}`,
      center_id: state.center.id,
      staff_id: input.staffId,
      staff_name: input.staffName,
      delta_sheets: credit.total_sheets,
      reason: "issue",
      related_booklet_id: null,
      related_sale_id: null,
      created_at: now,
    };
    return {
      ...state,
      paperCredits: [credit, ...state.paperCredits],
      paperTransactions: [tx, ...state.paperTransactions],
    };
  });
  if (credit) syncInsert("paper_credits", credit);
  if (tx) syncInsert("paper_transactions", tx);
  return credit && tx ? { credit, tx } : null;
}

/** رصيد الورق المتاح لموظف = مجموع الإصدارات + مجموع delta (issue موجبة، استهلاك سالب). */
export function getPaperCreditBalance(state: DataState, staffId: string): number {
  return state.paperTransactions
    .filter((tx) => tx.staff_id === staffId)
    .reduce((sum, tx) => sum + tx.delta_sheets, 0);
}

/* ---------------- 0019: lesson_plans mutators ---------------- */

export interface CreateLessonPlanInput {
  teacherId: string;
  groupId: string;
  lessonName: string;
  unit?: string;
  notes?: string;
}

/**
 * ينشئ خطة درس جديدة مع prepared_done=false و taught_done=false.
 * العزل: `teacher_id` و `group_id` ينتميان لنفس المركز (يُفترض أن الـ caller تحقّق).
 */
export function createLessonPlan(input: CreateLessonPlanInput): LessonPlan {
  const now = new Date().toISOString();
  const row: LessonPlan = {
    id: `lp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    center_id: "", // يُملأ بـ state.center.id في الـ mutator
    teacher_id: input.teacherId,
    group_id: input.groupId,
    lesson_name: input.lessonName,
    unit: input.unit ?? null,
    notes: input.notes ?? null,
    prepared_at: null,
    prepared_done: false,
    taught_at: null,
    taught_done: false,
    created_at: now,
    updated_at: now,
  };
  update((state) => {
    const full: LessonPlan = { ...row, center_id: state.center.id };
    return { ...state, lessonPlans: [full, ...state.lessonPlans] };
  });
  // sync إلى Supabase (لو متاح)
  void import("@/lib/data-functions.server").then(async (m) => {
    if (!USE_SUPABASE) return;
    const id = getSession()?.identifier;
    if (!id) return;
    const state = readState();
    const created = state.lessonPlans.find((p) => p.id === row.id);
    if (!created) return;
    try {
      await m.upsertLessonPlanRow({
        data: { identifier: id, row: created },
      });
    } catch (err) {
      reportSyncFailure("lesson_plans", err);
    }
  });
  return row;
}

/**
 * يعلِّم "تم الإعداد" أو "تم التدريس" — مع تسجيل الـ timestamp.
 * @param flag "prepared" | "taught"
 */
export function markLessonPlanState(
  planId: string,
  flag: "prepared" | "taught",
  done: boolean,
): void {
  const now = new Date().toISOString();
  update((state) => ({
    ...state,
    lessonPlans: state.lessonPlans.map((p) =>
      p.id === planId
        ? flag === "prepared"
          ? { ...p, prepared_done: done, prepared_at: done ? now : null, updated_at: now }
          : { ...p, taught_done: done, taught_at: done ? now : null, updated_at: now }
        : p,
    ),
  }));
  void import("@/lib/data-functions.server").then(async (m) => {
    if (!USE_SUPABASE) return;
    const id = getSession()?.identifier;
    if (!id) return;
    const updated = readState().lessonPlans.find((p) => p.id === planId);
    if (!updated) return;
    try {
      await m.upsertLessonPlanRow({ data: { identifier: id, row: updated } });
    } catch (err) {
      reportSyncFailure("lesson_plans", err);
    }
  });
}

export function updateLessonPlan(
  planId: string,
  patch: { lessonName?: string; unit?: string | null; notes?: string | null },
): void {
  const now = new Date().toISOString();
  update((state) => ({
    ...state,
    lessonPlans: state.lessonPlans.map((p) =>
      p.id === planId ? { ...p, ...patch, updated_at: now } : p,
    ),
  }));
  void import("@/lib/data-functions.server").then(async (m) => {
    if (!USE_SUPABASE) return;
    const id = getSession()?.identifier;
    if (!id) return;
    const updated = readState().lessonPlans.find((p) => p.id === planId);
    if (!updated) return;
    try {
      await m.upsertLessonPlanRow({ data: { identifier: id, row: updated } });
    } catch (err) {
      reportSyncFailure("lesson_plans", err);
    }
  });
}

export function deleteLessonPlan(planId: string): void {
  update((state) => ({
    ...state,
    lessonPlans: state.lessonPlans.filter((p) => p.id !== planId),
  }));
  void import("@/lib/data-functions.server").then(async (m) => {
    if (!USE_SUPABASE) return;
    const id = getSession()?.identifier;
    if (!id) return;
    try {
      await m.deleteLessonPlanRow({ data: { identifier: id, id: planId } });
    } catch (err) {
      reportSyncFailure("lesson_plans", err);
    }
  });
}

/** خطط المدرس لمجموعة معيّنة — مفلترة ومُرتَّبة بالأحدث. */
export function getLessonPlansForGroup(
  state: DataState,
  teacherId: string,
  groupId: string,
): LessonPlan[] {
  return state.lessonPlans
    .filter((p) => p.teacher_id === teacherId && p.group_id === groupId)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

/** خطط المدرس لكل مجموعاته — مفلترة بالمدرس فقط. */
export function getLessonPlansForTeacher(state: DataState, teacherId: string): LessonPlan[] {
  return state.lessonPlans
    .filter((p) => p.teacher_id === teacherId)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

/* ---------------- 0019: platform_teacher_notes mutators ---------------- */

export function createPlatformTeacherNote(
  subjectId: string,
  body: string,
  authorIdentifier: string,
  authorName: string,
): PlatformTeacherNote {
  const now = new Date().toISOString();
  const row: PlatformTeacherNote = {
    id: `ptn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    subject_id: subjectId,
    body,
    author_identifier: authorIdentifier,
    author_name: authorName,
    created_at: now,
    updated_at: now,
  };
  update((state) => ({
    ...state,
    platformTeacherNotes: [row, ...state.platformTeacherNotes],
  }));
  void import("@/lib/data-functions.server").then(async (m) => {
    if (!USE_SUPABASE) return;
    const id = getSession()?.identifier;
    if (!id) return;
    try {
      await m.upsertPlatformTeacherNote({ data: { identifier: id, row } });
    } catch (err) {
      reportSyncFailure("platform_teacher_notes", err);
    }
  });
  return row;
}

export function deletePlatformTeacherNote(noteId: string): void {
  update((state) => ({
    ...state,
    platformTeacherNotes: state.platformTeacherNotes.filter((n) => n.id !== noteId),
  }));
  void import("@/lib/data-functions.server").then(async (m) => {
    if (!USE_SUPABASE) return;
    const id = getSession()?.identifier;
    if (!id) return;
    try {
      await m.deletePlatformTeacherNote({ data: { identifier: id, id: noteId } });
    } catch (err) {
      reportSyncFailure("platform_teacher_notes", err);
    }
  });
}

/** رسائل مدير المنصة لمادة معيّنة — بدون فلتر center_id (عبر كل المراكز). */
export function getPlatformNotesForSubject(
  state: DataState,
  subjectId: string,
): PlatformTeacherNote[] {
  return state.platformTeacherNotes
    .filter((n) => n.subject_id === subjectId)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

export function closeShift(countedAmount: number): { expected: number; diff: number } {
  let closure: ShiftClosure | null = null;
  update((state) => {
    const expected = state.payments.reduce((sum, p) => sum + p.amount, 0);
    closure = {
      id: `sh-${Date.now()}`,
      center_id: state.center.id,
      expected,
      counted: countedAmount,
      diff: countedAmount - expected,
      closed_at: todayLabel(),
    };
    return { ...state, shiftClosures: [closure, ...state.shiftClosures] };
  });
  const c = closure as ShiftClosure;
  syncInsert("shift_closures", c);
  logActivity("shift", "تقفيل وردية", `الفرق: ${c.diff} ج.م`, null, c.counted);
  // القيمة المرجعة هي المرجع الرسمي المُسجَّل فعلياً (محسوبة لحظة الإغلاق نفسها) —
  // الواجهة تعرض هذه القيمة بعد التقفيل بدل إعادة حسابها محلياً من بيانات قد تكون
  // تغيّرت بين لحظة الضغط ولحظة الرسم.
  return { expected: c.expected, diff: c.diff };
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
  let nextLiveScore: LiveScore | null = null;
  let nextPoints: number | null = null;
  let gradedTask: HomeworkTask | null = null;
  let event: SessionEvent | null = null;
  update((state) => {
    const student = findStudentById(state, studentId);
    if (!student) return state;
    const current = ensureLiveScore(state, student);
    const delta = (value - (current.homework_score ?? 0)) * 5;
    nextLiveScore = {
      ...current,
      homework_score: value,
      points: current.points + delta,
    };
    const students = state.students.map((s) => {
      if (s.id !== student.id) return s;
      nextPoints = s.points + delta;
      return { ...s, points: nextPoints };
    });

    const taskId = `hw-live-${student.id}`;
    gradedTask = {
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
    let sessionEvents = state.sessionEvents;
    if (sessionId) {
      event = buildSessionEvent(sessionId, student.id, "homework_score", { value });
      sessionEvents = [event, ...state.sessionEvents];
    }

    return {
      ...state,
      students,
      leaderboard: buildLeaderboard(students),
      liveScores: [...state.liveScores.filter((s) => s.student_id !== student.id), nextLiveScore],
      homeworkTasks: exists
        ? state.homeworkTasks.map((h) => (h.id === taskId ? gradedTask! : h))
        : [gradedTask, ...state.homeworkTasks],
      sessionEvents,
    };
  });
  if (nextLiveScore) syncUpsert("live_scores", nextLiveScore, "student_id");
  if (nextPoints !== null) syncUpdate("students", studentId, { points: nextPoints });
  if (gradedTask) syncUpsert("homework_tasks", gradedTask);
  if (event) syncInsert("session_events", event);
}

/** Random-question answer inside session mode — updates points + leaderboard. */
export function recordQuestionAnswer(studentId: string, correct: boolean, sessionId?: string) {
  let nextLiveScore: LiveScore | null = null;
  let nextPoints: number | null = null;
  let event: SessionEvent | null = null;
  update((state) => {
    const student = findStudentById(state, studentId);
    if (!student) return state;
    const current = ensureLiveScore(state, student);
    const gain = correct ? 50 : 0;
    nextLiveScore = {
      ...current,
      question_score: correct ? 10 : 0,
      points: current.points + gain,
    };
    const students = state.students.map((s) => {
      if (s.id !== student.id) return s;
      nextPoints = s.points + gain;
      return { ...s, points: nextPoints };
    });
    let sessionEvents = state.sessionEvents;
    if (sessionId) {
      event = buildSessionEvent(sessionId, student.id, "question_answer", { correct });
      sessionEvents = [event, ...state.sessionEvents];
    }
    return {
      ...state,
      students,
      leaderboard: buildLeaderboard(students),
      liveScores: [...state.liveScores.filter((s) => s.student_id !== student.id), nextLiveScore],
      sessionEvents,
    };
  });
  if (nextLiveScore) syncUpsert("live_scores", nextLiveScore, "student_id");
  if (nextPoints !== null) syncUpdate("students", studentId, { points: nextPoints });
  if (event) syncInsert("session_events", event);
}

/** Releases homework + weekly sheet to every student of the group and notifies guardians. */
export function releaseSessionTasks(groupId: string) {
  let tasks: HomeworkTask[] = [];
  let logs: WhatsAppLog[] = [];
  update((state) => {
    const group = state.groups.find((g) => g.id === groupId);
    if (!group) return state;
    const members = state.students.filter((s) => s.group_name === group.name);
    const stamp = Date.now();

    tasks = members.map((s, i) => ({
      id: `hw-${stamp}-${i}`,
      center_id: s.center_id,
      student_id: s.id,
      subject: group.subject,
      title: "الواجب المنزلي — مسائل صفحة ٨٤ : ٨٩",
      due_date: "بعد ٤٨ ساعة",
      status: "pending",
    }));

    logs = members.map((s, i) => ({
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
  syncBulkInsert("homework_tasks", tasks);
  syncBulkInsert("whatsapp_logs", logs);
}

/** Teacher dashboard "أضف ملاحظتك" quick note (§6-هـ) — persists to the student's record. */
export function addTeacherNote(studentId: string, teacherId: string, note: string) {
  let entry: TeacherNote | null = null;
  update((state) => {
    const student = findStudentById(state, studentId);
    const teacher = state.teachers.find((t) => t.id === teacherId);
    if (!student || !teacher || !note.trim()) return state;
    entry = {
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
  if (entry) syncInsert("teacher_notes", entry);
}

/* ---------------- Awards & Alerts (§4.4) — رسائل المدرس للطالب ---------------- */

export type TeacherMessageKind = "award" | "alert";

/**
 * إرسال رسالة للمدرس إلى الطالب (للأولياء الأمور ضمنياً).
 * - kind: "award" = وسام تشجيعي (للمتفوقين فقط)
 * - kind: "alert" = تنبيه للضعفاء (تواصل ولي الأمر / حديث فردي / ملاحظة)
 * يستخدم whatsapp_logs مع template = "award" | "alert".
 */
export function sendTeacherMessage(
  studentId: string,
  body: string,
  kind: TeacherMessageKind,
  teacherId: string,
): WhatsAppLog | null {
  let log: WhatsAppLog | null = null;
  update((state) => {
    const student = findStudentById(state, studentId);
    const teacher = state.teachers.find((t) => t.id === teacherId);
    if (!student || !teacher || !body.trim()) return state;
    log = {
      id: `wa-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      center_id: student.center_id,
      student_id: student.id,
      sent_at: new Date().toISOString(),
      template: kind,
      message: body.trim(),
      delivered: true,
    };
    return { ...state, whatsappLogs: [log, ...state.whatsappLogs] };
  });
  if (log) syncInsert("whatsapp_logs", log);
  return log;
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

/**
 * Starts the pipeline: inserts a `processing` Lesson row. Returns its id.
 *
 * CURRICULUM_ENGINE_SPEC.md §13-ب: `curriculumLessonId` is now an explicit
 * choice from the teacher (the session sidebar), not auto-picked via
 * `getNextPlannedLesson` — a PDF upload attaches to whichever planned slot the
 * teacher actually selected. Pass `null` to upload without linking to a plan
 * entry (still creates a real Lesson; just doesn't advance any CurriculumLesson).
 */
export function createLesson(
  groupId: string,
  subjectId: string,
  teacherId: string,
  sourceFileName: string,
  contentHash: string,
  curriculumLessonId: string | null,
): string {
  const id = `lsn-${Date.now()}`;
  let linkedCurriculumLessonId: string | null = null;
  update((state) => {
    const lesson: Lesson = {
      id,
      center_id: state.center.id,
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

    const curriculumLessons = curriculumLessonId
      ? state.curriculumLessons.map((l) => {
          if (l.id !== curriculumLessonId) return l;
          linkedCurriculumLessonId = l.id;
          return { ...l, linked_lesson_id: id, status: "in_progress" as const };
        })
      : state.curriculumLessons;

    return { ...state, lessons: [lesson, ...state.lessons], curriculumLessons };
  });
  syncInsert(
    "lessons",
    getData().lessons.find((l) => l.id === id)!,
  );
  if (linkedCurriculumLessonId) {
    syncUpdate("curriculum_lessons", linkedCurriculumLessonId, {
      linked_lesson_id: id,
      status: "in_progress",
    });
  }
  return id;
}

export function setLessonExtractedText(lessonId: string, text: string) {
  update((state) => ({
    ...state,
    lessons: state.lessons.map((l) => (l.id === lessonId ? { ...l, extracted_text: text } : l)),
  }));
  syncUpdate("lessons", lessonId, { extracted_text: text });
}

/** Pipeline success — stores the generated slides + questions and flips the lesson to "ready". */
export function completeLessonGeneration(
  lessonId: string,
  slides: Array<Omit<LessonSlide, "id" | "lesson_id">>,
  questions: Array<Omit<QuizQuestion, "id" | "lesson_id" | "source">>,
  activity: Omit<SuggestedActivity, "id" | "lesson_id">,
) {
  let newSlides: LessonSlide[] = [];
  let newQuestions: QuizQuestion[] = [];
  let newActivity: SuggestedActivity | null = null;
  let newElectronicHomework: ElectronicHomework | null = null;
  update((state) => {
    newSlides = slides.map((s, i) => ({
      ...s,
      id: `sl-${lessonId}-${i}`,
      lesson_id: lessonId,
    }));
    newQuestions = questions.map((q, i) => ({
      ...q,
      id: `q-${lessonId}-${i}`,
      lesson_id: lessonId,
      source: "ai_generated",
    }));
    newActivity = {
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
    let electronicHomeworks = state.electronicHomeworks;
    if (lessonGroupId) {
      newElectronicHomework = {
        id: `eh-${lessonId}`,
        lesson_id: lessonId,
        group_id: lessonGroupId,
        questions: newQuestions,
        due_at: "خلال ٣ أيام",
      };
      electronicHomeworks = [...state.electronicHomeworks, newElectronicHomework];
    }
    return {
      ...state,
      lessons: state.lessons.map((l) => (l.id === lessonId ? { ...l, ai_status: "ready" } : l)),
      lessonSlides: [...state.lessonSlides, ...newSlides],
      sessionQuestions: [...state.sessionQuestions, ...newQuestions],
      suggestedActivities: [...state.suggestedActivities, newActivity],
      electronicHomeworks,
    };
  });
  syncUpdate("lessons", lessonId, { ai_status: "ready" });
  syncBulkInsert("lesson_slides", newSlides);
  syncBulkInsert("session_questions", newQuestions);
  if (newActivity) syncInsert("suggested_activities", newActivity);
  if (newElectronicHomework) syncInsert("electronic_homeworks", newElectronicHomework);
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
  syncUpdate("lessons", lessonId, { ai_status: "failed", ai_error: error });
}

/** "إعادة المحاولة" — reuses the stored extracted_text, no re-upload needed. */
export function retryLessonGeneration(lessonId: string) {
  update((state) => ({
    ...state,
    lessons: state.lessons.map((l) =>
      l.id === lessonId ? { ...l, ai_status: "processing", ai_error: null } : l,
    ),
  }));
  syncUpdate("lessons", lessonId, { ai_status: "processing", ai_error: null });
}

/** Logs a timer extension inside session mode (§7-ج). */
export function recordTimerExtension(
  sessionId: string,
  stepKey: SessionStepKey,
  addedSeconds: number,
  reason: string | null,
) {
  let entry: TimerExtension | null = null;
  update((state) => {
    entry = {
      id: `tx-${Date.now()}`,
      session_id: sessionId,
      step_key: stepKey,
      added_seconds: addedSeconds,
      reason,
      at: todayLabel(),
    };
    return { ...state, timerExtensions: [entry, ...state.timerExtensions] };
  });
  if (entry) syncInsert("timer_extensions", entry);
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
  syncUpdate("lesson_slides", slideId, { title, bullets });
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
  syncUpdate("session_questions", questionId, { text, options, correct_index: correctIndex });
}

/** Logs a fair-pick draw (§7-هـ) — feeds `pickFairly`'s weighting on future draws. */
export function recordRandomPick(groupId: string, studentId: string, sessionId: string) {
  let entry: RandomPickLog | null = null;
  update((state) => {
    entry = {
      id: `rpl-${Date.now()}`,
      group_id: groupId,
      student_id: studentId,
      session_id: sessionId,
      picked_at: todayLabel(),
    };
    return { ...state, randomPickLogs: [entry, ...state.randomPickLogs] };
  });
  if (entry) syncInsert("random_pick_logs", entry);
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
  /** §13-ج step 7. */
  eHomeworkLaunchStatus: "not_sent" | "sent";
  /** §13-ج step 8 — set from step 5's live toggle. */
  activityCompletedInSession: boolean;
  durationSeconds: number;
  explanationDurationSeconds: number;
  extensionSeconds: number;
  generalNotes: string | null;
}

/** §7-ط — persisted once, when the teacher actually ends the session (not on every step change). */
export function recordSessionSummary(input: SessionSummaryInput) {
  let record: SessionRecord | null = null;
  let doneCurriculumLessonId: string | null = null;
  update((state) => {
    record = {
      id: input.sessionId,
      center_id: state.center.id,
      group_id: input.groupId,
      lesson_id: input.lessonId,
      teacher_id: input.teacherId,
      date: todayLabel(),
      attendees_count: input.attendeesCount,
      absentees_count: input.absenteesCount,
      questions_asked_count: input.questionsAskedCount,
      participants_count: input.participantsCount,
      homework_launch_status: input.homeworkLaunchStatus,
      e_homework_launch_status: input.eHomeworkLaunchStatus,
      activity_completed_in_session: input.activityCompletedInSession,
      duration_seconds: input.durationSeconds,
      explanation_duration_seconds: input.explanationDurationSeconds,
      extension_seconds: input.extensionSeconds,
      general_notes: input.generalNotes,
    };

    // §9-ب: ending a session that taught a linked lesson marks its curriculum entry "done".
    const curriculumLessons = input.lessonId
      ? state.curriculumLessons.map((l) => {
          if (l.linked_lesson_id !== input.lessonId) return l;
          doneCurriculumLessonId = l.id;
          return { ...l, status: "done" as const };
        })
      : state.curriculumLessons;

    return {
      ...state,
      sessionRecords: [record, ...state.sessionRecords],
      curriculumLessons,
    };
  });
  if (record) syncInsert("session_records", record);
  if (doneCurriculumLessonId)
    syncUpdate("curriculum_lessons", doneCurriculumLessonId, { status: "done" });
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
  let entry: AssessmentScore | null = null;
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
    entry = {
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
      ? state.assessmentScores.map((a) => (a.id === existing.id ? entry! : a))
      : [entry, ...state.assessmentScores];
    return { ...state, assessmentScores };
  });
  if (entry) syncUpsert("assessment_scores", entry);
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
  let entry: BookExerciseTask | null = null;
  update((state) => {
    const group = state.groups.find((g) => g.id === input.groupId);
    if (!group) return state;
    const existing = state.bookExerciseTasks.find(
      (t) =>
        t.session_id === input.sessionId &&
        t.student_group_id === input.groupId &&
        t.context === input.context,
    );
    entry = {
      id: existing?.id ?? `bet-${Date.now()}`,
      center_id: group.center_id,
      session_id: input.sessionId,
      student_group_id: input.groupId,
      pages_text: input.pagesText,
      context: input.context,
      created_at: existing?.created_at ?? todayLabel(),
    };
    const bookExerciseTasks = existing
      ? state.bookExerciseTasks.map((t) => (t.id === existing.id ? entry! : t))
      : [entry, ...state.bookExerciseTasks];
    return { ...state, bookExerciseTasks };
  });
  if (entry) syncUpsert("book_exercise_tasks", entry);
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
  syncDeleteAll("live_scores");
}

/* ---------------- برج تحكم المالك (Owner Control Tower) ---------------- */

export const DEFAULT_FINANCE_SETTINGS: Omit<FinanceSettings, "id" | "center_id" | "updated_at"> = {
  billing_mode: "monthly",
  monthly_fee: 0,
  per_session_fee: 0,
  season_fee: 0,
  season_sessions: 0,
  staff_salary_basis: "fixed",
  staff_salary_value: 0,
  default_group_capacity: 20,
};

export function getFinanceSettings(state: DataState): FinanceSettings {
  return (
    state.financeSettings[0] ?? {
      id: `fs-${state.center.id}`,
      center_id: state.center.id,
      updated_at: "",
      ...DEFAULT_FINANCE_SETTINGS,
    }
  );
}

export function saveFinanceSettings(
  patch: Partial<Omit<FinanceSettings, "id" | "center_id" | "updated_at">>,
) {
  let row: FinanceSettings | null = null;
  update((state) => {
    row = {
      ...getFinanceSettings(state),
      ...patch,
      id: `fs-${state.center.id}`,
      center_id: state.center.id,
      updated_at: new Date().toISOString(),
    };
    return { ...state, financeSettings: [row] };
  });
  if (row) syncUpsert("center_finance_settings", row, "center_id");
}

/** سجل النشاط الموحّد — كل حدث مهم يمر من هنا. */
export function logActivity(
  kind: string,
  title: string,
  detail?: string | null,
  actor?: string | null,
  amount?: number | null,
) {
  let entry: ActivityEntry | null = null;
  update((state) => {
    entry = {
      id: `act-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      center_id: state.center.id,
      kind,
      title,
      detail: detail ?? null,
      actor: actor ?? null,
      amount: amount ?? null,
      created_at: new Date().toISOString(),
    };
    return { ...state, activityLog: [entry, ...state.activityLog] };
  });
  if (entry) syncInsert("activity_log", entry);
}

export function pushNotification(
  kind: string,
  severity: CenterNotification["severity"],
  title: string,
  body?: string | null,
) {
  let row: CenterNotification | null = null;
  update((state) => {
    row = {
      id: `ntf-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      center_id: state.center.id,
      kind,
      severity,
      title,
      body: body ?? null,
      read_at: null,
      created_at: new Date().toISOString(),
    };
    return { ...state, notifications: [row, ...state.notifications] };
  });
  if (row) syncInsert("notifications", row);
}

export function markNotificationRead(id: string) {
  const readAt = new Date().toISOString();
  update((state) => ({
    ...state,
    notifications: state.notifications.map((n) => (n.id === id ? { ...n, read_at: readAt } : n)),
  }));
  syncUpdate("notifications", id, { read_at: readAt });
}

export function markAllNotificationsRead() {
  const readAt = new Date().toISOString();
  const ids = getData()
    .notifications.filter((n) => !n.read_at)
    .map((n) => n.id);
  update((state) => ({
    ...state,
    notifications: state.notifications.map((n) => (n.read_at ? n : { ...n, read_at: readAt })),
  }));
  ids.forEach((id) => syncUpdate("notifications", id, { read_at: readAt }));
}

/** سجل تسليم واستلام الخزنة. */
export function recordSafeHandover(input: {
  staffName: string;
  staffIdentifier?: string | null;
  amount: number;
  note?: string | null;
}) {
  let row: SafeHandover | null = null;
  update((state) => {
    row = {
      id: `sfh-${Date.now()}`,
      center_id: state.center.id,
      staff_name: input.staffName,
      staff_identifier: input.staffIdentifier ?? null,
      amount: input.amount,
      note: input.note ?? null,
      received_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
    return { ...state, safeHandovers: [row, ...state.safeHandovers] };
  });
  if (row) {
    syncInsert("safe_handovers", row);
    logActivity(
      "safe_handover",
      `استلام خزنة من ${input.staffName}`,
      input.note ?? null,
      input.staffName,
      input.amount,
    );
  }
}

export function getStaffPermissions(state: DataState, identifier: string): StaffPermissionKey[] {
  return state.staffPermissions.find((p) => p.account_identifier === identifier)?.permissions ?? [];
}

export function setStaffPermissions(
  identifier: string,
  fullName: string,
  permissions: StaffPermissionKey[],
) {
  let row: StaffPermissionRecord | null = null;
  update((state) => {
    const existing = state.staffPermissions.find((p) => p.account_identifier === identifier);
    row = {
      ...existing,
      id: existing?.id ?? `perm-${identifier}`,
      center_id: state.center.id,
      account_identifier: identifier,
      full_name: fullName,
      permissions,
      updated_at: new Date().toISOString(),
    };
    const rest = state.staffPermissions.filter((p) => p.account_identifier !== identifier);
    return { ...state, staffPermissions: [...rest, row] };
  });
  if (row) syncUpsert("staff_permissions", row, "account_identifier");
}

/** الراتب المتوقع للموظف — تذكير فقط في صفحة التدفق المالي، لا يُخصم تلقائياً. نفس نمط setStaffPermissions (تحديث/إنشاء صف واحد لكل موظف). */
export function getStaffExpectedSalary(
  state: DataState,
  identifier: string,
): { basis: PayrollBasis; value: number } | null {
  const row = state.staffPermissions.find((p) => p.account_identifier === identifier);
  if (!row?.expected_salary_basis || row.expected_salary_value == null) return null;
  return { basis: row.expected_salary_basis, value: row.expected_salary_value };
}

export function setStaffExpectedSalary(
  identifier: string,
  fullName: string,
  basis: PayrollBasis,
  value: number,
) {
  let row: StaffPermissionRecord | null = null;
  update((state) => {
    const existing = state.staffPermissions.find((p) => p.account_identifier === identifier);
    row = {
      ...existing,
      id: existing?.id ?? `perm-${identifier}`,
      center_id: state.center.id,
      account_identifier: identifier,
      full_name: fullName,
      permissions: existing?.permissions ?? [],
      expected_salary_basis: basis,
      expected_salary_value: value,
      updated_at: new Date().toISOString(),
    };
    const rest = state.staffPermissions.filter((p) => p.account_identifier !== identifier);
    return { ...state, staffPermissions: [...rest, row] };
  });
  if (row) syncUpsert("staff_permissions", row, "account_identifier");
}

/* ---------------- محرك الماليات والجدولة (db/0010) ---------------- */

function nowISO() {
  return new Date().toISOString();
}

/** مصروف عام جديد — يظهر فوراً في التدفق المالي وسجل النشاط. */
export function addExpense(input: {
  title: string;
  amount: number;
  category: Expense["category"];
  note?: string | null;
  spentAt?: string;
}): Expense | null {
  let row: Expense | null = null;
  update((state) => {
    row = {
      id: `exp-${Date.now()}`,
      center_id: state.center.id,
      category: input.category,
      title: input.title,
      amount: Number(input.amount) || 0,
      spent_at: input.spentAt ?? nowISO(),
      note: input.note ?? null,
      created_at: nowISO(),
    };
    return { ...state, expenses: [row, ...state.expenses] };
  });
  if (row) {
    syncInsert("expenses", row);
    logActivity("expense", `مصروف: ${input.title}`, null, null, Number(input.amount) || 0);
  }
  return row;
}

export function deleteExpense(id: string) {
  update((state) => ({ ...state, expenses: state.expenses.filter((e) => e.id !== id) }));
  syncDeleteIds("expenses", [id]);
}

/** تسجيل راتب مدرس/موظف كـ"صادر" حقيقي. */
export function addPayroll(input: {
  personType: PayrollRecord["person_type"];
  personId?: string | null;
  personName: string;
  basis: PayrollRecord["basis"];
  amount: number;
  period?: string;
}): PayrollRecord | null {
  let row: PayrollRecord | null = null;
  update((state) => {
    row = {
      id: `pay-${Date.now()}`,
      center_id: state.center.id,
      person_type: input.personType,
      person_id: input.personId ?? null,
      person_name: input.personName,
      basis: input.basis,
      amount: Number(input.amount) || 0,
      period: input.period ?? new Date().toISOString().slice(0, 7),
      paid_at: nowISO(),
      created_at: nowISO(),
    };
    return { ...state, payrollRecords: [row, ...state.payrollRecords] };
  });
  if (row) {
    syncInsert("payroll_records", row);
    logActivity(
      "payroll",
      `راتب ${input.personName}`,
      input.personType === "teacher" ? "مدرس" : "موظف",
      input.personName,
      Number(input.amount) || 0,
    );
  }
  return row;
}

export function deletePayroll(id: string) {
  update((state) => ({
    ...state,
    payrollRecords: state.payrollRecords.filter((p) => p.id !== id),
  }));
  syncDeleteIds("payroll_records", [id]);
}

/** سعر المادة (شهري / بالحصة) — أساس الحساب الآلي لإجمالي رسوم الطالب. */
export function saveSubjectPrice(subjectId: string, monthly: number, perSession: number) {
  let row: SubjectPrice | null = null;
  update((state) => {
    const subject = state.subjects.find((s) => s.id === subjectId);
    const existing = state.subjectPrices.find((p) => p.subject_id === subjectId);
    row = {
      id: existing?.id ?? `sp-${subjectId}`,
      center_id: state.center.id,
      subject_id: subjectId,
      subject_name: subject?.name ?? existing?.subject_name ?? subjectId,
      monthly_price: Number(monthly) || 0,
      per_session_price: Number(perSession) || 0,
      updated_at: nowISO(),
    };
    const rest = state.subjectPrices.filter((p) => p.subject_id !== subjectId);
    return { ...state, subjectPrices: [...rest, row] };
  });
  if (row) syncUpsert("subject_prices", row, "id");
}

/** إجمالي رسوم الطالب الشهرية = مجموع أسعار المواد المسجّل فيها. */
export function computeStudentFees(
  state: DataState,
  subjectIds: string[],
): { monthly: number; perSession: number } {
  return subjectIds.reduce(
    (acc, id) => {
      const price = state.subjectPrices.find((p) => p.subject_id === id);
      return {
        monthly: acc.monthly + Number(price?.monthly_price ?? 0),
        perSession: acc.perSession + Number(price?.per_session_price ?? 0),
      };
    },
    { monthly: 0, perSession: 0 },
  );
}

/** حفظ خانة في غرفة الجدولة (إنشاء أو تعديل مباشر شبيه بـ Excel). */
export function upsertScheduleSlot(input: {
  id?: string | undefined;
  teacherId: string;
  teacherName: string;
  subjectId?: string | null | undefined;
  subject: string;
  grade?: string | undefined;
  weekday: string;
  time: string;
  room?: string | undefined;
  groupId?: string | null | undefined;
}): ScheduleSlot | null {
  let row: ScheduleSlot | null = null;
  update((state) => {
    row = {
      id: input.id ?? `slot-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      center_id: state.center.id,
      teacher_id: input.teacherId,
      teacher_name: input.teacherName,
      subject_id: input.subjectId ?? null,
      subject: input.subject,
      grade: input.grade ?? "",
      weekday: input.weekday,
      time: input.time,
      room: input.room ?? "",
      group_id: input.groupId ?? null,
      updated_at: nowISO(),
    };
    const rest = state.scheduleSlots.filter((sl) => sl.id !== row!.id);
    return { ...state, scheduleSlots: [...rest, row] };
  });
  if (row) syncUpsert("schedule_slots", row, "id");
  return row;
}

export function deleteScheduleSlot(id: string) {
  update((state) => ({ ...state, scheduleSlots: state.scheduleSlots.filter((s) => s.id !== id) }));
  syncDeleteIds("schedule_slots", [id]);
}

/**
 * حذف طالب نهائياً + كل متعلقاته المالية والحركية، حتى لا يظل أثره في التدفق المالي
 * أو في تقارير الحضور بعد خروجه من السنتر.
 */
export function deleteStudentCompletely(studentId: string) {
  const before = getData();
  const student = before.students.find((s) => s.id === studentId);
  if (!student) return;

  const paymentIds = before.payments
    .filter((p) => p.student_code === student.code)
    .map((p) => p.id);
  const attendanceIds = before.attendanceRecords
    .filter((a) => a.student_id === studentId)
    .map((a) => a.id);
  const quizIds = before.quizResults.filter((q) => q.student_id === studentId).map((q) => q.id);
  const homeworkIds = before.homeworkTasks
    .filter((h) => h.student_id === studentId)
    .map((h) => h.id);
  const whatsappIds = before.whatsappLogs
    .filter((w) => w.student_id === studentId)
    .map((w) => w.id);
  const noteIds = before.teacherNotes.filter((n) => n.student_id === studentId).map((n) => n.id);

  update((state) => {
    const students = state.students.filter((s) => s.id !== studentId);
    return {
      ...state,
      students,
      payments: state.payments.filter((p) => p.student_code !== student.code),
      attendanceRecords: state.attendanceRecords.filter((a) => a.student_id !== studentId),
      quizResults: state.quizResults.filter((q) => q.student_id !== studentId),
      homeworkTasks: state.homeworkTasks.filter((h) => h.student_id !== studentId),
      whatsappLogs: state.whatsappLogs.filter((w) => w.student_id !== studentId),
      teacherNotes: state.teacherNotes.filter((n) => n.student_id !== studentId),
      groups: state.groups.map((g) =>
        g.id === student.group_id ? { ...g, enrolled: Math.max(0, g.enrolled - 1) } : g,
      ),
      leaderboard: buildLeaderboard(students),
    };
  });

  syncDeleteIds("students", [studentId]);
  syncDeleteIds("payments", paymentIds);
  syncDeleteIds("attendance_records", attendanceIds);
  syncDeleteIds("quiz_results", quizIds);
  syncDeleteIds("homework_tasks", homeworkIds);
  syncDeleteIds("whatsapp_logs", whatsappIds);
  syncDeleteIds("teacher_notes", noteIds);
  if (student.group_id) {
    const group = before.groups.find((g) => g.id === student.group_id);
    if (group) syncUpdate("groups", group.id, { enrolled: Math.max(0, group.enrolled - 1) });
  }
  logActivity("student_deleted", `حذف الطالب ${student.full_name}`, student.code);
}

/** تحديث نظام دفع الطالب. */
export function setStudentBillingPlan(studentId: string, plan: StudentBillingPlan) {
  update((state) => ({
    ...state,
    students: state.students.map((s) => (s.id === studentId ? { ...s, billing_plan: plan } : s)),
  }));
  syncUpdate("students", studentId, { billing_plan: plan });
}

/** تحديد المستحق على الطالب (يُحسب آلياً من أسعار مواده عند الإضافة). */
export function setStudentDue(studentId: string, balanceDue: number) {
  const status: Student["payment_status"] = balanceDue > 0 ? "pending" : "paid";
  update((state) => ({
    ...state,
    students: state.students.map((s) =>
      s.id === studentId ? { ...s, balance_due: balanceDue, payment_status: status } : s,
    ),
  }));
  syncUpdate("students", studentId, { balance_due: balanceDue, payment_status: status });
}

/* ---------------- نظام المهام (Tasks) ---------------- */

export interface CreateTaskInput {
  title: string;
  taskType?: TaskType;
  assigneeRole: TaskAssigneeRole;
  assigneeId: string | null;
  assigneeName: string;
  createdById?: string | null;
  createdByName?: string | null;
  priority?: TaskPriority;
  isUrgent?: boolean;
  note?: string | null;
  dueAt?: string | null;
}

export function createTask(input: CreateTaskInput): Task {
  const now = new Date().toISOString();
  const id = `tsk-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const row: Task = {
    id,
    center_id: "",
    title: input.title.trim(),
    task_type: input.taskType ?? "general",
    assignee_role: input.assigneeRole,
    assignee_id: input.assigneeId,
    assignee_name: input.assigneeName,
    created_by_id: input.createdById ?? null,
    created_by_name: input.createdByName ?? null,
    priority: input.priority ?? "medium",
    is_urgent: input.isUrgent ?? false,
    status: "pending",
    note: input.note ?? null,
    due_at: input.dueAt ?? null,
    completed_at: null,
    created_at: now,
    updated_at: now,
  };
  update((state) => {
    row.center_id = state.center.id;
    return { ...state, tasks: [row, ...state.tasks] };
  });
  syncInsert("tasks", row as unknown as object);
  logActivity(
    "task_created",
    `مهمة جديدة: ${row.title}`,
    `المُكلَّف: ${row.assignee_name} (${row.assignee_role})${row.is_urgent ? " · مستعجل" : ""}`,
    input.createdByName ?? null,
  );
  pushNotification(
    "task_assigned",
    row.is_urgent ? "critical" : "info",
    `مهمة جديدة: ${row.title}`,
    `المُكلَّف: ${row.assignee_name}${row.is_urgent ? " · مستعجل" : ""}`,
  );
  return row;
}

export function setTaskStatus(id: string, status: TaskStatus) {
  const now = new Date().toISOString();
  update((state) => ({
    ...state,
    tasks: state.tasks.map((t) =>
      t.id === id
        ? {
            ...t,
            status,
            completed_at: status === "done" ? now : t.completed_at,
            updated_at: now,
          }
        : t,
    ),
  }));
  syncUpdate("tasks", id, {
    status,
    completed_at: status === "done" ? now : null,
    updated_at: now,
  });
}

export function deleteTask(id: string) {
  update((state) => ({ ...state, tasks: state.tasks.filter((t) => t.id !== id) }));
  syncDeleteIds("tasks", [id]);
}

/** المهام الخاصة بمستخدم/دور معيّن — مفتاح الفلترة للوحات كل دور. */
export function getTasksForAssignee(
  state: DataState,
  role: TaskAssigneeRole,
  identifier: string | null,
): Task[] {
  if (role === "owner") {
    return state.tasks;
  }
  return state.tasks.filter(
    (t) => t.assignee_role === role && (identifier ? t.assignee_id === identifier : true),
  );
}

/* ---------------- §0.3 — حذف جذري كامل (Cascade) ---------------- */

import { deleteAccount as deleteAccountAuth } from "@/lib/auth";

export interface CascadeDeleteResult {
  ok: boolean;
  deletedGroups: number;
  orphanedStudents: number;
  deletedPayroll: number;
  deletedSessions: number;
  error?: string;
}

/**
 * حذف جذري لمستخدم (مدرس / موظف / زائر / طالب):
 *  - للمدرس: حذف كل المجموعات + جدول حصصه + رواتبه + تقييماته + تحويل طلابه لأيتام.
 *  - للموظف: حذف صلاحياته + رواتبه.
 *  - للطالب: استدعاء deleteStudentCompletely (موجود فعلاً).
 *  - للزائر: حذف من accounts فقط.
 *
 * يعتمد على `accountId` (id من جدول accounts).
 */
export function deleteAccountCascade(
  accountId: string,
  role: "teacher" | "staff" | "visitor" | "student",
): CascadeDeleteResult {
  const state = getData();
  const result: CascadeDeleteResult = {
    ok: true,
    deletedGroups: 0,
    orphanedStudents: 0,
    deletedPayroll: 0,
    deletedSessions: 0,
  };

  if (role === "teacher") {
    const teacher = state.teachers.find((t) => t.id === accountId || t.user_id === accountId);
    if (teacher) {
      const teacherGroups = state.groups.filter((g) => g.teacher_id === teacher.id);
      const teacherGroupIds = new Set(teacherGroups.map((g) => g.id));
      result.deletedGroups = teacherGroupIds.size;

      // الطلاب في مجموعات هذا المدرس → يتحولون لأيتيام (group_id = null)
      const orphanIds: string[] = [];
      const newStudents = state.students.map((s) => {
        if (s.group_id && teacherGroupIds.has(s.group_id)) {
          orphanIds.push(s.id);
          return { ...s, group_id: null, group_name: "بدون مجموعة" };
        }
        return s;
      });
      result.orphanedStudents = orphanIds.length;

      // رواتب المدرس
      const payrollIds = state.payrollRecords
        .filter((p) => p.person_id === teacher.id || p.person_name === teacher.full_name)
        .map((p) => p.id);
      result.deletedPayroll = payrollIds.length;

      // سجلات الحصص
      const sessionIds = state.sessionRecords
        .filter((s) => s.teacher_id === teacher.id)
        .map((s) => s.id);
      result.deletedSessions = sessionIds.length;

      // تحديث الذاكرة
      update((s) => ({
        ...s,
        students: newStudents,
        groups: s.groups.filter((g) => !teacherGroupIds.has(g.id)),
        scheduleSlots: s.scheduleSlots.filter((slot) => slot.teacher_id !== teacher.id),
        payrollRecords: s.payrollRecords.filter((p) => !payrollIds.includes(p.id)),
        sessionRecords: s.sessionRecords.filter((sr) => !sessionIds.includes(sr.id)),
        sessionEvents: s.sessionEvents.filter((ev) => !sessionIds.includes(ev.session_id)),
        assessmentScores: s.assessmentScores.filter((a) => a.recorded_by_teacher_id !== teacher.id),
        teachers: s.teachers.filter((t) => t.id !== teacher.id),
      }));

      // مزامنة Supabase
      syncDeleteIds("groups", [...teacherGroupIds]);
      syncDeleteIds("schedule_slots", state.scheduleSlots.filter((s) => s.teacher_id === teacher.id).map((s) => s.id));
      syncDeleteIds("payroll_records", payrollIds);
      syncDeleteIds("session_records", sessionIds);
      syncDeleteIds("session_events", state.sessionEvents.filter((ev) => sessionIds.includes(ev.session_id)).map((ev) => ev.id));
      syncDeleteIds("assessment_scores", state.assessmentScores.filter((a) => a.recorded_by_teacher_id === teacher.id).map((a) => a.id));
      orphanIds.forEach((sid) =>
        syncUpdate("students", sid, { group_id: null, group_name: "بدون مجموعة" }),
      );
      syncDeleteIds("teachers", [teacher.id]);
    }
  } else if (role === "staff") {
    // للموظف: حذف صلاحياته + رواتبه
    const staffPerm = state.staffPermissions.find(
      (p) => p.account_identifier === accountId || p.id === accountId,
    );
    const payrollIds = state.payrollRecords
      .filter((p) => p.person_id === accountId)
      .map((p) => p.id);
    result.deletedPayroll = payrollIds.length;

    update((s) => ({
      ...s,
      staffPermissions: s.staffPermissions.filter((p) => p.id !== staffPerm?.id),
      payrollRecords: s.payrollRecords.filter((p) => !payrollIds.includes(p.id)),
    }));

    if (staffPerm) syncDeleteIds("staff_permissions", [staffPerm.id]);
    syncDeleteIds("payroll_records", payrollIds);
  } else if (role === "student") {
    const student = state.students.find((s) => s.id === accountId);
    if (student) {
      deleteStudentCompletely(student.id);
    }
  }
  // للزائر: لا توجد بيانات مرتبطة — فقط حذف الحساب

  // حذف الحساب نفسه من accounts (server fn)
  try {
    void deleteAccountAuth(accountId);
  } catch (e) {
    result.error = e instanceof Error ? e.message : "فشل حذف الحساب";
    result.ok = false;
  }
  return result;
}

/** حذف كل الإشعارات أو كل سجل النشاط (مع تأكيد بكلمة سر المالك قبل الاستدعاء). */
export function deleteAllNotifications(): void {
  const ids = getData().notifications.map((n) => n.id);
  if (ids.length === 0) return;
  update((state) => ({ ...state, notifications: [] }));
  syncDeleteIds("notifications", ids);
}

/* ---------------- Migration 0023 (المرحلة A): group_resources + teacher_launches + homework_attempts ---------------- */

export interface CreateGroupResourceInput {
  groupId: string;
  resourceType: GroupResource["resource_type"];
  url: string;
  name: string;
  unit?: string | null;
  createdBy: string;
}

export function addGroupResource(input: CreateGroupResourceInput): GroupResource {
  const now = new Date().toISOString();
  const row: GroupResource = {
    id: `gr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    center_id: "",
    group_id: input.groupId,
    resource_type: input.resourceType,
    url: input.url.trim(),
    name: input.name.trim(),
    unit: input.unit ?? null,
    created_by: input.createdBy,
    created_at: now,
  };
  update((state) => {
    const full: GroupResource = { ...row, center_id: state.center.id };
    return { ...state, groupResources: [full, ...state.groupResources] };
  });
  const inserted = readState().groupResources[0];
  syncInsert("group_resources", inserted ? { ...inserted } : row);
  return row;
}

export function getGroupResourcesForGroup(state: DataState, groupId: string): GroupResource[] {
  return state.groupResources
    .filter((r) => r.group_id === groupId)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

export function getGroupResourcesForTeacher(state: DataState, teacherId: string): GroupResource[] {
  const teacherGroups = new Set(
    state.groups
      .filter((g) => g.teacher_id === teacherId || g.teacher_user_id === teacherId)
      .map((g) => g.id),
  );
  return state.groupResources
    .filter((r) => teacherGroups.has(r.group_id))
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

export function deleteGroupResource(resourceId: string): void {
  update((state) => ({
    ...state,
    groupResources: state.groupResources.filter((r) => r.id !== resourceId),
  }));
  syncDeleteIds("group_resources", [resourceId]);
}

export interface CreateTeacherLaunchInput {
  groupId: string;
  teacherId: string;
  launchType: TeacherLaunch["launch_type"];
  title: string;
  body?: string | null;
  notes?: string | null;
  dueAt?: string | null;
  durationMin?: number | null;
  sourceLaunchId?: string | null;
  fileData?: string | null;
  fileName?: string | null;
  fileMime?: string | null;
}

export function addTeacherLaunch(input: CreateTeacherLaunchInput): TeacherLaunch {
  const now = new Date().toISOString();
  const row: TeacherLaunch = {
    id: `tl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    center_id: "",
    group_id: input.groupId,
    teacher_id: input.teacherId,
    launch_type: input.launchType,
    title: input.title.trim(),
    body: input.body ?? null,
    notes: input.notes ?? null,
    due_at: input.dueAt ?? null,
    duration_min: input.durationMin ?? null,
    source_launch_id: input.sourceLaunchId ?? null,
    file_data: input.fileData ?? null,
    file_name: input.fileName ?? null,
    file_mime: input.fileMime ?? null,
    created_at: now,
  };
  update((state) => {
    const full: TeacherLaunch = { ...row, center_id: state.center.id };
    return { ...state, teacherLaunches: [full, ...state.teacherLaunches] };
  });
  const inserted = readState().teacherLaunches[0];
  syncInsert("teacher_launches", inserted ? { ...inserted } : row);
  return row;
}

export function getTeacherLaunchesForGroup(state: DataState, groupId: string): TeacherLaunch[] {
  return state.teacherLaunches
    .filter((l) => l.group_id === groupId)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

export function getTeacherLaunchesForTeacher(state: DataState, teacherId: string): TeacherLaunch[] {
  return state.teacherLaunches
    .filter((l) => l.teacher_id === teacherId)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}

export function deleteTeacherLaunch(launchId: string): void {
  const attemptIds = readState().homeworkAttempts.filter((a) => a.launch_id === launchId).map((a) => a.id);
  update((state) => ({
    ...state,
    teacherLaunches: state.teacherLaunches.filter((l) => l.id !== launchId),
    homeworkAttempts: state.homeworkAttempts.filter((a) => a.launch_id !== launchId),
  }));
  syncDeleteIds("teacher_launches", [launchId]);
  syncDeleteIds("homework_attempts", attemptIds);
}

export interface RecordHomeworkAttemptInput {
  launchId: string;
  studentId: string;
  studentName: string;
  answer?: string | null;
  score?: number | null;
  maxScore?: number | null;
}

export function recordHomeworkAttempt(input: RecordHomeworkAttemptInput): HomeworkAttempt {
  const now = new Date().toISOString();
  const idSeed = `ha-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let row: HomeworkAttempt = {
    id: idSeed,
    center_id: "",
    launch_id: input.launchId,
    student_id: input.studentId,
    student_name: input.studentName,
    answer: input.answer ?? null,
    score: input.score ?? null,
    max_score: input.maxScore ?? null,
    submitted_at: now,
  };
  update((state) => {
    const existing = state.homeworkAttempts.find(
      (a) => a.launch_id === input.launchId && a.student_id === input.studentId,
    );
    row = { ...row, center_id: state.center.id, id: existing?.id ?? row.id };
    const next = existing
      ? state.homeworkAttempts.map((a) => (a.id === existing.id ? row : a))
      : [row, ...state.homeworkAttempts];
    return { ...state, homeworkAttempts: next };
  });
  syncUpsert("homework_attempts", { ...row }, "launch_id,student_id");
  return row;
}

export function scoreHomeworkAttempt(attemptId: string, score: number, maxScore: number): void {
  update((state) => ({
    ...state,
    homeworkAttempts: state.homeworkAttempts.map((a) =>
      a.id === attemptId ? { ...a, score, max_score: maxScore } : a,
    ),
  }));
  syncUpdate("homework_attempts", attemptId, { score, max_score: maxScore });
}

export function getHomeworkAttemptsForLaunch(state: DataState, launchId: string): HomeworkAttempt[] {
  return state.homeworkAttempts
    .filter((a) => a.launch_id === launchId)
    .sort((a, b) => (a.submitted_at < b.submitted_at ? 1 : -1));
}

export function getHomeworkAttemptsForStudent(state: DataState, studentId: string): HomeworkAttempt[] {
  return state.homeworkAttempts
    .filter((a) => a.student_id === studentId)
    .sort((a, b) => (a.submitted_at < b.submitted_at ? 1 : -1));
}

/**
 * Migration 0023 / خطة B (B1): "الحصة اللي فاتت" — محاولات الطلاب على الإطلاقات
 * الإلكترونية لمدرس معيّن، اللي حصّتها انتهت قبل >24 ساعة وما اتصحّحتش بعد.
 *
 * النافذة: `launch.created_at < now - 24h` (proxy للحصة اللي فاتت — ما عندنا
 * `session_id` على `teacher_launches` بَعْد).
 * فلتر: `launch.teacher_id === teacherId` و `attempt.score === null`.
 */
export interface PendingCorrection {
  attempt: HomeworkAttempt;
  launch: TeacherLaunch;
  student: Student | undefined;
  /** هل تجاوزت الـ 24 ساعة (يفرض التصحيح). */
  overdue: boolean;
}

export function getPendingCorrectionsForTeacher(
  state: DataState,
  teacherId: string,
  now: number = Date.now(),
): PendingCorrection[] {
  const cutoff = now - 24 * 60 * 60 * 1000;
  const teacherLaunches = state.teacherLaunches.filter(
    (l) =>
      l.teacher_id === teacherId &&
      Date.parse(l.created_at) < cutoff &&
      (l.launch_type === "online_homework" ||
        l.launch_type === "online_quiz" ||
        l.launch_type === "homework_with_correction"),
  );
  const out: PendingCorrection[] = [];
  for (const launch of teacherLaunches) {
    for (const attempt of state.homeworkAttempts) {
      if (attempt.launch_id !== launch.id) continue;
      if (attempt.score !== null) continue;
      out.push({
        attempt,
        launch,
        student: state.students.find((s) => s.id === attempt.student_id),
        overdue: Date.parse(attempt.submitted_at) < cutoff,
      });
    }
  }
  out.sort((a, b) => (a.attempt.submitted_at < b.attempt.submitted_at ? 1 : -1));
  return out;
}

/** عدد المحاولات المعلّقة لمدرس معيّن — يُستخدم في كروت المالك (B8). */
export function getPendingCorrectionsCountForTeacher(
  state: DataState,
  teacherId: string,
): number {
  return getPendingCorrectionsForTeacher(state, teacherId).length;
}

/** متوسط درجة السلوك لكل طلاب مدرس معيّن (0..1) — يُستخدم في owner.compliance (B8). */
export function getTeacherBehaviorAverage(
  state: DataState,
  teacherId: string,
): number | null {
  const students = getStudentsForTeacher(state, teacherId);
  if (students.length === 0) return null;
  let total = 0;
  let count = 0;
  for (const s of students) {
    const scores = state.assessmentScores.filter(
      (a) => a.student_id === s.id && a.category === "behavior",
    );
    for (const sc of scores) {
      if (sc.max_value <= 0) continue;
      total += sc.value / sc.max_value;
      count += 1;
    }
  }
  return count === 0 ? null : total / count;
}

/* ---------------- Migration 0023 / خطة C (C13): أحداث اليوم للمدرس ---------------- */

export interface TeacherTodayEvent {
  kind: "schedule" | "pending_correction" | "today_launch" | "today_assessment";
  title: string;
  detail: string | null;
  at: string | null;
  ref_id: string;
  group_id: string | null;
}

/**
 * أحداث "اليوم" الخاصة بمدرس معيّن:
 * - مواعيده اليوم (من `scheduleSlots` يطابق weekday اليوم).
 * - المحاولات المعلّقة (الحصة اللي فاتت >24س).
 * - الإطلاقات اللي أنشأها اليوم.
 * - تقييمات السلوك اللي سجّلها اليوم.
 */
export function getEventsForTeacherToday(
  state: DataState,
  teacherId: string,
  now: Date = new Date(),
): TeacherTodayEvent[] {
  const events: TeacherTodayEvent[] = [];
  const teacherGroups = state.groups.filter(
    (g) => g.teacher_id === teacherId || g.teacher_user_id === teacherId,
  );
  const teacherGroupIds = new Set(teacherGroups.map((g) => g.id));
  const todayWd = now.getDay();

  for (const slot of state.scheduleSlots) {
    if (slot.teacher_id !== teacherId) continue;
    if (slot.weekday !== dayNumberToName(todayWd)) continue;
    events.push({
      kind: "schedule",
      title: `${slot.subject} · ${slot.grade}`,
      detail: `${slot.weekday} ${slot.time} · قاعة ${slot.room}`,
      at: slot.time,
      ref_id: slot.id,
      group_id: slot.group_id ?? null,
    });
  }

  const pending = getPendingCorrectionsForTeacher(state, teacherId, now.getTime());
  for (const p of pending.slice(0, 10)) {
    events.push({
      kind: "pending_correction",
      title: `تصحيح: ${p.launch.title}`,
      detail: `${p.student?.full_name ?? p.attempt.student_name} · ${hoursAgo(p.attempt.submitted_at)}`,
      at: p.attempt.submitted_at,
      ref_id: p.attempt.id,
      group_id: p.launch.group_id,
    });
  }

  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  for (const l of state.teacherLaunches) {
    if (l.teacher_id !== teacherId) continue;
    const at = new Date(l.created_at);
    if (at.getTime() < todayStart.getTime()) continue;
    events.push({
      kind: "today_launch",
      title: l.title,
      detail: TYPE_LABEL_AR[l.launch_type] ?? l.launch_type,
      at: l.created_at,
      ref_id: l.id,
      group_id: l.group_id,
    });
  }

  for (const s of state.assessmentScores) {
    if (s.recorded_by_teacher_id !== teacherId) continue;
    if (teacherGroupIds.size > 0) {
      const student = state.students.find((st) => st.id === s.student_id);
      if (student && !teacherGroupIds.has(student.group_id ?? "")) continue;
    }
    const at = new Date(s.recorded_at);
    if (at.getTime() < todayStart.getTime()) continue;
    events.push({
      kind: "today_assessment",
      title: `تقييم ${categoryLabelAr(s.category)}`,
      detail: `${s.value}/${s.max_value}`,
      at: s.recorded_at,
      ref_id: s.id,
      group_id: null,
    });
  }

  events.sort((a, b) => {
    if (!a.at) return 1;
    if (!b.at) return -1;
    return a.at < b.at ? 1 : -1;
  });
  return events;
}

const TYPE_LABEL_AR: Record<TeacherLaunch["launch_type"], string> = {
  homework: "واجب بيتي",
  homework_with_correction: "واجب مع تصحيح",
  in_class_task: "مهمة صف",
  interactive_activity: "نشاط تفاعلي",
  online_homework: "واجب إلكتروني",
  online_quiz: "اختبار إلكتروني",
  reading_assignment: "مراجعة / قراءة",
  oral_recitation: "تسميع",
};

function categoryLabelAr(c: AssessmentScore["category"]): string {
  switch (c) {
    case "homework": return "واجب";
    case "activity": return "نشاط";
    case "behavior": return "سلوك";
    case "question": return "سؤال";
    case "e_homework": return "واجب إلكتروني";
    default: return c;
  }
}

function dayNumberToName(n: number): string {
  return ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"][n] ?? "";
}

function hoursAgo(iso: string): string {
  const ms = Date.now() - Date.parse(iso);
  if (!Number.isFinite(ms)) return "—";
  const hours = Math.floor(ms / (60 * 60 * 1000));
  if (hours < 1) return "الآن";
  if (hours < 24) return `منذ ${hours} ساعة`;
  const days = Math.floor(hours / 24);
  return `منذ ${days} يوم`;
}



/** متوسط درجة السلوك لكل طالب (يستخدمه owner.compliance). */
export function getAverageBehaviorScore(state: DataState, studentId: string): number | null {
  const scores = state.assessmentScores.filter(
    (s) => s.student_id === studentId && s.category === "behavior",
  );
  if (scores.length === 0) return null;
  const sum = scores.reduce(
    (acc, s) => acc + (s.max_value > 0 ? s.value / s.max_value : 0),
    0,
  );
  return sum / scores.length;
}

export function recordBehaviorScore(studentId: string, teacherId: string, value: number, maxValue = 10) {
  recordAssessmentScore({
    studentId,
    teacherId,
    category: "behavior",
    source: "manual",
    value,
    maxValue,
  });
}


export function deleteAllActivityLog(): void {
  const ids = getData().activityLog.map((a) => a.id);
  if (ids.length === 0) return;
  update((state) => ({ ...state, activityLog: [] }));
  syncDeleteIds("activity_log", ids);
}

export function deleteNotification(id: string): void {
  update((state) => ({ ...state, notifications: state.notifications.filter((n) => n.id !== id) }));
  syncDeleteIds("notifications", [id]);
}

export function deleteActivityEntry(id: string): void {
  update((state) => ({ ...state, activityLog: state.activityLog.filter((a) => a.id !== id) }));
  syncDeleteIds("activity_log", [id]);
}

/* ---------------- 0020: Real source for groups ---------------- */

export interface CreateGroupInput {
  name: string;
  gradeId: string;
  subjectId: string;
  teacherId: string;
  capacity: number;
  studentIds: string[];
  notes?: string | undefined;
}

/**
 * الخطوة 1: ينشئ Group في `pending` (لم تُجدول بعد).
 * يحدث state.students ليُسند group_id لكل طالب مُختار (و group_name من اسم المجموعة).
 * عند انتهاء السعة: يرفض الإضافة مع رسالة واضحة.
 */
export function createGroup(input: CreateGroupInput): { group: Group; warnings: string[] } {
  const state = getData();
  const grade = state.grades.find((g) => g.id === input.gradeId);
  const subject = state.subjects.find((s) => s.id === input.subjectId);
  const teacher = state.teachers.find((t) => t.id === input.teacherId);
  const warnings: string[] = [];

  if (!grade) {
    throw new Error("الصف غير موجود");
  }
  if (!subject) {
    throw new Error("المادة غير موجودة");
  }
  if (!teacher) {
    throw new Error("المدرس غير موجود");
  }
  if (input.capacity <= 0) {
    throw new Error("السعة يجب أن تكون أكبر من صفر");
  }
  if (input.studentIds.length > input.capacity) {
    throw new Error("عدد الطلاب المختارين يتجاوز السعة القصوى");
  }

  const now = new Date().toISOString();
  const newId = `grp-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const group: Group = {
    id: newId,
    center_id: state.center.id,
    name: input.name.trim(),
    subject: subject.name,
    subject_id: subject.id,
    teacher_name: teacher.full_name,
    teacher_id: teacher.id,
    teacher_user_id: teacher.user_id ?? null,
    grade: grade.name,
    grade_id: grade.id,
    weekday: "",
    time: "",
    room: "",
    enrolled: input.studentIds.length,
    capacity: input.capacity,
    scheduling_status: "pending",
    created_at: now,
    notes: input.notes ?? null,
  };

  const targetIds = new Set(input.studentIds);
  const studentsAfter = state.students.map((s) => {
    if (!targetIds.has(s.id)) return s;
    if (s.group_id && s.group_id !== newId) {
      warnings.push(`الطالب ${s.full_name} منقول من مجموعة سابقة`);
    }
    return { ...s, group_id: newId, group_name: group.name };
  });

  update((s) => ({
    ...s,
    groups: [...s.groups, group],
    students: studentsAfter,
  }));
  syncInsert("groups", group as unknown as object);
  for (const sid of input.studentIds) {
    syncUpdate("students", sid, { group_id: newId, group_name: group.name });
  }

  return { group, warnings };
}

export function updateGroup(
  groupId: string,
  patch: { capacity?: number; notes?: string | null },
): void {
  update((state) => ({
    ...state,
    groups: state.groups.map((g) =>
      g.id === groupId
        ? {
            ...g,
            ...(patch.capacity !== undefined ? { capacity: patch.capacity } : {}),
            ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
          }
        : g,
    ),
  }));
  const payload: Record<string, unknown> = {};
  if (patch.capacity !== undefined) payload["capacity"] = patch.capacity;
  if (patch.notes !== undefined) payload["notes"] = patch.notes;
  syncUpdate("groups", groupId, payload);
}

export function deleteGroup(groupId: string): void {
  const state = getData();
  const group = state.groups.find((g) => g.id === groupId);
  if (!group) return;
  const orphanIds: string[] = [];
  const studentsAfter = state.students.map((s) => {
    if (s.group_id === groupId) {
      orphanIds.push(s.id);
      return { ...s, group_id: null, group_name: "بدون مجموعة" };
    }
    return s;
  });
  const slotIds = state.scheduleSlots
    .filter((sl) => sl.group_id === groupId)
    .map((sl) => sl.id);

  update((s) => ({
    ...s,
    groups: s.groups.filter((g) => g.id !== groupId),
    students: studentsAfter,
    scheduleSlots: s.scheduleSlots.filter((sl) => sl.group_id !== groupId),
  }));
  syncDeleteIds("groups", [groupId]);
  for (const sid of orphanIds) {
    syncUpdate("students", sid, { group_id: null, group_name: "بدون مجموعة" });
  }
  if (slotIds.length > 0) syncDeleteIds("schedule_slots", slotIds);
}

export function addStudentToGroup(
  studentId: string,
  groupId: string,
): { ok: boolean; reason?: string } {
  const state = getData();
  const group = state.groups.find((g) => g.id === groupId);
  const student = state.students.find((s) => s.id === studentId);
  if (!group || !student) return { ok: false, reason: "بيانات غير مكتملة" };
  if (student.grade !== group.grade) {
    return { ok: false, reason: "الطالب في صف مختلف" };
  }
  if (!student.subject_ids.includes(group.subject_id)) {
    return { ok: false, reason: "الطالب غير مسجَّل في هذه المادة" };
  }
  if (group.enrolled >= group.capacity) {
    return { ok: false, reason: "السعة مكتملة" };
  }
  // لو الطالب كان مسجَّل في مجموعة تانية قبل كده، لازم ننقّص عدد المسجَّلين فيها
  // (كانت المجموعة القديمة بتفضل عدادها زي ما هو غلط لو نقلنا الطالب من غيرها).
  const previousGroupId = student.group_id;
  update((s) => ({
    ...s,
    groups: s.groups.map((g) => {
      if (g.id === groupId) return { ...g, enrolled: g.enrolled + 1 };
      if (previousGroupId && g.id === previousGroupId) {
        return { ...g, enrolled: Math.max(0, g.enrolled - 1) };
      }
      return g;
    }),
    students: s.students.map((st) =>
      st.id === studentId ? { ...st, group_id: groupId, group_name: group.name } : st,
    ),
  }));
  syncUpdate("students", studentId, { group_id: groupId, group_name: group.name });
  syncUpdate("groups", groupId, { enrolled: group.enrolled + 1 });
  if (previousGroupId && previousGroupId !== groupId) {
    const previousGroup = state.groups.find((g) => g.id === previousGroupId);
    if (previousGroup) {
      syncUpdate("groups", previousGroupId, { enrolled: Math.max(0, previousGroup.enrolled - 1) });
    }
  }
  return { ok: true };
}

export function removeStudentFromGroup(studentId: string): void {
  const state = getData();
  const student = state.students.find((s) => s.id === studentId);
  if (!student || !student.group_id) return;
  const groupId = student.group_id;
  const group = state.groups.find((g) => g.id === groupId);
  update((s) => ({
    ...s,
    groups: s.groups.map((g) =>
      g.id === groupId ? { ...g, enrolled: Math.max(0, g.enrolled - 1) } : g,
    ),
    students: s.students.map((st) =>
      st.id === studentId
        ? { ...st, group_id: null, group_name: "بدون مجموعة" }
        : st,
    ),
  }));
  syncUpdate("students", studentId, { group_id: null, group_name: "بدون مجموعة" });
  if (group) {
    syncUpdate("groups", groupId, { enrolled: Math.max(0, group.enrolled - 1) });
  }
}

export function getGroupsForGrade(state: DataState, gradeId: string): Group[] {
  return state.groups.filter((g) => g.grade_id === gradeId);
}

export function getEligibleStudentsForGroup(
  state: DataState,
  gradeId: string,
  subjectId: string,
  excludeGroupId?: string,
): Student[] {
  const grade = state.grades.find((g) => g.id === gradeId);
  if (!grade) return [];
  return state.students.filter((s) => {
    if (s.grade !== grade.name) return false;
    if (!s.subject_ids.includes(subjectId)) return false;
    if (excludeGroupId && s.group_id === excludeGroupId) return false;
    return true;
  });
}

export function setGroupSchedulingStatus(
  groupId: string,
  status: "pending" | "scheduled",
  schedulingFields?: { weekday: string; time: string; room: string },
): void {
  update((state) => ({
    ...state,
    groups: state.groups.map((g) =>
      g.id === groupId
        ? {
            ...g,
            scheduling_status: status,
            weekday: schedulingFields?.weekday ?? g.weekday,
            time: schedulingFields?.time ?? g.time,
            room: schedulingFields?.room ?? g.room,
          }
        : g,
    ),
  }));
  const patch: Record<string, unknown> = { scheduling_status: status };
  if (schedulingFields) {
    patch["weekday"] = schedulingFields.weekday;
    patch["time"] = schedulingFields.time;
    patch["room"] = schedulingFields.room;
  }
  syncUpdate("groups", groupId, patch);
}

export function getRealGroups(state: DataState): Group[] {
  return state.groups;
}
