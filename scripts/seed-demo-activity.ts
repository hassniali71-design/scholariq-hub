/**
 * يبني طبقة نشاط واقعية كاملة فوق الهيكل الموجود بالفعل لمركز "سنتر المتفوقين" فقط
 * (ctr-1787005507750) — لا يلمس "سنتر النخبة" (العميل الحقيقي) إطلاقاً، ليكون المركز
 * جاهزاً لعرض حي: حضور تاريخي، مدفوعات، درجات تقييم، واجبات مُطلَقة مع محاولات طلاب،
 * رسائل واتساب، ونقاط/معدلات محدَّثة فعلياً على صفوف الطلاب أنفسهم.
 *
 * الشرط: لازم `scripts/reset-and-seed-real.ts` يكون اتشغّل قبل كده على نفس المركز
 * (بيبني الهيكل: المواد/الصفوف/المدرسين/المجموعات/الطلاب). هذا السكربت لا يبني أي
 * هيكل جديد — فقط يضيف/يجدّد طبقة النشاط، وقابل لإعادة التشغيل بأمان (يمسح نشاطه
 * القديم لنفس المركز فقط قبل ما يعيد بناءه).
 *
 * لازم أيضاً Migration 0031 يكون اتنفّذ في Supabase SQL Editor قبل تشغيل هذا
 * السكربت — بيصحّح teacher_launches.teacher_id ليشاور على teachers(id) بدل
 * accounts(id)، وهذا السكربت بيسجّل إطلاقات فعلية بمعرّف المدرس (teachers.id).
 * بدونها هيفشل إدخال جدول teacher_launches بخطأ foreign key violation.
 *
 *   bun run scripts/seed-demo-activity.ts
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.ERP_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.ERP_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("ERP_SUPABASE_URL / ERP_SUPABASE_SERVICE_ROLE_KEY missing");
const db = createClient(url, key, { auth: { persistSession: false } });

const CENTER_ID = "ctr-1787005507750"; // سنتر المتفوقين — فقط
const SESSIONS_PER_GROUP = 6;
const MONTHLY_FEE_PER_SUBJECT = 150;
const PAYMENT_METHODS = ["cash", "wallet", "instapay", "bank_transfer", "fawry"] as const;
// القيم المسموحة فعلياً في قيد whatsapp_logs.template (0005_operations.sql) —
// 'award'/'alert' موجودة في النوع (types/index.ts) لكن بلا قيد CHECK مطابق بعد.
const WHATSAPP_TEMPLATES = ["attendance", "payment", "grade", "homework", "absence"] as const;

const ACTIVITY_TABLES = [
  "whatsapp_logs",
  "homework_attempts",
  "teacher_launches",
  "assessment_scores",
  "attendance_records",
  "session_records",
  "homework_tasks",
  "quiz_results",
  "payments",
] as const;

interface Row {
  [key: string]: unknown;
}

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}
function randInt(min: number, max: number) {
  return Math.floor(rand(min, max + 1));
}
function pick<T>(arr: readonly T[]): T {
  return arr[randInt(0, arr.length - 1)]!;
}
function daysAgo(n: number, hour: number, minute: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, minute, 0, 0);
  return d;
}

async function wipeActivity() {
  for (const table of ACTIVITY_TABLES) {
    const { error } = await db.from(table).delete().eq("center_id", CENTER_ID);
    if (error) console.warn(`  ! wipe ${table}: ${error.message}`);
  }
  console.log("  ✓ wiped previous demo activity");
}

async function insert(table: string, rows: Row[]) {
  if (rows.length === 0) return;
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await db.from(table).upsert(rows.slice(i, i + 200), { onConflict: "id" });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
  console.log(`  ✓ ${table} (${rows.length})`);
}

async function update(table: string, id: string, patch: Row) {
  const { error } = await db.from(table).update(patch).eq("id", id).eq("center_id", CENTER_ID);
  if (error) throw new Error(`${table} update ${id}: ${error.message}`);
}

async function main() {
  console.log(`Building demo activity for ${CENTER_ID}…`);

  const [
    { data: groups, error: gErr },
    { data: students, error: sErr },
    { data: subjects, error: subErr },
  ] = await Promise.all([
    db.from("groups").select("*").eq("center_id", CENTER_ID),
    db.from("students").select("*").eq("center_id", CENTER_ID),
    db.from("subjects").select("*").eq("center_id", CENTER_ID),
  ]);
  if (gErr) throw new Error(gErr.message);
  if (sErr) throw new Error(sErr.message);
  if (subErr) throw new Error(subErr.message);
  if (!groups?.length || !students?.length) {
    throw new Error(
      "لا يوجد هيكل مبني لهذا المركز بعد — شغّل scripts/reset-and-seed-real.ts أولاً.",
    );
  }
  const subjectNameById = new Map((subjects ?? []).map((s) => [s.id as string, s.name as string]));

  await wipeActivity();

  const sessionRecords: Row[] = [];
  const attendanceRecords: Row[] = [];
  const assessmentScores: Row[] = [];
  const teacherLaunches: Row[] = [];
  const homeworkAttempts: Row[] = [];
  const homeworkTasks: Row[] = [];
  const quizResults: Row[] = [];
  const whatsappLogs: Row[] = [];
  const payments: Row[] = [];

  // تراكم لكل طالب: نحدّث صفه في `students` بالأرقام الحقيقية المشتقة من كل ده.
  const studentStats = new Map<
    string,
    { present: number; total: number; scoreSum: number; scoreCount: number; points: number }
  >();
  for (const st of students) {
    studentStats.set(st.id as string, {
      present: 0,
      total: 0,
      scoreSum: 0,
      scoreCount: 0,
      points: 0,
    });
  }

  for (const group of groups) {
    const groupStudents = students.filter((s) => s.group_id === group.id);
    if (groupStudents.length === 0) continue;

    // --- جلسات سابقة + حضور + تقييمات ---
    const sessionIds: string[] = [];
    for (let i = SESSIONS_PER_GROUP; i >= 1; i--) {
      const sessionDate = daysAgo(i * 7, 15, 0);
      const sessionId = `sess-demo-${group.id}-${i}`;
      sessionIds.push(sessionId);

      let attendeesCount = 0;
      let absenteesCount = 0;
      let questionsAsked = 0;

      for (const student of groupStudents) {
        const stats = studentStats.get(student.id as string)!;
        const roll = Math.random();
        const status = roll < 0.78 ? "present" : roll < 0.9 ? "late" : "absent";
        if (status !== "absent") attendeesCount++;
        else absenteesCount++;
        stats.total++;
        if (status !== "absent") stats.present++;

        attendanceRecords.push({
          id: `att-demo-${sessionId}-${student.id}`,
          center_id: CENTER_ID,
          student_id: student.id,
          student_name: student.full_name,
          group_name: group.name,
          status,
          checked_in_at: daysAgo(i * 7, 15, randInt(0, 15)).toISOString(),
          method: "manual",
          session_id: sessionId,
        });

        if (status === "absent") continue;

        // درجة واجب لكل حصة تقريباً (85%) — قيمة من 5 إلى 10.
        if (Math.random() < 0.85) {
          const value = randInt(5, 10);
          assessmentScores.push({
            id: `asc-demo-hw-${sessionId}-${student.id}`,
            center_id: CENTER_ID,
            student_id: student.id,
            session_id: sessionId,
            lesson_id: null,
            category: "homework",
            source: "auto",
            value,
            max_value: 10,
            recorded_by_teacher_id: group.teacher_id,
            recorded_at: daysAgo(i * 7, 15, 20).toISOString(),
          });
          stats.scoreSum += (value / 10) * 100;
          stats.scoreCount++;
          stats.points += value * 5;
        }

        // مشاركة سؤال عشوائي (45% فرصة لكل طالب لكل حصة).
        if (Math.random() < 0.45) {
          const correct = Math.random() < 0.7;
          questionsAsked++;
          assessmentScores.push({
            id: `asc-demo-q-${sessionId}-${student.id}`,
            center_id: CENTER_ID,
            student_id: student.id,
            session_id: sessionId,
            lesson_id: null,
            category: "question",
            source: "auto",
            value: correct ? 10 : 0,
            max_value: 10,
            recorded_by_teacher_id: group.teacher_id,
            recorded_at: daysAgo(i * 7, 15, 25).toISOString(),
          });
          if (correct) stats.points += 50;
        }
      }

      sessionRecords.push({
        id: sessionId,
        center_id: CENTER_ID,
        group_id: group.id,
        lesson_id: null,
        teacher_id: group.teacher_id,
        date: sessionDate.toLocaleDateString("ar-EG", { numberingSystem: "latn" }),
        attendees_count: attendeesCount,
        absentees_count: absenteesCount,
        questions_asked_count: questionsAsked,
        participants_count: attendeesCount,
        homework_launch_status: "sent",
        e_homework_launch_status: i % 2 === 0 ? "sent" : "not_sent",
        activity_completed_in_session: i % 3 === 0,
        duration_seconds: randInt(2400, 3000),
        explanation_duration_seconds: randInt(900, 1200),
        extension_seconds: 0,
        general_notes: null,
      });
    }

    // --- إطلاقات (واجبات/مراجعات) + محاولات الطلاب ---
    const launchTitles: { title: string; type: string }[] = [
      { title: "واجب مراجعة الوحدة الأولى", type: "homework" },
      { title: "اختبار إلكتروني قصير", type: "online_quiz" },
    ];
    launchTitles.forEach((lt, li) => {
      const launchId = `lch-demo-${group.id}-${li}`;
      const createdAt = daysAgo((li + 1) * 10, 16, 0);
      teacherLaunches.push({
        id: launchId,
        center_id: CENTER_ID,
        group_id: group.id,
        teacher_id: group.teacher_id,
        launch_type: lt.type,
        title: lt.title,
        body: null,
        notes: null,
        due_at: daysAgo((li + 1) * 10 - 2, 23, 59).toISOString(),
        duration_min: lt.type === "online_quiz" ? 20 : null,
        source_launch_id: null,
        created_at: createdAt.toISOString(),
        file_data: null,
        file_name: null,
        file_mime: null,
      });

      for (const student of groupStudents) {
        const roll = Math.random();
        if (roll < 0.15) continue; // لسه محدفعش
        const submitted = roll < 0.9;
        const score = submitted ? randInt(6, 10) : null;
        homeworkAttempts.push({
          id: `hwa-demo-${launchId}-${student.id}`,
          center_id: CENTER_ID,
          launch_id: launchId,
          student_id: student.id,
          student_name: student.full_name,
          answer: submitted ? "تم الحل والتسليم" : null,
          score,
          max_score: submitted ? 10 : null,
          submitted_at: daysAgo((li + 1) * 10 - 4, 20, randInt(0, 40)).toISOString(),
        });
        if (score !== null) {
          const stats = studentStats.get(student.id as string)!;
          stats.points += score * 3;
        }
      }
    });

    // --- الجدول القديم homework_tasks (owner-metrics لسه بيقرأ منه لأداء المدرس) ---
    const subjectName = subjectNameById.get(group.subject_id as string) ?? group.subject;
    for (const student of groupStudents) {
      const graded = Math.random() < 0.75;
      homeworkTasks.push({
        id: `hwt-demo-${group.id}-${student.id}`,
        center_id: CENTER_ID,
        student_id: student.id,
        subject: subjectName,
        title: `واجب ${subjectName}`,
        due_date: "الأسبوع الماضي",
        status: graded ? "graded" : "pending",
        grade: graded ? randInt(6, 10) : null,
      });
      quizResults.push({
        id: `quiz-demo-${group.id}-${student.id}`,
        center_id: CENTER_ID,
        student_id: student.id,
        subject: subjectName,
        title: `اختبار الوحدة — ${subjectName}`,
        date: daysAgo(14, 12, 0).toLocaleDateString("ar-EG", { numberingSystem: "latn" }),
        score: randInt(12, 20),
        max_score: 20,
      });
    }
  }

  // --- مدفوعات + رسائل واتساب + تحديث صفوف الطلاب أنفسهم ---
  const centerName = "سنتر المتفوقين";
  for (const student of students) {
    const subjectIds = (student.subject_ids as string[] | null) ?? [];
    const subjectCount = Math.max(1, subjectIds.length);
    const monthlyTotal = subjectCount * MONTHLY_FEE_PER_SUBJECT;

    // الشهر اللي فات: مدفوع بالكامل (95% من الطلاب).
    if (Math.random() < 0.95) {
      payments.push({
        id: `pm-demo-${student.id}-prev`,
        center_id: CENTER_ID,
        student_name: student.full_name,
        student_code: student.code,
        amount: monthlyTotal,
        method: pick(PAYMENT_METHODS),
        item: "اشتراك الشهر الماضي",
        created_at: daysAgo(35, 11, 0).toISOString(),
      });
    }
    // الشهر الحالي: نسبة من الطلاب دفعوا كامل، نسبة جزئي، نسبة لسه محدفعتش.
    const currentRoll = Math.random();
    let paidThisMonth = 0;
    if (currentRoll < 0.6) {
      paidThisMonth = monthlyTotal;
    } else if (currentRoll < 0.85) {
      paidThisMonth = Math.round(monthlyTotal * 0.5);
    }
    if (paidThisMonth > 0) {
      payments.push({
        id: `pm-demo-${student.id}-curr`,
        center_id: CENTER_ID,
        student_name: student.full_name,
        student_code: student.code,
        amount: paidThisMonth,
        method: pick(PAYMENT_METHODS),
        item: "اشتراك الشهر الحالي",
        created_at: daysAgo(randInt(0, 6), 11, 0).toISOString(),
      });
    }
    const balanceDue = Math.max(0, monthlyTotal - paidThisMonth);
    const paymentStatus = balanceDue === 0 ? "paid" : paidThisMonth > 0 ? "pending" : "overdue";

    whatsappLogs.push(
      {
        id: `wa-demo-${student.id}-1`,
        center_id: CENTER_ID,
        student_id: student.id,
        sent_at: daysAgo(2, 16, 0).toISOString(),
        template: "attendance",
        message: `تم تسجيل حضور ${student.full_name} في ${centerName} اليوم.`,
        delivered: true,
      },
      {
        id: `wa-demo-${student.id}-2`,
        center_id: CENTER_ID,
        student_id: student.id,
        sent_at: daysAgo(6, 12, 0).toISOString(),
        template: balanceDue === 0 ? "payment" : "absence",
        message:
          balanceDue === 0
            ? `تم استلام دفعة اشتراك ${student.full_name} بنجاح — شكراً لكم.`
            : `تذكير: يوجد مبلغ متبقٍ ${balanceDue} ج.م على اشتراك ${student.full_name}.`,
        delivered: true,
      },
    );

    const stats = studentStats.get(student.id as string)!;
    const attendanceRate = stats.total > 0 ? Math.round((stats.present / stats.total) * 100) : 0;
    const avgScore = stats.scoreCount > 0 ? Math.round(stats.scoreSum / stats.scoreCount) : 0;

    await update("students", student.id as string, {
      attendance_rate: attendanceRate,
      avg_score: avgScore,
      points: Math.round(stats.points),
      balance_due: balanceDue,
      payment_status: paymentStatus,
    });
  }

  await insert("session_records", sessionRecords);
  await insert("attendance_records", attendanceRecords);
  await insert("assessment_scores", assessmentScores);
  await insert("teacher_launches", teacherLaunches);
  await insert("homework_attempts", homeworkAttempts);
  await insert("homework_tasks", homeworkTasks);
  await insert("quiz_results", quizResults);
  await insert("payments", payments);
  await insert("whatsapp_logs", whatsappLogs);
  console.log(`  ✓ students updated (${students.length})`);

  console.log("\nDone — سنتر المتفوقين جاهز للعرض.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
