import { createFileRoute } from "@tanstack/react-router";
import { CalendarRange } from "lucide-react";
import { useMemo } from "react";

import { Panel, StatusBadge } from "@/components/dashboard/StatCard";
import { AppShell } from "@/components/layout/AppShell";
import { getSession } from "@/lib/auth";
import { useDataStore } from "@/lib/data-store";
import { formatNumber } from "@/lib/format";
import { WEEKDAYS } from "@/lib/owner-metrics";

export const Route = createFileRoute("/teacher/schedule")({
  head: () => ({
    meta: [
      { title: "جدولي الأسبوعي — المدرس" },
      {
        name: "description",
        content: "مواعيدك الأسبوعية (قراءة فقط).",
      },
    ],
  }),
  component: TeacherSchedulePage,
});

/** صيغة 12 ساعة للمطابقة. */
const TIMES_12 = [
  "08:00 AM",
  "09:00 AM",
  "10:00 AM",
  "11:00 AM",
  "12:00 PM",
  "01:00 PM",
  "02:00 PM",
  "03:00 PM",
  "04:00 PM",
  "05:00 PM",
  "06:00 PM",
  "07:00 PM",
  "08:00 PM",
  "09:00 PM",
];

function format12h(t: string): string {
  return t.replace(" AM", " ص").replace(" PM", " م");
}

function TeacherSchedulePage() {
  const state = useDataStore();
  const session = typeof window !== "undefined" ? getSession() : null;
  const myTeacher = useMemo(() => {
    if (!session) return null;
    return state.teachers.find((t) => t.user_id === session.identifier) ?? null;
  }, [state.teachers, session?.identifier]);

  const mySlots = useMemo(() => {
    if (!myTeacher) return [];
    return state.scheduleSlots
      .filter((s) => s.teacher_id === myTeacher.id)
      .sort((a, b) =>
        a.weekday === b.weekday
          ? TIMES_12.indexOf(a.time) - TIMES_12.indexOf(b.time)
          : WEEKDAYS.indexOf(a.weekday as never) - WEEKDAYS.indexOf(b.weekday as never),
      );
  }, [state.scheduleSlots, myTeacher]);

  return (
    <AppShell
      role="teacher"
      title="جدولي الأسبوعي"
      description="مواعيدك الأسبوعية — للتعديل تواصل مع إدارة السنتر"
    >
      {!myTeacher ? (
        <p className="rounded-xl border-2 border-dashed border-border p-6 text-center text-base font-bold text-muted-foreground">
          لم يتم العثور على بيانات المدرس المرتبط بحسابك.
        </p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <Stat title="اسمك" value={myTeacher.full_name} />
            <Stat title="المادة" value={myTeacher.subject} />
            <Stat title="عدد المواعيد" value={`${formatNumber(mySlots.length)} موعد / أسبوع`} />
          </div>

          <Panel title="مواعيدك" description="قراءة فقط — أي تعديل يحتاج المالك من /owner/schedule">
            {mySlots.length === 0 ? (
              <p className="rounded-xl border-2 border-dashed border-border p-6 text-center text-base font-bold text-muted-foreground">
                لا توجد مواعيد بعد. تواصل مع إدارة السنتر.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-base">
                  <thead>
                    <tr className="border-b-2 border-border text-muted-foreground">
                      <th className="pb-3">اليوم</th>
                      <th className="pb-3">الساعة</th>
                      <th className="pb-3">الصف</th>
                      <th className="pb-3">القاعة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mySlots.map((s) => (
                      <tr key={s.id} className="border-b border-border last:border-0">
                        <td className="py-3 font-black text-foreground">{s.weekday}</td>
                        <td className="py-3 font-extrabold">{format12h(s.time)}</td>
                        <td className="py-3 font-bold">{s.grade}</td>
                        <td className="py-3 font-bold text-muted-foreground">{s.room || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <div className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
            <CalendarRange className="size-4" />
            <StatusBadge tone="neutral">قراءة فقط</StatusBadge>
          </div>
        </>
      )}
    </AppShell>
  );
}

function Stat({ title, value }: { title: string; value: string }) {
  return (
    <div className="card-crisp p-4">
      <p className="text-sm font-bold text-muted-foreground">{title}</p>
      <p className="kpi-number text-2xl">{value}</p>
    </div>
  );
}
