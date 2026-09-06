import { createFileRoute } from "@tanstack/react-router";

import { StaffGate } from "@/components/staff/AttendanceGate";

export const Route = createFileRoute("/staff/")({
  head: () => ({
    meta: [
      { title: "بوابة الحضور — السكرتارية" },
      {
        name: "description",
        content: "تسجيل حضور المجموعات النشطة بضغطة مع احترام نافذة 10/50 دقيقة.",
      },
    ],
  }),
  component: StaffGate,
});
