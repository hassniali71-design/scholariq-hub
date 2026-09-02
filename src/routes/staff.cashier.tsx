import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Banknote, CreditCard, Plus, Receipt, Search, Smartphone } from "lucide-react";
import { toast } from "sonner";

import { Panel, StatCard, StatusBadge } from "@/components/dashboard/StatCard";
import { AppShell } from "@/components/layout/AppShell";
import { formatCurrency, formatNumber } from "@/lib/format";
import { recordPayment, sumSubjectFees, useDataStore } from "@/lib/data-store";
import type { PaymentMethod, Student } from "@/types";

export const Route = createFileRoute("/staff/cashier")({
  head: () => ({
    meta: [
      { title: "شباك الكاشير — السكرتارية" },
      {
        name: "description",
        content: "تحصيل اشتراكات الطلاب حسب كل مادة وبيع الملازم وطباعة الإيصالات فوراً.",
      },
      { property: "og:title", content: "شباك الكاشير — السكرتارية" },
      {
        property: "og:description",
        content: "تحصيل اشتراكات الطلاب وبيع الملازم وإصدار الإيصالات فوراً.",
      },
    ],
  }),
  component: CashierPage,
});

const methods: { key: PaymentMethod; label: string; icon: typeof Banknote }[] = [
  { key: "cash", label: "كاش", icon: Banknote },
  { key: "wallet", label: "محفظة", icon: Smartphone },
  { key: "instapay", label: "إنستاباي", icon: CreditCard },
];

const planLabels: Record<string, string> = {
  per_session: "حصة",
  monthly: "شهر",
  season: "موسم",
  both: "شهر + حصة",
};

function CashierPage() {
  const state = useDataStore();
  const { students, payments: records, booklets, subjects } = state;

  const [query, setQuery] = useState("");
  const [studentId, setStudentId] = useState<string>("");
  const [item, setItem] = useState("");
  const [amount, setAmount] = useState(0);
  const [method, setMethod] = useState<PaymentMethod>("cash");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) => s.full_name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q),
    );
  }, [students, query]);

  const student = students.find((s) => s.id === studentId);
  const total = records.reduce((sum, r) => sum + r.amount, 0);

  const subjectLines = (s: Student) =>
    s.subject_ids.map((id) => ({
      id,
      name: subjects.find((sub) => sub.id === id)?.name ?? id,
      price: Number(s.subject_fees?.[id] ?? 0),
    }));

  const pick = (s: Student, label: string, value: number) => {
    setStudentId(s.id);
    setItem(label);
    setAmount(value);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!student) {
      toast.error("اختر طالباً من القائمة أولاً");
      return;
    }
    if (!item.trim()) {
      toast.error("اختر البند الذي يتم تحصيله");
      return;
    }
    if (!amount || amount <= 0) {
      toast.error("أدخل مبلغاً صحيحاً");
      return;
    }
    recordPayment(student.code, amount, method, item.trim());
    toast.success("تم التحصيل وطباعة الإيصال", {
      description: `${student.full_name} · ${formatCurrency(amount)}`,
    });
  };

  return (
    <AppShell
      role="staff"
      title="شباك الكاشير"
      description="تحصيل حسب كل مادة مع إيصال فوري وإشعار واتساب"
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="تحصيل الوردية"
          value={formatCurrency(total)}
          icon={Banknote}
          tone="success"
        />
        <StatCard label="عدد العمليات" value={formatNumber(records.length)} icon={Receipt} />
        <StatCard
          label="طلاب عليهم مستحقات"
          value={formatNumber(students.filter((s) => s.balance_due > 0).length)}
          icon={CreditCard}
          tone="destructive"
        />
      </div>

      <Panel
        title="شبكة التحصيل — كل الطلاب"
        description="اضغط على أي مادة لتحصيل قيمتها من الطالب مباشرة"
      >
        <div className="mb-4 flex items-center gap-2 rounded-xl border-2 border-border px-3">
          <Search className="size-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث باسم الطالب أو كوده"
            className="h-12 w-full bg-transparent text-sm font-black outline-none"
          />
        </div>

        {students.length === 0 ? (
          <p className="rounded-xl border-2 border-dashed border-border p-6 text-center text-sm font-black text-muted-foreground">
            لا توجد بيانات بعد — أضف طلاباً من صفحة المالك (إدارة الوصول) وسيظهرون هنا فوراً.
          </p>
        ) : (
          <div className="space-y-3">
            {filtered.map((s) => {
              const lines = subjectLines(s);
              const expected = sumSubjectFees(s.subject_fees);
              return (
                <div
                  key={s.id}
                  className={`rounded-xl border-2 p-4 ${
                    studentId === s.id ? "border-primary bg-primary/5" : "border-border"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-black text-foreground">{s.full_name}</p>
                      <p className="text-xs font-bold text-muted-foreground">
                        {s.code} · {s.grade} · نوع الحساب:{" "}
                        {planLabels[s.billing_plan ?? "monthly"] ?? "شهر"}
                      </p>
                    </div>
                    <StatusBadge tone={s.balance_due > 0 ? "warning" : "success"}>
                      {s.balance_due > 0
                        ? `مستحق ${formatCurrency(s.balance_due)}`
                        : "لا توجد مستحقات"}
                    </StatusBadge>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {lines.length === 0 ? (
                      <span className="text-xs font-bold text-muted-foreground">
                        لا توجد مواد مسجّلة لهذا الطالب.
                      </span>
                    ) : (
                      lines.map((l) => (
                        <button
                          key={l.id}
                          type="button"
                          onClick={() => pick(s, `${l.name} — ${s.grade}`, l.price)}
                          className="rounded-xl border-2 border-border px-3 py-2 text-xs font-black text-foreground hover:border-primary"
                        >
                          {l.name} · {formatCurrency(l.price)}
                        </button>
                      ))
                    )}
                  </div>
                  {expected > 0 ? (
                    <p className="mt-2 text-xs font-bold text-muted-foreground">
                      إجمالي رسوم المواد: {formatCurrency(expected)}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Panel title="عملية تحصيل جديدة" description="الطالب المختار من الشبكة أعلاه">
          <form onSubmit={submit} className="space-y-4">
            <Field label="الطالب">
              {student ? (
                <div className="flex flex-wrap items-center gap-2 rounded-xl border-2 border-border p-3">
                  <span className="font-black text-foreground">{student.full_name}</span>
                  <span className="font-mono text-sm font-black text-muted-foreground">
                    {student.code}
                  </span>
                  <StatusBadge tone={student.balance_due > 0 ? "warning" : "success"}>
                    {student.balance_due > 0
                      ? `مستحق ${formatCurrency(student.balance_due)}`
                      : "لا توجد مستحقات"}
                  </StatusBadge>
                </div>
              ) : (
                <p className="text-sm font-black text-muted-foreground">لم يتم اختيار طالب بعد.</p>
              )}
            </Field>

            <Field label="البند">
              <input
                value={item}
                onChange={(e) => setItem(e.target.value)}
                placeholder="اسم المادة أو البند"
                className="h-12 w-full rounded-xl border-2 border-border bg-background px-4 text-sm font-black outline-none focus:border-primary"
              />
              <div className="mt-2 flex flex-wrap gap-2">
                {booklets.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => {
                      setItem(b.title);
                      setAmount(b.price);
                    }}
                    className="rounded-xl border-2 border-border px-3 py-2 text-xs font-black hover:border-primary"
                  >
                    {b.title} · {formatCurrency(b.price)}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="المبلغ">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="h-14 w-full rounded-xl border-2 border-border bg-background px-4 text-2xl font-black outline-none focus:border-primary"
              />
            </Field>

            <Field label="طريقة الدفع">
              <div className="grid grid-cols-3 gap-2">
                {methods.map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setMethod(m.key)}
                    className={
                      method === m.key
                        ? "flex items-center justify-center gap-2 rounded-xl border-2 border-navy bg-navy py-3 text-sm font-black text-navy-foreground"
                        : "flex items-center justify-center gap-2 rounded-xl border-2 border-border py-3 text-sm font-black hover:border-primary"
                    }
                  >
                    <m.icon className="size-4" />
                    {m.label}
                  </button>
                ))}
              </div>
            </Field>

            <button
              type="submit"
              className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary text-lg font-black text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Plus className="size-5" /> تحصيل وطباعة الإيصال
            </button>
          </form>
        </Panel>

        <Panel title="إيصالات الوردية" description="أحدث العمليات أولاً">
          {records.length === 0 ? (
            <p className="rounded-xl border-2 border-dashed border-border p-6 text-center text-sm font-black text-muted-foreground">
              لا توجد عمليات تحصيل بعد.
            </p>
          ) : (
            <div className="space-y-3">
              {records.map((r) => (
                <div key={r.id} className="rounded-xl border-2 border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-black text-foreground">{r.student_name}</p>
                    <span className="kpi-number text-lg">{formatCurrency(r.amount)}</span>
                  </div>
                  <p className="mt-1 text-xs font-bold text-muted-foreground">
                    {r.item} · {r.student_code} · {r.created_at}
                  </p>
                  <div className="mt-2">
                    <StatusBadge tone="neutral">
                      {methods.find((m) => m.key === r.method)?.label}
                    </StatusBadge>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-sm font-black text-foreground">{label}</p>
      {children}
    </div>
  );
}
