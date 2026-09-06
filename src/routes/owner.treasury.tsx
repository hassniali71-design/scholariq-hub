import { createFileRoute } from "@tanstack/react-router";
import { Banknote, Calculator, HandCoins, Wallet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Panel, StatCard } from "@/components/dashboard/StatCard";
import { SubjectPricingPanel, ExpensesPanel, PayrollPanel } from "@/components/owner/FinanceOpsPanels";
import { MonthOverMonthPanel } from "@/components/owner/MonthOverMonthPanel";
import { PaperCreditsPanel } from "@/components/owner/PaperCreditsPanel";
import { AppShell } from "@/components/layout/AppShell";
import { getAccounts, subscribeAuth, type Account } from "@/lib/auth";
import {
  getFinanceSettings,
  recordSafeHandover,
  saveFinanceSettings,
  useDataStore,
} from "@/lib/data-store";
import { formatCurrency, formatDateTime, formatNumber } from "@/lib/format";

export const Route = createFileRoute("/owner/treasury")({
  head: () => ({
    meta: [
      { title: "الخزنة — لوحة المالك" },
      {
        name: "description",
        content: "مقارنة الأداء المالي، تسليم واستلام الخزنة، أسعار المواد، المصروفات، والرواتب.",
      },
    ],
  }),
  component: TreasuryPage,
});

function TreasuryPage() {
  const state = useDataStore();
  const settings = getFinanceSettings(state);
  const [staff, setStaff] = useState<Account[]>([]);

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      void getAccounts().then((rows) => {
        if (!cancelled) setStaff(rows.filter((a) => a.role === "staff"));
      });
    };
    refresh();
    return subscribeAuth(refresh);
  }, []);

  // §1.16 — تم حذف "السعة الافتراضية" من هنا؛ تُعرَّف per-group عند إنشائها.

  const [staffName, setStaffName] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  const totalReceived = useMemo(
    () => state.safeHandovers.reduce((s, h) => s + Number(h.amount), 0),
    [state.safeHandovers],
  );
  const collected = useMemo(
    () => state.payments.reduce((s, p) => s + Number(p.amount), 0),
    [state.payments],
  );
  const pendingInStaffHands = Math.max(0, collected - totalReceived);
  const totalExpenses = useMemo(
    () => state.expenses.reduce((s, e) => s + Number(e.amount), 0),
    [state.expenses],
  );
  const totalPayroll = useMemo(
    () => state.payrollRecords.reduce((s, p) => s + Number(p.amount), 0),
    [state.payrollRecords],
  );
  const biggestPayment = useMemo(
    () => state.payments.reduce<number>((m, p) => Math.max(m, Number(p.amount)), 0),
    [state.payments],
  );

  return (
    <AppShell
      role="owner"
      title="الخزنة"
      description="مقارنة الأداء المالي، تسليم واستلام الخزنة، ورواتب الموظفين"
    >
      {/* 4 كروت حوكمة إضافية (القسم 7) */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="إجمالي الإيرادات"
          value={formatCurrency(collected)}
          icon={Banknote}
          tone="success"
          trend="مدى الحياة"
        />
        <StatCard
          label="صافي الشهر الحالي"
          value={formatCurrency(collected - totalExpenses - totalPayroll)}
          icon={Wallet}
          tone={collected > totalExpenses + totalPayroll ? "success" : "destructive"}
          trend="تحصيل − مصروفات − رواتب"
        />
        <StatCard
          label="مصروفات مفتوحة"
          value={formatCurrency(totalExpenses)}
          icon={HandCoins}
          tone={totalExpenses > 0 ? "warning" : "success"}
        />
        <StatCard
          label="أكبر تحصيل"
          value={formatCurrency(biggestPayment)}
          icon={Banknote}
        />
      </div>

      <MonthOverMonthPanel />

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel title="تسجيل استلام من الخزنة" description="كل مبلغ يستلمه المدير من موظف">
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const value = Number(amount);
              if (!staffName.trim() || !Number.isFinite(value) || value <= 0) {
                toast.error("اختر الموظف وأدخل مبلغاً صحيحاً");
                return;
              }
              const account = staff.find((a) => a.full_name === staffName);
              recordSafeHandover({
                staffName: staffName.trim(),
                staffIdentifier: account?.identifier ?? null,
                amount: value,
                note: note.trim() || null,
              });
              setAmount("");
              setNote("");
              toast.success("تم تسجيل الاستلام في سجل الخزنة");
            }}
          >
            <select
              value={staffName}
              onChange={(e) => setStaffName(e.target.value)}
              className="w-full rounded-xl border-2 border-border bg-background px-4 py-3 text-base font-extrabold text-foreground outline-none focus:border-primary"
            >
              <option value="">اختر الموظف</option>
              {staff.map((a) => (
                <option key={a.id} value={a.full_name}>
                  {a.full_name} — {a.identifier}
                </option>
              ))}
            </select>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              inputMode="numeric"
              placeholder="المبلغ المستلم (ج.م)"
              className="w-full rounded-xl border-2 border-border bg-background px-4 py-3 text-base font-extrabold text-foreground outline-none placeholder:font-bold placeholder:text-muted-foreground focus:border-primary"
            />
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="ملاحظة (اختياري)"
              className="w-full rounded-xl border-2 border-border bg-background px-4 py-3 text-base font-extrabold text-foreground outline-none placeholder:font-bold placeholder:text-muted-foreground focus:border-primary"
            />
            <button
              type="submit"
              className="w-full rounded-xl bg-navy px-4 py-3 text-base font-black text-navy-foreground transition-opacity hover:opacity-90"
            >
              تسجيل الاستلام
            </button>
          </form>
        </Panel>

        <Panel
          title="سجل تسليم واستلام الخزنة"
          description={`${formatNumber(state.safeHandovers.length)} عملية مسجّلة`}
          className="xl:col-span-2"
        >
          {state.safeHandovers.length === 0 ? (
            <p className="rounded-xl border-2 border-dashed border-border p-6 text-center text-base font-bold text-muted-foreground">
              لا يوجد أي استلام مسجّل بعد.
            </p>
          ) : (
            <div className="max-h-[28rem] space-y-3 overflow-y-auto pr-1">
              {state.safeHandovers.map((h) => (
                <div
                  key={h.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-border p-4"
                >
                  <div>
                    <p className="text-base font-black text-foreground">{h.staff_name}</p>
                    <p className="text-sm font-bold text-muted-foreground">
                      {formatDateTime(h.received_at)}
                      {h.note ? ` · ${h.note}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {h.staff_identifier ? (
                      <span className="rounded-xl border-2 border-border px-3 py-1 text-sm font-black text-foreground">
                        {h.staff_identifier}
                      </span>
                    ) : null}
                    <span className="text-lg font-black text-success">
                      {formatCurrency(Number(h.amount))}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <SubjectPricingPanel />
      <ExpensesPanel />
      <PayrollPanel />
      <PaperCreditsPanel />
    </AppShell>
  );
}

void Calculator;
