import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Banknote, CreditCard, Plus, Receipt, Smartphone } from "lucide-react";
import { toast } from "sonner";

import { Panel, StatCard, StatusBadge } from "@/components/dashboard/StatCard";
import { AppShell } from "@/components/layout/AppShell";
import { formatCurrency, formatNumber } from "@/lib/format";
import { recordPayment, useDataStore } from "@/lib/data-store";
import { booklets } from "@/lib/mock-data";
import type { PaymentMethod } from "@/types";

export const Route = createFileRoute("/staff/cashier")({
  head: () => ({
    meta: [
      { title: "شباك الكاشير — السكرتارية" },
      {
        name: "description",
        content: "تحصيل الاشتراكات وبيع الملازم وطباعة الإيصالات بسرعة عالية.",
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

const quickItems = [
  { label: "اشتراك شهري - فيزياء", amount: 450 },
  { label: "اشتراك شهري - كيمياء", amount: 400 },
  { label: "حصة تعويضية", amount: 120 },
  ...booklets.map((b) => ({ label: b.title, amount: b.price })),
];

function CashierPage() {
  const { students, payments: records } = useDataStore();
  const [studentCode, setStudentCode] = useState(students[1]!.code);
  const [item, setItem] = useState(quickItems[0]!.label);
  const [amount, setAmount] = useState(quickItems[0]!.amount);
  const [method, setMethod] = useState<PaymentMethod>("cash");

  const student = students.find((s) => s.code === studentCode);
  const total = records.reduce((sum, r) => sum + r.amount, 0);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!student) {
      toast.error("كود الطالب غير صحيح");
      return;
    }
    recordPayment(student.code, amount, method, item);
    toast.success("تم التحصيل وطباعة الإيصال", {
      description: `${student.full_name} · ${formatCurrency(amount)}`,
    });
  };

  return (
    <AppShell role="staff" title="شباك الكاشير" description="تحصيل سريع مع إيصال فوري وإشعار واتساب">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="تحصيل الوردية" value={formatCurrency(total)} icon={Banknote} tone="success" />
        <StatCard label="عدد العمليات" value={formatNumber(records.length)} icon={Receipt} />
        <StatCard
          label="طلاب متأخرون"
          value={formatNumber(students.filter((s) => s.payment_status !== "paid").length)}
          icon={CreditCard}
          tone="destructive"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Panel title="عملية تحصيل جديدة" description="اختر الطالب والبند وطريقة الدفع">
          <form onSubmit={submit} className="space-y-4">
            <Field label="كود الطالب">
              <input
                value={studentCode}
                onChange={(e) => setStudentCode(e.target.value)}
                className="h-12 w-full rounded-xl border-2 border-border bg-background px-4 font-mono text-lg font-black outline-none focus:border-primary"
              />
            </Field>

            {student ? (
              <div className="flex flex-wrap items-center gap-2 rounded-xl border-2 border-border p-3">
                <span className="font-black text-foreground">{student.full_name}</span>
                <StatusBadge tone={student.payment_status === "paid" ? "success" : "warning"}>
                  {student.payment_status === "paid"
                    ? "لا توجد مستحقات"
                    : `مستحق ${formatCurrency(student.balance_due)}`}
                </StatusBadge>
              </div>
            ) : (
              <p className="text-sm font-black text-destructive">لا يوجد طالب بهذا الكود</p>
            )}

            <Field label="البند">
              <div className="flex flex-wrap gap-2">
                {quickItems.map((q) => (
                  <button
                    key={q.label}
                    type="button"
                    onClick={() => {
                      setItem(q.label);
                      setAmount(q.amount);
                    }}
                    className={
                      item === q.label
                        ? "rounded-xl border-2 border-navy bg-navy px-3 py-2 text-xs font-black text-navy-foreground"
                        : "rounded-xl border-2 border-border px-3 py-2 text-xs font-black hover:border-primary"
                    }
                  >
                    {q.label}
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
