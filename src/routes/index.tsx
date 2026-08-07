import { Link, createFileRoute } from "@tanstack/react-router";
import {
  ArrowLeft,
  GraduationCap,
  MonitorPlay,
  ShieldCheck,
  Sparkles,
  Timer,
  Users,
} from "lucide-react";

import { ROLES, ROLE_ORDER } from "@/config/roles";
import { CURRENT_TENANT } from "@/lib/mock-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "بوابة الدخول — منصة إدارة السناتر التعليمية" },
      {
        name: "description",
        content:
          "بوابة موحدة لدخول المالك والسكرتارية والمدرسين والطلاب وأولياء الأمور إلى نظام إدارة السنتر.",
      },
      { property: "og:title", content: "بوابة الدخول — منصة إدارة السناتر التعليمية" },
      {
        property: "og:description",
        content: "نظام ERP و LMS متكامل للسناتر التعليمية مع تايمرات الحصص والمتابعة اللحظية.",
      },
    ],
  }),
  component: PortalGate,
});

const highlights = [
  { icon: Timer, title: "محرك حصة بالتايمر", text: "٤ مراحل موزونة بالثانية داخل الفصل" },
  { icon: Users, title: "متابعة بدون أعذار", text: "إشعارات واتساب لحظية لولي الأمر" },
  { icon: ShieldCheck, title: "عزل بيانات كل سنتر", text: "حماية صفية عبر center_id" },
];

function PortalGate() {
  return (
    <div dir="rtl" className="min-h-screen bg-canvas">
      <div className="grid min-h-screen lg:grid-cols-[1fr_1.1fr]">
        <aside className="relative flex flex-col justify-between bg-navy px-8 py-10 text-navy-foreground md:px-12">
          <div className="flex items-center gap-3">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-white/15">
              <GraduationCap className="size-7" />
            </span>
            <div>
              <p className="text-lg font-black">{CURRENT_TENANT.name}</p>
              <p className="text-xs font-bold text-white/70">{CURRENT_TENANT.branch}</p>
            </div>
          </div>

          <div className="my-12 max-w-lg">
            <span className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-3 py-1.5 text-xs font-black">
              <Sparkles className="size-4" /> نظام ERP و LMS متكامل
            </span>
            <h1 className="mt-5 text-4xl leading-tight font-black md:text-5xl">
              منصة إدارة والتحكم بالسناتر التعليمية
            </h1>
            <p className="mt-4 text-base font-bold text-white/80">
              أتمتة كاملة للحضور والتحصيل والحصص التفاعلية، مع تقارير لحظية للمالك ومتابعة صارمة
              لأولياء الأمور.
            </p>

            <div className="mt-8 space-y-3">
              {highlights.map((h) => (
                <div key={h.title} className="flex items-start gap-3 rounded-2xl bg-white/10 p-4">
                  <h.icon className="mt-0.5 size-5 shrink-0" />
                  <div>
                    <p className="text-sm font-black">{h.title}</p>
                    <p className="text-xs font-bold text-white/70">{h.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs font-bold text-white/50">
            © 2026 جميع الحقوق محفوظة — منصة إدارة السناتر التعليمية
          </p>
        </aside>

        <main className="flex items-center px-6 py-12 md:px-12">
          <div className="mx-auto w-full max-w-2xl">
            <h2 className="text-3xl font-black text-foreground">اختر بوابة الدخول</h2>
            <p className="mt-2 text-sm font-bold text-muted-foreground">
              كل دور له لوحة تحكم وصلاحيات مستقلة داخل نفس السنتر.
            </p>

            <div className="mt-8 space-y-4">
              {ROLE_ORDER.map((role) => {
                const config = ROLES[role];
                return (
                  <Link
                    key={role}
                    to={config.home}
                    className="card-crisp group flex items-center gap-4 p-5 transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-lift"
                  >
                    <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-navy text-navy-foreground">
                      <config.icon className="size-7" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-lg font-black text-foreground">{config.title}</p>
                      <p className="text-sm font-bold text-muted-foreground">{config.subtitle}</p>
                      <p className="mt-1 text-xs font-extrabold text-primary">
                        {config.loginHint}
                      </p>
                    </div>
                    <ArrowLeft className="size-6 shrink-0 text-muted-foreground transition-transform group-hover:-translate-x-1 group-hover:text-primary" />
                  </Link>
                );
              })}
            </div>

            <Link
              to="/teacher/session"
              className="mt-6 flex items-center justify-center gap-2 rounded-xl border-2 border-navy bg-navy px-5 py-4 text-base font-black text-navy-foreground transition-opacity hover:opacity-90"
            >
              <MonitorPlay className="size-5" />
              فتح وضع الحصة على الشاشة الذكية مباشرة
            </Link>
          </div>
        </main>
      </div>
    </div>
  );
}
