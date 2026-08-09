import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Banknote, ClipboardCheck, LockKeyhole, Users } from "lucide-react";
import { toast } from "sonner";

import { Panel, StatCard, StatusBadge } from "@/components/dashboard/StatCard";
import { AppShell } from "@/components/layout/AppShell";
import { formatCurrency, formatNumber } from "@/lib/format";
import { closeShift, useDataStore } from "@/lib/data-store";

export const Route = createFileRoute("/staff/shift")({
  head: () => ({
    meta: [
      { title: "تقفيل الوردية — السكرتارية" },
      {
        name: "description",
        content: "مطابقة النقدية وتقرير نهاية الوردية قبل تسليم الخزنة.",
      },
      { property: "og:title", content: "تقفيل الوردية — السكرتارية" },
      {
        property: "og:description",
        content: "مطابقة النقدية وإصدار تقرير نهاية الوردية للسنتر.",
      },
    ],
  }),
  component: ShiftPage,
});

function ShiftPage() {
  const { payments, attendanceRecords } = useDataStore();
  const expected = payments.reduce((s, p) => s + p.amount, 0);
  const [counted, setCounted] = useState(expected);
  const [closed, setClosed] = useState(false);
  const diff = counted - expected;

  return (
    <AppShell role="staff" title="تقفيل الوردية" description="مطابقة النقدية وتسليم تقرير اليوم">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="إجمالي التحصيل" value={formatCurrency(expected)} icon={Banknote} />
        <StatCard label="عدد الإيصالات" value={formatNumber(payments.length)} icon={ClipboardCheck} />
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
      </div>
    </AppShell>
  );
}
