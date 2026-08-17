/**
 * SUPABASE_MIGRATION_SPEC.md §4 — one-time migration + seed. Run manually once the
 * migrations in supabase/migrations/ have been applied to the live project:
 *
 *   bun run scripts/seed-supabase.ts
 *
 * Imports the actual mock-data.ts / auth.ts seed arrays (source of truth) instead of
 * hand-transcribing values into SQL, so every seeded row matches the app's current demo
 * data exactly (§4: "تأكد من مطابقة كل قيمة seed للبيانات الحالية بالضبط").
 *
 * Also creates the reserved "platform" center + its one owner account (used by
 * createCenter in src/lib/server/auth-functions.ts to gate §8's onboarding screen), and —
 * for §9's mandatory isolation proof — a second, separate demo center with its own
 * distinctly-named test student, fully isolated from the first.
 */
import { createClient } from "@supabase/supabase-js";

import {
  CURRENT_TENANT,
  attendanceToday,
  booklets,
  curriculumLessons,
  curriculumUnits,
  gradeSubjects,
  grades,
  groups,
  homeworkTasks,
  lessonSlides,
  payments,
  quizResults,
  sessionQuestions,
  students,
  subjects,
  teacherNotes,
  teachers,
  whatsappLogs,
} from "../src/lib/mock-data";
import { seedAccounts } from "../src/lib/auth";

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing — check .env");
}
const supabase = createClient(url, serviceRoleKey);

// Upsert (not insert) so the script is safe to re-run while iterating on it.
async function insertAll(table: string, rows: unknown[], onConflict = "id") {
  if (rows.length === 0) return;
  const { error } = await supabase.from(table).upsert(rows, { onConflict });
  if (error) throw new Error(`${table}: ${error.message}`);
  console.log(`  ✓ ${table} (${rows.length})`);
}

async function seedMainDemoCenter() {
  console.log(`Seeding main demo center: ${CURRENT_TENANT.center_id}`);
  await insertAll("centers", [
    { id: CURRENT_TENANT.center_id, name: CURRENT_TENANT.name, branch: CURRENT_TENANT.branch },
  ]);
  await insertAll("subjects", subjects);
  await insertAll("grades", grades);
  await insertAll(
    "grade_subjects",
    gradeSubjects.map((gs) => ({ ...gs, center_id: CURRENT_TENANT.center_id })),
  );
  await insertAll("teachers", teachers);
  await insertAll("groups", groups);
  await insertAll("students", students);
  await insertAll("curriculum_units", curriculumUnits);
  await insertAll(
    "curriculum_lessons",
    curriculumLessons.map((cl) => ({ ...cl, center_id: CURRENT_TENANT.center_id })),
  );
  await insertAll(
    "attendance_records",
    attendanceToday.map((a) => ({ ...a, session_id: null })),
  );
  await insertAll("payments", payments);
  await insertAll("booklets", booklets);
  await insertAll(
    "lesson_slides",
    lessonSlides.map((s) => ({ ...s, center_id: CURRENT_TENANT.center_id })),
  );
  await insertAll(
    "session_questions",
    sessionQuestions.map((q) => ({ ...q, center_id: CURRENT_TENANT.center_id })),
  );
  await insertAll("quiz_results", quizResults);
  await insertAll("homework_tasks", homeworkTasks);
  await insertAll("whatsapp_logs", whatsappLogs);
  await insertAll("teacher_notes", teacherNotes);
  await insertAll("accounts", seedAccounts());
}

const PLATFORM_CENTER_ID = "platform";

async function seedPlatformAdmin() {
  console.log("Seeding platform-admin (system operator, not a real client)");
  await insertAll("centers", [{ id: PLATFORM_CENTER_ID, name: "System Platform Admin", branch: "-" }]);
  await insertAll("accounts", [
    {
      id: "acc-platform-owner",
      center_id: PLATFORM_CENTER_ID,
      role: "owner",
      full_name: "مدير المنصة",
      phone: null,
      identifier: "PLATFORM-ADMIN",
      password: "Pl@tform-2026!",
      created_at: new Date().toISOString(),
    },
  ]);
  console.log("  Platform admin login: PLATFORM-ADMIN / Pl@tform-2026!  — CHANGE THIS PASSWORD after first login.");
}

/** §9 — a second, independent, minimal tenant with one distinctly-named student. */
async function seedIsolationTestCenter() {
  const centerId = "ctr-isolation-test";
  console.log(`Seeding §9 isolation-test center: ${centerId}`);
  await insertAll("centers", [{ id: centerId, name: "مركز الاختبار الثاني (عزل البيانات)", branch: "فرع تجريبي" }]);
  await insertAll("subjects", [{ id: "isotest-subj-1", center_id: centerId, name: "مادة اختبار", theme_key: "math" }]);
  await insertAll("grades", [{ id: "isotest-grade-1", center_id: centerId, name: "صف اختبار", order: 1 }]);
  await insertAll("teachers", [
    {
      id: "isotest-tch-1",
      center_id: centerId,
      user_id: "TCH-ISOTEST",
      full_name: "مدرس مركز الاختبار",
      subject: "مادة اختبار",
      subject_id: "isotest-subj-1",
      groups: 1,
      students: 1,
      timer_compliance: 0,
      sla_breaches: 0,
      monthly_revenue: 0,
    },
  ]);
  await insertAll("groups", [
    {
      id: "isotest-gr-1",
      center_id: centerId,
      name: "مجموعة الاختبار",
      subject: "مادة اختبار",
      subject_id: "isotest-subj-1",
      teacher_name: "مدرس مركز الاختبار",
      teacher_id: "isotest-tch-1",
      grade: "صف اختبار",
      grade_id: "isotest-grade-1",
      weekday: "السبت",
      time: "١٠:٠٠ ص",
      room: "قاعة اختبار",
      enrolled: 1,
      capacity: 10,
    },
  ]);
  await insertAll("students", [
    {
      id: "isotest-st-1",
      center_id: centerId,
      code: "STD-ISOTEST2",
      full_name: "طالب مميز — مركز الاختبار الثاني",
      grade: "صف اختبار",
      group_name: "مجموعة الاختبار",
      group_id: "isotest-gr-1",
      guardian_name: "ولي أمر الاختبار",
      guardian_phone: "01000000000",
      payment_status: "paid",
      balance_due: 0,
      points: 0,
      attendance_rate: 100,
      avg_score: 0,
      subject_ids: ["isotest-subj-1"],
    },
  ]);
  await insertAll("accounts", [
    {
      id: "acc-isotest-owner",
      center_id: centerId,
      role: "owner",
      full_name: "مالك مركز الاختبار الثاني",
      phone: null,
      identifier: "owner.isotest",
      password: "IsoTest#2026",
      created_at: new Date().toISOString(),
    },
    {
      id: "acc-isotest-std-1",
      center_id: centerId,
      role: "student",
      full_name: "طالب مميز — مركز الاختبار الثاني",
      phone: "01000000000",
      identifier: "STD-ISOTEST2",
      password: null,
      created_at: new Date().toISOString(),
    },
  ]);
  console.log("  Center 2 owner login: owner.isotest / IsoTest#2026");
  console.log("  Center 2 student login: STD-ISOTEST2 (no password)");
}

/** §4 — a distinctly-named student in the MAIN demo center too, so both sides of the §9 proof are unambiguous. */
async function seedIsolationTestStudentInMainCenter() {
  await insertAll("students", [
    {
      id: "st-isotest-main",
      center_id: CURRENT_TENANT.center_id,
      code: "STD-ISOTEST1",
      full_name: "طالب مميز — سنتر النخبة (المركز الأول)",
      grade: students[0]!.grade,
      group_name: students[0]!.group_name,
      group_id: students[0]!.group_id,
      guardian_name: "ولي أمر الاختبار",
      guardian_phone: "01000000001",
      payment_status: "paid",
      balance_due: 0,
      points: 0,
      attendance_rate: 100,
      avg_score: 0,
      subject_ids: students[0]!.subject_ids,
    },
  ]);
  await insertAll("accounts", [
    {
      id: "acc-isotest-std-main",
      center_id: CURRENT_TENANT.center_id,
      role: "student",
      full_name: "طالب مميز — سنتر النخبة (المركز الأول)",
      phone: "01000000001",
      identifier: "STD-ISOTEST1",
      password: null,
      created_at: new Date().toISOString(),
    },
  ]);
  console.log("  Center 1 isolation-test student login: STD-ISOTEST1 (no password)");
}

async function main() {
  await seedPlatformAdmin();
  await seedMainDemoCenter();
  await seedIsolationTestStudentInMainCenter();
  await seedIsolationTestCenter();
  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
