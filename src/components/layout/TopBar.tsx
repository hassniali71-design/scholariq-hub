import { GraduationCap } from "lucide-react";

import { Logo } from "@/components/shared/Logo";
import { useDataStore } from "@/lib/data-store";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types";

/**
 * الشريط العلوي الموحّد — ثلاث مناطق:
 *  (يمين) شعار "سبّورة" (Logo مشترك من shared/Logo.tsx) + اسم النظام
 *  (وسط) اسم السنتر + اسم اللوحة + دور المستخدم
 *  (يسار) شعار "حلول" + "مقدمة من شركة حلول"
 *
 * شعار "حلول" لسه Placeholder SVG محلي — تُستبدل لاحقاً بصورة حقيقية من
 * public/branding/ عند رفعها.
 */

interface TopBarProps {
  role: UserRole;
  className?: string;
}

export function TopBar({ role, className }: TopBarProps) {
  const { center } = useDataStore();
  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex items-center justify-between gap-3 border-b-2 border-border bg-background/95 px-5 py-2.5 backdrop-blur md:px-8",
        className,
      )}
    >
      {/* يمين: سبّورة */}
      <div className="flex items-center gap-2">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-navy text-navy-foreground"
          aria-label="سبّورة"
        >
          <Logo className="size-6" />
        </span>
        <div className="hidden sm:block">
          <p className="text-sm font-black text-foreground leading-tight">سبّورة</p>
          <p className="text-[10px] font-bold text-muted-foreground leading-tight">إدارة ذكية للسناتر</p>
        </div>
      </div>

      {/* وسط: اسم السنتر + اللوحة */}
      <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
        <span className="hidden md:flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <GraduationCap className="size-4" />
        </span>
        <div className="min-w-0 text-center">
          <p className="truncate text-sm font-black text-foreground">{center.name}</p>
          <p className="truncate text-[10px] font-bold text-muted-foreground">
            {roleLabel(role)} · {center.branch}
          </p>
        </div>
      </div>

      {/* يسار: حلول */}
      <div className="flex items-center gap-2">
        <div className="hidden text-right sm:block">
          <p className="text-sm font-black text-foreground leading-tight">حلول</p>
          <p className="text-[10px] font-bold text-muted-foreground leading-tight">مقدمة من شركة حلول</p>
        </div>
        <HuloolMark />
      </div>
    </header>
  );
}

function roleLabel(role: UserRole): string {
  switch (role) {
    case "owner":
      return "لوحة المالك";
    case "staff":
      return "لوحة الموظف";
    case "teacher":
      return "لوحة المدرس";
    case "student":
      return "لوحة الطالب";
    case "parent":
      return "لوحة ولي الأمر";
    case "visitor":
      return "صفحة الزائر";
  }
}

/**
 * شعار "حلول" — Placeholder SVG.
 * عند رفع شعار حقيقي، استبدل هذا المكون بـ:
 *   <img src="/branding/hulool.svg" alt="حلول" className="h-8 w-auto" />
 */
function HuloolMark() {
  return (
    <div
      className="flex size-9 shrink-0 items-center justify-center rounded-lg border-2 border-primary bg-primary/5 text-primary"
      aria-label="حلول"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none">
        <path d="M3 12 L12 3 L21 12 L12 21 Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <circle cx="12" cy="12" r="3" fill="currentColor" />
      </svg>
    </div>
  );
}
