import { createFileRoute } from "@tanstack/react-router";
import { CalendarPlus, CalendarRange, Download, LayoutList, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Panel, StatusBadge } from "@/components/dashboard/StatCard";
import { AppShell } from "@/components/layout/AppShell";
import { GroupScheduleModal } from "@/components/owner/GroupScheduleModal";
import { deleteScheduleSlot, useDataStore } from "@/lib/data-store";
import { formatNumber } from "@/lib/format";
import { WEEKDAYS } from "@/lib/owner-metrics";
import { cn } from "@/lib/utils";
import type { ScheduleSlot } from "@/types";

export const Route = createFileRoute("/owner/schedule")({
  head: () => ({
    meta: [
      { title: "غرفة تحكم الجدولة — لوحة المالك" },
      {
        name: "description",
        content:
          "جدول مواعيد كل مدرس بصيغة 12 ساعة، جدولة المجموعات المعلَّقة، تصدير PDF لكل مدرس.",
      },
    ],
  }),
  component: SchedulePage,
});

/** صيغة 12 ساعة — تغطي الفترة الكاملة ليوم السنتر (8 ص - 9 م). */
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

/** تحويل "04:00 PM" إلى "04:00 م" لعرض الفاتح. */
function format12hArabic(t: string): string {
  return t.replace(" AM", " ص").replace(" PM", " م").replace("AM", "ص").replace("PM", "م");
}

function SchedulePage() {
  const state = useDataStore();
  const { teachers, scheduleSlots, groups } = state;
  const [aggregate, setAggregate] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const pendingCount = useMemo(
    () => groups.filter((g) => g.scheduling_status === "pending").length,
    [groups],
  );

  const slotsByTeacher = useMemo(() => {
    const map = new Map<string, ScheduleSlot[]>();
    for (const t of teachers) map.set(t.id, []);
    for (const s of scheduleSlots) {
      const list = map.get(s.teacher_id);
      if (list) list.push(s);
    }
    return map;
  }, [teachers, scheduleSlots]);

  const allSlots = useMemo(
    () =>
      [...scheduleSlots].sort((a, b) =>
        a.weekday === b.weekday
          ? TIMES_12.indexOf(a.time) - TIMES_12.indexOf(b.time)
          : WEEKDAYS.indexOf(a.weekday as never) - WEEKDAYS.indexOf(b.weekday as never),
      ),
    [scheduleSlots],
  );

  function downloadTeacherPDF(teacherId: string) {
    const teacher = teachers.find((t) => t.id === teacherId);
    if (!teacher) return;
    const slots = slotsByTeacher.get(teacherId) ?? [];
    const html = `
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="utf-8" />
          <title>جدول ${teacher.full_name}</title>
          <style>
            body { font-family: 'Tajawal', 'Cairo', sans-serif; padding: 24px; }
            h1 { color: #1E3A8A; margin-bottom: 8px; }
            .meta { color: #64748B; margin-bottom: 16px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: right; }
            th { background: #f1f5f9; }
            .empty { color: #94a3b8; }
          </style>
        </head>
        <body>
          <h1>جدول المدرس: ${teacher.full_name}</h1>
          <p class="meta">المادة: ${teacher.subject} · عدد المواعيد الأسبوعية: ${formatNumber(slots.length)}</p>
          ${
            slots.length === 0
              ? '<p class="empty">لا توجد مواعيد مسجّلة.</p>'
              : `<table>
                  <thead>
                    <tr>
                      <th>اليوم</th>
                      <th>الساعة</th>
                      <th>الصف</th>
                      <th>القاعة</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${slots
                      .map(
                        (s) => `<tr>
                        <td>${s.weekday}</td>
                        <td>${format12hArabic(s.time)}</td>
                        <td>${s.grade}</td>
                        <td>${s.room || "—"}</td>
                      </tr>`,
                      )
                      .join("")}
                  </tbody>
                </table>`
          }
        </body>
      </html>`;
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (win) {
      win.addEventListener("load", () => {
        win.focus();
        win.print();
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      });
    } else {
      const a = document.createElement("a");
      a.href = url;
      a.download = `schedule-${teacher.full_name.replace(/\s+/g, "_")}.html`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  function handleDeleteSlot(id: string) {
    deleteScheduleSlot(id);
    toast.success("تم حذف الموعد");
  }

  return (
    <AppShell
      role="owner"
      title="غرفة تحكم الجدولة"
      description="جدولة المجموعات المعلَّقة (الخطوة 2) + عرض جدول كل مدرس"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setScheduleOpen(true)}
            disabled={pendingCount === 0}
            className="flex items-center gap-2 rounded-xl bg-navy px-4 py-2.5 text-base font-black text-navy-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <CalendarPlus className="size-5" />
            جدولة مجموعة
            {pendingCount > 0 ? (
              <span className="rounded-full bg-primary-foreground/20 px-2 py-0.5 text-xs font-black">
                {pendingCount}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => setAggregate((v) => !v)}
            className="flex items-center gap-2 rounded-xl border-2 border-border bg-background px-4 py-2.5 text-base font-black text-foreground hover:border-primary"
          >
            <LayoutList className="size-5" />
            {aggregate ? "جداول المدرسين" : "تجميع السنتر"}
          </button>
        </div>
      }
    >
      <GroupScheduleModal open={scheduleOpen} onClose={() => setScheduleOpen(false)} />

      {pendingCount > 0 ? (
        <div className="rounded-xl border-2 border-warning/40 bg-warning/5 p-4 text-base font-black text-foreground">
          لديك {formatNumber(pendingCount)} مجموعة بانتظار الجدولة — اضغط "جدولة مجموعة" لإكمالها.
        </div>
      ) : null}

      {aggregate ? (
        <Panel
          title="جدول السنتر المجمّع"
          description={`${formatNumber(allSlots.length)} موعد على مستوى السنتر`}
        >
          {allSlots.length === 0 ? (
            <Empty text="لا توجد مواعيد مسجّلة بعد — ابدأ بجدولة مجموعة من الزر بالأعلى." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-base">
                <thead>
                  <tr className="border-b-2 border-border text-muted-foreground">
                    <th className="pb-3">اليوم</th>
                    <th className="pb-3">الساعة</th>
                    <th className="pb-3">المدرس</th>
                    <th className="pb-3">الصف</th>
                    <th className="pb-3">القاعة</th>
                    <th className="pb-3" />
                  </tr>
                </thead>
                <tbody>
                  {allSlots.map((s) => (
                    <tr key={s.id} className="border-b border-border last:border-0">
                      <td className="py-3 font-black text-foreground">{s.weekday}</td>
                      <td className="py-3 font-extrabold">{format12hArabic(s.time)}</td>
                      <td className="py-3 font-bold">{s.teacher_name}</td>
                      <td className="py-3 font-bold text-muted-foreground">{s.grade}</td>
                      <td className="py-3 font-bold text-muted-foreground">{s.room || "—"}</td>
                      <td className="py-3">
                        <button
                          type="button"
                          onClick={() => handleDeleteSlot(s.id)}
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
      ) : (
        <div className="space-y-6">
          {teachers.length === 0 ? (
            <Empty text="لا يوجد مدرسون مسجّلون بعد — أضف مدرساً من /owner/access أولاً." />
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
                      onClick={() => downloadTeacherPDF(t.id)}
                      className="flex items-center gap-2 rounded-xl border-2 border-border bg-background px-3 py-2 text-sm font-black text-foreground hover:border-primary"
                    >
                      <Download className="size-4" />
                      جدول المدرس
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
                            <th className="pb-3">الصف</th>
                            <th className="pb-3">اليوم</th>
                            <th className="pb-3">الساعة</th>
                            <th className="pb-3">القاعة</th>
                            <th className="pb-3" />
                          </tr>
                        </thead>
                        <tbody>
                          {slots.map((s) => (
                            <tr key={s.id} className="border-b border-border last:border-0">
                              <td className="py-2 font-extrabold text-foreground">{s.grade}</td>
                              <td className="py-2 font-black text-foreground">{s.weekday}</td>
                              <td className="py-2 font-extrabold">{format12hArabic(s.time)}</td>
                              <td className="py-2">
                                <span
                                  className={cn(
                                    "font-extrabold",
                                    !s.room && "text-muted-foreground",
                                  )}
                                >
                                  {s.room || "—"}
                                </span>
                              </td>
                              <td className="py-2">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteSlot(s.id)}
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

      <div className="flex items-center gap-3 text-sm font-bold text-muted-foreground">
        <CalendarRange className="size-4" />
        <span>{formatNumber(scheduleSlots.length)} موعد محفوظ</span>
        <StatusBadge tone="neutral">صيغة 12 ساعة</StatusBadge>
      </div>
    </AppShell>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <p className="rounded-xl border-2 border-dashed border-border p-6 text-center text-base font-bold text-muted-foreground">
      {text}
    </p>
  );
}
