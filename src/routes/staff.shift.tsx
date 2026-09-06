import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Banknote, CheckCircle2, ClipboardCheck, LockKeyhole, TrendingUp, Users } from "lucide-react";
import { toast } from "sonner";

import { Panel, StatCard, StatusBadge } from "@/components/dashboard/StatCard";
import { AppShell } from "@/components/layout/AppShell";
import { closeShift, useDataStore } from "@/lib/data-store";
import { formatCurrency, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/staff/shift")({
  head: () => ({
    meta: [
      { title: "تقفيل الوردية — السكرتارية" },
      {
        name: "description",
        content: "مطابقة النقدية وتقرير نهاية الوردية قبل تسليم الخزنة.",
      },
    ],
  }),
  component: ShiftPage,
});

function ShiftPage() {
  const { payments, attendanceRecords, shiftClosures } = useDataStore();
  const expected = payments.reduce((s, p) => s + p.amount, 0);
  const [counted, setCounted] = useState(expected);
  const [closed, setClosed] = useState(false);
  const diff = counted - expected;

  const last5 = useMemo(() => shiftClosures.slice(0, 5), [shiftClosures]);
  const avgCounted = last5.length
    ? last5.reduce((s, c) => s + Number(c.counted), 0) / last5.length
    : 0;
  const avgExpected = last5.length
    ? last5.reduce((s, c) => s + Number(c.expected), 0) / last5.length
    : 0;
  const avgDiff = last5.length
    ? last5.reduce((s, c) => s + Number(c.diff), 0) / last5.length
    : 0;

  const lastHourAbsent = attendanceRecords.some(
    (a) =>
      a.status === "absent" &&
      (() => {
        const t = Date.parse(a.checked_in_at);
        return !Number.isNaN(t) && Date.now() - t < 3600000;
      })(),
  );
  const cleanShift = diff === 0 && !lastHourAbsent && !closed;

  return (
    <AppShell role="staff" title="تقفيل الوردية" description="مطابقة النقدية وتسليم تقرير اليوم">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="إجمالي التحصيل" value={formatCurrency(expected)} icon={Banknote} />
        <StatCard
          label="عدد الإيصالات"
          value={formatNumber(payments.length)}
          icon={ClipboardCheck}
        />
        <StatCard
          label="حضور مسجل"
          value={formatNumber(attendanceRecords.filter((a) => a.status !== "absent").length)}
          icon={Users}
          tone="success"
        />
        <StatCard
          label="فرق الخزنة"
          value={formatCurrency(diff)}
          icon={LockKeyhole}
          tone={diff === 0 ? "success" : "destructive"}
        />
      </div>

      {cleanShift ? (
        <div className="flex items-center gap-2 rounded-2xl border-2 border-success/40 bg-success/15 p-3 text-sm font-black text-success">
          <CheckCircle2 className="size-4" />
          وردية نظيفة — الخزنة مطابقة ولا حالات غياب في الساعة الأخيرة.
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="مطابقة النقدية" description="أدخل المبلغ الفعلي داخل الدرج">
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-sm font-black">المبلغ المتوقع</p>
              <p className="kpi-number text-3xl">{formatCurrency(expected)}</p>
            </div>
            <div>
              <p className="mb-2 text-sm font-black">المبلغ الفعلي</p>
              <input
                type="number"
                value={counted}
                onChange={(e) => setCounted(Number(e.target.value))}
                disabled={closed}
                className="h-16 w-full rounded-2xl border-2 border-border bg-background px-4 text-3xl font-black outline-none focus:border-primary disabled:opacity-60"
              />
            </div>
            <StatusBadge tone={diff === 0 ? "success" : diff > 0 ? "warning" : "destructive"}>
              {diff === 0 ? "مطابق تماماً" : `فرق ${formatCurrency(diff)}`}
            </StatusBadge>

            <button
              onClick={() => {
                closeShift(counted);
                setClosed(true);
                toast.success("تم تقفيل الوردية وإرسال التقرير للمالك");
              }}
              disabled={closed}
              className="h-14 w-full rounded-2xl bg-navy text-lg font-black text-navy-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {closed ? "تم التقفيل ✓" : "تقفيل الوردية"}
            </button>
          </div>
        </Panel>

        <Panel
          title="مقارنة مع آخر 5 ورديات"
          description={last5.length ? `متوسط ${formatNumber(last5.length)} ورديات سابقة` : "لا يوجد سجل ورديات بعد"}
          actions={
            <span className="flex items-center gap-1 text-xs font-black text-muted-foreground">
              <TrendingUp className="size-3" /> مرجع
            </span>
          }
        >
          <table className="w-full text-sm">
            <thead className="text-xs font-black text-muted-foreground">
              <tr>
                <th className="py-2 text-right">البند</th>
                <th className="py-2 text-right">اليوم</th>
                <th className="py-2 text-right">المتوسط</th>
                <th className="py-2 text-right">الفرق</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-border">
                <td className="py-2 font-black">المتوقع</td>
                <td className="py-2 font-black">{formatCurrency(expected)}</td>
                <td className="py-2">{formatCurrency(avgExpected)}</td>
                <td className={cn("py-2", expected - avgExpected >= 0 ? "text-success" : "text-destructive")}>
                  {expected - avgExpected >= 0 ? "+" : ""}
                  {formatCurrency(expected - avgExpected)}
                </td>
              </tr>
              <tr className="border-t border-border">
                <td className="py-2 font-black">الفعلي</td>
                <td className="py-2 font-black">{formatCurrency(counted)}</td>
                <td className="py-2">{formatCurrency(avgCounted)}</td>
                <td className={cn("py-2", counted - avgCounted >= 0 ? "text-success" : "text-destructive")}>
                  {counted - avgCounted >= 0 ? "+" : ""}
                  {formatCurrency(counted - avgCounted)}
                </td>
              </tr>
              <tr className="border-t border-border">
                <td className="py-2 font-black">الفرق</td>
                <td className="py-2 font-black">{formatCurrency(diff)}</td>
                <td className="py-2">{formatCurrency(avgDiff)}</td>
                <td className="py-2 text-muted-foreground">—</td>
              </tr>
            </tbody>
          </table>
        </Panel>
      </div>

      <Panel title="تقرير الوردية" description="ملخص العمليات المرسل للمالك">
        <div className="space-y-3">
          {payments.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between gap-3 rounded-xl border-2 border-border p-3"
            >
              <div className="min-w-0">
                <p className="truncate font-black text-foreground">{p.student_name}</p>
                <p className="truncate text-xs font-bold text-muted-foreground">{p.item}</p>
              </div>
              <span className="font-black text-primary">{formatCurrency(p.amount)}</span>
            </div>
          ))}
          <div className="flex items-center justify-between rounded-xl border-2 border-navy bg-navy p-4 text-navy-foreground">
            <span className="font-black">الإجمالي المسلَّم</span>
            <span className="text-xl font-black">{formatCurrency(counted)}</span>
          </div>
        </div>
      </Panel>
    </AppShell>
  );
}
