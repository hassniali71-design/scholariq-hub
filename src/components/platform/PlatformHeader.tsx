import { Link, useNavigate } from "@tanstack/react-router";
import { Building2, LogOut, Users } from "lucide-react";

import { signOut } from "@/lib/auth";
import { cn } from "@/lib/utils";

/**
 * Shared bar for every `/platform/*` admin screen (there is no AppShell/sidebar here — these
 * pages are outside the six client-facing roles entirely). Was inline markup duplicated only in
 * `platform.new-center.tsx` before PLATFORM_CLIENT_MANAGEMENT_SPEC.md added a second page
 * (`/platform/clients`); pulled out once a second consumer existed instead of speculatively.
 */
export function PlatformHeader({
  title,
  subtitle,
  active,
}: {
  title: string;
  subtitle: string;
  active: "clients" | "new-center";
}) {
  const navigate = useNavigate();

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-border bg-navy px-6 py-4 text-navy-foreground">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-white/15">
          <Building2 className="size-5" />
        </span>
        <div>
          <p className="text-lg font-black">{title}</p>
          <p className="text-xs font-bold text-white/70">{subtitle}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <nav className="flex items-center gap-1 rounded-xl bg-white/10 p-1">
          <Link
            to="/platform/clients"
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-black transition-colors",
              active === "clients" ? "bg-white/20" : "hover:bg-white/10",
            )}
          >
            <Users className="size-4" /> كل العملاء
          </Link>
          <Link
            to="/platform/new-center"
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-black transition-colors",
              active === "new-center" ? "bg-white/20" : "hover:bg-white/10",
            )}
          >
            <Building2 className="size-4" /> إضافة عميل جديد
          </Link>
        </nav>
        <button
          type="button"
          onClick={() => {
            signOut();
            void navigate({ to: "/" });
          }}
          className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-black hover:bg-white/20"
        >
          <LogOut className="size-4" /> تسجيل خروج
        </button>
      </div>
    </header>
  );
}
