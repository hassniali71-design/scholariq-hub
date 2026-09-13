/**
 * استيراد طلاب سنتر المتفوقين_سبورة من شيت التسجيلات.
 *
 * يُضيف فقط: سجل الطالب + حساب دخول (كود + كلمة سر) + ربط المواد بالصف عند الحاجة.
 * لا مواعيد، لا مدفوعات، لا درجات — الطلاب في انتظار الحركة الحقيقية.
 *
 *   bun run scripts/import-motafawqeen-sabora.ts /tmp/students.json
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

import { generateFriendlyIdentifier, generateSimplePassword, ROLE_PREFIX } from "../src/lib/identifier-gen";

const url = process.env.ERP_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.ERP_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("SUPABASE env missing");
const db = createClient(url, key, { auth: { persistSession: false } });

const CENTER = "ctr-1789325195831";

const SUBJECT_ALIASES: Record<string, string> = {
  "اللغة العربية": "عربي",
  عربي: "عربي",
  "اللغة الإنجليزية": "إنجليزي",
  "اللغة الانجليزية": "إنجليزي",
  إنجليزي: "إنجليزي",
  الرياضيات: "رياضيات",
  رياضيات: "رياضيات",
  العلوم: "علوم",
  علوم: "علوم",
  "الدراسات الاجتماعية": "دراسات",
  دراسات: "دراسات",
};

interface Row {
  name: string;
  phone: string;
  grade: string;
  subjects: string[];
  total: number;
}

function cleanPhone(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, "");
  if (!digits || digits.replace(/\D/g, "").length < 7) return "";
  return digits;
}

function guardianName(fullName: string): string {
  const w = fullName.trim().split(/\s+/).filter(Boolean);
  return w.slice(1).join(" ") || fullName;
}

async function main() {
  const rows: Row[] = JSON.parse(readFileSync(process.argv[2] ?? "/tmp/students.json", "utf8"));

  const [{ data: grades }, { data: subjects }, { data: gradeSubjects }, { data: accounts }] =
    await Promise.all([
      db.from("grades").select("*").eq("center_id", CENTER),
      db.from("subjects").select("*").eq("center_id", CENTER),
      db.from("grade_subjects").select("*").eq("center_id", CENTER),
      db.from("accounts").select("identifier"),
    ]);

  const taken = new Set((accounts ?? []).map((a) => a.identifier as string));
  const gradeByName = new Map((grades ?? []).map((g) => [g.name as string, g]));
  const subjectByName = new Map((subjects ?? []).map((s) => [s.name as string, s]));
  const gsKeys = new Set((gradeSubjects ?? []).map((g) => `${g.grade_id}|${g.subject_id}`));

  const newGradeSubjects: Record<string, unknown>[] = [];
  const students: Record<string, unknown>[] = [];
  const newAccounts: Record<string, unknown>[] = [];
  const report: Record<string, string>[] = [];
  const now = new Date().toISOString();
  let seq = 0;

  for (const row of rows) {
    const gradeName = row.grade.replace(/^الصف\s+/, "").trim();
    const grade = gradeByName.get(gradeName);
    if (!grade) {
      console.warn(`! صف غير معروف: ${row.grade} (${row.name})`);
      continue;
    }

    const subjIds: string[] = [];
    for (const raw of row.subjects) {
      const name = SUBJECT_ALIASES[raw] ?? raw;
      const subj = subjectByName.get(name);
      if (!subj) {
        console.warn(`! مادة غير معروفة: ${raw} (${row.name})`);
        continue;
      }
      subjIds.push(subj.id as string);
      const k = `${grade.id}|${subj.id}`;
      if (!gsKeys.has(k)) {
        gsKeys.add(k);
        newGradeSubjects.push({
          id: `${CENTER}-gs-${String(grade.id).split("-").pop()}-${String(subj.id).split("-").slice(-2).join("-")}`,
          center_id: CENTER,
          grade_id: grade.id,
          subject_id: subj.id,
        });
      }
    }
    if (subjIds.length === 0) continue;

    const per = Math.round(row.total / subjIds.length);
    const fees: Record<string, number> = {};
    subjIds.forEach((id) => (fees[id] = per));

    const code = generateFriendlyIdentifier(ROLE_PREFIX.student, row.name, (c) => taken.has(c));
    taken.add(code);
    const password = generateSimplePassword();
    const phone = cleanPhone(row.phone);
    seq += 1;
    const id = `st-${Date.now()}-${seq}`;

    students.push({
      id,
      center_id: CENTER,
      code,
      full_name: row.name,
      grade: grade.name,
      group_name: grade.name,
      group_id: null,
      guardian_name: guardianName(row.name),
      guardian_phone: phone,
      payment_status: "pending",
      balance_due: row.total,
      points: 0,
      attendance_rate: 0,
      avg_score: 0,
      subject_ids: subjIds,
      billing_plan: "month",
      billing_mode: "monthly",
      due_day_of_month: 1,
      subject_fees: fees,
    });
    newAccounts.push({
      id: `acc-${id}`,
      center_id: CENTER,
      role: "student",
      full_name: row.name,
      phone,
      identifier: code,
      password,
      created_at: now,
    });
    report.push({
      name: row.name,
      grade: grade.name,
      subjects: row.subjects.join(" / "),
      total: String(row.total),
      code,
      password,
    });
  }

  if (newGradeSubjects.length) {
    const { error } = await db.from("grade_subjects").upsert(newGradeSubjects, { onConflict: "id" });
    if (error) throw new Error(`grade_subjects: ${error.message}`);
    console.log(`✓ grade_subjects +${newGradeSubjects.length}`);
  }
  const { error: se } = await db.from("students").upsert(students, { onConflict: "id" });
  if (se) throw new Error(`students: ${se.message}`);
  console.log(`✓ students +${students.length}`);
  const { error: ae } = await db.from("accounts").upsert(newAccounts, { onConflict: "id" });
  if (ae) throw new Error(`accounts: ${ae.message}`);
  console.log(`✓ accounts +${newAccounts.length}`);

  console.log("\n| الطالب | الصف | المواد | الشهري | الكود | كلمة السر |");
  console.log("|---|---|---|---|---|---|");
  for (const r of report) {
    console.log(`| ${r.name} | ${r.grade} | ${r.subjects} | ${r.total} | ${r.code} | ${r.password} |`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
