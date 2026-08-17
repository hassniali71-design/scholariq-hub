import { createServerFn } from "@tanstack/react-start";

import { getSupabaseAdmin, resolveCenterId } from "@/lib/supabase-server";
import type { UserRole } from "@/types";

/**
 * SUPABASE_MIGRATION_SPEC.md §2 — `accounts` mirrors auth.ts's current `Account` shape
 * exactly, just backed by Supabase instead of localStorage now.
 */
interface AccountRow {
  id: string;
  center_id: string;
  role: UserRole;
  full_name: string;
  phone: string | null;
  identifier: string;
  password: string | null;
  created_at: string;
}

/** §8's onboarding screen — reserved, not a real client. Seeded once, see supabase/seed/. */
const PLATFORM_CENTER_ID = "platform";

function rand(len: number) {
  let out = "";
  for (let i = 0; i < len; i += 1) out += Math.floor(Math.random() * 10);
  return out;
}
function randAlpha(len: number) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i += 1) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}
function generatePassword() {
  return `${randAlpha(4)}${rand(4)}`;
}

async function uniqueIdentifier(prefix: string, digits: number) {
  const supabase = getSupabaseAdmin();
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = `${prefix}-${rand(digits)}`;
    const { data } = await supabase.from("accounts").select("id").eq("identifier", candidate).maybeSingle();
    if (!data) return candidate;
  }
  throw new Error("تعذّر توليد كود فريد — حاول مرة أخرى");
}

export const signIn = createServerFn({ method: "POST" })
  .validator((data: { role: UserRole; identifier: string; password?: string | undefined }) => data)
  .handler(async ({ data }) => {
    const identifier = data.identifier.trim();
    if (!identifier) return { ok: false as const, error: "من فضلك أدخل بيانات الدخول" };

    const needsPassword = data.role === "owner" || data.role === "teacher" || data.role === "staff";
    if (needsPassword && !data.password?.trim()) {
      return { ok: false as const, error: "كلمة السر مطلوبة" };
    }

    // Parent authenticates with the student ID of their child — same lookup as auth.ts.
    const lookupRole: UserRole = data.role === "parent" ? "student" : data.role;
    const supabase = getSupabaseAdmin();
    const { data: account } = await supabase
      .from("accounts")
      .select("*")
      .eq("role", lookupRole)
      .ilike("identifier", identifier)
      .maybeSingle<AccountRow>();

    if (!account) return { ok: false as const, error: "الكود أو البريد غير صحيح" };
    if (needsPassword && account.password !== data.password?.trim()) {
      return { ok: false as const, error: "كلمة السر غير صحيحة" };
    }

    return {
      ok: true as const,
      session: {
        role: data.role,
        full_name: data.role === "parent" ? `ولي أمر ${account.full_name}` : account.full_name,
        identifier: account.identifier,
        isPlatformAdmin: account.center_id === PLATFORM_CENTER_ID,
      },
    };
  });

export const fetchAccounts = createServerFn({ method: "GET" })
  .validator((data: { identifier: string }) => data)
  .handler(async ({ data }) => {
    const centerId = await resolveCenterId(data.identifier);
    const supabase = getSupabaseAdmin();
    const { data: rows, error } = await supabase
      .from("accounts")
      .select("*")
      .eq("center_id", centerId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []) as AccountRow[];
  });

export const createAccount = createServerFn({ method: "POST" })
  .validator(
    (data: {
      identifier: string; // caller's own session identifier — provisioning is owner/staff-only, enforced by the UI route guard same as today
      role: "student" | "teacher" | "staff" | "visitor";
      full_name: string;
      phone?: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const centerId = await resolveCenterId(data.identifier);
    const supabase = getSupabaseAdmin();

    const prefixByRole = { student: "STD", teacher: "TCH", staff: "STF", visitor: "VIS" } as const;
    const digitsByRole = { student: 5, teacher: 4, staff: 4, visitor: 0 } as const;
    const needsPassword = data.role === "teacher" || data.role === "staff";

    const newIdentifier =
      data.role === "visitor" ? `VIS-${randAlpha(6)}` : await uniqueIdentifier(prefixByRole[data.role], digitsByRole[data.role]);
    const password = needsPassword ? generatePassword() : undefined;

    const row: AccountRow = {
      id: `acc-${Date.now()}`,
      center_id: centerId,
      role: data.role,
      full_name: data.full_name,
      phone: data.phone ?? null,
      identifier: newIdentifier,
      password: password ?? null,
      created_at: new Date().toISOString(),
    };

    const { error } = await supabase.from("accounts").insert(row);
    if (error) throw new Error(error.message);

    return { role: data.role, full_name: data.full_name, identifier: newIdentifier, password };
  });

export const deleteAccount = createServerFn({ method: "POST" })
  .validator((data: { identifier: string; accountId: string }) => data)
  .handler(async ({ data }) => {
    const centerId = await resolveCenterId(data.identifier);
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("accounts")
      .delete()
      .eq("id", data.accountId)
      .eq("center_id", centerId);
    if (error) throw new Error(error.message);
  });

/**
 * SUPABASE_MIGRATION_SPEC.md §8 — client onboarding. Deliberately reuses the existing
 * accounts/login mechanism instead of a new auth system: the caller must already be logged
 * in as the one seeded account whose `center_id` is the reserved "platform" row (never a
 * real client's center) — see supabase/seed/ for that seeded identifier/password. This is
 * an explicit, server-verified check, not just a hidden route.
 */
export const createCenter = createServerFn({ method: "POST" })
  .validator(
    (data: {
      identifier: string; // caller's own session — must resolve to the platform center
      centerName: string;
      phone: string;
      address: string;
    }) => data,
  )
  .handler(async ({ data }) => {
    const callerCenterId = await resolveCenterId(data.identifier);
    if (callerCenterId !== PLATFORM_CENTER_ID) {
      throw new Error("هذا الحساب غير مصرَّح له بإضافة عملاء جدد");
    }

    const supabase = getSupabaseAdmin();
    const newCenterId = `ctr-${Date.now()}`;
    const { error: centerError } = await supabase.from("centers").insert({
      id: newCenterId,
      name: data.centerName,
      branch: data.address,
    });
    if (centerError) throw new Error(centerError.message);

    // §8-2: username = first.second_name + random digits (e.g. "ahmed.mahmoud47568").
    const nameParts = data.centerName.trim().split(/\s+/).filter(Boolean);
    const slug = (nameParts[0] ?? "admin").toLowerCase().replace(/[^a-z؀-ۿ]/g, "");
    const identifier = `${slug}.admin${rand(5)}`;
    const password = `${randAlpha(5)}${rand(3)}`;

    const { error: accountError } = await supabase.from("accounts").insert({
      id: `acc-${Date.now()}`,
      center_id: newCenterId,
      role: "owner",
      full_name: `مالك ${data.centerName}`,
      phone: data.phone,
      identifier,
      password,
      created_at: new Date().toISOString(),
    });
    if (accountError) throw new Error(accountError.message);

    return { centerId: newCenterId, identifier, password };
  });
