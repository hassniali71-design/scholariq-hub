import { createFileRoute } from "@tanstack/react-router";
import { ArrowDownRight, Banknote, PiggyBank, Receipt, Wallet } from "lucide-react";

import { Panel, StatCard, StatusBadge } from "@/components/dashboard/StatCard";
import { AppShell } from "@/components/layout/AppShell";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import { getFinanceSettings, useDataStore } from "@/lib/data-store";

export const Route = createFileRoute("/owner/finance")({
  head: () => ({
    meta: [
      { title: "التدفق المالي — لوحة المالك" },
      {
        name: "description",
        content: "تحليل التحصيل الفعلي والمستحقات وتوزيع الإيراد على المدرسين من البيانات الحقيقية.",
      },
      { property: "og:title", content: "التدفق المالي — لوحة المالك" },
      {
        property: "og:description",
        content: "أرقام مالية محسوبة من عمليات التحصيل الحقيقية داخل السنتر التعليمي.",
      },
    ],
  }),
  component: FinancePage,
});

const METHOD_LABEL: Record<string, string> = {
  cash: "كاش",
  wallet: "محفظة",
  instapay: "إنستاباي",
};

function FinancePage() {
  const state = useDataStore();
  const { payments, teachers, students } = state;
  const settings = getFinanceSettings(state);

  const collected = payments.reduce((s, p) => s + Number(p.amount), 0);
  const outstanding = students.reduce((s, st) => s + Number(st.balance_due), 0);
  const inSafe = state.safeHandovers.reduce((s, h) => s + Number(h.amount), 0);
  const expectedMonthly =
    settings.billing_mode === "monthly"
      ? students.length * settings.monthly_fee
      : settings.billing_mode === "per_session"
        ? students.length * settings.per_session_fee * 8
        : Math.round((students.length * settings.season_fee) / 4);
  const collectionRate = expectedMonthly ? Math.round((collected / expectedMonthly) * 100) : 0;

  const byMethod = ["cash", "wallet", "instapay"].map((m) => ({
    method: m,
    total: payments.filter((p) => p.method === m).reduce((s, p) => s + Number(p.amount), 0),
    count: payments.filter((p) => p.method === m).length,
  }));

  return (
    <AppShell
      role="owner"
      title="التدفق المالي"
      description="كل الأرقام محسوبة من عمليات التحصيل الفعلية المسجّلة في النظام"
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="إجمالي التحصيل" value={formatCurrency(collected)} icon={Banknote} />
        <StatCard
          label="مستحقات لم تُحصَّل"
          value={formatCurrency(outstanding)}
          icon={Receipt}
          tone={outstanding > 0 ? "warning" : "success"}
        />
        <StatCard label="المستلم في الخزنة" value={formatCurrency(inSafe)} icon={Wallet} tone="success" />
        <StatCard
          label="نسبة التحصيل للمتوقع"
          value={formatPercent(collectionRate)}
          icon={PiggyBank}
          tone={collectionRate >= 80 ? "success" : "warning"}
          trend={`المتوقع ${formatCurrency(expectedMonthly)}`}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="التحصيل حسب وسيلة الدفع" description="من عمليات الكاشير الفعلية">
          <div className="space-y-4">
            {byMethod.map((m) => {
              const share = collected ? Math.round((m.total / collected) * 100) : 0;
              return (
                <div key={m.method} className="rounded-xl border-2 border-border p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-base font-black text-foreground">{METHOD_LABEL[m.method]}</p>
                    <span className="kpi-number text-lg">{formatCurrency(m.total)}</span>
                  </div>
                  <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-navy" style={{ width: `${share}%` }} />
                  </div>
                  <p className="mt-2 text-sm font-bold text-muted-foreground">
                    {formatPercent(share)} · {formatNumber(m.count)} عملية
                  </p>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel title="توزيع الإيراد المتوقع على المدرسين" description="حسب عدد الطلاب المشتركين في مادة كل مدرس">
          <div className="space-y-4">
            {teachers.map((t) => {
              const enrolled = students.filter((s) => s.subject_ids.includes(t.subject_id)).length;
              const expected =
                settings.billing_mode === "monthly"
                  ? enrolled * settings.monthly_fee
                  : settings.billing_mode === "per_session"
                    ? enrolled * settings.per_session_fee * 8
                    : Math.round((enrolled * settings.season_fee) / 4);
              const share = expectedMonthly ? Math.round((expected / expectedMonthly) * 100) : 0;
              return (
                <div key={t.id} className="rounded-xl border-2 border-border p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-base font-black text-foreground">{t.full_name}</p>
                    <span className="kpi-number text-lg">{formatCurrency(expected)}</span>
                  </div>
                  <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${share}%` }} />
                  </div>
                  <p className="mt-2 text-sm font-bold text-muted-foreground">
                    {t.subject} · {formatNumber(enrolled)} طالب مشترك
                  </p>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      <Panel title="آخر عمليات التحصيل" description="مباشرة من شباك الكاشير">
        {payments.length === 0 ? (
          <p className="rounded-xl border-2 border-dashed border-border p-6 text-center text-base font-bold text-muted-foreground">
            لا توجد عمليات تحصيل مسجّلة بعد.
          </p>
        ) : (
          <div className="space-y-3">
            {payments.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-border p-4"
              >
                <div>
                  <p className="text-base font-black text-foreground">{p.student_name}</p>
                  <p className="text-sm font-bold text-muted-foreground">
                    {p.item} · {p.student_code} · {p.created_at}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge tone="neutral">{METHOD_LABEL[p.method]}</StatusBadge>
                  <span className="flex items-center gap-1 text-base font-black text-success">
                    <ArrowDownRight className="size-4" />
                    {formatCurrency(Number(p.amount))}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </AppShell>
  );
}
