import type {
  AttendancePoint,
  AttendanceRecord,
  BookletItem,
  CurriculumLesson,
  CurriculumUnit,
  Grade,
  GradeSubject,
  Group,
  HomeworkTask,
  LeaderboardEntry,
  LessonSlide,
  PaymentRecord,
  PerformancePoint,
  QuizQuestion,
  QuizResult,
  RevenuePoint,
  SessionStep,
  Student,
  Subject,
  Teacher,
  TeacherNote,
  Tenant,
  WhatsAppLog,
} from "@/types";

/**
 * Static mock layer. Every record is scoped by `center_id` so swapping these
 * arrays for Supabase queries (with RLS on center_id) is a drop-in change.
 */

export const CURRENT_TENANT: Tenant = {
  center_id: "ctr-0001",
  name: "سنتر النخبة التعليمي",
  branch: "الفرع الرئيسي — المنصورة",
};

const c = CURRENT_TENANT.center_id;

/* ---------------- Reference tables (Subject / Grade) ---------------- */

/**
 * DESIGN_ATMOSPHERE_SPEC.md §0.2 — replaced the previous 5 subjects
 * (فيزياء/كيمياء/رياضيات/لغة إنجليزية/أحياء) with these 5, same ids.
 */
export const subjects: Subject[] = [
  { id: "sub-1", center_id: c, name: "عربي", theme_key: "arabic" },
  { id: "sub-2", center_id: c, name: "إنجليزي", theme_key: "english" },
  { id: "sub-3", center_id: c, name: "رياضيات", theme_key: "math" },
  { id: "sub-4", center_id: c, name: "دراسات", theme_key: "social" },
  { id: "sub-5", center_id: c, name: "علوم", theme_key: "science" },
];

/**
 * CURRICULUM_ENGINE_SPEC.md §8 — project is primary/prep only; the old secondary
 * (ثانوي) stage was removed entirely, not kept alongside this. gd-1/gd-2/gd-3 keep
 * their ids (existing groups/students/curriculum FKs stay valid) but now mean
 * 1st/2nd/3rd primary instead of 1st/2nd/3rd secondary. gd-4/gd-5/gd-6 are new —
 * a plain reference table, not hardcoded to 6: a 7th+ grade (prep stage) later is
 * a seed-data addition only, matching the existing 4th-6th primary pattern.
 */
export const grades: Grade[] = [
  { id: "gd-1", center_id: c, name: "الأول الابتدائي", order: 1 },
  { id: "gd-2", center_id: c, name: "الثاني الابتدائي", order: 2 },
  { id: "gd-3", center_id: c, name: "الثالث الابتدائي", order: 3 },
  { id: "gd-4", center_id: c, name: "الرابع الابتدائي", order: 4 },
  { id: "gd-5", center_id: c, name: "الخامس الابتدائي", order: 5 },
  { id: "gd-6", center_id: c, name: "السادس الابتدائي", order: 6 },
];

/**
 * Which subjects each grade actually studies — data-driven (§8), not a code
 * conditional. 1st-3rd primary: عربي/إنجليزي/رياضيات only. 4th-6th primary adds
 * علوم + دراسات (they split off from "دراسات" as separate subjects starting 4th
 * grade in the real curriculum this center follows).
 */
const CORE_SUBJECT_IDS = ["sub-1", "sub-2", "sub-3"] as const;
const UPPER_PRIMARY_SUBJECT_IDS = ["sub-1", "sub-2", "sub-3", "sub-4", "sub-5"] as const;

export const gradeSubjects: GradeSubject[] = grades.flatMap((g) => {
  const subjectIds = g.order <= 3 ? CORE_SUBJECT_IDS : UPPER_PRIMARY_SUBJECT_IDS;
  return subjectIds.map((subjectId) => ({
    id: `gs-${g.id}-${subjectId}`,
    grade_id: g.id,
    subject_id: subjectId,
  }));
});

/**
 * Curriculum plan (§9) — دراسات / gd-4, matching gr-1. DESIGN_ATMOSPHERE_SPEC.md
 * §0.2 reassigned gr-1's teacher (tc-1) from physics to دراسات, so the
 * physics-specific plan that used to live here (sub-1) no longer makes sense
 * under any subject; replaced with دراسات content under sub-4.
 *
 * FIXED (real browser trial caught this): this used to sit at gd-3, which
 * `gradeSubjects` above says only studies عربي/إنجليزي/رياضيات — دراسات isn't
 * supposed to exist below 4th grade. Moved gr-1 + this plan to gd-4 (per user
 * decision — moving the grade, not tc-1's subject). gr-2/gr-4 (علوم at
 * gd-3/gd-2) have the identical mismatch and are NOT fixed here — flagged
 * separately, pending a decision on whether to fix those too.
 */
export const curriculumUnits: CurriculumUnit[] = [
  {
    id: "cu-1",
    center_id: c,
    subject_id: "sub-4",
    grade_id: "gd-4",
    name: "الوحدة الأولى — الجغرافيا الطبيعية لمصر",
    order: 1,
    planned_duration_days: 14,
  },
  {
    id: "cu-2",
    center_id: c,
    subject_id: "sub-4",
    grade_id: "gd-4",
    name: "الوحدة الثانية — تاريخ مصر الحديث",
    order: 2,
    planned_duration_days: 10,
  },
];

export const curriculumLessons: CurriculumLesson[] = [
  {
    id: "cl-1",
    unit_id: "cu-1",
    order: 1,
    title: "نهر النيل ودوره التاريخي",
    status: "done",
    linked_lesson_id: null,
  },
  {
    id: "cl-2",
    unit_id: "cu-1",
    order: 2,
    title: "المناخ والتضاريس المصرية",
    status: "not_started",
    linked_lesson_id: null,
  },
  {
    id: "cl-3",
    unit_id: "cu-1",
    order: 3,
    title: "الموارد الطبيعية وتوزيعها",
    status: "not_started",
    linked_lesson_id: null,
  },
  {
    id: "cl-4",
    unit_id: "cu-2",
    order: 1,
    title: "الحملة الفرنسية وآثارها",
    status: "not_started",
    linked_lesson_id: null,
  },
  {
    id: "cl-5",
    unit_id: "cu-2",
    order: 2,
    title: "عصر محمد علي ونهضة مصر",
    status: "not_started",
    linked_lesson_id: null,
  },
];

export const students: Student[] = [
  {
    id: "st-1",
    center_id: c,
    code: "STD-10234",
    full_name: "أحمد محمود السيد",
    grade: "الرابع الابتدائي",
    group_name: "دراسات - سبت 4م",
    group_id: "gr-1",
    guardian_name: "محمود السيد",
    guardian_phone: "01001234567",
    payment_status: "paid",
    balance_due: 0,
    points: 1840,
    attendance_rate: 96,
    avg_score: 92,
    subject_ids: ["sub-4"],
  },
  {
    id: "st-2",
    center_id: c,
    code: "STD-10235",
    full_name: "سارة عادل إبراهيم",
    grade: "الثالث الابتدائي",
    group_name: "علوم - أحد 6م",
    group_id: "gr-2",
    guardian_name: "عادل إبراهيم",
    guardian_phone: "01112345678",
    payment_status: "pending",
    balance_due: 450,
    points: 2110,
    attendance_rate: 99,
    avg_score: 95,
    subject_ids: ["sub-5"],
  },
  {
    id: "st-3",
    center_id: c,
    code: "STD-10236",
    full_name: "يوسف خالد منصور",
    grade: "الثاني الابتدائي",
    group_name: "إنجليزي - اثنين 5م",
    group_id: "gr-3",
    guardian_name: "خالد منصور",
    guardian_phone: "01223456789",
    payment_status: "overdue",
    balance_due: 900,
    points: 940,
    attendance_rate: 74,
    avg_score: 68,
    subject_ids: ["sub-2"],
  },
  {
    id: "st-4",
    center_id: c,
    code: "STD-10237",
    full_name: "منة الله طارق",
    grade: "الثاني الابتدائي",
    group_name: "علوم - ثلاثاء 3م",
    group_id: "gr-4",
    guardian_name: "طارق فهمي",
    guardian_phone: "01034567890",
    payment_status: "paid",
    balance_due: 0,
    points: 1620,
    attendance_rate: 91,
    avg_score: 88,
    subject_ids: ["sub-5"],
  },
  {
    id: "st-5",
    center_id: c,
    code: "STD-10238",
    full_name: "عمر حسام الدين",
    grade: "الأول الابتدائي",
    group_name: "رياضيات - أربعاء 7م",
    group_id: "gr-5",
    guardian_name: "حسام الدين علي",
    guardian_phone: "01145678901",
    payment_status: "pending",
    balance_due: 300,
    points: 1275,
    attendance_rate: 85,
    avg_score: 79,
    subject_ids: ["sub-3"],
  },
  {
    id: "st-6",
    center_id: c,
    code: "STD-10239",
    full_name: "ملك أشرف زكي",
    grade: "الرابع الابتدائي",
    group_name: "دراسات - سبت 4م",
    group_id: "gr-1",
    guardian_name: "أشرف زكي",
    guardian_phone: "01256789012",
    payment_status: "paid",
    balance_due: 0,
    points: 1990,
    attendance_rate: 97,
    avg_score: 90,
    subject_ids: ["sub-4"],
  },
  {
    id: "st-7",
    center_id: c,
    code: "STD-10240",
    full_name: "زياد إبراهيم عبد الله",
    grade: "الثاني الابتدائي",
    group_name: "عربي - خميس 5م",
    group_id: "gr-6",
    guardian_name: "إبراهيم عبد الله",
    guardian_phone: "01167890123",
    payment_status: "paid",
    balance_due: 0,
    points: 1510,
    attendance_rate: 93,
    avg_score: 86,
    subject_ids: ["sub-1"],
  },
  {
    id: "st-8",
    center_id: c,
    code: "STD-10241",
    full_name: "نور محمد سامي",
    grade: "الثاني الابتدائي",
    group_name: "عربي - خميس 5م",
    group_id: "gr-6",
    guardian_name: "محمد سامي",
    guardian_phone: "01278901234",
    payment_status: "pending",
    balance_due: 250,
    points: 1350,
    attendance_rate: 88,
    avg_score: 81,
    subject_ids: ["sub-1"],
  },
  /**
   * CURRICULUM_ENGINE_SPEC.md §10 — 5 test students for today's real trial run
   * (upload a lesson → session cycle → homework → grade → descriptive card),
   * one per remaining group so the trial can exercise a different subject each
   * time. Same seed pattern as st-7/st-8 (DESIGN_ATMOSPHERE_SPEC.md §0.2).
   */
  {
    id: "st-9",
    center_id: c,
    code: "STD-10242",
    full_name: "حبيبة سامح فتحي",
    grade: "الثالث الابتدائي",
    group_name: "علوم - أحد 6م",
    group_id: "gr-2",
    guardian_name: "سامح فتحي",
    guardian_phone: "01011122233",
    payment_status: "paid",
    balance_due: 0,
    points: 1180,
    attendance_rate: 90,
    avg_score: 83,
    subject_ids: ["sub-5"],
  },
  {
    id: "st-10",
    center_id: c,
    code: "STD-10243",
    full_name: "كريم أحمد لطفي",
    grade: "الثاني الابتدائي",
    group_name: "إنجليزي - اثنين 5م",
    group_id: "gr-3",
    guardian_name: "أحمد لطفي",
    guardian_phone: "01122233344",
    payment_status: "pending",
    balance_due: 150,
    points: 760,
    attendance_rate: 68,
    avg_score: 58,
    subject_ids: ["sub-2"],
  },
  {
    id: "st-11",
    center_id: c,
    code: "STD-10244",
    full_name: "جنى وليد عادل",
    grade: "الثاني الابتدائي",
    group_name: "علوم - ثلاثاء 3م",
    group_id: "gr-4",
    guardian_name: "وليد عادل",
    guardian_phone: "01233344455",
    payment_status: "paid",
    balance_due: 0,
    points: 2050,
    attendance_rate: 98,
    avg_score: 94,
    subject_ids: ["sub-5"],
  },
  {
    id: "st-12",
    center_id: c,
    code: "STD-10245",
    full_name: "مصطفى رمضان حلمي",
    grade: "الأول الابتدائي",
    group_name: "رياضيات - أربعاء 7م",
    group_id: "gr-5",
    guardian_name: "رمضان حلمي",
    guardian_phone: "01044455566",
    payment_status: "overdue",
    balance_due: 400,
    points: 890,
    attendance_rate: 80,
    avg_score: 71,
    subject_ids: ["sub-3"],
  },
  {
    id: "st-13",
    center_id: c,
    code: "STD-10246",
    full_name: "ريم خالد عبد العزيز",
    grade: "الثاني الابتدائي",
    group_name: "عربي - خميس 5م",
    group_id: "gr-6",
    guardian_name: "خالد عبد العزيز",
    guardian_phone: "01155566677",
    payment_status: "paid",
    balance_due: 0,
    points: 1420,
    attendance_rate: 92,
    avg_score: 85,
    subject_ids: ["sub-1"],
  },
];

/**
 * DESIGN_ATMOSPHERE_SPEC.md §0.2 — `subject`/`subject_id` reshuffled across the
 * new 5-subject list (no teacher kept their old subject); every other field
 * (id, name, groups/students/timer_compliance/sla_breaches/monthly_revenue)
 * untouched. tc-5 is the new 5th teacher needed to cover the 5th subject.
 */
export const teachers: Teacher[] = [
  {
    id: "tc-1",
    center_id: c,
    // Matches auth.ts's seedAccounts (`TCH-${2001 + i}`) at index 0.
    user_id: "TCH-2001",
    full_name: "أ. مصطفى الجندي",
    subject: "دراسات",
    subject_id: "sub-4",
    groups: 6,
    students: 214,
    timer_compliance: 97,
    sla_breaches: 1,
    monthly_revenue: 86400,
  },
  {
    id: "tc-2",
    center_id: c,
    user_id: "TCH-2002",
    full_name: "أ. هبة عبد الرحمن",
    subject: "علوم",
    subject_id: "sub-5",
    groups: 5,
    students: 178,
    timer_compliance: 92,
    sla_breaches: 3,
    monthly_revenue: 71200,
  },
  {
    id: "tc-3",
    center_id: c,
    user_id: "TCH-2003",
    full_name: "أ. كريم شوقي",
    subject: "إنجليزي",
    subject_id: "sub-2",
    groups: 7,
    students: 240,
    timer_compliance: 78,
    sla_breaches: 9,
    monthly_revenue: 96000,
  },
  {
    id: "tc-4",
    center_id: c,
    user_id: "TCH-2004",
    full_name: "أ. نورهان سعيد",
    subject: "رياضيات",
    subject_id: "sub-3",
    groups: 4,
    students: 132,
    timer_compliance: 88,
    sla_breaches: 4,
    monthly_revenue: 52800,
  },
  {
    id: "tc-5",
    center_id: c,
    user_id: "TCH-2005",
    full_name: "أ. سلمى وجدي",
    subject: "عربي",
    subject_id: "sub-1",
    groups: 3,
    students: 95,
    timer_compliance: 90,
    sla_breaches: 2,
    monthly_revenue: 45000,
  },
];

export const groups: Group[] = [
  {
    id: "gr-1",
    center_id: c,
    name: "دراسات - سبت 4م",
    subject: "دراسات",
    subject_id: "sub-4",
    teacher_name: "أ. مصطفى الجندي",
    teacher_id: "tc-1",
    grade: "الرابع الابتدائي",
    grade_id: "gd-4",
    weekday: "السبت",
    time: "04:00 م",
    room: "قاعة A1",
    enrolled: 38,
    capacity: 40,
  },
  {
    id: "gr-2",
    center_id: c,
    name: "علوم - أحد 6م",
    subject: "علوم",
    subject_id: "sub-5",
    teacher_name: "أ. هبة عبد الرحمن",
    teacher_id: "tc-2",
    grade: "الثالث الابتدائي",
    grade_id: "gd-3",
    weekday: "الأحد",
    time: "06:00 م",
    room: "قاعة B2",
    enrolled: 33,
    capacity: 40,
  },
  {
    id: "gr-3",
    center_id: c,
    name: "إنجليزي - اثنين 5م",
    subject: "إنجليزي",
    subject_id: "sub-2",
    teacher_name: "أ. كريم شوقي",
    teacher_id: "tc-3",
    grade: "الثاني الابتدائي",
    grade_id: "gd-2",
    weekday: "الإثنين",
    time: "05:00 م",
    room: "قاعة A3",
    enrolled: 40,
    capacity: 40,
  },
  {
    id: "gr-4",
    center_id: c,
    name: "علوم - ثلاثاء 3م",
    subject: "علوم",
    subject_id: "sub-5",
    teacher_name: "أ. هبة عبد الرحمن",
    teacher_id: "tc-2",
    grade: "الثاني الابتدائي",
    grade_id: "gd-2",
    weekday: "الثلاثاء",
    time: "03:00 م",
    room: "قاعة C1",
    enrolled: 27,
    capacity: 35,
  },
  {
    // Pre-existing gap fixed: st-5's group_name had no matching Group record.
    id: "gr-5",
    center_id: c,
    name: "رياضيات - أربعاء 7م",
    subject: "رياضيات",
    subject_id: "sub-3",
    teacher_name: "أ. نورهان سعيد",
    teacher_id: "tc-4",
    grade: "الأول الابتدائي",
    grade_id: "gd-1",
    weekday: "الأربعاء",
    time: "07:00 م",
    room: "قاعة B1",
    enrolled: 26,
    capacity: 30,
  },
  {
    // New group for the new 5th teacher (DESIGN_ATMOSPHERE_SPEC.md §0.2).
    id: "gr-6",
    center_id: c,
    name: "عربي - خميس 5م",
    subject: "عربي",
    subject_id: "sub-1",
    teacher_name: "أ. سلمى وجدي",
    teacher_id: "tc-5",
    grade: "الثاني الابتدائي",
    grade_id: "gd-2",
    weekday: "الخميس",
    time: "05:00 م",
    room: "قاعة C2",
    enrolled: 24,
    capacity: 30,
  },
];

export const attendanceToday: AttendanceRecord[] = [
  {
    id: "at-1",
    center_id: c,
    student_id: "st-1",
    student_name: "أحمد محمود السيد",
    group_name: "دراسات - سبت 4م",
    status: "present",
    checked_in_at: "03:52 م",
    method: "qr",
    session_id: null,
  },
  {
    id: "at-2",
    center_id: c,
    student_id: "st-6",
    student_name: "ملك أشرف زكي",
    group_name: "دراسات - سبت 4م",
    status: "present",
    checked_in_at: "03:55 م",
    method: "barcode",
    session_id: null,
  },
  {
    id: "at-3",
    center_id: c,
    student_id: "st-3",
    student_name: "يوسف خالد منصور",
    group_name: "إنجليزي - اثنين 5م",
    status: "late",
    checked_in_at: "05:18 م",
    method: "qr",
    session_id: null,
  },
  {
    id: "at-4",
    center_id: c,
    student_id: "st-5",
    student_name: "عمر حسام الدين",
    group_name: "رياضيات - أربعاء 7م",
    status: "absent",
    checked_in_at: "—",
    method: "manual",
    session_id: null,
  },
];

export const payments: PaymentRecord[] = [
  {
    id: "pm-1",
    center_id: c,
    student_name: "أحمد محمود السيد",
    student_code: "STD-10234",
    amount: 450,
    method: "cash",
    item: "اشتراك شهر أغسطس - فيزياء",
    created_at: "03:53 م",
  },
  {
    id: "pm-2",
    center_id: c,
    student_name: "ملك أشرف زكي",
    student_code: "STD-10239",
    amount: 120,
    method: "wallet",
    item: "ملزمة الباب الثالث",
    created_at: "03:58 م",
  },
  {
    id: "pm-3",
    center_id: c,
    student_name: "منة الله طارق",
    student_code: "STD-10237",
    amount: 400,
    method: "instapay",
    item: "اشتراك شهر أغسطس - أحياء",
    created_at: "04:11 م",
  },
];

export const booklets: BookletItem[] = [
  {
    id: "bk-1",
    center_id: c,
    title: "ملزمة الفيزياء - الباب الثالث",
    subject: "الفيزياء",
    price: 120,
    in_stock: 64,
    delivered: 186,
  },
  {
    id: "bk-2",
    center_id: c,
    title: "بنك أسئلة الكيمياء",
    subject: "الكيمياء",
    price: 90,
    in_stock: 12,
    delivered: 141,
  },
  {
    id: "bk-3",
    center_id: c,
    title: "شيت الرياضيات الأسبوعي",
    subject: "الرياضيات",
    price: 45,
    in_stock: 210,
    delivered: 320,
  },
];

/* ---------------- Session engine ---------------- */

/**
 * CURRICULUM_ENGINE_SPEC.md §3: declaration order now matches the real on-screen
 * flow (شرح ← واجب/غياب ← أنشطة ← إطلاق, TEACHER_MODULE_SPEC.md §7-ب), same as
 * `SESSION_FLOW` in teacher.session.tsx. owner.compliance.tsx used to map its
 * `stepCompliance` array to this one positionally (order-sensitive); that lookup
 * is now keyed by `step.key` instead, so this array's order is free to match
 * reality without risking misalignment there.
 */
export const SESSION_STEPS: SessionStep[] = [
  {
    key: "lesson",
    title: "الشرح التفاعلي للدرس",
    hint: "عرض الدرس بقالب موحد عالي التباين على الشاشة الذكية",
    duration: 30 * 60,
  },
  {
    key: "homework",
    title: "تقييم الواجب المنزلي ورصد الغياب",
    hint: "رصد سريع لتقييم الواجب وتسجيل حضور/غياب كل طالب بلمسة واحدة",
    duration: 10 * 60,
  },
  {
    key: "questions",
    title: "الأنشطة التفاعلية — الأسئلة العشوائية",
    hint: "سحب اسم طالب عشوائياً مع تايمر لكل سؤال",
    duration: 10 * 60,
  },
  {
    key: "release",
    title: "إطلاق المهام والأنشطة",
    hint: "إرسال الواجب والشيت الأسبوعي للطلاب وأولياء الأمور",
    duration: 10 * 60,
  },
];

export const QUESTION_SECONDS = 60;

export const lessonSlides: LessonSlide[] = [
  {
    id: "sl-1",
    lesson_id: null,
    index: 1,
    title: "الباب الثالث — التأثير المغناطيسي للتيار",
    bullets: [
      "تعريف المجال المغناطيسي وخطوط الفيض",
      "قاعدة اليد اليمنى وتحديد الاتجاه",
      "أهداف الحصة ومخرجات التعلم",
    ],
  },
  {
    id: "sl-2",
    lesson_id: null,
    index: 2,
    title: "قانون بيو-سافار",
    bullets: [
      "شدة المجال الناشئ عن سلك مستقيم",
      "العلاقة العكسية مع البعد العمودي",
      "مثال محلول رقم (1) على السبورة",
    ],
  },
  {
    id: "sl-3",
    lesson_id: null,
    index: 3,
    title: "الملف اللولبي والوشيعة الدائرية",
    bullets: [
      "اشتقاق قانون شدة المجال داخل الملف",
      "أثر عدد اللفات وشدة التيار",
      "خطأ شائع في التعويض بوحدات الطول",
    ],
  },
  {
    id: "sl-4",
    lesson_id: null,
    index: 4,
    title: "ملخص وتطبيقات الامتحان",
    bullets: [
      "خريطة ذهنية سريعة للقوانين",
      "٣ أسئلة نموذجية من امتحانات سابقة",
      "الواجب المنزلي المطلوب",
    ],
  },
];

export const sessionQuestions: QuizQuestion[] = [
  {
    id: "q-1",
    lesson_id: null,
    source: "manual",
    kind: "mcq",
    text: "ما وحدة قياس شدة المجال المغناطيسي في النظام الدولي؟",
    options: ["تسلا", "أمبير", "فولت", "هنري"],
    correct_index: 0,
  },
  {
    id: "q-2",
    lesson_id: null,
    source: "manual",
    kind: "true_false",
    text: "خطوط الفيض المغناطيسي تتقاطع داخل الملف اللولبي.",
    options: ["صح", "خطأ"],
    correct_index: 1,
  },
  {
    id: "q-3",
    lesson_id: null,
    source: "manual",
    kind: "mcq",
    text: "شدة المجال حول سلك مستقيم تتناسب عكسياً مع:",
    options: ["شدة التيار", "البعد العمودي", "طول السلك", "المقاومة"],
    correct_index: 1,
  },
  {
    id: "q-4",
    lesson_id: null,
    source: "manual",
    kind: "true_false",
    text: "قاعدة اليد اليمنى تحدد اتجاه المجال المغناطيسي حول السلك.",
    options: ["صح", "خطأ"],
    correct_index: 0,
  },
  {
    id: "q-5",
    lesson_id: null,
    source: "manual",
    kind: "ordering",
    text: "رتّب خطوات رسم خطوط المجال المغناطيسي حول سلك مستقيم بالترتيب الصحيح.",
    options: [
      "حدّد اتجاه التيار في السلك",
      "طبّق قاعدة اليد اليمنى",
      "ارسم الخطوط الدائرية حول السلك",
      "حدّد اتجاه المجال عند كل نقطة",
    ],
    correct_index: 0,
  },
  {
    id: "q-6",
    lesson_id: null,
    source: "manual",
    kind: "matching",
    text: "صل كل مصدر مجال مغناطيسي بشكل خطوط المجال الناتجة عنه.",
    options: ["سلك مستقيم", "ملف لولبي", "مغناطيس قضيبي"],
    correct_index: 0,
    match_targets: ["دوائر متحدة المركز", "خطوط متوازية داخل الملف", "خطوط من القطب الشمالي للجنوبي"],
  },
];

/* ---------------- Portals ---------------- */

export const quizResults: QuizResult[] = [
  {
    id: "qr-1",
    center_id: c,
    student_id: "st-1",
    subject: "الفيزياء",
    title: "تقييم الباب الثالث",
    date: "٥ أغسطس",
    score: 18,
    max_score: 20,
  },
  {
    id: "qr-2",
    center_id: c,
    student_id: "st-1",
    subject: "الكيمياء",
    title: "اختبار سريع - الاتزان",
    date: "٣ أغسطس",
    score: 14,
    max_score: 20,
  },
  {
    id: "qr-3",
    center_id: c,
    student_id: "st-1",
    subject: "الرياضيات",
    title: "التفاضل - ورقة (2)",
    date: "١ أغسطس",
    score: 19,
    max_score: 20,
  },
];

export const homeworkTasks: HomeworkTask[] = [
  {
    id: "hw-1",
    center_id: c,
    student_id: "st-1",
    subject: "الفيزياء",
    title: "مسائل صفحة 84 : 89",
    due_date: "٩ أغسطس",
    status: "pending",
  },
  {
    id: "hw-2",
    center_id: c,
    student_id: "st-1",
    subject: "الكيمياء",
    title: "شيت الاتزان الكيميائي",
    due_date: "٨ أغسطس",
    status: "submitted",
  },
  {
    id: "hw-3",
    center_id: c,
    student_id: "st-1",
    subject: "الرياضيات",
    title: "تمارين التفاضل (3)",
    due_date: "٦ أغسطس",
    status: "graded",
    grade: 9.5,
  },
];

export const whatsappLogs: WhatsAppLog[] = [
  {
    id: "wa-1",
    center_id: c,
    student_id: "st-1",
    sent_at: "اليوم 03:53 م",
    template: "attendance",
    message: "تم تسجيل حضور الطالب أحمد محمود في حصة الفيزياء الساعة 3:52 م.",
    delivered: true,
  },
  {
    id: "wa-2",
    center_id: c,
    student_id: "st-1",
    sent_at: "اليوم 05:40 م",
    template: "grade",
    message: "نتيجة تقييم اليوم: 18 من 20 — تقدير ممتاز.",
    delivered: true,
  },
  {
    id: "wa-3",
    center_id: c,
    student_id: "st-1",
    sent_at: "أمس 08:10 م",
    template: "homework",
    message: "تم إطلاق واجب جديد: مسائل صفحة 84 : 89، آخر موعد 9 أغسطس.",
    delivered: true,
  },
  {
    id: "wa-4",
    center_id: c,
    student_id: "st-1",
    sent_at: "أمس 06:02 م",
    template: "payment",
    message: "تم سداد مبلغ 450 جنيه — اشتراك شهر أغسطس.",
    delivered: false,
  },
];

export const teacherNotes: TeacherNote[] = [
  {
    id: "tn-1",
    center_id: c,
    student_id: "st-1",
    teacher_id: "tc-1",
    teacher_name: "أ. مصطفى الجندي",
    subject: "الفيزياء",
    date: "اليوم",
    note: "مستوى ممتاز في حل المسائل، يحتاج تركيز أكبر في وحدات القياس.",
    tone: "positive",
  },
  {
    id: "tn-2",
    center_id: c,
    student_id: "st-1",
    teacher_id: "tc-2",
    teacher_name: "أ. هبة عبد الرحمن",
    subject: "الكيمياء",
    date: "٣ أغسطس",
    note: "تأخر في تسليم الواجب مرتين هذا الشهر، برجاء المتابعة المنزلية.",
    tone: "warning",
  },
];

export const leaderboard: LeaderboardEntry[] = [
  { rank: 1, student_id: "st-2", student_name: "سارة عادل إبراهيم", points: 2110 },
  { rank: 2, student_id: "st-6", student_name: "ملك أشرف زكي", points: 1990 },
  { rank: 3, student_id: "st-1", student_name: "أحمد محمود السيد", points: 1840 },
  { rank: 4, student_id: "st-4", student_name: "منة الله طارق", points: 1620 },
  { rank: 5, student_id: "st-5", student_name: "عمر حسام الدين", points: 1275 },
];

/* ---------------- Analytics ---------------- */

export const revenueSeries: RevenuePoint[] = [
  { month: "مارس", revenue: 218000, expenses: 96000, profit: 122000 },
  { month: "أبريل", revenue: 246000, expenses: 101000, profit: 145000 },
  { month: "مايو", revenue: 231000, expenses: 99000, profit: 132000 },
  { month: "يونيو", revenue: 268000, expenses: 104000, profit: 164000 },
  { month: "يوليو", revenue: 294000, expenses: 112000, profit: 182000 },
  { month: "أغسطس", revenue: 316000, expenses: 118000, profit: 198000 },
];

export const attendanceSeries: AttendancePoint[] = [
  { day: "السبت", present: 212, absent: 18 },
  { day: "الأحد", present: 198, absent: 24 },
  { day: "الإثنين", present: 231, absent: 12 },
  { day: "الثلاثاء", present: 187, absent: 29 },
  { day: "الأربعاء", present: 205, absent: 16 },
  { day: "الخميس", present: 176, absent: 33 },
];

export const performanceSeries: PerformancePoint[] = [
  { subject: "فيزياء", avg: 88 },
  { subject: "كيمياء", avg: 81 },
  { subject: "رياضيات", avg: 74 },
  { subject: "أحياء", avg: 86 },
  { subject: "إنجليزي", avg: 79 },
];

export const studentAttendanceSeries: AttendancePoint[] = [
  { day: "أسبوع 1", present: 4, absent: 0 },
  { day: "أسبوع 2", present: 3, absent: 1 },
  { day: "أسبوع 3", present: 4, absent: 0 },
  { day: "أسبوع 4", present: 4, absent: 0 },
];
