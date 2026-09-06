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
 *
 * SUPABASE_MIGRATION_SPEC.md §11-ج: gd-7/8/9 (prep stage) added the same way —
 * pure data extension, same id/order pattern, no structural change.
 */
export const grades: Grade[] = [
  { id: "gd-1", center_id: c, name: "الأول الابتدائي", order: 1 },
  { id: "gd-2", center_id: c, name: "الثاني الابتدائي", order: 2 },
  { id: "gd-3", center_id: c, name: "الثالث الابتدائي", order: 3 },
  { id: "gd-4", center_id: c, name: "الرابع الابتدائي", order: 4 },
  { id: "gd-5", center_id: c, name: "الخامس الابتدائي", order: 5 },
  { id: "gd-6", center_id: c, name: "السادس الابتدائي", order: 6 },
  { id: "gd-7", center_id: c, name: "الأول الإعدادي", order: 7 },
  { id: "gd-8", center_id: c, name: "الثاني الإعدادي", order: 8 },
  { id: "gd-9", center_id: c, name: "الثالث الإعدادي", order: 9 },
  { id: "gd-10", center_id: c, name: "الأول الثانوي", order: 10 },
  { id: "gd-11", center_id: c, name: "الثاني الثانوي", order: 11 },
  { id: "gd-12", center_id: c, name: "الثالث الثانوي", order: 12 },
];

/**
 * Which subjects each grade actually studies — data-driven (§8), not a code
 * conditional. 1st-3rd primary: عربي/إنجليزي/رياضيات only. 4th-6th primary adds
 * علوم + دراسات (they split off from "دراسات" as separate subjects starting 4th
 * grade in the real curriculum this center follows).
 */
const CORE_SUBJECT_IDS = ["sub-1", "sub-2", "sub-3"] as const;
const UPPER_PRIMARY_SUBJECT_IDS = ["sub-1", "sub-2", "sub-3", "sub-4", "sub-5"] as const;
/**
 * الإعدادي والثانوي يدرسون نفس المواد (عربي/إنجليزي/رياضيات/علوم/دراسات)
 * — يمكن توسيعها لاحقاً بإضافة فيزياء/كيمياء/أحياء كمواد جديدة في مرجع subjects.
 */
const PREP_SUBJECT_IDS = UPPER_PRIMARY_SUBJECT_IDS;

export const gradeSubjects: GradeSubject[] = grades.flatMap((g) => {
  const subjectIds =
    g.order <= 3
      ? CORE_SUBJECT_IDS
      : g.order <= 9
        ? UPPER_PRIMARY_SUBJECT_IDS
        : PREP_SUBJECT_IDS;
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
  // نقطة بداية نظيفة: لا يوجد طلاب في الـ seed الافتراضي.
  // المالك يضيف كل طالب بنفسه من /owner/access ثم ربطه بمجموعة من /owner/schedule.
  // (المجموعة تُنشأ من الجدولة فقط — الطالب يطابق (صف+مادة) ويلتحق بمجموعة موجودة.)
];

/**
 * §0.3 — Seed مبسّط للتجربة: مدرس واحد فقط (أ. علي حسونة) كمرجع وحيد.
 * كل المراكز الجديدة تبدأ بصفر مدرسين — المالك يضيف كل مدرس بنفسه.
 */
export const teachers: Teacher[] = [
  {
    id: "tc-1",
    center_id: c,
    // Matches auth.ts's seedAccounts (`TCH-${2001 + i}`) at index 0.
    user_id: "TCH-2001",
    full_name: "أ. علي حسونة",
    subject: "دراسات",
    subject_id: "sub-4",
    groups: 1,
    students: 0,
    timer_compliance: 0,
    sla_breaches: 0,
    monthly_revenue: 0,
    stages: ["primary", "prep", "secondary"],
    primary_stage: "primary",
  },
];

export const groups: Group[] = [
  // الـ seed الافتراضي خالٍ من المجموعات — تُنشأ من /owner/schedule فقط.
  // الـ model الجديد: المجموعة = (مدرس + مادة + صف + يوم + ساعة + قاعة) — لا ربط تلقائي بالطلاب.
];

export const attendanceToday: AttendanceRecord[] = [
  // الـ seed الافتراضي خالٍ — السجلات تُنشأ من صفحة المدرس أو بوابة الـ QR.
];

export const payments: PaymentRecord[] = [
  // الـ seed الافتراضي خالٍ — المدفوعات تُسجَّل من الكاشير أو صفحة المالك.
];

export const booklets: BookletItem[] = [
  // مخزون الملازم يدخله المالك من /staff/booklets عند الحاجة.
];

/* ---------------- Session engine ---------------- */

/**
 * CURRICULUM_ENGINE_SPEC.md §13-ج — final confirmed 9-row table (row 8, "حالة
 * النشاط", has no independent timer, so it's not a step here — see
 * SessionRecord.activity_completed_in_session). This REVERSES §3's earlier
 * "lesson first" order — §13-ج is explicit ("أول خطوة، تقييم آخر مرة اتحطت")
 * and is marked "مؤكد نهائياً من صاحب المشروع", so it supersedes §3.
 * Declaration order = on-screen order (owner.compliance.tsx looks up by
 * `step.key`, not position, so this stays safe to reorder).
 */
export const SESSION_STEPS: SessionStep[] = [
  {
    key: "last_homework",
    title: "تقييم واجب الحصة اللي فاتت ورصد الغياب",
    hint: "رصد سريع لتقييم آخر واجب اتحط وتسجيل حضور/غياب كل طالب بلمسة واحدة",
    duration: 10 * 60,
  },
  {
    key: "lesson",
    title: "الشرح التفاعلي للدرس",
    hint: "عرض الدرس بقالب موحد عالي التباين على الشاشة الذكية",
    duration: 25 * 60,
  },
  {
    key: "questions",
    title: "الأنشطة التفاعلية — الأسئلة العشوائية",
    hint: "سحب اسم طالب عشوائياً مع تايمر لكل سؤال",
    duration: 8 * 60,
  },
  {
    key: "book_exercise",
    title: "حل تمارين الكتاب — داخل الحصة",
    hint: "أدخل أرقام الصفحات المطلوب حلها الآن",
    duration: 3 * 60,
  },
  {
    key: "activity_review",
    title: "مراجعة النشاط المقترح",
    hint: "استعراض النشاط المقترح للدرس تمهيداً لإطلاقه — بدون تقييم هنا",
    duration: 3 * 60,
  },
  {
    key: "release_homework",
    title: "إطلاق واجب البيت — تمارين الكتاب",
    hint: "أدخل أرقام الصفحات المطلوبة كواجب منزلي وأرسلها للطلاب",
    duration: 2 * 60,
  },
  {
    key: "release_e_homework",
    title: "إطلاق واجب الويب سايت",
    hint: "تأكيد إتاحة الواجب الإلكتروني للطلاب على المنصة",
    duration: 2 * 60,
  },
  {
    key: "behavior",
    title: "تقييم السلوك",
    hint: "رصد سلوك كل طالب طوال الحصة — آخر خطوة قبل إنهاء الحصة",
    duration: 5 * 60,
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
  // تُنشأ من وضع الحصة عند تقييم الطلاب.
];

export const homeworkTasks: HomeworkTask[] = [
  // تُنشأ من وضع الحصة (إطلاق الواجب) أو من صفحة المدرس.
];

export const whatsappLogs: WhatsAppLog[] = [
  // تُنشأ تلقائياً مع كل حدث (حضور، دفع، تقييم، غياب).
];

export const teacherNotes: TeacherNote[] = [
  // يكتبها المدرس من وضع الحصة أو صفحة التقييمات.
];

export const leaderboard: LeaderboardEntry[] = [
  // يُحسب من نقاط الطلاب الفعلية — لا seed.
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
