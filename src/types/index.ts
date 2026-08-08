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
  guardian_name: string;
  guardian_phone: string;
  payment_status: PaymentStatus;
  balance_due: number;
  points: number;
  attendance_rate: number;
  avg_score: number;
}

export interface Teacher {
  id: UUID;
  center_id: UUID;
  full_name: string;
  subject: string;
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
  teacher_name: string;
  grade: string;
  weekday: string;
  time: string;
  room: string;
  enrolled: number;
  capacity: number;
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

export type SessionStepKey = "homework" | "lesson" | "questions" | "release";

export interface SessionStep {
  key: SessionStepKey;
  title: string;
  hint: string;
  /** Planned duration in seconds. */
  duration: number;
}

export type QuestionKind = "mcq" | "truefalse";

export interface QuizQuestion {
  id: UUID;
  kind: QuestionKind;
  text: string;
  options: string[];
  correct_index: number;
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
  index: number;
  title: string;
  bullets: string[];
}

/* ---------------- Portals ---------------- */

export interface QuizResult {
  id: UUID;
  center_id: UUID;
  subject: string;
  title: string;
  date: string;
  score: number;
  max_score: number;
}

export interface HomeworkTask {
  id: UUID;
  center_id: UUID;
  subject: string;
  title: string;
  due_date: string;
  status: "pending" | "submitted" | "graded" | "late";
  grade?: number;
}

export interface WhatsAppLog {
  id: UUID;
  center_id: UUID;
  sent_at: string;
  template: "attendance" | "payment" | "grade" | "homework" | "absence";
  message: string;
  delivered: boolean;
}

export interface TeacherNote {
  id: UUID;
  center_id: UUID;
  teacher_name: string;
  subject: string;
  date: string;
  note: string;
  tone: "positive" | "neutral" | "warning";
}

export interface LeaderboardEntry {
  rank: number;
  student_name: string;
  points: number;
  is_me?: boolean;
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
