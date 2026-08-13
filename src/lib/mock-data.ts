import type {
  AttendancePoint,
  AttendanceRecord,
  BookletItem,
  CurriculumLesson,
  CurriculumUnit,
  Grade,
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

export const grades: Grade[] = [
  { id: "gd-1", center_id: c, name: "الأول الثانوي", order: 1 },
  { id: "gd-2", center_id: c, name: "الثاني الثانوي", order: 2 },
  { id: "gd-3", center_id: c, name: "الثالث الثانوي", order: 3 },
];

/**
 * Curriculum plan (§9) — دراسات / الثالث الثانوي, matching gr-1.
 * DESIGN_ATMOSPHERE_SPEC.md §0.2 reassigned gr-1's teacher (tc-1) from physics to
 * دراسات, so the physics-specific plan that used to live here (sub-1) no longer
 * makes sense under any subject; replaced with دراسات content under sub-4.
 */
export const curriculumUnits: CurriculumUnit[] = [
  {
    id: "cu-1",
    center_id: c,
    subject_id: "sub-4",
    grade_id: "gd-3",
    name: "الوحدة الأولى — الجغرافيا الطبيعية لمصر",
    order: 1,
    planned_duration_days: 14,
  },
  {
    id: "cu-2",
    center_id: c,
    subject_id: "sub-4",
    grade_id: "gd-3",
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
    grade: "الثالث الثانوي",
    group_name: "دراسات - سبت 4م",
    group_id: "gr-1",
    guardian_name: "محمود السيد",
    guardian_phone: "01001234567",
    payment_status: "paid",
    balance_due: 0,
    points: 1840,
    attendance_rate: 96,
    avg_score: 92,
  },
  {
    id: "st-2",
    center_id: c,
    code: "STD-10235",
    full_name: "سارة عادل إبراهيم",
    grade: "الثالث الثانوي",
    group_name: "علوم - أحد 6م",
    group_id: "gr-2",
    guardian_name: "عادل إبراهيم",
    guardian_phone: "01112345678",
    payment_status: "pending",
    balance_due: 450,
    points: 2110,
    attendance_rate: 99,
    avg_score: 95,
  },
  {
    id: "st-3",
    center_id: c,
    code: "STD-10236",
    full_name: "يوسف خالد منصور",
    grade: "الثاني الثانوي",
    group_name: "إنجليزي - اثنين 5م",
    group_id: "gr-3",
    guardian_name: "خالد منصور",
    guardian_phone: "01223456789",
    payment_status: "overdue",
    balance_due: 900,
    points: 940,
    attendance_rate: 74,
    avg_score: 68,
  },
  {
    id: "st-4",
    center_id: c,
    code: "STD-10237",
    full_name: "منة الله طارق",
    grade: "الثاني الثانوي",
    group_name: "علوم - ثلاثاء 3م",
    group_id: "gr-4",
    guardian_name: "طارق فهمي",
    guardian_phone: "01034567890",
    payment_status: "paid",
    balance_due: 0,
    points: 1620,
    attendance_rate: 91,
    avg_score: 88,
  },
  {
    id: "st-5",
    center_id: c,
    code: "STD-10238",
    full_name: "عمر حسام الدين",
    grade: "الأول الثانوي",
    group_name: "رياضيات - أربعاء 7م",
    group_id: "gr-5",
    guardian_name: "حسام الدين علي",
    guardian_phone: "01145678901",
    payment_status: "pending",
    balance_due: 300,
    points: 1275,
    attendance_rate: 85,
    avg_score: 79,
  },
  {
    id: "st-6",
    center_id: c,
    code: "STD-10239",
    full_name: "ملك أشرف زكي",
    grade: "الثالث الثانوي",
    group_name: "دراسات - سبت 4م",
    group_id: "gr-1",
    guardian_name: "أشرف زكي",
    guardian_phone: "01256789012",
    payment_status: "paid",
    balance_due: 0,
    points: 1990,
    attendance_rate: 97,
    avg_score: 90,
  },
  {
    id: "st-7",
    center_id: c,
    code: "STD-10240",
    full_name: "زياد إبراهيم عبد الله",
    grade: "الثاني الثانوي",
    group_name: "عربي - خميس 5م",
    group_id: "gr-6",
    guardian_name: "إبراهيم عبد الله",
    guardian_phone: "01167890123",
    payment_status: "paid",
    balance_due: 0,
    points: 1510,
    attendance_rate: 93,
    avg_score: 86,
  },
  {
    id: "st-8",
    center_id: c,
    code: "STD-10241",
    full_name: "نور محمد سامي",
    grade: "الثاني الثانوي",
    group_name: "عربي - خميس 5م",
    group_id: "gr-6",
    guardian_name: "محمد سامي",
    guardian_phone: "01278901234",
    payment_status: "pending",
    balance_due: 250,
    points: 1350,
    attendance_rate: 88,
    avg_score: 81,
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
    // Phase 1 default (decision #7): no auth.ts account↔teacher linking yet.
    user_id: null,
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
    user_id: null,
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
    user_id: null,
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
    user_id: null,
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
    user_id: null,
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
    grade: "الثالث الثانوي",
    grade_id: "gd-3",
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
    grade: "الثالث الثانوي",
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
    grade: "الثاني الثانوي",
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
    grade: "الثاني الثانوي",
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
    grade: "الأول الثانوي",
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
    grade: "الثاني الثانوي",
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
 * Declaration order is NOT the on-screen flow order — owner.compliance.tsx maps a
 * separate `stepCompliance` array to this one positionally, so reordering here
 * would silently misalign that page. `SESSION_FLOW` in teacher.session.tsx
 * controls the actual presentation order (lesson → homework → questions → release).
 */
export const SESSION_STEPS: SessionStep[] = [
  {
    key: "homework",
    title: "تقييم الواجب المنزلي ورصد الغياب",
    hint: "رصد سريع لتقييم الواجب وتسجيل حضور/غياب كل طالب بلمسة واحدة",
    duration: 10 * 60,
  },
  {
    key: "lesson",
    title: "الشرح التفاعلي للدرس",
    hint: "عرض الدرس بقالب موحد عالي التباين على الشاشة الذكية",
    duration: 30 * 60,
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
    kind: "truefalse",
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
    kind: "truefalse",
    text: "قاعدة اليد اليمنى تحدد اتجاه المجال المغناطيسي حول السلك.",
    options: ["صح", "خطأ"],
    correct_index: 0,
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
