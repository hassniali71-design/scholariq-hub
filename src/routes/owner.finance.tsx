import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowDownRight,
  Banknote,
  Crown,
  PiggyBank,
  Receipt,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { useMemo } from "react";

import { Panel, StatCard, StatusBadge } from "@/components/dashboard/StatCard";
import { AppShell } from "@/components/layout/AppShell";
import { formatCurrency, formatDateTime, formatNumber, formatPercent } from "@/lib/format";
import { computeStudentFees, useDataStore } from "@/lib/data-store";
import { buildTeacherFinance, computeOwnerKpis } from "@/lib/owner-metrics";

export const Route = createFileRoute("/owner/finance")({
  head: () => ({
    meta: [
      { title: "التدفق المالي — لوحة المالك" },
      {
        name: "description",
        content: "تحليل التحصيل والمصروفات والرواتب وصافي الربح لكل مدرس من البيانات الحقيقية.",
      },
      { property: "og:title", content: "التدفق المالي — لوحة المالك" },
      {
        property: "og:description",
        content: "أرقام مالية محسوبة من عمليات التحصيل والرواتب والمصروفات الحقيقية داخل السنتر.",
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
  const { payments, students, subjects } = state;

  const kpis = useMemo(() => computeOwnerKpis(state), [state]);
  const teacherFinance = useMemo(() => buildTeacherFinance(state), [state]);

  const monthlyStudents = students.filter(
    (s) => s.billing_plan === "monthly" || s.billing_plan === "both" || !s.billing_plan,
  ).length;
  const perSessionStudents = students.filter(
    (s) => s.billing_plan === "per_session" || s.billing_plan === "both",
  ).length;

  /** إيراد كل مادة = مجموع تحصيل طلابها الفعلي، والمتوقع من أسعار المواد. */
  const subjectRevenue = useMemo(() => {
    return subjects
      .map((sub) => {
        const enrolled = students.filter((s) => s.subject_ids.includes(sub.id));
        const codes = new Set(enrolled.map((s) => s.code));
        const collected = payments
          .filter((p) => codes.has(p.student_code))
          .reduce((s, p) => s + Number(p.amount), 0);
        const price = state.subjectPrices.find((p) => p.subject_id === sub.id);
        return {
          id: sub.id,
          name: sub.name,
          students: enrolled.length,
          collected,
          expected: enrolled.length * Number(price?.monthly_price ?? 0),
        };
      })
      .sort((a, b) => b.collected - a.collected || b.expected - a.expected);
  }, [subjects, students, payments, state.subjectPrices]);

  const topSubject = subjectRevenue[0];
  const grossBefore = kpis.monthRevenue;
  const marginBefore = grossBefore ? 100 : 0;
  const lastPayment = payments[0];

  const byMethod = ["cash", "wallet", "instapay"].map((m) => ({
    method: m,
    total: payments.filter((p) => p.method === m).reduce((s, p) => s + Number(p.amount), 0),
    count: payments.filter((p) => p.method === m).length,
  }));

  return (
    <AppShell
      role="owner"
      title="التدفق المالي"
      description="تحليل آلي كامل: تحصيل، رواتب، مصروفات، وصافي ربح لكل مدرس"
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="إيرادات الشهر"
          value={formatCurrency(kpis.monthRevenue)}
          icon={Banknote}
          tone="success"
        />
        <StatCard
          label="إجمالي الرواتب"
          value={formatCurrency(kpis.salariesTotal)}
          icon={PiggyBank}
          tone={kpis.salariesTotal > 0 ? "warning" : "success"}
        />
        <StatCard
          label="إجمالي المصروفات"
          value={formatCurrency(kpis.expensesTotal)}
          icon={Receipt}
          tone={kpis.expensesTotal > 0 ? "warning" : "success"}
        />
        <StatCard
          label="صافي الربح"
          value={formatCurrency(kpis.netProfit)}
          icon={TrendingUp}
          tone={kpis.netProfit >= 0 ? "success" : "destructive"}
          trend={`هامش ${formatPercent(kpis.netMarginPct)}`}
        />
      </div>

      <Panel title="التحليل الآلي للشهر" description="قبل الخصم وبعده، مع توزيع أنظمة الدفع">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Mini label="طلاب النظام الشهري" value={formatNumber(monthlyStudents)} icon={Users} />
          <Mini label="طلاب نظام الحصة" value={formatNumber(perSessionStudents)} icon={Users} />
          <Mini
            label="المادة الأعلى إيراداً"
            value={topSubject ? topSubject.name : "—"}
            icon={Crown}
            hint={topSubject ? formatCurrency(topSubject.collected) : undefined}
          />
          <Mini
            label="المستحقات المتأخرة"
            value={formatCurrency(kpis.overdueTotal)}
            icon={Wallet}
          />
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border-2 border-border p-4">
            <p className="text-sm font-bold text-muted-foreground">الإيراد قبل الخصم</p>
            <p className="kpi-number text-2xl">{formatCurrency(grossBefore)}</p>
            <p className="mt-1 text-sm font-bold text-muted-foreground">
              {formatPercent(marginBefore)}
            </p>
          </div>
          <div className="rounded-xl border-2 border-border p-4">
            <p className="text-sm font-bold text-muted-foreground">
              إجمالي الخصومات (رواتب + مصروفات)
            </p>
            <p className="kpi-number text-2xl">
              {formatCurrency(kpis.salariesTotal + kpis.expensesTotal)}
            </p>
          </div>
          <div className="rounded-xl border-2 border-border p-4">
            <p className="text-sm font-bold text-muted-foreground">الصافي بعد الخصم</p>
            <p className="kpi-number text-2xl">{formatCurrency(kpis.netProfit)}</p>
            <p className="mt-1 text-sm font-bold text-muted-foreground">
              {formatPercent(kpis.netMarginPct)} من الإيراد
            </p>
          </div>
        </div>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="التحصيل حسب وسيلة الدفع" description="من عمليات الكاشير الفعلية">
          <div className="space-y-4">
            {byMethod.map((m) => {
              const share = kpis.monthRevenue ? Math.round((m.total / kpis.monthRevenue) * 100) : 0;
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

        <Panel title="إيراد كل مادة" description="محصَّل فعلي مقابل المتوقع من أسعار المواد">
          <div className="space-y-3">
            {subjectRevenue.length === 0 ? (
              <Empty text="لا توجد مواد مسجّلة بعد." />
            ) : (
              subjectRevenue.map((s) => (
                <div key={s.id} className="rounded-xl border-2 border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-base font-black text-foreground">{s.name}</p>
                    <span className="kpi-number text-lg">{formatCurrency(s.collected)}</span>
                  </div>
                  <p className="mt-1 text-sm font-bold text-muted-foreground">
                    {formatNumber(s.students)} طالب · متوقع {formatCurrency(s.expected)}
                  </p>
                </div>
              ))
            )}
          </div>
        </Panel>
      </div>

      <Panel
        title="تحليل تفصيلي لكل مدرس"
        description="إيراد طلابه مقابل راتبه = الصافي الفعلي للسنتر من كل مدرس"
      >
        {teacherFinance.length === 0 ? (
          <Empty text="لا يوجد مدرسون مسجّلون بعد." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-base">
              <thead>
                <tr className="border-b-2 border-border text-muted-foreground">
                  <th className="pb-3">المدرس</th>
                  <th className="pb-3">المادة</th>
                  <th className="pb-3">الطلاب</th>
                  <th className="pb-3">إيراد طلابه</th>
                  <th className="pb-3">راتبه</th>
                  <th className="pb-3">صافي السنتر</th>
                </tr>
              </thead>
              <tbody>
                {teacherFinance.map((t) => (
                  <tr key={t.teacherId} className="border-b border-border last:border-0">
                    <td className="py-3 font-black text-foreground">{t.name}</td>
                    <td className="py-3 font-bold text-muted-foreground">{t.subject}</td>
                    <td className="py-3 font-extrabold">{formatNumber(t.studentsCount)}</td>
                    <td className="py-3 font-extrabold text-success">
                      {formatCurrency(t.revenue)}
                    </td>
                    <td className="py-3 font-extrabold text-destructive">
                      {formatCurrency(t.salary)}
                    </td>
                    <td className="py-3">
                      <StatusBadge tone={t.net >= 0 ? "success" : "destructive"}>
                        {formatCurrency(t.net)}
                      </StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel title="آخر عملية تحصيل" description="أحدث حركة حقيقية على قاعدة البيانات">
          {lastPayment ? (
            <div className="rounded-xl border-2 border-success/40 bg-success/5 p-5">
              <p className="text-lg font-black text-foreground">{lastPayment.student_name}</p>
              <p className="mt-1 text-sm font-bold text-muted-foreground">
                {lastPayment.item} · {lastPayment.student_code} ·{" "}
                {formatDateTime(lastPayment.created_at)}
              </p>
              <p className="kpi-number mt-3 text-3xl text-success">
                {formatCurrency(Number(lastPayment.amount))}
              </p>
              <StatusBadge tone="neutral">{METHOD_LABEL[lastPayment.method]}</StatusBadge>
            </div>
          ) : (
            <Empty text="لا توجد عمليات تحصيل بعد." />
          )}
        </Panel>

        <Panel
          title="آخر عمليات التحصيل"
          description="مباشرة من شباك الكاشير"
          className="xl:col-span-2"
        >
          {payments.length === 0 ? (
            <Empty text="لا توجد عمليات تحصيل مسجّلة بعد." />
          ) : (
            <div className="max-h-[26rem] space-y-3 overflow-y-auto pl-1">
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
      </div>

      <Panel title="مرجع أسعار المواد" description="الأساس الذي يُحسب منه إجمالي رسوم أي طالب">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {state.subjectPrices.length === 0 ? (
            <Empty text="لم يتم تحديد أسعار المواد بعد — حددها من صفحة الخزنة والنظام المالي." />
          ) : (
            state.subjectPrices.map((p) => (
              <div key={p.id} className="rounded-xl border-2 border-border p-4">
                <p className="text-base font-black text-foreground">{p.subject_name}</p>
                <p className="mt-1 text-sm font-bold text-muted-foreground">
                  شهري {formatCurrency(Number(p.monthly_price))} · بالحصة{" "}
                  {formatCurrency(Number(p.per_session_price))}
                </p>
              </div>
            ))
          )}
        </div>
        <p className="mt-3 text-sm font-bold text-muted-foreground">
          مثال: طالب مسجّل في كل المواد الحالية إجماليه الشهري{" "}
          {formatCurrency(
            computeStudentFees(
              state,
              subjects.map((s) => s.id),
            ).monthly,
          )}
          .
        </p>
      </Panel>
    </AppShell>
  );
}

function Mini({
  label,
  value,
  icon: Icon,
  hint,
}: {
  label: string;
  value: string;
  icon: typeof Users;
  hint?: string | undefined;
}) {
  return (
    <div className="rounded-xl border-2 border-border p-4">
      <p className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
        <Icon className="size-4 text-primary" />
        {label}
      </p>
      <p className="kpi-number mt-1 text-2xl">{value}</p>
      {hint ? <p className="mt-1 text-sm font-bold text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <p className="rounded-xl border-2 border-dashed border-border p-6 text-center text-base font-bold text-muted-foreground">
      {text}
    </p>
  );
}
