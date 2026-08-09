import { createFileRoute } from "@tanstack/react-router";
import { ArrowDownRight, ArrowUpRight, Banknote, PiggyBank, Receipt } from "lucide-react";

import { RevenueChart } from "@/components/dashboard/Charts";
import { Panel, StatCard, StatusBadge } from "@/components/dashboard/StatCard";
import { AppShell } from "@/components/layout/AppShell";
import { formatCurrency, formatPercent } from "@/lib/format";
import { useDataStore } from "@/lib/data-store";
import { revenueSeries } from "@/lib/mock-data";

export const Route = createFileRoute("/owner/finance")({
  head: () => ({
    meta: [
      { title: "التدفق المالي — لوحة المالك" },
      {
        name: "description",
        content: "تحليل الإيرادات والمصروفات وصافي الربح وتوزيع الدخل على المدرسين.",
      },
      { property: "og:title", content: "التدفق المالي — لوحة المالك" },
      {
        property: "og:description",
        content: "تحليل الإيرادات والمصروفات وصافي الربح داخل السنتر التعليمي.",
      },
    ],
  }),
  component: FinancePage,
});

function FinancePage() {
  const { payments, teachers } = useDataStore();
  const last = revenueSeries[revenueSeries.length - 1]!;
  const totalRevenue = revenueSeries.reduce((s, r) => s + r.revenue, 0);
  const totalExpenses = revenueSeries.reduce((s, r) => s + r.expenses, 0);
  const margin = Math.round((last.profit / last.revenue) * 100);

  return (
    <AppShell
      role="owner"
      title="التدفق المالي"
      description="متابعة الإيرادات والمصروفات وهامش الربح لكل فرع"
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="إيرادات ٦ أشهر" value={formatCurrency(totalRevenue)} icon={Banknote} />
        <StatCard
          label="إجمالي المصروفات"
          value={formatCurrency(totalExpenses)}
          icon={Receipt}
          tone="warning"
          trendDirection="down"
          trend="+٥٪ عن المتوسط"
        />
        <StatCard
          label="صافي ربح الشهر"
          value={formatCurrency(last.profit)}
          icon={PiggyBank}
          tone="success"
          trend="+٩٪"
        />
        <StatCard label="هامش الربح" value={formatPercent(margin)} icon={ArrowUpRight} />
      </div>

      <Panel title="منحنى الإيرادات وصافي الربح" description="آخر ٦ أشهر">
        <RevenueChart data={revenueSeries} />
      </Panel>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="تفصيل الشهور" description="الإيراد والمصروف والربح لكل شهر">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead>
                <tr className="border-b-2 border-border text-muted-foreground">
                  <th className="pb-3">الشهر</th>
                  <th className="pb-3">الإيراد</th>
                  <th className="pb-3">المصروف</th>
                  <th className="pb-3">الربح</th>
                </tr>
              </thead>
              <tbody>
                {revenueSeries.map((r) => (
                  <tr key={r.month} className="border-b border-border last:border-0">
                    <td className="py-3 font-black text-foreground">{r.month}</td>
                    <td className="py-3 font-extrabold">{formatCurrency(r.revenue)}</td>
                    <td className="py-3 font-extrabold text-destructive">
                      {formatCurrency(r.expenses)}
                    </td>
                    <td className="py-3 font-black text-primary">{formatCurrency(r.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="توزيع الإيراد على المدرسين" description="حصة كل مدرس من إيراد الشهر">
          <div className="space-y-4">
            {teachers.map((t) => {
              const share = Math.round((t.monthly_revenue / last.revenue) * 100);
              return (
                <div key={t.id} className="rounded-xl border-2 border-border p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-black text-foreground">{t.full_name}</p>
                    <span className="kpi-number text-lg">{formatCurrency(t.monthly_revenue)}</span>
                  </div>
                  <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-navy" style={{ width: `${share}%` }} />
                  </div>
                  <p className="mt-2 text-xs font-bold text-muted-foreground">
                    {formatPercent(share)} من إيراد الشهر · {t.subject}
                  </p>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      <Panel title="آخر عمليات التحصيل" description="مباشرة من شباك الكاشير">
        <div className="space-y-3">
          {payments.map((p) => (
            <div
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-border p-4"
            >
              <div>
                <p className="font-black text-foreground">{p.student_name}</p>
                <p className="text-xs font-bold text-muted-foreground">
                  {p.item} · {p.student_code} · {p.created_at}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge tone="neutral">
                  {p.method === "cash" ? "كاش" : p.method === "wallet" ? "محفظة" : "إنستاباي"}
                </StatusBadge>
                <span className="flex items-center gap-1 font-black text-success">
                  <ArrowDownRight className="size-4" />
                  {formatCurrency(p.amount)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </AppShell>
  );
}
