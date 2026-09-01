import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { GraduationCap, LogOut } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { getSession, signOut, subscribeAuth, type Session } from "@/lib/auth";

import { BrandLogo } from "@/components/BrandLogo";
import { ROLES } from "@/config/roles";
import { useDataStore } from "@/lib/data-store";
import { DEFAULT_TENANT_ACCENT } from "@/lib/tenant-colors";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types";

interface AppShellProps {
  role: UserRole;
  /** Page title shown in the sticky top bar. */
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function AppShell({ role, title, description, actions, children }: AppShellProps) {
  const config = ROLES[role];
  const { center } = useDataStore();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const sync = () => {
      const current = getSession();
      setSession(current);
      setChecked(true);
      if (!current || current.role !== role) {
        goToCenterLogin();
      }
    };
    sync();
    return subscribeAuth(sync);
  }, [role, navigate]);

  /**
   * الخروج من لوحة السنتر يرجّع لصفحة دخول نفس السنتر (Tenant Login) — مش صفحة
   * دخول مالك المنصة على "/".
   */
  const goToCenterLogin = () => {
    if (center.slug) {
      void navigate({ to: "/login/$slug", params: { slug: center.slug } });
    } else {
      void navigate({ to: "/login" });
    }
  };

  const handleSignOut = () => {
    signOut();
    goToCenterLogin();
  };

  if (!checked || !session) {
    return (
      <div dir="rtl" className="flex min-h-screen items-center justify-center bg-canvas">
        <p className="text-base font-black text-muted-foreground">جارٍ التحقق من الصلاحيات…</p>
      </div>
    );
  }

  return (
    <div dir="rtl" className="flex min-h-screen bg-canvas">
      <BrandLogo />
      {/* §11-أ: tenant accent — sidebar background only, independent of the 5 subject colors. */}
      <aside
        className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col text-navy-foreground md:flex"
        style={{ backgroundColor: center.accent_color ?? DEFAULT_TENANT_ACCENT }}
      >
        <div className="flex items-center gap-3 border-b border-white/15 px-6 py-6">
          <span className="flex size-11 items-center justify-center rounded-xl bg-white/15">
            <GraduationCap className="size-6" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-base font-black">{center.name}</p>
            <p className="truncate text-xs font-bold text-white/70">{center.branch}</p>
          </div>
        </div>

        <div className="px-6 pt-6 pb-3">
          <p className="text-xs font-black tracking-wide text-white/60">لوحة {config.title}</p>
        </div>

        <nav className="flex-1 space-y-1.5 px-4">
          {config.nav.map((item) => {
            const active = pathname === item.to;
            return (
              <Link
                key={item.label}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-4 py-3 text-[15px] font-extrabold transition-colors",
                  active
                    ? "bg-white text-navy shadow-lift"
                    : "text-white/80 hover:bg-white/10 hover:text-white",
                )}
              >
                <item.icon className="size-5 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/15 p-4">
          <div className="mb-3 rounded-xl bg-white/10 p-3">
            <p className="text-[11px] font-bold text-white/60">معرّف السنتر (RLS)</p>
            <p className="font-mono text-sm font-black">{center.id}</p>
          </div>
          <div className="mb-2 px-1">
            <p className="truncate text-sm font-black text-white">{session.full_name}</p>
            <p className="truncate font-mono text-[11px] font-bold text-white/60">
              {session.identifier}
            </p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-extrabold text-white/80 transition-colors hover:bg-white/10 hover:text-white"
          >
            <LogOut className="size-5" />
            تسجيل الخروج
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b-2 border-border bg-background/95 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 md:px-8">
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-black text-foreground md:text-3xl">{title}</h1>
              {description ? (
                <p className="mt-1 text-sm font-bold text-muted-foreground">{description}</p>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              {actions}
              <button
                type="button"
                onClick={handleSignOut}
                className="flex items-center gap-2 rounded-xl border-2 border-border px-3 py-2 text-xs font-black text-foreground transition-colors hover:bg-muted md:hidden"
              >
                <LogOut className="size-4" />
                خروج
              </button>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto border-t-2 border-border px-5 py-2 md:hidden">
            {config.nav.map((item) => (
              <Link
                key={item.label}
                to={item.to}
                className={cn(
                  "shrink-0 rounded-lg px-3 py-2 text-xs font-extrabold",
                  pathname === item.to ? "bg-navy text-navy-foreground" : "bg-muted text-foreground",
                )}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </header>

        <main className="flex-1 px-5 py-6 md:px-8 md:py-8">
          <div className="mx-auto w-full max-w-7xl space-y-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
