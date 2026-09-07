/**
 * إعادة توليد أكواد الدخول لكل الحسابات الحقيقية الموجودة فعلاً في قاعدة البيانات
 * (طلب صريح من صاحب المشروع لمرحلة التجربة): كل حساب (مالك سنتر / مدرس / موظف /
 * طالب) يُعاد تسميته بصيغة PREFIX-XXXX مبنية من اسمه الحقيقي المخزَّن بالفعل +
 * كلمة سر جديدة من 4 أرقام. حساب المالك العام للمنصة (center_id = "platform")
 * مستثنى تماماً ولا يُلمس إطلاقاً. حسابات الزائر (role = visitor) مستثناة أيضاً
 * (آلية دعوة منفصلة بلا كلمة سر، مش جزء من هذا التعديل).
 *
 * ⚠️ عملية لا رجعة فيها على الأكواد القديمة: بعد التشغيل، كل الأكواد/كلمات السر
 * القديمة تتوقف عن العمل فوراً لكل من تم تجديد كوده. اطبع/احفظ المخرجات (فيها
 * الكود الجديد وكلمة السر الجديدة لكل شخص) قبل إغلاق الترمينال.
 *
 * ⚠️ هذا الملف لم يُشغَّل من هذه الجلسة — الصندوق الحالي (sandbox) مفيش عنده
 * وصول لمفتاح Supabase الحقيقي ولا اتصال شبكة بقاعدة البيانات الفعلية. لازم
 * يتشغل من بيئة فيها ERP_SUPABASE_URL / ERP_SUPABASE_SERVICE_ROLE_KEY حقيقيين.
 *
 * التشغيل:
 *   bun run scripts/regenerate-friendly-identifiers.ts
 *
 * آمن لإعادة التشغيل جزئياً: لو السكريبت وقف في نص الطريق، الحسابات اللي
 * اتجدّدت فعلاً هتتجدد تاني بكود مختلف لو اتشغل تاني (مش idempotent بالكامل)،
 * لذلك الأفضل تشغيله مرة واحدة ومراجعة المخرجات كاملة.
 */
import { createClient } from "@supabase/supabase-js";

import { buildNameCode, generateSimplePassword, ROLE_PREFIX } from "../src/lib/identifier-gen";

const url = process.env.ERP_SUPABASE_URL ?? process.env.SUPABASE_URL;
const serviceRoleKey =
  process.env.ERP_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  throw new Error("ERP_SUPABASE_URL / ERP_SUPABASE_SERVICE_ROLE_KEY missing — راجع .env");
}
const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

const PLATFORM_CENTER_ID = "platform";

interface AccountRow {
  id: string;
  center_id: string;
  role: "owner" | "staff" | "teacher" | "student" | "parent" | "visitor";
  full_name: string;
  identifier: string;
}

async function isIdentifierTaken(candidate: string): Promise<boolean> {
  const { data } = await supabase
    .from("accounts")
    .select("id")
    .eq("identifier", candidate)
    .maybeSingle();
  return !!data;
}

async function uniqueFriendlyIdentifier(prefix: string, fullName: string): Promise<string> {
  const base = buildNameCode(fullName);
  for (let attempt = 1; attempt < 50; attempt += 1) {
    const candidate = attempt === 1 ? `${prefix}-${base}` : `${prefix}-${base}${attempt}`;
    if (!(await isIdentifierTaken(candidate))) return candidate;
  }
  throw new Error(`تعذّر توليد كود فريد لـ "${fullName}"`);
}

/** يحدّث عمود نصي في جدول معيّن من القيمة القديمة للجديدة، بلا كسر لو الجدول/العمود مش موجود. */
async function renameEverywhere(table: string, column: string, oldValue: string, newValue: string) {
  const { error, count } = await supabase
    .from(table)
    .update({ [column]: newValue }, { count: "exact" })
    .eq(column, oldValue);
  if (error) {
    console.warn(`    ! ${table}.${column}: ${error.message}`);
    return;
  }
  if (count) console.log(`    ↳ ${table}.${column}: ${count} صف`);
}

async function regenerateOne(
  account: AccountRow,
): Promise<{ identifier: string; password: string } | null> {
  if (account.role === "visitor") return null;
  const prefix = ROLE_PREFIX[account.role as keyof typeof ROLE_PREFIX];
  if (!prefix) return null; // parent ليس له حساب مستقل أصلاً

  const oldIdentifier = account.identifier;
  const newIdentifier = await uniqueFriendlyIdentifier(prefix, account.full_name);
  const newPassword = generateSimplePassword();

  // تحديث كل مكان بيخزّن نسخة من الكود القديم (denormalized) قبل تحديث accounts نفسه.
  if (account.role === "teacher") {
    await renameEverywhere("teachers", "user_id", oldIdentifier, newIdentifier);
    await renameEverywhere("groups", "teacher_user_id", oldIdentifier, newIdentifier);
    await renameEverywhere("payroll_records", "person_id", oldIdentifier, newIdentifier);
  } else if (account.role === "student") {
    await renameEverywhere("students", "code", oldIdentifier, newIdentifier);
    await renameEverywhere("payments", "student_code", oldIdentifier, newIdentifier);
    await renameEverywhere("booklet_sales", "student_code", oldIdentifier, newIdentifier);
  } else if (account.role === "staff") {
    await renameEverywhere("staff_permissions", "account_identifier", oldIdentifier, newIdentifier);
    await renameEverywhere("paper_credits", "staff_id", oldIdentifier, newIdentifier);
    await renameEverywhere("paper_transactions", "staff_id", oldIdentifier, newIdentifier);
    await renameEverywhere("safe_handovers", "staff_identifier", oldIdentifier, newIdentifier);
    await renameEverywhere("payroll_records", "person_id", oldIdentifier, newIdentifier);
  }

  const { error } = await supabase
    .from("accounts")
    .update({ identifier: newIdentifier, password: newPassword })
    .eq("id", account.id);
  if (error) throw new Error(`accounts/${account.id}: ${error.message}`);

  return { identifier: newIdentifier, password: newPassword };
}

async function main() {
  const { data: accounts, error } = await supabase
    .from("accounts")
    .select("id, center_id, role, full_name, identifier")
    .neq("center_id", PLATFORM_CENTER_ID)
    .order("center_id", { ascending: true });
  if (error) throw new Error(error.message);
  if (!accounts?.length) {
    console.log("لا يوجد حسابات لتجديدها (غير حساب المنصة).");
    return;
  }

  console.log(`\nإعادة توليد ${accounts.length} حساب (بخلاف حساب المنصة)...\n`);
  const results: {
    center: string;
    role: string;
    name: string;
    old: string;
    new: string;
    password: string;
  }[] = [];

  for (const account of accounts as AccountRow[]) {
    const result = await regenerateOne(account);
    if (!result) continue;
    results.push({
      center: account.center_id,
      role: account.role,
      name: account.full_name,
      old: account.identifier,
      new: result.identifier,
      password: result.password,
    });
    console.log(
      `  ✓ [${account.center_id}] ${account.full_name} (${account.role}): ${account.identifier} → ${result.identifier} / ${result.password}`,
    );
  }

  console.log("\n=== ملخّص نهائي — احفظ الجدول ده قبل غلق الترمينال ===\n");
  console.table(results);
  console.log(`\nتم تجديد ${results.length} حساب. حساب المنصة لم يُلمس، وحسابات الزائر لم تُلمس.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
