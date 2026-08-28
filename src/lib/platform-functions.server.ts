import { createServerFn } from "@tanstack/react-start";

import { getSupabaseAdmin, resolveCenterId } from "@/lib/supabase-server";

/**
 * PLATFORM_CLIENT_MANAGEMENT_SPEC.md — server functions behind `/platform/clients`. Same
 * platform-only gate as `createCenter`/`fetchCenterDataForAdmin` in auth-functions.server.ts /
 * data-functions.server.ts: the caller's own session identifier must resolve to the reserved
 * "platform" center, never a real client's. Kept in a separate file from those two because this
 * is a distinct concern (managing existing clients vs. onboarding a new one / exporting one).
 */
const PLATFORM_CENTER_ID = "platform";

interface ClientCenterRow {
  id: string;
  name: string;
  branch: string;
  slug: string | null;
  accent_color: string | null;
  joined_at: string;
  expires_at: string;
  status: "active" | "paused";
}

export interface ClientListItem extends ClientCenterRow {
  ownerIdentifier: string | null;
  /** §3-4 — latest `accounts.last_login_at` across every account under this center, or null if none has ever logged in. */
  lastActivityAt: string | null;
}

async function assertPlatformCaller(identifier: string) {
  const callerCenterId = await resolveCenterId(identifier);
  if (callerCenterId !== PLATFORM_CENTER_ID) {
    throw new Error("هذا الحساب غير مصرَّح له بإدارة العملاء");
  }
}

/** §2 — "كل العملاء": every real client (never the reserved "platform" row itself). */
export const fetchClients = createServerFn({ method: "GET" })
  .validator((data: { identifier: string }) => data)
  .handler(async ({ data }): Promise<ClientListItem[]> => {
    await assertPlatformCaller(data.identifier);
    const supabase = getSupabaseAdmin();

    const { data: centers, error: centersError } = await supabase
      .from("centers")
      .select("id, name, branch, slug, accent_color, joined_at, expires_at, status")
      .neq("id", PLATFORM_CENTER_ID)
      .order("joined_at", { ascending: false });
    if (centersError) throw new Error(centersError.message);

    const centerIds = (centers ?? []).map((c) => c.id);
    const { data: accounts, error: accountsError } =
      centerIds.length === 0
        ? { data: [], error: null }
        : await supabase
            .from("accounts")
            .select("center_id, role, identifier, last_login_at")
            .in("center_id", centerIds);
    if (accountsError) throw new Error(accountsError.message);

    return (centers ?? []).map((c) => {
      const centerAccounts = (accounts ?? []).filter((a) => a.center_id === c.id);
      const owner = centerAccounts.find((a) => a.role === "owner");
      const lastActivityAt = centerAccounts.reduce<string | null>((latest, a) => {
        if (!a.last_login_at) return latest;
        if (!latest || a.last_login_at > latest) return a.last_login_at as string;
        return latest;
      }, null);
      return { ...c, ownerIdentifier: owner?.identifier ?? null, lastActivityAt };
    });
  });

/**
 * §2 "آلية الإيقاف/التشغيل" — flips `status` only, never touches any other row. A paused
 * center's data stays exactly as-is; `signIn` (auth-functions.server.ts) is what actually
 * rejects logins for it.
 */
export const setClientStatus = createServerFn({ method: "POST" })
  .validator((data: { identifier: string; centerId: string; status: "active" | "paused" }) => data)
  .handler(async ({ data }) => {
    await assertPlatformCaller(data.identifier);
    if (data.centerId === PLATFORM_CENTER_ID) {
      throw new Error("لا يمكن تغيير حالة حساب إدارة المنصة نفسه");
    }
    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("centers")
      .update({ status: data.status })
      .eq("id", data.centerId);
    if (error) throw new Error(error.message);
  });

/** §3-2 — adds a month/year on top of the center's *current* `expires_at`, not from `now()`. */
export const extendClientSubscription = createServerFn({ method: "POST" })
  .validator((data: { identifier: string; centerId: string; unit: "month" | "year" }) => data)
  .handler(async ({ data }) => {
    await assertPlatformCaller(data.identifier);
    const supabase = getSupabaseAdmin();
    const { data: center, error: fetchError } = await supabase
      .from("centers")
      .select("expires_at")
      .eq("id", data.centerId)
      .single();
    if (fetchError || !center) throw new Error("العميل غير موجود");

    const next = new Date(center.expires_at as string);
    if (data.unit === "month") next.setMonth(next.getMonth() + 1);
    else next.setFullYear(next.getFullYear() + 1);

    const { error } = await supabase
      .from("centers")
      .update({ expires_at: next.toISOString() })
      .eq("id", data.centerId);
    if (error) throw new Error(error.message);
    return { expiresAt: next.toISOString() };
  });
