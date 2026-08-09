import { createFileRoute } from "@tanstack/react-router";
import { Award, BookOpen, Info, Trophy, Users } from "lucide-react";

import { AppShell } from "@/components/layout/AppShell";
import { useDataStore } from "@/lib/data-store";
import { CURRENT_TENANT } from "@/lib/mock-data";

export const Route = createFileRoute("/visitor/")({
  head: () => ({
    meta: [
      { title: "نظرة عامة — بوابة الزائر" },
      {
        name: "description",
        content: "استعراض عام عن السنتر التعليمي: أبرز الطلاب المتفوقين وقائمة المدرسين والمواد.",
      },
      { property: "og:title", content: "نظرة عامة — بوابة الزائر" },
      {
        property: "og:description",
        content: "معلومات عامة عن السنتر التعليمي وأبرز المتفوقين والمدرسين بدون بيانات خاصة.",
      },
    ],
  }),
  component: VisitorDashboard,
});

function VisitorDashboard() {
  const { groups, leaderboard, teachers } = useDataStore();
  const subjects = Array.from(new Set(groups.map((g) => g.subject)));

  return (
    <AppShell
      role="visitor"
      title="نظرة عامة عن السنتر"
      description="بيانات عامة فقط — لا تُعرض أي معلومات مالية أو إدارية"
    >
      <div className="card-crisp flex items-start gap-3 p-5">
        <Info className="mt-0.5 size-5 shrink-0 text-primary" />
        <div>
          <p className="text-lg font-black text-foreground">{CURRENT_TENANT.name}</p>
          <p className="text-sm font-bold text-muted-foreground">{CURRENT_TENANT.branch}</p>
          <p className="mt-2 text-sm font-bold text-foreground">
            سنتر تعليمي متكامل يقدّم حصصاً تفاعلية بنظام تايمرات دقيق، مع متابعة لحظية لأولياء
            الأمور وتقارير أداء مستمرة للطلاب.
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card-crisp p-5">
          <p className="flex items-center gap-2 text-lg font-black text-foreground">
            <Trophy className="size-5 text-warning" />
            أبرز الطلاب المتفوقين
          </p>
          <div className="mt-4 space-y-2">
            {leaderboard.slice(0, 5).map((entry) => (
              <div
                key={entry.rank}
                className="flex items-center gap-3 rounded-xl border-2 border-border p-3"
              >
                <span className="flex size-9 items-center justify-center rounded-lg bg-navy text-sm font-black text-navy-foreground">
                  {entry.rank}
                </span>
                <p className="flex-1 text-sm font-black text-foreground">{entry.student_name}</p>
                <span className="flex items-center gap-1 text-sm font-black text-primary">
                  <Award className="size-4" />
                  {entry.points}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="card-crisp p-5">
          <p className="flex items-center gap-2 text-lg font-black text-foreground">
            <Users className="size-5 text-primary" />
            هيئة التدريس
          </p>
          <div className="mt-4 space-y-2">
            {teachers.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between gap-3 rounded-xl border-2 border-border p-3"
              >
                <p className="text-sm font-black text-foreground">{t.full_name}</p>
                <span className="rounded-lg bg-muted px-3 py-1 text-xs font-black text-foreground">
                  {t.subject}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card-crisp p-5">
        <p className="flex items-center gap-2 text-lg font-black text-foreground">
          <BookOpen className="size-5 text-success" />
          المواد الدراسية المتاحة
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {subjects.map((s) => (
            <span
              key={s}
              className="rounded-xl border-2 border-border bg-muted px-4 py-2 text-sm font-black text-foreground"
            >
              {s}
            </span>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
