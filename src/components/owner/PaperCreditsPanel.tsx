import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Printer, Save } from "lucide-react";

import { Panel, StatusBadge } from "@/components/dashboard/StatCard";
import { getAccounts, subscribeAuth, type Account } from "@/lib/auth";
import { getPaperCreditBalance, issuePaperCredit, useDataStore } from "@/lib/data-store";
import { formatCurrency, formatDateTime, formatNumber } from "@/lib/format";

/**
 * Panel "إصدار ورق للموظف" — يظهر في /owner/treasury:
 *  - اختيار موظف + عدد ورق + سعر الورقة + ملاحظة.
 *  - رصيد كل موظف = sum(paper_transactions.delta_sheets) للموظف.
 *  - سجل آخر الإصدارات.
 */

export function PaperCreditsPanel() {
  const state = useDataStore();
  const { paperCredits, paperTransactions } = state;
  const [staff, setStaff] = useState<Account[]>([]);
  const [staffId, setStaffId] = useState("");
  const [sheets, setSheets] = useState(0);
  const [unitPrice, setUnitPrice] = useState(0);
  const [note, setNote] = useState("");

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

  const balances = useMemo(() => {
    const ids = new Set(staff.map((s) => s.id));
    paperTransactions.forEach((tx) => {
      if (tx.staff_id) ids.add(tx.staff_id);
    });
    return Array.from(ids)
      .map((id) => {
        const acct = staff.find((a) => a.id === id);
        const name = acct?.full_name ?? paperTransactions.find((t) => t.staff_id === id)?.staff_name ?? id;
        return { id, name, balance: getPaperCreditBalance(state, id) };
      })
      .sort((a, b) => b.balance - a.balance);
  }, [state, staff, paperTransactions]);

  function submit(e: React.FormEvent): void {
    e.preventDefault();
    if (!staffId) {
      toast.error("اختر موظفاً");
      return;
    }
    if (sheets <= 0) {
      toast.error("عدد الورق يجب أن يكون أكبر من صفر");
      return;
    }
    if (unitPrice < 0) {
      toast.error("سعر الورقة غير صحيح");
      return;
    }
    const acct = staff.find((a) => a.id === staffId);
    const result = issuePaperCredit({
      staffId,
      staffName: acct?.full_name ?? staffId,
      totalSheets: sheets,
      unitPrice,
      note: note.trim() || null,
    });
    if (!result) {
      toast.error("تعذّر إصدار الرصيد");
      return;
    }
    toast.success(`تم إصدار ${formatNumber(sheets)} ورقة للموظف`);
    setSheets(0);
    setNote("");
  }

  return (
    <Panel
      title="إصدار ورق للموظف"
      description="رصيد ورق للموظف يستهلكه على المبيعات والطباعة"
    >
      <div className="grid gap-4 md:grid-cols-[1fr_2fr]">
        <form onSubmit={submit} className="space-y-2 rounded-xl border-2 border-border p-4">
          <p className="text-sm font-black">إصدار جديد</p>
          <select
            value={staffId}
            onChange={(e) => setStaffId(e.target.value)}
            className="h-12 w-full rounded-xl border-2 border-border bg-background px-3 text-sm font-black outline-none focus:border-primary"
          >
            <option value="">اختر موظفاً</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <NumField label="عدد الورق" value={sheets} onChange={setSheets} />
            <NumField label="سعر الورقة" value={unitPrice} onChange={setUnitPrice} />
          </div>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="ملاحظة (اختياري)"
            className="h-12 w-full rounded-xl border-2 border-border bg-background px-3 text-sm font-black outline-none focus:border-primary"
          />
          <button
            type="submit"
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-black text-primary-foreground hover:opacity-90"
          >
            <Save className="size-4" /> إصدار
          </button>
        </form>
        <div>
          <p className="mb-2 text-sm font-black">أرصدة الموظفين</p>
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {balances.length === 0 ? (
              <p className="rounded-xl border-2 border-dashed border-border p-4 text-center text-sm font-bold text-muted-foreground">
                لا توجد أرصدة ورق بعد.
              </p>
            ) : (
              balances.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center justify-between gap-2 rounded-xl border-2 border-border p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-black">{b.name}</p>
                    <p className="text-xs text-muted-foreground">رصيد متبقي</p>
                  </div>
                  <StatusBadge tone={b.balance < 50 ? "destructive" : "success"}>
                    <Printer className="size-3.5" /> {formatNumber(b.balance)} ورقة
                  </StatusBadge>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="mt-4">
        <p className="mb-2 text-sm font-black">آخر الإصدارات</p>
        <div className="space-y-2">
          {paperCredits.slice(0, 10).map((c) => (
            <div
              key={c.id}
              className="flex items-center justify-between gap-2 rounded-xl border-2 border-border p-3"
            >
              <div className="min-w-0">
                <p className="truncate font-black">{c.staff_name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {formatNumber(c.total_sheets)} ورقة × {formatCurrency(c.unit_price)} · {formatDateTime(c.issued_at)}
                </p>
              </div>
              <span className="kpi-number text-base">{formatCurrency(c.total_sheets * c.unit_price)}</span>
            </div>
          ))}
          {paperCredits.length === 0 ? (
            <p className="rounded-xl border-2 border-dashed border-border p-4 text-center text-sm font-bold text-muted-foreground">
              لا توجد إصدارات بعد.
            </p>
          ) : null}
        </div>
      </div>
    </Panel>
  );
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-extrabold text-muted-foreground">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-12 w-full rounded-xl border-2 border-border bg-background px-3 text-sm font-black outline-none focus:border-primary"
      />
    </label>
  );
}
