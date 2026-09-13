/**
 * استيراد المدرسين + الإدارة لسنتر المتفوقين_سبورة (ورقة "الادارة+المدرسين").
 * حسابات دخول فقط + سجلات مدرسين — بدون مجموعات أو مواعيد أو رواتب مصروفة.
 *
 *   bun run scripts/import-motafawqeen-staff.ts
 */
import { createClient } from "@supabase/supabase-js";

import { generateFriendlyIdentifier, generateSimplePassword, ROLE_PREFIX } from "../src/lib/identifier-gen";

const url = process.env.ERP_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.ERP_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("SUPABASE env missing");
const db = createClient(url, key, { auth: { persistSession: false } });

const CENTER = "ctr-1789325195831";

interface Person {
  name: string;
  role: "teacher" | "staff";
  phone: string;
  stages: ("primary" | "prep")[];
  subject: string | null;
  salary: number;
}

const PEOPLE: Person[] = [
  { name: "علي محمد حسونه", role: "teacher", phone: "01147704295", stages: ["primary", "prep"], subject: "دراسات", salary: 1600 },
  { name: "مينا شارون", role: "teacher", phone: "01002507454", stages: ["primary", "prep"], subject: "رياضيات", salary: 1700 },
  { name: "زمزم حماد محمد", role: "teacher", phone: "01148895619", stages: ["primary", "prep"], subject: "إنجليزي", salary: 2400 },
  { name: "روان حماد محمد", role: "teacher", phone: "01148895619", stages: ["primary"], subject: "رياضيات", salary: 1200 },
  { name: "شيماء حماده", role: "teacher", phone: "01150803659", stages: ["primary"], subject: "عربي", salary: 1200 },
  { name: "مي ايمن ممدوح", role: "staff", phone: "01155075206", stages: ["primary"], subject: null, salary: 1200 },
];

async function main() {
  const [{ data: subjects }, { data: accounts }] = await Promise.all([
    db.from("subjects").select("*").eq("center_id", CENTER),
    db.from("accounts").select("identifier, full_name, center_id"),
  ]);
  const subjectByName = new Map((subjects ?? []).map((s) => [s.name as string, s]));
  const taken = new Set((accounts ?? []).map((a) => a.identifier as string));
  const existingNames = new Set(
    (accounts ?? []).filter((a) => a.center_id === CENTER).map((a) => a.full_name as string),
  );

  const teachers: Record<string, unknown>[] = [];
  const newAccounts: Record<string, unknown>[] = [];
  const report: Record<string, string>[] = [];
  const now = new Date().toISOString();
  let seq = 0;

  for (const p of PEOPLE) {
    if (existingNames.has(p.name)) {
      console.log(`- موجود بالفعل: ${p.name}`);
      continue;
    }
    const prefix = p.role === "teacher" ? ROLE_PREFIX.teacher : ROLE_PREFIX.staff;
    const identifier = generateFriendlyIdentifier(prefix, p.name, (c) => taken.has(c));
    taken.add(identifier);
    const password = generateSimplePassword();
    seq += 1;

    if (p.role === "teacher") {
      const subject = subjectByName.get(p.subject!);
      if (!subject) throw new Error(`مادة غير معروفة: ${p.subject}`);
      teachers.push({
        id: `tc-${Date.now()}-${seq}`,
        center_id: CENTER,
        user_id: identifier,
        full_name: p.name,
        subject: subject.name,
        subject_id: subject.id,
        groups: 0,
        students: 0,
        timer_compliance: 0,
        sla_breaches: 0,
        monthly_revenue: 0,
        stages: p.stages,
        primary_stage: p.stages[0],
        expected_salary_basis: "monthly",
        expected_salary_value: p.salary,
        honorific: "mr",
      });
    }

    newAccounts.push({
      id: `acc-${Date.now()}-${seq}`,
      center_id: CENTER,
      role: p.role,
      full_name: p.name,
      phone: p.phone,
      identifier,
      password,
      created_at: now,
    });
    report.push({
      name: p.name,
      role: p.role === "teacher" ? "مدرس" : "سكرتيرة / إدارة",
      subject: p.subject ?? "—",
      stages: p.stages.map((s) => (s === "primary" ? "ابتدائي" : "إعدادي")).join(" + "),
      salary: String(p.salary),
      identifier,
      password,
    });
  }

  if (teachers.length) {
    const { error } = await db.from("teachers").upsert(teachers, { onConflict: "id" });
    if (error) throw new Error(`teachers: ${error.message}`);
    console.log(`✓ teachers +${teachers.length}`);
  }
  if (newAccounts.length) {
    const { error } = await db.from("accounts").upsert(newAccounts, { onConflict: "id" });
    if (error) throw new Error(`accounts: ${error.message}`);
    console.log(`✓ accounts +${newAccounts.length}`);
  }

  console.log("\n| الاسم | الصفة | المادة | المراحل | الراتب الشهري | الكود | كلمة السر |");
  console.log("|---|---|---|---|---|---|---|");
  for (const r of report) {
    console.log(`| ${r.name} | ${r.role} | ${r.subject} | ${r.stages} | ${r.salary} | ${r.identifier} | ${r.password} |`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
