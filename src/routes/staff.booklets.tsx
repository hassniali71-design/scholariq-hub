import { createFileRoute } from "@tanstack/react-router";

import { BookletInventory } from "@/components/staff/BookletInventory";

export const Route = createFileRoute("/staff/booklets")({
  head: () => ({
    meta: [
      { title: "مخزون الملازم والكتب — السكرتارية" },
      {
        name: "description",
        content: "إدارة الكتب والملازم والامتحانات وبيعها للطلاب مع تتبع رصيد الورق.",
      },
    ],
  }),
  component: BookletInventory,
});
