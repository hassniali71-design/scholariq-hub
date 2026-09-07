import { ArrowDown, ArrowUp, Minus } from "lucide-react";

import { Panel, StatusBadge } from "@/components/dashboard/StatCard";
import { useDataStore } from "@/lib/data-store";
import { formatCurrency, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * §0.3 — مقارنة الأداء المالي بين الشهر الحالي والشهر السابق.
 * يحسب من تواريخ الدفعات والمصروفات الحقيقية فعلياً.
 */
function rangeFor(offsetMonths: number): { from: number; to: number } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + offsetMonths, 1, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth() + offsetMonths + 1, 1, 0, 0, 0, 0);
  return { from: start.getTime(), to: end.getTime() };
}

function inRange(iso: string | null | undefined, range: { from: number; to: number }): boolean {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return Number.isFinite(t) && t >= range.from && t < range.to;
}

interface Snapshot {
  collected: number;
  expenses: number;
  payroll: number;
  net: number;
}

function snapshot(
  state: ReturnType<typeof useDataStore>,
  range: { from: number; to: number },
): Snapshot {
  const collected = state.payments
    .filter((p) => inRange(p.created_at, range))
    .reduce((s, p) => s + Number(p.amount), 0);
  const expenses = state.expenses
    .filter((e) => inRange(e.spent_at ?? e.created_at, range))
    .reduce((s, e) => s + Number(e.amount), 0);
  const payroll = state.payrollRecords
    .filter((p) => inRange(p.paid_at, range))
    .reduce((s, p) => s + Number(p.amount), 0);
  return { collected, expenses, payroll, net: collected - expenses - payroll };
}

function Delta({
  current,
  previous,
  invertTone = false,
}: {
  current: number;
  previous: number;
  invertTone?: boolean | undefined;
}) {
  if (previous === 0 && current === 0) {
    return (
      <StatusBadge tone="neutral">
        <Minus className="size-3" />
        بدون بيانات
      </StatusBadge>
    );
  }
  if (previous === 0) {
    return (
      <StatusBadge tone="success">
        <ArrowUp className="size-3" />
        جديد
      </StatusBadge>
    );
  }
  const diff = current - previous;
  const pct = Math.round((diff / previous) * 100);
  const positiveIsGood = !invertTone;
  const isUp = diff > 0;
  const isGood = positiveIsGood ? isUp : !isUp;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-lg border-2 px-2 py-1 text-sm font-black",
        isGood
          ? "border-success/40 bg-success/10 text-success"
          : "border-destructive/40 bg-destructive/10 text-destructive",
      )}
    >
      {isUp ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
      {Math.abs(pct)}% عن الشهر السابق
    </span>
  );
}

export function MonthOverMonthPanel() {
  const state = useDataStore();
  const current = snapshot(state, rangeFor(0));
  const previous = snapshot(state, rangeFor(-1));

  return (
    <Panel
      title="مقارنة الأداء المالي — الشهر الحالي vs السابق"
      description="كل الأرقام محسوبة من تواريخ الدفعات والمصروفات الحقيقية"
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="التحصيل" current={current.collected} previous={previous.collected} />
        <Metric
          label="المصروفات"
          current={current.expenses}
          previous={previous.expenses}
          invertTone
        />
        <Metric label="الرواتب" current={current.payroll} previous={previous.payroll} invertTone />
        <Metric label="الصافي" current={current.net} previous={previous.net} />
      </div>
    </Panel>
  );
}

function Metric({
  label,
  current,
  previous,
  invertTone,
}: {
  label: string;
  current: number;
  previous: number;
  invertTone?: boolean;
}) {
  return (
    <div className="rounded-xl border-2 border-border p-4">
      <p className="text-sm font-black text-muted-foreground">{label}</p>
      <p className="kpi-number mt-1 text-2xl">{formatCurrency(current)}</p>
      <p className="mt-1 text-xs font-bold text-muted-foreground">
        الشهر السابق: {formatCurrency(previous)}
      </p>
      <div className="mt-2">
        <Delta current={current} previous={previous} invertTone={invertTone} />
      </div>
    </div>
  );
}
