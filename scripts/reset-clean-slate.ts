/**
 * تصفير كامل للبيانات التشغيلية في المركزين الحقيقيين:
 *  - حذف كل الطلاب وحساباتهم، وكل المدفوعات والحركة المالية والحضور والدرجات.
 *  - تصفير عدادات المجموعات والمدرسين.
 *  - إبقاء الهيكل فقط (مواد / صفوف / مدرسين / مجموعات) عشان نضيف الطلاب بأنفسنا من الواجهة.
 *  - إضافة المرحلة الإعدادية (3 صفوف) لكل مركز مع ربطها بالمواد.
 *
 *   bun run scripts/reset-clean-slate.ts
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.ERP_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.ERP_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("ERP_SUPABASE_URL / ERP_SUPABASE_SERVICE_ROLE_KEY missing");
const db = createClient(url, key, { auth: { persistSession: false } });

const CENTERS = [
  { id: "ctr-0001", prefix: "NKH" },
  { id: "ctr-1787005507750", prefix: "MTF" },
];

/** كل ما هو "حركة" — يُمسح بالكامل. الهيكل (subjects/grades/teachers/groups) يبقى. */
const WIPE_TABLES = [
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
  "expenses",
  "payroll_records",
  "safe_handovers",
  "notifications",
  "activity_log",
  "students",
];

const PREP_GRADES = ["الصف الأول الإعدادي", "الصف الثاني الإعدادي", "الصف الثالث الإعدادي"];
const SUBJECT_KEYS = ["arabic", "english", "math", "science", "social"];

async function main() {
  for (const center of CENTERS) {
    console.log(`\n== ${center.id}`);
    for (const table of WIPE_TABLES) {
      const { error } = await db.from(table).delete().eq("center_id", center.id);
      if (error) console.warn(`  ! ${table}: ${error.message}`);
      else console.log(`  ✓ wiped ${table}`);
    }

    const { error: accErr } = await db
      .from("accounts")
      .delete()
      .eq("center_id", center.id)
      .eq("role", "student");
    if (accErr) console.warn(`  ! accounts: ${accErr.message}`);
    else console.log("  ✓ wiped student accounts");

    const { error: gErr } = await db
      .from("groups")
      .update({ enrolled: 0 })
      .eq("center_id", center.id);
    if (gErr) console.warn(`  ! groups: ${gErr.message}`);

    const { error: tErr } = await db
      .from("teachers")
      .update({ students: 0, monthly_revenue: 0, timer_compliance: 0, sla_breaches: 0 })
      .eq("center_id", center.id);
    if (tErr) console.warn(`  ! teachers: ${tErr.message}`);

    // المرحلة الإعدادية (لا يوجد ثانوي عمداً).
    const gradeRows = PREP_GRADES.map((name, i) => ({
      id: `${center.prefix}-grade-p${i + 1}`,
      center_id: center.id,
      name,
      order: 7 + i,
    }));
    const { error: gradeErr } = await db.from("grades").upsert(gradeRows, { onConflict: "id" });
    if (gradeErr) console.warn(`  ! grades: ${gradeErr.message}`);

    const gsRows = gradeRows.flatMap((g) =>
      SUBJECT_KEYS.map((k) => ({
        id: `${g.id}-${k}`,
        center_id: center.id,
        grade_id: g.id,
        subject_id: `${center.prefix}-subj-${k}`,
      })),
    );
    const { error: gsErr } = await db.from("grade_subjects").upsert(gsRows, { onConflict: "id" });
    if (gsErr) console.warn(`  ! grade_subjects: ${gsErr.message}`);
    else console.log("  ✓ prep-stage grades added");
  }
  console.log("\nDone — clean slate.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
