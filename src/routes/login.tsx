import { createFileRoute } from "@tanstack/react-router";

import { LoginCard } from "@/components/auth/LoginCard";

/**
 * The generic, per-role login (owner/staff/teacher/student/parent/visitor dropdown) — moved
 * here from `/`, which is now the platform operator's own entry point. Still the same
 * component, same behavior, just a different path.
 */
export const Route = createFileRoute("/login")({
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
  component: () => <LoginCard />,
});
