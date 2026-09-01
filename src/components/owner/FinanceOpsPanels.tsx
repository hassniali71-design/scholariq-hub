import { Banknote, Plus, Receipt, Tags, Trash2, Users2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Panel, StatusBadge } from "@/components/dashboard/StatCard";
import { getAccounts, subscribeAuth, type Account } from "@/lib/auth";
import {
  addExpense,
  addPayroll,
  deleteExpense,
  deletePayroll,
  saveSubjectPrice,
  useDataStore,
} from "@/lib/data-store";
import { formatCurrency, formatDateTime, formatNumber } from "@/lib/format";
import type { ExpenseCategory, PayrollBasis } from "@/types";

const inputClass =
  "w-full rounded-xl border-2 border-border bg-background px-4 py-3 text-base font-extrabold text-foreground outline-none placeholder:font-bold placeholder:text-muted-foreground focus:border-primary";

const CATEGORIES: { key: ExpenseCategory; label: string }[] = [
  { key: "maintenance", label: "صيانة" },
  { key: "bills", label: "فواتير" },
  { key: "rent", label: "إيجار" },
  { key: "supplies", label: "مستلزمات" },
  { key: "marketing", label: "تسويق" },
  { key: "other", label: "أخرى" },
];

const BASIS: { key: PayrollBasis; label: string }[] = [
  { key: "per_session", label: "بالحصة" },
  { key: "weekly", label: "أسبوعي" },
  { key: "monthly", label: "شهري" },
];

/** أسعار المواد — أساس الحساب الآلي لإجمالي رسوم الطالب حسب مواده. */
export function SubjectPricingPanel() {
  const state = useDataStore();
  return (
    <Panel
      title="تسعير المواد"
      description="حدّد سعر كل مادة، والنظام يحسب إجمالي رسوم الطالب آلياً من مواده"
    >
      {state.subjects.length === 0 ? (
        <Empty text="لا توجد مواد مسجّلة بعد." />
      ) : (
        <div className="space-y-3">
          {state.subjects.map((sub) => {
            const price = state.subjectPrices.find((p) => p.subject_id === sub.id);
            return (
              <div
                key={sub.id}
                className="grid items-end gap-3 rounded-xl border-2 border-border p-4 md:grid-cols-3"
              >
                <p className="flex items-center gap-2 text-base font-black text-foreground">
                  <Tags className="size-5 text-primary" />
                  {sub.name}
                </p>
                <PriceInput
                  label="سعر الشهر (ج.م)"
                  initial={String(price?.monthly_price ?? 0)}
                  onCommit={(v) =>
                    saveSubjectPrice(sub.id, v, Number(price?.per_session_price ?? 0))
                  }
                />
                <PriceInput
                  label="سعر الحصة (ج.م)"
                  initial={String(price?.per_session_price ?? 0)}
                  onCommit={(v) => saveSubjectPrice(sub.id, Number(price?.monthly_price ?? 0), v)}
                />
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

function PriceInput({
  label,
  initial,
  onCommit,
}: {
  label: string;
  initial: string;
  onCommit: (value: number) => void;
}) {
  const [value, setValue] = useState(initial);
  useEffect(() => setValue(initial), [initial]);
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-black text-muted-foreground">{label}</span>
      <input
        value={value}
        inputMode="numeric"
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          const num = Number(value || 0);
          if (String(num) !== initial) {
            onCommit(num);
            toast.success("تم حفظ السعر");
          }
        }}
        className={inputClass}
      />
    </label>
  );
}

/** المصروفات العامة — تُخصم مباشرة من صافي الربح. */
export function ExpensesPanel() {
  const state = useDataStore();
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("other");
  const total = state.expenses.reduce((s, e) => s + Number(e.amount), 0);

  return (
    <Panel
      title="المصروفات العامة"
      description={`${formatNumber(state.expenses.length)} مصروف · إجمالي ${formatCurrency(total)}`}
    >
      <form
        className="grid gap-3 md:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault();
          const value = Number(amount);
          if (!title.trim() || !Number.isFinite(value) || value <= 0) {
            toast.error("اكتب اسم المصروف ومبلغاً صحيحاً");
            return;
          }
          addExpense({ title: title.trim(), amount: value, category });
          setTitle("");
          setAmount("");
          toast.success("تم تسجيل المصروف");
        }}
      >
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="اسم المصروف"
          className={inputClass}
        />
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="numeric"
          placeholder="المبلغ (ج.م)"
          className={inputClass}
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
          className={inputClass}
        >
          {CATEGORIES.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="flex items-center justify-center gap-2 rounded-xl bg-navy px-4 py-3 text-base font-black text-navy-foreground hover:opacity-90"
        >
          <Plus className="size-5" />
          تسجيل
        </button>
      </form>

      <div className="mt-4 space-y-3">
        {state.expenses.length === 0 ? (
          <Empty text="لا توجد مصروفات مسجّلة بعد." />
        ) : (
          state.expenses.map((e) => (
            <div
              key={e.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-border p-4"
            >
              <div>
                <p className="flex items-center gap-2 text-base font-black text-foreground">
                  <Receipt className="size-5 text-warning" />
                  {e.title}
                </p>
                <p className="text-sm font-bold text-muted-foreground">
                  {formatDateTime(e.spent_at)} ·{" "}
                  {CATEGORIES.find((c) => c.key === e.category)?.label ?? e.category}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-black text-destructive">
                  {formatCurrency(Number(e.amount))}
                </span>
                <button
                  type="button"
                  onClick={() => deleteExpense(e.id)}
                  className="rounded-lg border-2 border-border p-2 text-destructive hover:border-destructive"
                  aria-label="حذف المصروف"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </Panel>
  );
}

/** الرواتب — تُسجَّل كـ"صادر" حقيقي ضمن التدفق المالي. */
export function PayrollPanel() {
  const state = useDataStore();
  const [staff, setStaff] = useState<Account[]>([]);
  const [personKey, setPersonKey] = useState("");
  const [basis, setBasis] = useState<PayrollBasis>("monthly");
  const [amount, setAmount] = useState("");

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      void getAccounts().then((rows) => {
        if (!cancelled) setStaff(rows.filter((a) => a.role === "staff"));
      });
    };
    refresh();
    const unsub = subscribeAuth(refresh);
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  const total = state.payrollRecords.reduce((s, p) => s + Number(p.amount), 0);

  return (
    <Panel
      title="الرواتب (صادر)"
      description={`${formatNumber(state.payrollRecords.length)} صرف · إجمالي ${formatCurrency(total)}`}
    >
      <form
        className="grid gap-3 md:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault();
          const value = Number(amount);
          if (!personKey || !Number.isFinite(value) || value <= 0) {
            toast.error("اختر الشخص وأدخل مبلغاً صحيحاً");
            return;
          }
          const [type, id] = personKey.split("|");
          const name =
            type === "teacher"
              ? (state.teachers.find((t) => t.id === id)?.full_name ?? "")
              : (staff.find((a) => a.id === id)?.full_name ?? "");
          addPayroll({
            personType: type === "teacher" ? "teacher" : "staff",
            personId: id ?? null,
            personName: name,
            basis,
            amount: value,
          });
          setAmount("");
          toast.success("تم تسجيل الراتب كصادر");
        }}
      >
        <select
          value={personKey}
          onChange={(e) => setPersonKey(e.target.value)}
          className={inputClass}
        >
          <option value="">اختر مدرس / موظف</option>
          {state.teachers.map((t) => (
            <option key={t.id} value={`teacher|${t.id}`}>
              مدرس — {t.full_name}
            </option>
          ))}
          {staff.map((a) => (
            <option key={a.id} value={`staff|${a.id}`}>
              موظف — {a.full_name}
            </option>
          ))}
        </select>
        <select
          value={basis}
          onChange={(e) => setBasis(e.target.value as PayrollBasis)}
          className={inputClass}
        >
          {BASIS.map((b) => (
            <option key={b.key} value={b.key}>
              {b.label}
            </option>
          ))}
        </select>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="numeric"
          placeholder="المبلغ (ج.م)"
          className={inputClass}
        />
        <button
          type="submit"
          className="flex items-center justify-center gap-2 rounded-xl bg-navy px-4 py-3 text-base font-black text-navy-foreground hover:opacity-90"
        >
          <Banknote className="size-5" />
          صرف
        </button>
      </form>

      <div className="mt-4 space-y-3">
        {state.payrollRecords.length === 0 ? (
          <Empty text="لا توجد رواتب مسجّلة بعد." />
        ) : (
          state.payrollRecords.map((p) => (
            <div
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-border p-4"
            >
              <div>
                <p className="flex items-center gap-2 text-base font-black text-foreground">
                  <Users2 className="size-5 text-primary" />
                  {p.person_name}
                </p>
                <p className="text-sm font-bold text-muted-foreground">
                  {formatDateTime(p.paid_at)} · {BASIS.find((b) => b.key === p.basis)?.label}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge tone="neutral">
                  {p.person_type === "teacher" ? "مدرس" : "موظف"}
                </StatusBadge>
                <span className="text-lg font-black text-destructive">
                  {formatCurrency(Number(p.amount))}
                </span>
                <button
                  type="button"
                  onClick={() => deletePayroll(p.id)}
                  className="rounded-lg border-2 border-border p-2 text-destructive hover:border-destructive"
                  aria-label="حذف الراتب"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </Panel>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <p className="rounded-xl border-2 border-dashed border-border p-6 text-center text-base font-bold text-muted-foreground">
      {text}
    </p>
  );
}
