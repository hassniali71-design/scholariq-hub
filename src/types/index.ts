/**
 * Shared domain types for the Educational Center ERP & LMS.
 * Every tenant-scoped entity carries `center_id` (Supabase RLS isolation key).
 */

export type UUID = string;

export type UserRole = "owner" | "staff" | "teacher" | "student" | "parent" | "visitor";

export interface Tenant {
  center_id: UUID;
  name: string;
  branch: string;
}

export interface AppUser {
  id: UUID;
  center_id: UUID;
  full_name: string;
  role: UserRole;
  avatar_initials: string;
}

export type PaymentStatus = "paid" | "pending" | "overdue";
export type AttendanceStatus = "present" | "late" | "absent";

export interface Student {
  id: UUID;
  center_id: UUID;
  code: string; // Student ID used for portal + QR
  full_name: string;
  grade: string;
  group_name: string;
  /** Null when the student's `group_name` has no matching `Group` record yet (pre-existing seed gap). */
  group_id: UUID | null;
  guardian_name: string;
  guardian_phone: string;
  payment_status: PaymentStatus;
  balance_due: number;
  points: number;
  attendance_rate: number;
  avg_score: number;
  /**
   * CURRICULUM_ENGINE_SPEC.md §7 — explicit multi-subject enrollment, replacing
   * the old implicit "one subject via group_id" assumption.
   */
  subject_ids: UUID[];
  /** نظام دفع الطالب (db/0010) — قد يكون فاضي لصفوف قديمة قبل الهجرة. */
  billing_plan?: StudentBillingPlan | null;
  /**
   * سعر كل مادة لهذا الطالب تحديداً (db/0011) — `{ [subject_id]: price }`.
   * السعر شخصي لكل طالب وليس سعراً عاماً ثابتاً للمادة.
   */
  subject_fees?: Record<UUID, number> | null;
}

export interface Teacher {
  id: UUID;
  center_id: UUID;
  /**
   * The teacher's `auth.ts` login identifier (e.g. "TCH-2001") — `Session`
   * only carries `identifier`, never a real account id, so this is a login
   * code join key, same mechanism as `Student.code`, not a literal UUID FK.
   */
  user_id: UUID | null;
  full_name: string;
  subject: string;
  subject_id: UUID;
  groups: number;
  students: number;
  /** % of sessions where the 4 timer steps were fully respected */
  timer_compliance: number;
  sla_breaches: number;
  monthly_revenue: number;
}

export interface Group {
  id: UUID;
  center_id: UUID;
  name: string;
  subject: string;
  subject_id: UUID;
  teacher_name: string;
  teacher_id: UUID;
  grade: string;
  grade_id: UUID;
  weekday: string;
  time: string;
  room: string;
  enrolled: number;
  capacity: number;
}

/** Reference table — replaces free-text `subject`/`subject_id` pairs with a real lookup. */
export interface Subject {
  id: UUID;
  center_id: UUID;
  name: string;
  theme_key: string;
}

/** Reference table — replaces free-text `grade`/`grade_id` pairs with a real lookup. */
export interface Grade {
  id: UUID;
  center_id: UUID;
  name: string;
  order: number;
}

/**
 * Which subjects a grade actually studies (CURRICULUM_ENGINE_SPEC.md §8) — data,
 * not a hardcoded rule, so adding a 7th grade later is a seed-data change only.
 */
export interface GradeSubject {
  id: UUID;
  grade_id: UUID;
  subject_id: UUID;
}

export interface AttendanceRecord {
  id: UUID;
  center_id: UUID;
  student_id: UUID;
  student_name: string;
  group_name: string;
  status: AttendanceStatus;
  checked_in_at: string;
  method: "qr" | "barcode" | "manual";
  /** Links to `SessionRecord.id` for session-mode marks; null for QR-gate/legacy check-ins with no session context. */
  session_id: UUID | null;
}

export type PaymentMethod = "cash" | "wallet" | "instapay";

export interface PaymentRecord {
  id: UUID;
  center_id: UUID;
  student_name: string;
  student_code: string;
  amount: number;
  method: PaymentMethod;
  item: string;
  created_at: string;
}

export interface BookletItem {
  id: UUID;
  center_id: UUID;
  title: string;
  subject: string;
  price: number;
  in_stock: number;
  delivered: number;
}

/* ---------------- In-class session engine ---------------- */

/**
 * CURRICULUM_ENGINE_SPEC.md §13-ج — 9-row table, final confirmed order; row 8
 * ("حالة النشاط") has no independent timer ("بلا وقت مستقل") so it is not a
 * step key here — it's derived status shown inside `release_homework`.
 * "homework"/"release" (old keys) are gone; "last_homework" replaces
 * "homework" (same grading+attendance screen, just repositioned first again —
 * §13-ج explicitly reverses §3's earlier lesson-first order).
 */
export type SessionStepKey =
  | "last_homework"
  | "lesson"
  | "questions"
  | "book_exercise"
  | "activity_review"
  | "release_homework"
  | "release_e_homework"
  | "behavior";

export interface SessionStep {
  key: SessionStepKey;
  title: string;
  hint: string;
  /** Planned duration in seconds. */
  duration: number;
}

/** CURRICULUM_ENGINE_SPEC.md §8 — variety, not just mcq/true_false. */
export type QuestionKind = "mcq" | "true_false" | "ordering" | "matching";

export interface QuizQuestion {
  id: UUID;
  /** Null for the pre-Phase-2 static question bank — no `Lesson` record exists yet. */
  lesson_id: UUID | null;
  source: "ai_generated" | "manual";
  kind: QuestionKind;
  text: string;
  /**
   * mcq: choices. true_false: ["صح","خطأ"]. ordering: items in their correct
   * order (display shuffles them). matching: left-side labels, paired by
   * index with `match_targets`.
   */
  options: string[];
  /** Meaningful only for mcq/true_false. */
  correct_index: number;
  /** matching only — right-side labels; match_targets[i] pairs with options[i]. */
  match_targets?: string[];
}

export interface LiveScore {
  student_id: UUID;
  student_name: string;
  homework_score: number | null;
  question_score: number | null;
  points: number;
}

export interface LessonSlide {
  id: UUID;
  /** Null for the pre-Phase-2 static slide deck — no `Lesson` record exists yet. */
  lesson_id: UUID | null;
  index: number;
  title: string;
  bullets: string[];
}

/* ---------------- Session mode rebuild (TEACHER_MODULE_SPEC.md §4-b) ----------------
 * Types only for now — no data-store.ts state, mutations, or UI consume these yet.
 * Each gets wired in starting the phase that actually implements it (spec §17):
 * Lesson/AI pipeline + slide viewer = Phase 2, fair-pick questions + session log = Phase 3,
 * AssessmentScore = Phase 4, CurriculumUnit/Lesson = Phase 5.
 */

export interface Lesson {
  id: UUID;
  center_id: UUID;
  group_id: UUID;
  subject_id: UUID;
  title: string;
  source_file_name: string | null;
  extracted_text: string | null;
  content_hash: string | null;
  ai_status: "idle" | "processing" | "ready" | "failed";
  ai_error: string | null;
  taught_status: "not_started" | "in_progress" | "done";
  taught_at: string | null;
  actual_duration_seconds: number | null;
  created_by_teacher_id: UUID;
}

export interface CurriculumUnit {
  id: UUID;
  center_id: UUID;
  subject_id: UUID;
  grade_id: UUID;
  name: string;
  order: number;
  planned_duration_days: number;
}

export interface CurriculumLesson {
  id: UUID;
  unit_id: UUID;
  order: number;
  title: string;
  status: "not_started" | "in_progress" | "done";
  linked_lesson_id: UUID | null;
}

export interface SessionRecord {
  id: UUID;
  center_id: UUID;
  group_id: UUID;
  lesson_id: UUID | null;
  teacher_id: UUID;
  date: string;
  attendees_count: number;
  absentees_count: number;
  questions_asked_count: number;
  participants_count: number;
  homework_launch_status: "not_sent" | "sent";
  /** §13-ج step 7 — separate from `homework_launch_status` (step 6's book-exercise release). */
  e_homework_launch_status: "not_sent" | "sent";
  /** §13-ج step 8 ("حالة النشاط"): true if marked done live in step 5 ("مراجعة النشاط المقترح"); false = it rode along in the step 6 homework release instead. */
  activity_completed_in_session: boolean;
  duration_seconds: number;
  explanation_duration_seconds: number;
  extension_seconds: number;
  general_notes: string | null;
}

export interface SessionEvent {
  id: UUID;
  session_id: UUID;
  student_id: UUID;
  at: string;
  kind: "homework_score" | "question_answer" | "activity_score" | "attendance" | "note";
  payload: Record<string, unknown>;
}

export interface TimerExtension {
  id: UUID;
  session_id: UUID;
  step_key: SessionStepKey;
  added_seconds: number;
  reason: string | null;
  at: string;
}

export interface AssessmentScore {
  id: UUID;
  center_id: UUID;
  student_id: UUID;
  session_id: UUID | null;
  lesson_id: UUID | null;
  category: "homework" | "activity" | "behavior" | "question" | "e_homework";
  source: "auto" | "manual";
  value: number;
  max_value: number;
  recorded_by_teacher_id: UUID;
  recorded_at: string;
}

export interface RandomPickLog {
  id: UUID;
  group_id: UUID;
  student_id: UUID;
  session_id: UUID;
  picked_at: string;
}

/**
 * "حل تمارين الكتاب" (CURRICULUM_ENGINE_SPEC.md §1) — deliberately simple: a free-text
 * page-number field, no book content lookup. Same shape used twice per session via
 * `context`, once for in-class exercises and once assigned as homework.
 */
export interface BookExerciseTask {
  id: UUID;
  center_id: UUID;
  session_id: UUID;
  student_group_id: UUID;
  pages_text: string;
  context: "in_session" | "homework";
  created_at: string;
}

export interface ElectronicHomework {
  id: UUID;
  lesson_id: UUID;
  group_id: UUID;
  questions: QuizQuestion[];
  due_at: string;
}

/**
 * §8 — one suggested activity per lesson, generated by the stub pipeline based
 * on that lesson's title/subject, not a fixed pattern repeated for every lesson.
 */
export interface SuggestedActivity {
  id: UUID;
  lesson_id: UUID;
  type: "visit" | "draw" | "observe" | "practice" | "other";
  title: string;
  description: string;
}

/* ---------------- Portals ---------------- */

export interface QuizResult {
  id: UUID;
  center_id: UUID;
  student_id: UUID;
  subject: string;
  title: string;
  date: string;
  score: number;
  max_score: number;
}

export interface HomeworkTask {
  id: UUID;
  center_id: UUID;
  student_id: UUID;
  subject: string;
  title: string;
  due_date: string;
  status: "pending" | "submitted" | "graded" | "late";
  grade?: number;
}

export interface WhatsAppLog {
  id: UUID;
  center_id: UUID;
  student_id: UUID;
  sent_at: string;
  template: "attendance" | "payment" | "grade" | "homework" | "absence";
  message: string;
  delivered: boolean;
}

export interface TeacherNote {
  id: UUID;
  center_id: UUID;
  student_id: UUID;
  teacher_id: UUID;
  teacher_name: string;
  subject: string;
  date: string;
  note: string;
  tone: "positive" | "neutral" | "warning";
}

/**
 * `is_me` is intentionally NOT stored: the "current student" highlight is
 * derived at render time by comparing `student_id` with the active session.
 */
export interface LeaderboardEntry {
  rank: number;
  student_id: UUID;
  student_name: string;
  points: number;
}

/* ---------------- Analytics ---------------- */

export interface RevenuePoint {
  month: string;
  revenue: number;
  expenses: number;
  profit: number;
}

export interface AttendancePoint {
  day: string;
  present: number;
  absent: number;
}

export interface PerformancePoint {
  subject: string;
  avg: number;
}

/* ---------------- برج تحكم المالك (Owner Control Tower) ---------------- */

export type BillingMode = "monthly" | "per_session" | "season";
export type StaffSalaryBasis = "fixed" | "per_session" | "revenue_share";

/** إعداد النظام المالي الذي يختاره كل مركز — أساس كل حسابات الرسوم والرواتب بعده. */
export interface FinanceSettings {
  id: UUID;
  center_id: UUID;
  billing_mode: BillingMode;
  monthly_fee: number;
  per_session_fee: number;
  season_fee: number;
  season_sessions: number;
  staff_salary_basis: StaffSalaryBasis;
  staff_salary_value: number;
  updated_at: string;
}

/** سجل تسليم واستلام الخزنة: المدير استلم مبلغ من موظف معيّن بتاريخه. */
export interface SafeHandover {
  id: UUID;
  center_id: UUID;
  staff_name: string;
  staff_identifier: string | null;
  amount: number;
  note: string | null;
  received_at: string;
  created_at: string;
}

export type NotificationSeverity = "info" | "warning" | "critical";

export interface CenterNotification {
  id: UUID;
  center_id: UUID;
  kind: string;
  severity: NotificationSeverity;
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
}

/** سجل النشاط الموحّد (Timeline) — كل الأحداث المهمة في مكان واحد. */
export interface ActivityEntry {
  id: UUID;
  center_id: UUID;
  kind: string;
  title: string;
  detail: string | null;
  actor: string | null;
  amount: number | null;
  created_at: string;
}

/** الصلاحيات المتاحة للموظفين — مفاتيح ثابتة تُخزَّن كمصفوفة في staff_permissions.permissions. */
export const STAFF_PERMISSION_KEYS = [
  "attendance_gate",
  "cashier",
  "booklets",
  "shift_close",
  "view_students",
  "edit_students",
  "view_finance",
  "safe_handover",
] as const;

export type StaffPermissionKey = (typeof STAFF_PERMISSION_KEYS)[number];

export interface StaffPermissionRecord {
  id: UUID;
  center_id: UUID;
  account_identifier: string;
  full_name: string;
  permissions: StaffPermissionKey[];
  updated_at: string;
}

/* ---------------- محرك الماليات والجدولة (db/0010) ---------------- */

export type ExpenseCategory = "maintenance" | "bills" | "rent" | "supplies" | "marketing" | "other";

/** مصروف عام خارجي (صيانة، فواتير، إيجار...) — يُخصم من صافي الربح مباشرة. */
export interface Expense {
  id: UUID;
  center_id: UUID;
  category: ExpenseCategory;
  title: string;
  amount: number;
  spent_at: string;
  note: string | null;
  created_at: string;
}

export type PayrollBasis = "per_session" | "weekly" | "monthly";

/** راتب مسجّل كـ"صادر" حقيقي لمدرس أو موظف. */
export interface PayrollRecord {
  id: UUID;
  center_id: UUID;
  person_type: "teacher" | "staff";
  person_id: string | null;
  person_name: string;
  basis: PayrollBasis;
  amount: number;
  period: string;
  paid_at: string;
  created_at: string;
}

/** نظام دفع الطالب: بالشهر / بالحصة / كلاهما. */
/** نظام دفع الطالب: بالحصة / بالشهر / بالموسم. ("both" مُبقاة للتوافق مع صفوف قديمة.) */
export type StudentBillingPlan = "per_session" | "monthly" | "season" | "both";

/** سعر المادة الواحدة كما يحدده المالك — الإجمالي يُحسب آلياً من مواد الطالب. */
export interface SubjectPrice {
  id: UUID;
  center_id: UUID;
  subject_id: UUID;
  subject_name: string;
  monthly_price: number;
  per_session_price: number;
  updated_at: string;
}

/** خانة في غرفة تحكم الجدولة: مدرس × مادة × يوم × ساعة × قاعة. */
export interface ScheduleSlot {
  id: UUID;
  center_id: UUID;
  teacher_id: UUID;
  teacher_name: string;
  subject_id: UUID | null;
  subject: string;
  grade: string;
  weekday: string;
  time: string;
  room: string;
  group_id: UUID | null;
  updated_at: string;
}
