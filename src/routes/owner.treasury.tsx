import { createFileRoute } from "@tanstack/react-router";
import { Banknote, Calculator, HandCoins, Settings2, Wallet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Panel, StatCard, StatusBadge } from "@/components/dashboard/StatCard";
import { AppShell } from "@/components/layout/AppShell";
import { getAccounts, subscribeAuth, type Account } from "@/lib/auth";
import {
  getFinanceSettings,
  recordSafeHandover,
  saveFinanceSettings,
  useDataStore,
} from "@/lib/data-store";
import { formatCurrency, formatDateTime, formatNumber } from "@/lib/format";
import type { BillingMode, StaffSalaryBasis } from "@/types";

export const Route = createFileRoute("/owner/treasury")({
  head: () => ({
    meta: [
      { title: "الخزنة والنظام المالي — لوحة المالك" },
      {
        name: "description",
        content: "اختيار نظام التعامل المالي للسنتر (شهري/بالحصة/بالسيزون) وسجل تسليم واستلام الخزنة.",
      },
      { property: "og:title", content: "الخزنة والنظام المالي — لوحة المالك" },
      {
        property: "og:description",
        content: "إعداد نظام الرسوم وأساس رواتب الموظفين وسجل استلام الخزنة الكامل.",
      },
    ],
  }),
  component: TreasuryPage,
});

const BILLING_MODES: { key: BillingMode; label: string; hint: string }[] = [
  { key: "monthly", label: "اشتراك شهري", hint: "الطالب يدفع مبلغاً ثابتاً كل شهر" },
  { key: "per_session", label: "بالحصة", hint: "الطالب يدفع عن كل حصة يحضرها" },
  { key: "season", label: "بالسيزون", hint: "مبلغ واحد لعدد حصص محدد (ترم / سيزون)" },
];

const SALARY_BASIS: { key: StaffSalaryBasis; label: string; hint: string }[] = [
  { key: "fixed", label: "راتب ثابت", hint: "مبلغ شهري ثابت لكل موظف" },
  { key: "per_session", label: "بالحصة", hint: "مبلغ عن كل حصة عمل" },
  { key: "revenue_share", label: "نسبة من الإيراد", hint: "نسبة مئوية من إيراد الشهر" },
];

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

  const [mode, setMode] = useState<BillingMode>(settings.billing_mode);
  const [monthlyFee, setMonthlyFee] = useState(String(settings.monthly_fee));
  const [sessionFee, setSessionFee] = useState(String(settings.per_session_fee));
  const [seasonFee, setSeasonFee] = useState(String(settings.season_fee));
  const [seasonSessions, setSeasonSessions] = useState(String(settings.season_sessions));
  const [salaryBasis, setSalaryBasis] = useState<StaffSalaryBasis>(settings.staff_salary_basis);
  const [salaryValue, setSalaryValue] = useState(String(settings.staff_salary_value));
  const [synced, setSynced] = useState(false);

  // البيانات بتوصل من الخادم بعد أول رندر — نزامن الفورم مرة واحدة أول ما توصل.
  useEffect(() => {
    if (synced || !settings.updated_at) return;
    setMode(settings.billing_mode);
    setMonthlyFee(String(settings.monthly_fee));
    setSessionFee(String(settings.per_session_fee));
    setSeasonFee(String(settings.season_fee));
    setSeasonSessions(String(settings.season_sessions));
    setSalaryBasis(settings.staff_salary_basis);
    setSalaryValue(String(settings.staff_salary_value));
    setSynced(true);
  }, [settings, synced]);

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

  const expectedMonthlyRevenue = useMemo(() => {
    const activeStudents = state.students.length;
    if (mode === "monthly") return activeStudents * Number(monthlyFee || 0);
    if (mode === "season")
      return Number(seasonSessions || 0) > 0
        ? Math.round((activeStudents * Number(seasonFee || 0)) / 4)
        : 0;
    // بالحصة: تقدير 8 حصص شهرياً لكل طالب
    return activeStudents * Number(sessionFee || 0) * 8;
  }, [mode, monthlyFee, seasonFee, seasonSessions, sessionFee, state.students.length]);

  const salaryEstimate = useMemo(() => {
    const value = Number(salaryValue || 0);
    if (salaryBasis === "fixed") return value * Math.max(1, staff.length);
    if (salaryBasis === "per_session") return value * state.groups.length * 4;
    return Math.round((expectedMonthlyRevenue * value) / 100);
  }, [salaryBasis, salaryValue, staff.length, state.groups.length, expectedMonthlyRevenue]);

  return (
    <AppShell
      role="owner"
      title="الخزنة والنظام المالي"
      description="اختيار نظام التعامل المالي للسنتر وتسجيل كل استلام من الموظفين"
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="إجمالي التحصيل المسجَّل" value={formatCurrency(collected)} icon={Banknote} />
        <StatCard
          label="المستلم في الخزنة"
          value={formatCurrency(totalReceived)}
          icon={Wallet}
          tone="success"
        />
        <StatCard
          label="لسه مع الموظفين"
          value={formatCurrency(pendingInStaffHands)}
          icon={HandCoins}
          tone={pendingInStaffHands > 0 ? "warning" : "success"}
        />
        <StatCard
          label="الإيراد المتوقع شهرياً"
          value={formatCurrency(expectedMonthlyRevenue)}
          icon={Calculator}
        />
      </div>

      <Panel
        title="نظام التعامل المالي للسنتر"
        description="اختيار المركز نفسه — كل حسابات الرسوم ورواتب الموظفين تُبنى عليه"
      >
        <div className="space-y-6">
          <div className="grid gap-3 md:grid-cols-3">
            {BILLING_MODES.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setMode(m.key)}
                className={`rounded-xl border-2 p-4 text-right transition-colors ${
                  mode === m.key ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                }`}
              >
                <p className="text-base font-black text-foreground">{m.label}</p>
                <p className="mt-1 text-sm font-bold text-muted-foreground">{m.hint}</p>
              </button>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field label="الاشتراك الشهري (ج.م)" value={monthlyFee} onChange={setMonthlyFee} />
            <Field label="سعر الحصة (ج.م)" value={sessionFee} onChange={setSessionFee} />
            <Field label="سعر السيزون (ج.م)" value={seasonFee} onChange={setSeasonFee} />
            <Field label="عدد حصص السيزون" value={seasonSessions} onChange={setSeasonSessions} />
          </div>

          <div>
            <p className="mb-3 flex items-center gap-2 text-base font-black text-foreground">
              <Settings2 className="size-5 text-primary" />
              أساس حساب رواتب الموظفين
            </p>
            <div className="grid gap-3 md:grid-cols-3">
              {SALARY_BASIS.map((b) => (
                <button
                  key={b.key}
                  type="button"
                  onClick={() => setSalaryBasis(b.key)}
                  className={`rounded-xl border-2 p-4 text-right transition-colors ${
                    salaryBasis === b.key
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <p className="text-base font-black text-foreground">{b.label}</p>
                  <p className="mt-1 text-sm font-bold text-muted-foreground">{b.hint}</p>
                </button>
              ))}
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field
                label={salaryBasis === "revenue_share" ? "النسبة (٪)" : "القيمة (ج.م)"}
                value={salaryValue}
                onChange={setSalaryValue}
              />
              <div className="rounded-xl border-2 border-border p-4">
                <p className="text-sm font-bold text-muted-foreground">تقدير إجمالي الرواتب شهرياً</p>
                <p className="kpi-number mt-1 text-2xl">{formatCurrency(salaryEstimate)}</p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              saveFinanceSettings({
                billing_mode: mode,
                monthly_fee: Number(monthlyFee || 0),
                per_session_fee: Number(sessionFee || 0),
                season_fee: Number(seasonFee || 0),
                season_sessions: Number(seasonSessions || 0),
                staff_salary_basis: salaryBasis,
                staff_salary_value: Number(salaryValue || 0),
              });
              toast.success("تم حفظ النظام المالي للسنتر");
            }}
            className="rounded-xl bg-navy px-6 py-3 text-base font-black text-navy-foreground transition-opacity hover:opacity-90"
          >
            حفظ الإعدادات المالية
          </button>
        </div>
      </Panel>

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
            <div className="space-y-3">
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
                      <StatusBadge tone="neutral">{h.staff_identifier}</StatusBadge>
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
    </AppShell>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-black text-muted-foreground">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="numeric"
        className="w-full rounded-xl border-2 border-border bg-background px-4 py-3 text-base font-extrabold text-foreground outline-none focus:border-primary"
      />
    </label>
  );
}
