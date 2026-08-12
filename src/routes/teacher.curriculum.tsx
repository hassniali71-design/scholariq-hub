import { createFileRoute } from "@tanstack/react-router";
import { BookMarked } from "lucide-react";

import { Panel } from "@/components/dashboard/StatCard";
import { AppShell } from "@/components/layout/AppShell";

export const Route = createFileRoute("/teacher/curriculum")({
  head: () => ({
    meta: [
      { title: "الخطة والمنهج — المدرس" },
      {
        name: "description",
        content: "متابعة تقدم المنهج ووحدات ودروس كل مادة، مرتبطة تلقائياً بما يُدرَّس فعلياً.",
      },
      { property: "og:title", content: "الخطة والمنهج — المدرس" },
      {
        property: "og:description",
        content: "خريطة المنهج ووحداته ونسبة الإنجاز، محدَّثة تلقائياً من وضع الحصة.",
      },
    ],
  }),
  component: CurriculumPage,
});

function CurriculumPage() {
  return (
    <AppShell
      role="teacher"
      title="الخطة والمنهج"
      description="ذاكرة تشغيل المنهج — تُحدَّث تلقائياً من أحداث وضع الحصة"
    >
      <Panel title="قيد الإنشاء" description="هذا القسم جزء من مرحلة لاحقة من خطة التطوير">
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <BookMarked className="size-7" />
          </span>
          <p className="font-black text-foreground">قسم الخطة والمنهج قيد التنفيذ</p>
          <p className="max-w-sm text-sm font-bold text-muted-foreground">
            سيعرض وحدات المنهج ودروسها المخططة، وحالة كل درس (لم يبدأ / قيد التنفيذ / تم)
            مرتبطة تلقائياً بما يُرفع ويُدرَّس فعلياً داخل وضع الحصة، بدون أي إدخال يدوي إضافي.
          </p>
        </div>
      </Panel>
    </AppShell>
  );
}
