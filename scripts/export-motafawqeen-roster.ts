/**
 * تقرير قراءة فقط (SELECT بحت — صفر insert/update/delete) لحالة سنتر
 * "المتفوقين_سبورة" الحقيقية الآن: كل المدرسين مجمَّعين حسب المادة، وكل الطلاب
 * بمواد اشتراكهم وكودهم وكلمة سرهم.
 *
 * ⚠️ الملفات المُنتَجة فيها كلمات سر وأرقام تليفون حقيقية لأطفال — لا تُرفع لـ
 * git ولا تُشارك مع أي حد غير مالك السنتر.
 *
 *   bun run scripts/export-motafawqeen-roster.ts
 */
import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const url = process.env.ERP_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.ERP_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("SUPABASE env missing");
const db = createClient(url, key, { auth: { persistSession: false } });

const CENTER = "ctr-1789325195831";

function csvCell(v: string): string {
  return `"${v.replace(/"/g, '""')}"`;
}

async function main() {
  const [
    { data: subjects, error: se },
    { data: teachers, error: te },
    { data: students, error: ste },
    { data: accounts, error: ae },
  ] = await Promise.all([
    db.from("subjects").select("id, name").eq("center_id", CENTER),
    db.from("teachers").select("*").eq("center_id", CENTER),
    db.from("students").select("*").eq("center_id", CENTER),
    db.from("accounts").select("identifier, role, password, phone").eq("center_id", CENTER),
  ]);
  if (se) throw new Error(`subjects: ${se.message}`);
  if (te) throw new Error(`teachers: ${te.message}`);
  if (ste) throw new Error(`students: ${ste.message}`);
  if (ae) throw new Error(`accounts: ${ae.message}`);

  const subjectNameById = new Map((subjects ?? []).map((s) => [s.id as string, s.name as string]));
  const accountByIdentifier = new Map((accounts ?? []).map((a) => [a.identifier as string, a]));

  const stageLabel: Record<string, string> = {
    primary: "ابتدائي",
    prep: "إعدادي",
    secondary: "ثانوي",
  };

  const teacherRows = (teachers ?? []).map((t) => {
    const acc = t.user_id ? accountByIdentifier.get(t.user_id as string) : undefined;
    const subjectName = t.subject_id
      ? (subjectNameById.get(t.subject_id as string) ?? (t.subject as string) ?? "—")
      : (t.subject as string) || "—";
    const stages = ((t.stages as string[] | null) ?? []).map((s) => stageLabel[s] ?? s).join(" + ");
    return {
      name: t.full_name as string,
      subject: subjectName,
      stages: stages || "—",
      identifier: t.user_id ?? "—",
      password: (acc?.password as string) ?? "—",
      phone: (acc?.phone as string) ?? "—",
    };
  });
  teacherRows.sort((a, b) => a.subject.localeCompare(b.subject, "ar"));

  const studentRows = (students ?? []).map((s) => {
    const acc = accountByIdentifier.get(s.code as string);
    const subjectNames = ((s.subject_ids as string[] | null) ?? [])
      .map((id) => subjectNameById.get(id) ?? id)
      .join(" / ");
    const fees = (s.subject_fees as Record<string, number> | null) ?? {};
    const monthlyTotal = Object.values(fees).reduce((sum, v) => sum + (Number(v) || 0), 0);
    return {
      name: s.full_name as string,
      grade: s.grade as string,
      subjects: subjectNames || "—",
      monthly: monthlyTotal || (s.balance_due as number) || 0,
      code: s.code as string,
      password: (acc?.password as string) ?? "—",
      phone: (acc?.phone as string) ?? (s.guardian_phone as string) ?? "—",
    };
  });
  studentRows.sort((a, b) => a.name.localeCompare(b.name, "ar"));

  const lines: string[] = [];
  lines.push(`# تقرير سنتر المتفوقين سبورة — ${new Date().toISOString().slice(0, 10)}`);
  lines.push("");
  lines.push(
    "⚠️ هذا الملف فيه كلمات سر وأرقام تليفون حقيقية — لا يُرفع لـ git ولا يُشارك إلا مع مالك السنتر.",
  );
  lines.push("");
  lines.push(`## المدرسون (${teacherRows.length})`);
  lines.push("");
  lines.push("| الاسم | المادة | المراحل | الكود | كلمة السر | التليفون |");
  lines.push("|---|---|---|---|---|---|");
  for (const r of teacherRows) {
    lines.push(
      `| ${r.name} | ${r.subject} | ${r.stages} | ${r.identifier} | ${r.password} | ${r.phone} |`,
    );
  }
  lines.push("");
  lines.push(`## الطلاب (${studentRows.length})`);
  lines.push("");
  lines.push("| الاسم | الصف | المواد | الاشتراك الشهري | الكود | كلمة السر | تليفون ولي الأمر |");
  lines.push("|---|---|---|---|---|---|---|");
  for (const r of studentRows) {
    lines.push(
      `| ${r.name} | ${r.grade} | ${r.subjects} | ${r.monthly} | ${r.code} | ${r.password} | ${r.phone} |`,
    );
  }
  const markdown = lines.join("\n");

  const csvLines: string[] = [];
  csvLines.push("نوع,الاسم,المادة أو الصف,التفاصيل,الاشتراك/المراحل,الكود,كلمة السر,التليفون");
  for (const r of teacherRows) {
    csvLines.push(
      ["مدرس", r.name, r.subject, "", r.stages, r.identifier, r.password, r.phone]
        .map(csvCell)
        .join(","),
    );
  }
  for (const r of studentRows) {
    csvLines.push(
      ["طالب", r.name, r.grade, r.subjects, String(r.monthly), r.code, r.password, r.phone]
        .map(csvCell)
        .join(","),
    );
  }
  const csv = "﻿" + csvLines.join("\n");

  writeFileSync("/tmp/motafawqeen-roster.md", markdown, "utf8");
  writeFileSync("/tmp/motafawqeen-roster.csv", csv, "utf8");

  console.log(markdown);
  console.log("\n✓ الملفات محفوظة في: /tmp/motafawqeen-roster.md و /tmp/motafawqeen-roster.csv");
  console.log("⚠️ تذكير: لا ترفع الملفين دول لـ git ولا تشاركهم إلا مع مالك السنتر.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
