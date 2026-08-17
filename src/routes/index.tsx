import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { GraduationCap, Info, LogIn, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ROLES, ROLE_ORDER } from "@/config/roles";
import { DEMO_OWNER, signIn } from "@/lib/auth";
import type { UserRole } from "@/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "تسجيل الدخول — منصة إدارة السناتر التعليمية" },
      {
        name: "description",
        content:
          "بوابة دخول موحدة وآمنة للمالك والسكرتارية والمدرسين والطلاب وأولياء الأمور والزوار.",
      },
      { property: "og:title", content: "تسجيل الدخول — منصة إدارة السناتر التعليمية" },
      {
        property: "og:description",
        content: "بوابة دخول موحدة وآمنة لجميع أدوار السنتر التعليمي بدون تسجيل ذاتي.",
      },
    ],
  }),
  component: LoginGate,
});

const identifierLabel: Record<UserRole, string> = {
  owner: "البريد الإلكتروني",
  teacher: "كود المدرس",
  staff: "كود الموظف",
  student: "كود الطالب (Student ID)",
  parent: "كود الطالب الخاص بابنك",
  visitor: "كود دعوة الزائر",
};

const identifierPlaceholder: Record<UserRole, string> = {
  owner: "owner@center.com",
  teacher: "TCH-2001",
  staff: "STF-3001",
  student: "STD-10234",
  parent: "STD-10234",
  visitor: "VIS-ABC123",
};

function needsPassword(role: UserRole) {
  return role === "owner" || role === "teacher" || role === "staff";
}

function LoginGate() {
  const navigate = useNavigate();
  const [role, setRole] = useState<UserRole>("owner");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    const result = await signIn({ role, identifier, password });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      toast.error(result.error);
      return;
    }
    setError(null);
    toast.success(`مرحباً ${result.session.full_name}`);
    navigate({ to: result.session.isPlatformAdmin ? "/platform/new-center" : ROLES[role].home });
  }

  function useDemoOwner() {
    setRole("owner");
    setIdentifier(DEMO_OWNER.email);
    setPassword(DEMO_OWNER.password);
    toast.info("تم تعبئة بيانات المالك التجريبية");
  }

  return (
    <div dir="rtl" className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-md">
        <div className="card-crisp overflow-hidden">
          <div className="flex flex-col items-center gap-3 bg-navy px-6 py-8 text-navy-foreground">
            <span className="flex size-16 items-center justify-center rounded-2xl bg-white/15">
              <GraduationCap className="size-9" />
            </span>
            <div className="text-center">
              {/* This login page is shared by every client (SUPABASE_MIGRATION_SPEC.md §8 —
                  one URL for all centers), so it can't show a specific tenant's name before
                  the identifier/password resolve which one — that only becomes known after
                  signing in (see AppShell, which shows the real center dynamically). */}
              <p className="text-xl font-black">منصة إدارة السناتر التعليمية</p>
            </div>
            <p className="rounded-xl bg-white/10 px-3 py-1.5 text-[11px] font-black text-white/80">
              نظام ERP و LMS متكامل — دخول آمن بدون تسجيل ذاتي
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 p-6">
            <h1 className="text-2xl font-black text-foreground">تسجيل الدخول</h1>

            <div className="space-y-1.5">
              <label htmlFor="role" className="block text-sm font-extrabold text-foreground">
                نوع الحساب
              </label>
              <select
                id="role"
                value={role}
                onChange={(e) => {
                  setRole(e.target.value as UserRole);
                  setIdentifier("");
                  setPassword("");
                  setError(null);
                }}
                className="w-full rounded-xl border-2 border-border bg-background px-4 py-3 text-base font-extrabold text-foreground outline-none focus:border-primary"
              >
                {ROLE_ORDER.map((r) => (
                  <option key={r} value={r}>
                    {ROLES[r].title}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="identifier" className="block text-sm font-extrabold text-foreground">
                {identifierLabel[role]}
              </label>
              <input
                id="identifier"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder={identifierPlaceholder[role]}
                autoComplete="off"
                className="w-full rounded-xl border-2 border-border bg-background px-4 py-3 text-base font-extrabold text-foreground outline-none placeholder:font-bold placeholder:text-muted-foreground focus:border-primary"
              />
            </div>

            {needsPassword(role) ? (
              <div className="space-y-1.5">
                <label htmlFor="password" className="block text-sm font-extrabold text-foreground">
                  كلمة السر
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full rounded-xl border-2 border-border bg-background px-4 py-3 text-base font-extrabold text-foreground outline-none focus:border-primary"
                />
              </div>
            ) : null}

            {error ? (
              <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm font-extrabold text-destructive">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-navy px-5 py-3.5 text-base font-black text-navy-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              <LogIn className="size-5" />
              {submitting ? "جارٍ الدخول…" : "دخول"}
            </button>

            <div className="rounded-xl border-2 border-dashed border-border bg-muted/60 p-4">
              <p className="flex items-center gap-2 text-xs font-black text-foreground">
                <Info className="size-4 text-primary" />
                حساب المالك التجريبي
              </p>
              <p className="mt-1.5 font-mono text-sm font-black text-foreground">
                {DEMO_OWNER.email}
              </p>
              <p className="font-mono text-sm font-black text-foreground">{DEMO_OWNER.password}</p>
              <button
                type="button"
                onClick={useDemoOwner}
                className="mt-3 w-full rounded-lg border-2 border-navy px-3 py-2 text-xs font-black text-navy transition-colors hover:bg-navy hover:text-navy-foreground"
              >
                تعبئة البيانات تلقائياً
              </button>
            </div>

            <p className="flex items-center justify-center gap-1.5 text-center text-xs font-bold text-muted-foreground">
              <ShieldCheck className="size-4" />
              الحسابات تُنشأ من لوحة المالك فقط — لا يوجد تسجيل ذاتي
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
