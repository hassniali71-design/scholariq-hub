import { CURRENT_TENANT, students as seedStudents, teachers as seedTeachers } from "@/lib/mock-data";
import type { UserRole } from "@/types";

/**
 * Client-side provisioning + session layer (mock).
 * No public sign-up: every account is created by the Owner.
 * Data is persisted in localStorage so the full auth loop can be tested
 * (owner creates a code -> logout -> login with that code).
 */

export interface Account {
  id: string;
  center_id: string;
  role: UserRole;
  full_name: string;
  phone?: string;
  /** Owner: email. Teacher/Staff: code. Student/Parent: student ID. Visitor: invite code. */
  identifier: string;
  /** Owner / Teacher / Staff only. */
  password?: string;
  created_at: string;
}

export interface Session {
  role: UserRole;
  full_name: string;
  identifier: string;
}

const ACCOUNTS_KEY = "erp.accounts.v1";
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
  return () => listeners.delete(listener);
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

function seedAccounts(): Account[] {
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

  seedStudents.slice(0, 6).forEach((s, i) => {
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

  seedTeachers.slice(0, 4).forEach((t, i) => {
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

export function getAccounts(): Account[] {
  return readAccounts();
}

/* ---------------- Code generators ---------------- */

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
  password?: string;
}

function push(account: Account) {
  writeAccounts([...readAccounts(), account]);
}

export function createStudent(full_name: string, phone: string): CreatedCredentials {
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

export function createTeacher(full_name: string, phone: string): CreatedCredentials {
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

export function createStaff(full_name: string, phone: string): CreatedCredentials {
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

export function createVisitorInvite(): CreatedCredentials {
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

export function deleteAccount(id: string) {
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

export function signIn({ role, identifier, password }: LoginInput): LoginResult {
  const id = identifier.trim();
  if (!id) return { ok: false, error: "من فضلك أدخل بيانات الدخول" };

  const needsPassword = role === "owner" || role === "teacher" || role === "staff";
  if (needsPassword && !password?.trim()) {
    return { ok: false, error: "كلمة السر مطلوبة" };
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
