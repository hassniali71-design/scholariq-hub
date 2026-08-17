import { createFileRoute } from "@tanstack/react-router";

import { LoginCard } from "@/components/auth/LoginCard";

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
  component: () => <LoginCard />,
});
