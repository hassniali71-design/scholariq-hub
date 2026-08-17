import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * SUPABASE_MIGRATION_SPEC.md §3 — server-only. `SUPABASE_SERVICE_ROLE_KEY` must never reach
 * the browser bundle, so this module may only be imported from inside `createServerFn`
 * handler bodies (src/lib/server/*.ts) — never from a route or component file directly.
 */
function assertServerOnly() {
  if (typeof window !== "undefined") {
    throw new Error("supabase-server.ts was imported into client code — this must never happen.");
  }
}

/**
 * `.from(tableName)` is called with plain runtime strings throughout src/lib/server/ (one
 * generic CRUD layer over ~26 tables, see data-functions.ts) instead of a hand-written
 * `Database` type — supabase-js's table-row generics resolve to `never` without one, so the
 * client is intentionally typed loosely here rather than fighting that for every call site.
 */
type AnySupabaseClient = SupabaseClient<any, any, any>;

let client: AnySupabaseClient | null = null;

export function getSupabaseAdmin(): AnySupabaseClient {
  assertServerOnly();
  if (client) return client;

  const url = process.env["SUPABASE_URL"];
  const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing from the server environment (.env).",
    );
  }

  client = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

/**
 * §3 — every server function verifies `center_id` itself instead of trusting a
 * client-supplied value: the browser sends `identifier` (auth.ts's `Session.identifier`,
 * already unique per account — `accounts.identifier unique` in 0001_centers_and_accounts.sql),
 * and this looks up that account's real `center_id` server-side via the service-role
 * client. There is no real Supabase Auth yet (§7, deferred on purpose), so `identifier`
 * is the interim "session" anchor — a client could only spoof it by guessing another
 * center's real identifier string, which is the accepted tradeoff §0/§7 already document.
 */
export async function resolveCenterId(identifier: string): Promise<string> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("accounts")
    .select("center_id")
    .eq("identifier", identifier)
    .single();
  if (error || !data) {
    throw new Error("جلسة غير صالحة — سجّل الدخول من جديد.");
  }
  return data.center_id as string;
}
