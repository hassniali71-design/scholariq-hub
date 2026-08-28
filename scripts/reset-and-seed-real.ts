/**
 * إعادة ضبط قاعدة البيانات الحقيقية:
 *  1) حذف مركز اختبار العزل نهائياً.
 *  2) تصفير كل البيانات الوهمية للمركزين الحقيقيين (سنتر النخبة + سنتر المتفوقين).
 *  3) بناء بيانات تسجيل حقيقية لكل مركز على حدة: 6 مراحل ابتدائية، 10 طلاب لكل مرحلة،
 *     مدرس لكل مادة، مجموعات، وحسابات دخول (كود + كلمة سر) للطلاب والمدرسين.
 *
 * لا يتم إدخال أي درجات/حضور/دفعات — دي بتتسجل من الاستخدام الحي.
 *
 *   bun run scripts/reset-and-seed-real.ts
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.ERP_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.ERP_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("ERP_SUPABASE_URL / ERP_SUPABASE_SERVICE_ROLE_KEY missing");
const db = createClient(url, key, { auth: { persistSession: false } });

const ISOLATION_CENTER = "ctr-isolation-test";

const DATA_TABLES = [
  "assessment_scores",
  "book_exercise_tasks",
  "suggested_activities",
  "electronic_homeworks",
  "session_events",
  "random_pick_logs",
  "timer_extensions",
  "session_questions",
  "lesson_slides",
  "session_records",
  "lessons",
  "quiz_results",
  "homework_tasks",
  "whatsapp_logs",
  "teacher_notes",
  "live_scores",
  "shift_closures",
  "attendance_records",
  "payments",
  "booklets",
  "curriculum_lessons",
  "curriculum_units",
  "students",
  "groups",
  "grade_subjects",
  "teachers",
  "grades",
  "subjects",
] as const;

interface CenterPlan {
  id: string;
  prefix: string;
  studentBase: number;
  teacherBase: number;
  firstNames: string[];
  fatherNames: string[];
  familyNames: string[];
  teacherNames: Record<string, string>;
  rooms: string[];
}

const SUBJECTS = [
  { key: "arabic", name: "اللغة العربية", theme: "arabic" },
  { key: "english", name: "اللغة الإنجليزية", theme: "english" },
  { key: "math", name: "الرياضيات", theme: "math" },
  { key: "science", name: "العلوم", theme: "science" },
  { key: "social", name: "الدراسات الاجتماعية", theme: "social" },
];

const GRADES = [
  "الصف الأول الابتدائي",
  "الصف الثاني الابتدائي",
  "الصف الثالث الابتدائي",
  "الصف الرابع الابتدائي",
  "الصف الخامس الابتدائي",
  "الصف السادس الابتدائي",
];

const WEEKDAYS = ["السبت", "الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس"];
const TIMES = ["٢:٠٠ م", "٣:٣٠ م", "٥:٠٠ م", "٦:٣٠ م"];

const PLANS: CenterPlan[] = [
  {
    id: "ctr-0001",
    prefix: "NKH",
    studentBase: 1001,
    teacherBase: 101,
    firstNames: [
      "أحمد", "محمود", "يوسف", "عمر", "كريم", "مصطفى", "زياد", "آدم", "حمزة", "سيف",
      "ملك", "جنى", "حبيبة", "نور", "سلمى", "مريم", "لمار", "رودينا", "تالia", "فريدة",
    ],
    fatherNames: ["محمد", "علي", "إبراهيم", "سعيد", "طارق", "هشام", "أشرف", "ماهر", "رمضان", "صلاح"],
    familyNames: ["السيد", "عبد الرحمن", "الشناوي", "زكي", "الجندي", "فتحي", "عبد اللطيف", "الحسيني", "شاهين", "منصور"],
    teacherNames: {
      arabic: "أ. سامح عبد الحميد",
      english: "أ. داليا مجدي",
      math: "أ. وليد الشربيني",
      science: "أ. هبة عاطف",
      social: "أ. رأفت السيد",
    },
    rooms: ["قاعة النيل", "قاعة الأمل", "قاعة النجاح", "قاعة الفجر"],
  },
  {
    id: "ctr-1787005507750",
    prefix: "MTF",
    studentBase: 5001,
    teacherBase: 501,
    firstNames: [
      "طه", "بلال", "أنس", "خالد", "مازن", "جاد", "رضوى", "هنا", "لينا", "بسملة",
      "علياء", "شهد", "ريم", "دنيا", "آية", "منة الله", "عبد الله", "إياد", "فارس", "مالك",
    ],
    fatherNames: ["عادل", "ياسر", "جمال", "نبيل", "عصام", "شريف", "مدحت", "رضا", "سمير", "حسام"],
    familyNames: ["البدري", "قنديل", "عثمان", "الديب", "سليمان", "الغريب", "بدوي", "خليفة", "الطوخي", "صادق"],
    teacherNames: {
      arabic: "أ. نجلاء فوزي",
      english: "أ. مينا رفعت",
      math: "أ. أيمن قطب",
      science: "أ. سحر لبيب",
      social: "أ. تامر عياد",
    },
    rooms: ["قاعة المتفوقين", "قاعة الإبداع", "قاعة الرواد", "قاعة التميز"],
  },
];

async function wipe(centerId: string) {
  for (const table of DATA_TABLES) {
    const { error } = await db.from(table).delete().eq("center_id", centerId);
    if (error) console.warn(`  ! ${table}: ${error.message}`);
  }
  const { error } = await db.from("accounts").delete().eq("center_id", centerId).neq("role", "owner");
  if (error) console.warn(`  ! accounts: ${error.message}`);
  console.log(`  ✓ wiped ${centerId}`);
}

async function insert(table: string, rows: unknown[]) {
  if (rows.length === 0) return;
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await db.from(table).upsert(rows.slice(i, i + 200), { onConflict: "id" });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
  console.log(`  ✓ ${table} (${rows.length})`);
}

function subjectsForGradeIndex(i: number) {
  return i < 3 ? SUBJECTS.slice(0, 3) : SUBJECTS;
}

/** توزيع واقعي: مش كل طالب مشترك في كل المواد المتاحة لمرحلته. */
function enrolledSubjects(available: typeof SUBJECTS, seed: number) {
  const min = available.length <= 3 ? 1 : 2;
  const count = min + (seed % (available.length - min + 1));
  const start = seed % available.length;
  const picked: typeof SUBJECTS = [];
  for (let k = 0; k < count; k++) picked.push(available[(start + k) % available.length]!);
  return picked;
}

async function seedCenter(plan: CenterPlan) {
  console.log(`Seeding ${plan.id}`);
  await wipe(plan.id);

  const subjects = SUBJECTS.map((s) => ({
    id: `${plan.prefix}-subj-${s.key}`,
    center_id: plan.id,
    name: s.name,
    theme_key: s.theme,
  }));
  const grades = GRADES.map((name, i) => ({
    id: `${plan.prefix}-grade-${i + 1}`,
    center_id: plan.id,
    name,
    order: i + 1,
  }));
  const gradeSubjects: Record<string, unknown>[] = [];
  grades.forEach((g, i) => {
    subjectsForGradeIndex(i).forEach((s) => {
      gradeSubjects.push({
        id: `${plan.prefix}-gs-${i + 1}-${s.key}`,
        center_id: plan.id,
        grade_id: g.id,
        subject_id: `${plan.prefix}-subj-${s.key}`,
      });
    });
  });

  const teachers = SUBJECTS.map((s, i) => ({
    id: `${plan.prefix}-tch-${s.key}`,
    center_id: plan.id,
    user_id: `${plan.prefix}-T${plan.teacherBase + i}`,
    full_name: plan.teacherNames[s.key]!,
    subject: s.name,
    subject_id: `${plan.prefix}-subj-${s.key}`,
    groups: 0,
    students: 0,
    timer_compliance: 0,
    sla_breaches: 0,
    monthly_revenue: 0,
  }));

  const groups: Record<string, unknown>[] = [];
  grades.forEach((g, gi) => {
    subjectsForGradeIndex(gi).forEach((s, si) => {
      groups.push({
        id: `${plan.prefix}-gr-${gi + 1}-${s.key}`,
        center_id: plan.id,
        name: `${s.name} — ${g.name}`,
        subject: s.name,
        subject_id: `${plan.prefix}-subj-${s.key}`,
        teacher_name: plan.teacherNames[s.key]!,
        teacher_id: `${plan.prefix}-tch-${s.key}`,
        grade: g.name,
        grade_id: g.id,
        weekday: WEEKDAYS[(gi + si) % WEEKDAYS.length]!,
        time: TIMES[(gi + si) % TIMES.length]!,
        room: plan.rooms[(gi + si) % plan.rooms.length]!,
        enrolled: 0,
        capacity: 20,
      });
    });
  });

  const students: Record<string, unknown>[] = [];
  const accounts: Record<string, unknown>[] = [];
  const now = new Date().toISOString();
  const enrolledCount = new Map<string, number>();
  const subjectStudents = new Map<string, number>();

  let n = 0;
  grades.forEach((g, gi) => {
    const available = subjectsForGradeIndex(gi);
    for (let k = 0; k < 10; k++) {
      const first = plan.firstNames[(gi * 10 + k) % plan.firstNames.length]!;
      const father = plan.fatherNames[(gi * 3 + k) % plan.fatherNames.length]!;
      const family = plan.familyNames[(gi * 7 + k * 3) % plan.familyNames.length]!;
      const fullName = `${first} ${father} ${family}`;
      const code = `${plan.prefix}-S${plan.studentBase + n}`;
      const password = `${plan.prefix.toLowerCase()}${plan.studentBase + n}`;
      const picked = enrolledSubjects(available, gi * 10 + k * 3 + 1);
      const primary = picked[0]!;
      const groupId = `${plan.prefix}-gr-${gi + 1}-${primary.key}`;
      enrolledCount.set(groupId, (enrolledCount.get(groupId) ?? 0) + 1);
      picked.forEach((s) =>
        subjectStudents.set(s.key, (subjectStudents.get(s.key) ?? 0) + 1),
      );

      students.push({
        id: `${plan.prefix}-st-${plan.studentBase + n}`,
        center_id: plan.id,
        code,
        full_name: fullName,
        grade: g.name,
        group_name: `${primary.name} — ${g.name}`,
        group_id: groupId,
        guardian_name: `${father} ${family}`,
        guardian_phone: `010${String(20000000 + plan.studentBase + n).slice(0, 8)}`,
        payment_status: "pending",
        balance_due: 0,
        points: 0,
        attendance_rate: 0,
        avg_score: 0,
        subject_ids: picked.map((s) => `${plan.prefix}-subj-${s.key}`),
      });
      accounts.push({
        id: `acc-${code}`,
        center_id: plan.id,
        role: "student",
        full_name: fullName,
        phone: `010${String(20000000 + plan.studentBase + n).slice(0, 8)}`,
        identifier: code,
        password,
        created_at: now,
      });
      n++;
    }
  });

  groups.forEach((g) => {
    g.enrolled = enrolledCount.get(g.id as string) ?? 0;
  });
  teachers.forEach((t, i) => {
    const key = SUBJECTS[i]!.key;
    t.groups = groups.filter((g) => g.subject_id === t.subject_id).length;
    t.students = subjectStudents.get(key) ?? 0;
  });

  teachers.forEach((t, i) => {
    accounts.push({
      id: `acc-${t.user_id}`,
      center_id: plan.id,
      role: "teacher",
      full_name: t.full_name,
      phone: `011${String(30000000 + plan.teacherBase + i).slice(0, 8)}`,
      identifier: t.user_id,
      password: `${plan.prefix.toLowerCase()}${plan.teacherBase + i}`,
      created_at: now,
    });
  });

  await insert("subjects", subjects);
  await insert("grades", grades);
  await insert("grade_subjects", gradeSubjects);
  await insert("teachers", teachers);
  await insert("groups", groups);
  await insert("students", students);
  await insert("accounts", accounts);
}

async function main() {
  console.log("Deleting isolation-test center…");
  const { error } = await db.from("centers").delete().eq("id", ISOLATION_CENTER);
  if (error) console.warn(`  ! centers: ${error.message}`);
  else console.log("  ✓ deleted");

  for (const plan of PLANS) await seedCenter(plan);
  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
