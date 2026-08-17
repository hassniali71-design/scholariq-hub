import { CURRENT_TENANT, students as seedStudents, teachers as seedTeachers } from "@/lib/mock-data";
import { createAccount, deleteAccount as deleteAccountFn, fetchAccounts, signIn as signInFn } from "@/lib/auth-functions.server";
import type { UserRole } from "@/types";

/**
 * Client-side provisioning + session layer.
 *
 * SUPABASE_MIGRATION_SPEC.md §5: same public API as before, now backed by Supabase behind
 * `USE_SUPABASE` (mirrors data-store.ts's flag — flip both together). Accounts themselves
 * moved to the `accounts` table (§2); the `Session` (which role/identifier THIS browser
 * currently believes it's logged in as) stays in localStorage either way — it's just local
 * UI state, not a security boundary. The real boundary is server-side: every server function
 * re-resolves `center_id` from `identifier` itself (src/lib/supabase-server.ts), never trusts
 * the client. No public sign-up: every account is still created by the Owner (or, for a new
 * center itself, by the platform admin — §8).
 */
export const USE_SUPABASE = true;

export interface Account {
  id: string;
  center_id: string;
  role: UserRole;
  full_name: string;
  phone?: string | null;
  /** Owner: email. Teacher/Staff: code. Student/Parent: student ID. Visitor: invite code. */
  identifier: string;
  /** Owner / Teacher / Staff only. */
  password?: string | null;
  created_at: string;
}

export interface Session {
  role: UserRole;
  full_name: string;
  identifier: string;
  /** §8: this account's center_id is the reserved "platform" row — routes to /platform/new-center. */
  isPlatformAdmin?: boolean;
}

/**
 * Same recurring-staleness bug as data-store.ts's STORAGE_KEY (see its comment):
 * `readAccounts` never re-seeds once a key has been used, so every `.slice(0, N)`
 * bump here (4→5 teachers, 6→8→13 students, across several past changes) landed
 * unbumped — real browsers kept old account lists with missing teacher/student
 * logins indefinitely. Fingerprinting the actual seed content instead of a
 * manually-remembered version number closes this permanently.
 */
function fingerprintAccountSeed(): string {
  const raw = JSON.stringify([seedStudents, seedTeachers]);
  let hash = 5381;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash * 33) ^ raw.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

const ACCOUNTS_KEY = `erp.accounts.v2.${fingerprintAccountSeed()}`;
const SESSION_KEY = "erp.session.v1";

export const DEMO_OWNER = {
  email: "owner@center.com",
  password: "admin123456",
};

const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function subscribeAuth(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function readAccounts(): Account[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(ACCOUNTS_KEY);
  if (raw) {
    try {
      return JSON.parse(raw) as Account[];
    } catch {
      /* fall through to seed */
    }
  }
  const seeded = seedAccounts();
  window.localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(seeded));
  return seeded;
}

function writeAccounts(accounts: Account[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  emit();
}

/** Exported so scripts/seed-supabase.ts can reuse the exact same seed logic. */
export function seedAccounts(): Account[] {
  const c = CURRENT_TENANT.center_id;
  const now = new Date().toISOString();
  const list: Account[] = [
    {
      id: "acc-owner",
      center_id: c,
      role: "owner",
      full_name: "مالك السنتر",
      identifier: DEMO_OWNER.email,
      password: DEMO_OWNER.password,
      created_at: now,
    },
  ];

  seedStudents.slice(0, 13).forEach((s, i) => {
    list.push({
      id: `acc-std-${i}`,
      center_id: c,
      role: "student",
      full_name: s.full_name,
      phone: s.guardian_phone,
      identifier: s.code,
      created_at: now,
    });
  });

  seedTeachers.slice(0, 5).forEach((t, i) => {
    list.push({
      id: `acc-tch-${i}`,
      center_id: c,
      role: "teacher",
      full_name: t.full_name,
      identifier: `TCH-${2001 + i}`,
      password: `tch${1000 + i}`,
      created_at: now,
    });
  });

  list.push({
    id: "acc-stf-0",
    center_id: c,
    role: "staff",
    full_name: "منى عبد الرحمن",
    identifier: "STF-3001",
    password: "stf1000",
    created_at: now,
  });

  return list;
}

export async function getAccounts(): Promise<Account[]> {
  if (USE_SUPABASE) {
    const identifier = getSession()?.identifier;
    if (!identifier) return [];
    return (await fetchAccounts({ data: { identifier } })) as Account[];
  }
  return readAccounts();
}

/* ---------------- Code generators (local-mode only — Supabase mode generates server-side) ---------------- */

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

export function generatePassword() {
  return `${randAlpha(4)}${rand(4)}`;
}

function uniqueIdentifier(prefix: string, digits: number) {
  const existing = new Set(readAccounts().map((a) => a.identifier));
  let candidate = `${prefix}-${rand(digits)}`;
  while (existing.has(candidate)) candidate = `${prefix}-${rand(digits)}`;
  return candidate;
}

/* ---------------- Provisioning (Owner only) ---------------- */

export interface CreatedCredentials {
  role: UserRole;
  full_name: string;
  identifier: string;
  password?: string | undefined;
}

function push(account: Account) {
  writeAccounts([...readAccounts(), account]);
}

function requireIdentifier(): string {
  const identifier = getSession()?.identifier;
  if (!identifier) throw new Error("لازم تسجّل الدخول الأول");
  return identifier;
}

export async function createStudent(full_name: string, phone: string): Promise<CreatedCredentials> {
  if (USE_SUPABASE) {
    const result = await createAccount({
      data: { identifier: requireIdentifier(), role: "student", full_name, phone },
    });
    emit();
    return result;
  }
  const identifier = uniqueIdentifier("STD", 5);
  push({
    id: `acc-${Date.now()}`,
    center_id: CURRENT_TENANT.center_id,
    role: "student",
    full_name,
    phone,
    identifier,
    created_at: new Date().toISOString(),
  });
  return { role: "student", full_name, identifier };
}

export async function createTeacher(full_name: string, phone: string): Promise<CreatedCredentials> {
  if (USE_SUPABASE) {
    const result = await createAccount({
      data: { identifier: requireIdentifier(), role: "teacher", full_name, phone },
    });
    emit();
    return result;
  }
  const identifier = uniqueIdentifier("TCH", 4);
  const password = generatePassword();
  push({
    id: `acc-${Date.now()}`,
    center_id: CURRENT_TENANT.center_id,
    role: "teacher",
    full_name,
    phone,
    identifier,
    password,
    created_at: new Date().toISOString(),
  });
  return { role: "teacher", full_name, identifier, password };
}

export async function createStaff(full_name: string, phone: string): Promise<CreatedCredentials> {
  if (USE_SUPABASE) {
    const result = await createAccount({
      data: { identifier: requireIdentifier(), role: "staff", full_name, phone },
    });
    emit();
    return result;
  }
  const identifier = uniqueIdentifier("STF", 4);
  const password = generatePassword();
  push({
    id: `acc-${Date.now()}`,
    center_id: CURRENT_TENANT.center_id,
    role: "staff",
    full_name,
    phone,
    identifier,
    password,
    created_at: new Date().toISOString(),
  });
  return { role: "staff", full_name, identifier, password };
}

export async function createVisitorInvite(): Promise<CreatedCredentials> {
  if (USE_SUPABASE) {
    const result = await createAccount({
      data: { identifier: requireIdentifier(), role: "visitor", full_name: "زائر مدعو" },
    });
    emit();
    return result;
  }
  const identifier = `VIS-${randAlpha(6)}`;
  push({
    id: `acc-${Date.now()}`,
    center_id: CURRENT_TENANT.center_id,
    role: "visitor",
    full_name: "زائر مدعو",
    identifier,
    created_at: new Date().toISOString(),
  });
  return { role: "visitor", full_name: "زائر مدعو", identifier };
}

export async function deleteAccount(id: string): Promise<void> {
  if (USE_SUPABASE) {
    await deleteAccountFn({ data: { identifier: requireIdentifier(), accountId: id } });
    emit();
    return;
  }
  writeAccounts(readAccounts().filter((a) => a.id !== id));
}

/* ---------------- Session ---------------- */

export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export function signOut() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SESSION_KEY);
  emit();
}

export interface LoginInput {
  role: UserRole;
  identifier: string;
  password?: string;
}

export type LoginResult = { ok: true; session: Session } | { ok: false; error: string };

export async function signIn({ role, identifier, password }: LoginInput): Promise<LoginResult> {
  const id = identifier.trim();
  if (!id) return { ok: false, error: "من فضلك أدخل بيانات الدخول" };

  const needsPassword = role === "owner" || role === "teacher" || role === "staff";
  if (needsPassword && !password?.trim()) {
    return { ok: false, error: "كلمة السر مطلوبة" };
  }

  if (USE_SUPABASE) {
    const result = await signInFn({ data: { role, identifier: id, password } });
    if (result.ok) {
      window.localStorage.setItem(SESSION_KEY, JSON.stringify(result.session));
      emit();
    }
    return result;
  }

  // Parent authenticates with the student ID of their child.
  const lookupRole: UserRole = role === "parent" ? "student" : role;
  const account = readAccounts().find(
    (a) => a.role === lookupRole && a.identifier.toLowerCase() === id.toLowerCase(),
  );

  if (!account) return { ok: false, error: "الكود أو البريد غير صحيح" };
  if (needsPassword && account.password !== password?.trim()) {
    return { ok: false, error: "كلمة السر غير صحيحة" };
  }

  const session: Session = {
    role,
    full_name: role === "parent" ? `ولي أمر ${account.full_name}` : account.full_name,
    identifier: account.identifier,
  };
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  emit();
  return { ok: true, session };
}
