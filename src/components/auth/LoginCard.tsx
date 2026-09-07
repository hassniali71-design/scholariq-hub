import { useNavigate } from "@tanstack/react-router";
import { GraduationCap, LogIn, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { ROLES, ROLE_ORDER } from "@/config/roles";
import { signIn } from "@/lib/auth";
import { DEFAULT_TENANT_ACCENT } from "@/lib/tenant-colors";
import type { UserRole } from "@/types";

const identifierLabel: Record<UserRole, string> = {
  owner: "كود المالك",
  teacher: "كود المدرس",
  staff: "كود الموظف",
  student: "كود الطالب (Student ID)",
  parent: "كود الطالب الخاص بابنك",
  visitor: "كود دعوة الزائر",
};

const identifierPlaceholder: Record<UserRole, string> = {
  owner: "OWN-AHFO",
  teacher: "TCH-AHFO",
  staff: "STF-AHFO",
  student: "STD-AHFO",
  parent: "STD-AHFO",
  visitor: "VIS-ABC123",
};

function needsPassword(role: UserRole) {
  // مرحلة التجربة الحالية: كل الأدوار محتاجة كلمة سر حتى الطالب/ولي الأمر.
  return role !== "visitor";
}

/**
 * SUPABASE_MIGRATION_SPEC.md §11-ب — the actual login form, shared by both entry points:
 * `/` (generic, `branding` omitted) and `/login/$slug` (a specific client's own link, name +
 * accent_color known before auth). Same form/logic either way — only the header changes.
 */
export function LoginCard({
  branding,
}: {
  branding?: { name: string; accentColor: string | null } | null;
}) {
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

  return (
    <div dir="rtl" className="flex min-h-screen flex-col items-center justify-center gap-6 bg-canvas px-4 py-10">
      <div className="w-full max-w-md">
        <div className="card-crisp overflow-hidden">
          <div
            className="flex flex-col items-center gap-3 px-6 py-8 text-navy-foreground"
            style={{ backgroundColor: branding?.accentColor ?? DEFAULT_TENANT_ACCENT }}
          >
            <p className="text-sm font-black text-white/90">مرحبا بكم في نظام سبّورة لإدارة السناتر التعليمية</p>
            <span className="flex size-16 items-center justify-center rounded-2xl bg-white/15">
              <GraduationCap className="size-9" />
            </span>
            <div className="text-center">
              {/* Generic `/` is shared by every client (§8 — one URL for all centers), so it
                  can't show a specific tenant's name before auth resolves which one. `/login/$slug`
                  knows exactly which center this is, so it shows the real name here instead. */}
              <p className="text-xl font-black">{branding?.name ?? "منصة إدارة السناتر التعليمية"}</p>
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

            <p className="flex items-center justify-center gap-1.5 text-center text-xs font-bold text-muted-foreground">
              <ShieldCheck className="size-4" />
              الحسابات تُنشأ من لوحة المالك فقط — لا يوجد تسجيل ذاتي
            </p>
          </form>
        </div>
        <p className="mt-4 flex items-center justify-center gap-2 text-xs font-black text-muted-foreground">
          <span>مقدمة من شركة</span>
          <span className="rounded-md border-2 border-primary/40 bg-primary/5 px-2 py-0.5 text-sm font-black text-primary">
            حلول
          </span>
        </p>
      </div>
    </div>
  );
}
