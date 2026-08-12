import { createFileRoute } from "@tanstack/react-router";
import { ClipboardCheck } from "lucide-react";

import { Panel } from "@/components/dashboard/StatCard";
import { AppShell } from "@/components/layout/AppShell";

export const Route = createFileRoute("/teacher/assessments")({
  head: () => ({
    meta: [
      { title: "التقييمات والغياب — المدرس" },
      {
        name: "description",
        content: "إدارة الحضور والواجبات والأنشطة والسلوك بأثر رجعي لكل طالب.",
      },
      { property: "og:title", content: "التقييمات والغياب — المدرس" },
      {
        property: "og:description",
        content: "إدارة كاملة للحضور وتقييم الواجب والأنشطة والسلوك.",
      },
    ],
  }),
  component: AssessmentsPage,
});

function AssessmentsPage() {
  return (
    <AppShell
      role="teacher"
      title="التقييمات والغياب"
      description="الحضور، تقييم الواجب، الأنشطة، والسلوك — إدارة بأثر رجعي"
    >
      <Panel title="قيد الإنشاء" description="هذا القسم جزء من مرحلة لاحقة من خطة التطوير">
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <ClipboardCheck className="size-7" />
          </span>
          <p className="font-black text-foreground">قسم التقييمات والغياب قيد التنفيذ</p>
          <p className="max-w-sm text-sm font-bold text-muted-foreground">
            سيضم أدوات إدارة الحضور بأثر رجعي، تقييم الواجب والأنشطة، وتقييم السلوك — كل ما
            يُرصد الآن سريعاً داخل وضع الحصة يظهر هنا للمراجعة والتعديل.
          </p>
        </div>
      </Panel>
    </AppShell>
  );
}
