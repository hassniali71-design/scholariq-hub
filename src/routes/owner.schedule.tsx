import { createFileRoute } from "@tanstack/react-router";
import { CalendarRange, LayoutList, Plus, Printer, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Panel, StatusBadge } from "@/components/dashboard/StatCard";
import { AppShell } from "@/components/layout/AppShell";
import { deleteScheduleSlot, upsertScheduleSlot, useDataStore } from "@/lib/data-store";
import { formatNumber } from "@/lib/format";
import { WEEKDAYS } from "@/lib/owner-metrics";
import type { ScheduleSlot } from "@/types";

export const Route = createFileRoute("/owner/schedule")({
  head: () => ({
    meta: [
      { title: "غرفة تحكم الجدولة — لوحة المالك" },
      {
        name: "description",
        content: "جدول مواعيد كل مدرس مع تعديل مباشر للمادة واليوم والساعة والقاعة وتصدير PDF.",
      },
      { property: "og:title", content: "غرفة تحكم الجدولة — لوحة المالك" },
      {
        property: "og:description",
        content: "تعديل جداول المدرسين بتجربة شبيهة بـ Excel مع جدول مجمّع للسنتر وتصدير PDF.",
      },
    ],
  }),
  component: SchedulePage,
});

const TIMES = [
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
  "19:00",
  "20:00",
];

function SchedulePage() {
  const state = useDataStore();
  const { teachers, subjects, grades, scheduleSlots } = state;
  const [aggregate, setAggregate] = useState(false);

  const slotsByTeacher = useMemo(() => {
    const map = new Map<string, ScheduleSlot[]>();
    for (const t of teachers) map.set(t.id, []);
    for (const s of scheduleSlots) {
      const list = map.get(s.teacher_id);
      if (list) list.push(s);
    }
    for (const list of map.values()) {
      list.sort((a, b) =>
        a.weekday === b.weekday ? (a.time < b.time ? -1 : 1) : WEEKDAYS.indexOf(a.weekday as never) - WEEKDAYS.indexOf(b.weekday as never),
      );
    }
    return map;
  }, [teachers, scheduleSlots]);

  const allSlots = useMemo(
    () =>
      [...scheduleSlots].sort((a, b) =>
        a.weekday === b.weekday
          ? a.time < b.time
            ? -1
            : 1
          : WEEKDAYS.indexOf(a.weekday as never) - WEEKDAYS.indexOf(b.weekday as never),
      ),
    [scheduleSlots],
  );

  const patch = (slot: ScheduleSlot, changes: Partial<ScheduleSlot>) => {
    const merged = { ...slot, ...changes };
    upsertScheduleSlot({
      id: merged.id,
      teacherId: merged.teacher_id,
      teacherName: merged.teacher_name,
      subjectId: merged.subject_id,
      subject: merged.subject,
      grade: merged.grade,
      weekday: merged.weekday,
      time: merged.time,
      room: merged.room,
      groupId: merged.group_id,
    });
  };

  return (
    <AppShell
      role="owner"
      title="غرفة تحكم الجدولة"
      description="عدّل مواعيد وقاعات كل مدرس مباشرة — أي تعديل يتحفظ فوراً"
      actions={
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <button
            type="button"
            onClick={() => setAggregate((v) => !v)}
            className="flex items-center gap-2 rounded-xl border-2 border-border bg-background px-4 py-2.5 text-base font-black text-foreground hover:border-primary"
          >
            <LayoutList className="size-5" />
            {aggregate ? "جداول المدرسين" : "تجميع الجداول"}
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-2 rounded-xl border-2 border-border bg-background px-4 py-2.5 text-base font-black text-foreground hover:border-primary"
          >
            <Printer className="size-5" />
            تصدير PDF
          </button>
        </div>
      }
    >
      {aggregate ? (
        <Panel
          title="جدول السنتر المجمّع"
          description={`${formatNumber(allSlots.length)} موعد على مستوى السنتر كله`}
        >
          {allSlots.length === 0 ? (
            <Empty text="لا توجد مواعيد مسجّلة بعد — ابدأ بإضافة موعد من جدول أي مدرس." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-base">
                <thead>
                  <tr className="border-b-2 border-border text-muted-foreground">
                    <th className="pb-3">اليوم</th>
                    <th className="pb-3">الساعة</th>
                    <th className="pb-3">المدرس</th>
                    <th className="pb-3">المادة</th>
                    <th className="pb-3">الصف</th>
                    <th className="pb-3">القاعة</th>
                  </tr>
                </thead>
                <tbody>
                  {allSlots.map((s) => (
                    <tr key={s.id} className="border-b border-border last:border-0">
                      <td className="py-3 font-black text-foreground">{s.weekday}</td>
                      <td className="py-3 font-extrabold">{s.time}</td>
                      <td className="py-3 font-bold">{s.teacher_name}</td>
                      <td className="py-3 font-bold">{s.subject}</td>
                      <td className="py-3 font-bold text-muted-foreground">{s.grade}</td>
                      <td className="py-3 font-bold text-muted-foreground">{s.room}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      ) : (
        <div className="space-y-6">
          {teachers.length === 0 ? (
            <Empty text="لا يوجد مدرسون مسجّلون بعد." />
          ) : (
            teachers.map((t) => {
              const slots = slotsByTeacher.get(t.id) ?? [];
              return (
                <Panel
                  key={t.id}
                  title={`جدول ${t.full_name}`}
                  description={`${t.subject} · ${formatNumber(slots.length)} موعد أسبوعي`}
                  actions={
                    <button
                      type="button"
                      onClick={() => {
                        upsertScheduleSlot({
                          teacherId: t.id,
                          teacherName: t.full_name,
                          subjectId: t.subject_id,
                          subject: t.subject,
                          grade: grades[0]?.name ?? "",
                          weekday: WEEKDAYS[6]!,
                          time: "16:00",
                          room: "",
                        });
                        toast.success("تمت إضافة موعد جديد");
                      }}
                      className="flex items-center gap-2 rounded-xl border-2 border-border px-3 py-2 text-sm font-black text-foreground hover:border-primary print:hidden"
                    >
                      <Plus className="size-4" />
                      موعد جديد
                    </button>
                  }
                >
                  {slots.length === 0 ? (
                    <Empty text="لا توجد مواعيد لهذا المدرس بعد." />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-right text-base">
                        <thead>
                          <tr className="border-b-2 border-border text-muted-foreground">
                            <th className="pb-3">المادة</th>
                            <th className="pb-3">الصف</th>
                            <th className="pb-3">اليوم</th>
                            <th className="pb-3">الساعة</th>
                            <th className="pb-3">القاعة</th>
                            <th className="pb-3 print:hidden" />
                          </tr>
                        </thead>
                        <tbody>
                          {slots.map((s) => (
                            <tr key={s.id} className="border-b border-border last:border-0">
                              <td className="py-2">
                                <select
                                  value={s.subject_id ?? ""}
                                  onChange={(e) => {
                                    const subject = subjects.find((x) => x.id === e.target.value);
                                    patch(s, {
                                      subject_id: subject?.id ?? null,
                                      subject: subject?.name ?? "",
                                    });
                                  }}
                                  className={cellClass}
                                >
                                  <option value="">— اختر —</option>
                                  {subjects.map((sub) => (
                                    <option key={sub.id} value={sub.id}>
                                      {sub.name}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="py-2">
                                <select
                                  value={s.grade}
                                  onChange={(e) => patch(s, { grade: e.target.value })}
                                  className={cellClass}
                                >
                                  <option value="">— اختر —</option>
                                  {grades.map((g) => (
                                    <option key={g.id} value={g.name}>
                                      {g.name}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="py-2">
                                <select
                                  value={s.weekday}
                                  onChange={(e) => patch(s, { weekday: e.target.value })}
                                  className={cellClass}
                                >
                                  {WEEKDAYS.map((d) => (
                                    <option key={d} value={d}>
                                      {d}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="py-2">
                                <select
                                  value={s.time}
                                  onChange={(e) => patch(s, { time: e.target.value })}
                                  className={cellClass}
                                >
                                  {TIMES.map((tm) => (
                                    <option key={tm} value={tm}>
                                      {tm}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="py-2">
                                <input
                                  value={s.room}
                                  onChange={(e) => patch(s, { room: e.target.value })}
                                  placeholder="قاعة"
                                  className={cellClass}
                                />
                              </td>
                              <td className="py-2 print:hidden">
                                <button
                                  type="button"
                                  onClick={() => deleteScheduleSlot(s.id)}
                                  className="rounded-lg border-2 border-border p-2 text-destructive hover:border-destructive"
                                  aria-label="حذف الموعد"
                                >
                                  <Trash2 className="size-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Panel>
              );
            })
          )}
        </div>
      )}

      <p className="flex items-center gap-2 text-sm font-bold text-muted-foreground print:hidden">
        <CalendarRange className="size-4" />
        كل تعديل في أي خانة يتحفظ فوراً على قاعدة البيانات.
      </p>
      <div className="print:hidden">
        <StatusBadge tone="neutral">{formatNumber(scheduleSlots.length)} موعد محفوظ</StatusBadge>
      </div>
    </AppShell>
  );
}

const cellClass =
  "w-full rounded-lg border-2 border-border bg-background px-3 py-2 text-base font-bold text-foreground focus:border-primary focus:outline-none";

function Empty({ text }: { text: string }) {
  return (
    <p className="rounded-xl border-2 border-dashed border-border p-6 text-center text-base font-bold text-muted-foreground">
      {text}
    </p>
  );
}
