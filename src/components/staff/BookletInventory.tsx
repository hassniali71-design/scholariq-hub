import {
  AlertTriangle,
  BookOpen,
  FileText,
  GraduationCap,
  Plus,
  Printer,
  Receipt,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Panel, StatCard, StatusBadge } from "@/components/dashboard/StatCard";
import { AppShell } from "@/components/layout/AppShell";
import { getSession } from "@/lib/auth";
import {
  addBookletItem,
  adminPrintBooklet,
  getPaperCreditBalance,
  preorderBooklet,
  sellBookletToStudent,
  useDataStore,
} from "@/lib/data-store";
import { formatCurrency, formatDateTime, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { BookletItem, BookletKind } from "@/types";

/**
 * مخزون الملازم والكتب — إعادة بناء كاملة:
 *  - 6 كروت حوكمة، نموذج إضافة، بطاقات طباعة/بيع/إدارة، سجل حركة، تنبيه منخفض.
 */

const KIND_LABELS: Record<BookletKind, string> = {
  book: "كتاب",
  booklet: "ملزمة",
  exam: "امتحان",
};

const KIND_TONE: Record<BookletKind, "primary" | "success" | "warning"> = {
  book: "primary",
  booklet: "success",
  exam: "warning",
};

function isToday(iso: string): boolean {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso.startsWith("اليوم");
  const d = new Date(t);
  const r = new Date();
  return (
    d.getFullYear() === r.getFullYear() &&
    d.getMonth() === r.getMonth() &&
    d.getDate() === r.getDate()
  );
}

export function BookletInventory() {
  const state = useDataStore();
  const { booklets: items, bookletSales, paperTransactions, students } = state;
  const session = typeof window !== "undefined" ? getSession() : null;
  const staffId = session?.identifier ?? null;
  const staffName = session?.full_name ?? "—";
  const paperBalance = staffId ? getPaperCreditBalance(state, staffId) : 0;

  const totalItems = items.length;
  const totalStockValue = items.reduce((s, b) => s + b.price * b.in_stock, 0);
  const todaySales = bookletSales.filter((s) => isToday(s.sold_at));
  const todaySalesCount = todaySales.length;
  const totalPreprinted = items.reduce((s, b) => s + b.printed, 0);
  const lowStock = items.filter((b) => b.in_stock < 10).length;
  const lowPaper = paperBalance < 50;

  const [form, setForm] = useState({
    kind: "booklet" as BookletKind,
    title: "",
    subject: "",
    pageCount: 0,
    price: 0,
    paperPerUnit: 1,
    initialStock: 0,
  });

  const [preorderBookletId, setPreorderBookletId] = useState("");
  const [preorderQty, setPreorderQty] = useState(1);

  const [sellQuery, setSellQuery] = useState("");
  const [sellStudentId, setSellStudentId] = useState("");
  const [sellBookletId, setSellBookletId] = useState("");
  const [sellQty, setSellQty] = useState(1);

  const [adminBookletId, setAdminBookletId] = useState("");
  const [adminQty, setAdminQty] = useState(1);
  const [adminReason, setAdminReason] = useState("");

  const filteredStudents = useMemo(() => {
    const q = sellQuery.trim().toLowerCase();
    if (!q) return students.slice(0, 20);
    return students
      .filter((s) => s.full_name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q))
      .slice(0, 20);
  }, [students, sellQuery]);

  const sellStudent = students.find((s) => s.id === sellStudentId);
  const sellBooklet = items.find((b) => b.id === sellBookletId);
  const sellTotal = sellBooklet ? sellBooklet.price * sellQty : 0;
  const paperNeeded = sellBooklet ? sellBooklet.paper_per_unit * sellQty : 0;

  const recentPaper = paperTransactions.slice(0, 50);
  const recentSales = bookletSales.slice(0, 20);

  function submitAdd(e: React.FormEvent): void {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error("اكتب عنوان الصنف");
      return;
    }
    if (!form.subject.trim()) {
      toast.error("اكتب المادة");
      return;
    }
    if (form.pageCount < 0) {
      toast.error("عدد الصفحات غير صحيح");
      return;
    }
    if (form.price < 0) {
      toast.error("السعر غير صحيح");
      return;
    }
    addBookletItem({
      title: form.title,
      subject: form.subject,
      kind: form.kind,
      pageCount: form.pageCount,
      price: form.price,
      paperPerUnit: form.paperPerUnit,
      initialStock: form.initialStock,
    });
    toast.success("تم إضافة الصنف");
    setForm({
      kind: "booklet",
      title: "",
      subject: "",
      pageCount: 0,
      price: 0,
      paperPerUnit: 1,
      initialStock: 0,
    });
  }

  function doPreorder(): void {
    if (!preorderBookletId) {
      toast.error("اختر صنفاً للطباعة");
      return;
    }
    if (preorderQty < 1) {
      toast.error("كمية غير صحيحة");
      return;
    }
    const ok = preorderBooklet({ bookletId: preorderBookletId, quantity: preorderQty });
    if (ok) toast.success("تم تسجيل طباعة مسبقة");
  }

  function doSell(): void {
    if (!sellBookletId) {
      toast.error("اختر صنفاً للبيع");
      return;
    }
    if (!sellStudentId) {
      toast.error("اختر طالباً");
      return;
    }
    if (sellQty < 1) {
      toast.error("كمية غير صحيحة");
      return;
    }
    if (!staffId) {
      toast.error("تعذّر تحديد الموظف الحالي");
      return;
    }
    const result = sellBookletToStudent({
      bookletId: sellBookletId,
      studentId: sellStudentId,
      quantity: sellQty,
      sellerId: staffId,
      sellerName: staffName,
    });
    if (!result) {
      toast.error("تعذّر البيع — راجع المخزون");
      return;
    }
    toast.success(`تم بيع ${result.quantity} × ${result.booklet_title}`);
    setSellBookletId("");
    setSellQty(1);
  }

  function doAdmin(): void {
    if (!adminBookletId) {
      toast.error("اختر صنفاً للطباعة الإدارية");
      return;
    }
    if (adminQty < 1) {
      toast.error("كمية غير صحيحة");
      return;
    }
    if (!adminReason.trim()) {
      toast.error("اكتب سبب الطباعة الإدارية");
      return;
    }
    if (!staffId) {
      toast.error("تعذّر تحديد الموظف الحالي");
      return;
    }
    const result = adminPrintBooklet({
      bookletId: adminBookletId,
      quantity: adminQty,
      staffId,
      staffName,
      reason: adminReason,
    });
    if (!result) {
      toast.error("تعذّر تسجيل الطباعة الإدارية");
      return;
    }
    toast.success("تم تسجيل الطباعة الإدارية كمصروف");
    setAdminBookletId("");
    setAdminQty(1);
    setAdminReason("");
  }

  return (
    <AppShell role="staff" title="مخزون الملازم والكتب" description="إضافة · طباعة · بيع · إدارة">
      {lowStock > 0 || lowPaper ? (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border-2 border-warning/40 bg-warning/10 p-3 text-sm font-black text-warning">
          <AlertTriangle className="size-4" />
          {lowStock > 0 ? `${formatNumber(lowStock)} صنف قارب على النفاد. ` : ""}
          {lowPaper ? `رصيد الورق المتاح لك ${formatNumber(paperBalance)} ورقة فقط.` : ""}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="عدد الأصناف" value={formatNumber(totalItems)} icon={BookOpen} />
        <StatCard
          label="قيمة المخزون"
          value={formatCurrency(totalStockValue)}
          icon={BookOpen}
          tone="success"
        />
        <StatCard
          label="رصيد الورق المتاح لك"
          value={formatNumber(paperBalance)}
          icon={Printer}
          tone={lowPaper ? "destructive" : "primary"}
        />
        <StatCard
          label="مبيعات اليوم"
          value={formatNumber(todaySalesCount)}
          icon={Receipt}
          tone="success"
        />
        <StatCard label="طبعات مسبقة" value={formatNumber(totalPreprinted)} icon={Printer} />
        <StatCard
          label="أصناف قاربت النفاد"
          value={formatNumber(lowStock)}
          icon={AlertTriangle}
          tone="destructive"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="إضافة كتاب/ملزمة/امتحان" description="صنف جديد في المخزون">
          <form onSubmit={submitAdd} className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {(["book", "booklet", "exam"] as BookletKind[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setForm({ ...form, kind: k })}
                  className={cn(
                    "rounded-xl border-2 px-3 py-3 text-sm font-black",
                    form.kind === k
                      ? "border-navy bg-navy text-navy-foreground"
                      : "border-border hover:border-primary",
                  )}
                >
                  {KIND_LABELS[k]}
                </button>
              ))}
            </div>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="عنوان الصنف"
              className="h-12 w-full rounded-xl border-2 border-border bg-background px-4 text-sm font-black outline-none focus:border-primary"
            />
            <input
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              placeholder="المادة"
              className="h-12 w-full rounded-xl border-2 border-border bg-background px-4 text-sm font-black outline-none focus:border-primary"
            />
            <div className="grid grid-cols-2 gap-2">
              <NumField
                label="عدد الصفحات"
                value={form.pageCount}
                onChange={(v) => setForm({ ...form, pageCount: v })}
              />
              <NumField
                label="السعر"
                value={form.price}
                onChange={(v) => setForm({ ...form, price: v })}
              />
              <NumField
                label="ورق لكل نسخة"
                value={form.paperPerUnit}
                onChange={(v) => setForm({ ...form, paperPerUnit: Math.max(1, v) })}
              />
              <NumField
                label="الكمية المبدئية"
                value={form.initialStock}
                onChange={(v) => setForm({ ...form, initialStock: v })}
              />
            </div>
            <button
              type="submit"
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-base font-black text-primary-foreground hover:opacity-90"
            >
              <Plus className="size-4" /> إضافة
            </button>
          </form>
        </Panel>

        <Panel title="طباعة مسبقة" description="رفع عداد الطباعة بدون تسليم">
          <div className="space-y-3">
            <BookletSelect
              items={items}
              value={preorderBookletId}
              onChange={setPreorderBookletId}
              placeholder="اختر صنفاً"
            />
            <NumField label="عدد النسخ" value={preorderQty} onChange={setPreorderQty} />
            <button
              type="button"
              onClick={doPreorder}
              className="h-12 w-full rounded-xl bg-navy text-sm font-black text-navy-foreground hover:opacity-90"
            >
              تسجيل طباعة مسبقة
            </button>
          </div>
        </Panel>
      </div>

      <Panel title="بيع لطالب" description="يخصم من in_stock ومن رصيد الورق ويُنشئ payment">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <input
              value={sellQuery}
              onChange={(e) => setSellQuery(e.target.value)}
              placeholder="بحث بالاسم/الكود"
              className="h-12 w-full rounded-xl border-2 border-border bg-background px-4 text-sm font-black outline-none focus:border-primary"
            />
            <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border-2 border-border p-2">
              {filteredStudents.length === 0 ? (
                <p className="p-3 text-center text-xs font-black text-muted-foreground">لا نتائج</p>
              ) : (
                filteredStudents.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSellStudentId(s.id)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg px-3 py-2 text-right text-sm",
                      sellStudentId === s.id
                        ? "bg-primary/10 font-black text-primary"
                        : "hover:bg-muted",
                    )}
                  >
                    <span>{s.full_name}</span>
                    <span className="font-mono text-xs text-muted-foreground">{s.code}</span>
                  </button>
                ))
              )}
            </div>
            {sellStudent ? (
              <div className="rounded-xl border-2 border-border p-3 text-xs font-black">
                <p>{sellStudent.full_name}</p>
                <p className="text-muted-foreground">
                  {sellStudent.code} · مستحق {formatCurrency(sellStudent.balance_due)}
                </p>
              </div>
            ) : null}
          </div>
          <div className="space-y-2">
            <BookletSelect
              items={items}
              value={sellBookletId}
              onChange={setSellBookletId}
              placeholder="اختر صنفاً"
            />
            <NumField label="الكمية" value={sellQty} onChange={setSellQty} />
            <div className="rounded-xl border-2 border-border p-3 text-sm font-black">
              {sellBooklet ? (
                <>
                  <p>
                    الإجمالي: <span className="text-primary">{formatCurrency(sellTotal)}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    ورق مستهلك: {formatNumber(paperNeeded)} ورقة
                  </p>
                </>
              ) : (
                <p className="text-muted-foreground">لم يتم اختيار صنف بعد.</p>
              )}
            </div>
            <button
              type="button"
              onClick={doSell}
              className="h-12 w-full rounded-xl bg-success text-sm font-black text-white hover:opacity-90"
            >
              إتمام البيع
            </button>
          </div>
        </div>
      </Panel>

      <Panel title="طباعة إدارية" description="تسجَّل كمصروف printing ولا تُخصم من رصيد الطالب">
        <div className="grid gap-3 md:grid-cols-3">
          <BookletSelect
            items={items}
            value={adminBookletId}
            onChange={setAdminBookletId}
            placeholder="اختر صنفاً"
          />
          <NumField label="الكمية" value={adminQty} onChange={setAdminQty} />
          <input
            value={adminReason}
            onChange={(e) => setAdminReason(e.target.value)}
            placeholder="سبب الطباعة"
            className="h-12 rounded-xl border-2 border-border bg-background px-3 text-sm font-black outline-none focus:border-primary"
          />
        </div>
        <button
          type="button"
          onClick={doAdmin}
          className="mt-3 h-12 w-full rounded-xl bg-warning text-sm font-black text-white hover:opacity-90"
        >
          تسجيل طباعة إدارية
        </button>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="حركة الورق" description="أحدث 50 حركة">
          <div className="max-h-[420px] space-y-2 overflow-y-auto">
            {recentPaper.length === 0 ? (
              <p className="rounded-xl border-2 border-dashed border-border p-4 text-center text-sm font-bold text-muted-foreground">
                لا توجد حركات ورق بعد.
              </p>
            ) : (
              recentPaper.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between gap-2 rounded-xl border-2 border-border p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-black">{tx.staff_name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {tx.reason} · {formatDateTime(tx.created_at)}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "kpi-number text-base",
                      tx.delta_sheets >= 0 ? "text-success" : "text-destructive",
                    )}
                  >
                    {tx.delta_sheets >= 0 ? "+" : ""}
                    {formatNumber(tx.delta_sheets)} ورقة
                  </span>
                </div>
              ))
            )}
          </div>
        </Panel>
        <Panel title="مبيعات حديثة" description="أحدث 20 عملية بيع">
          <div className="max-h-[420px] space-y-2 overflow-y-auto">
            {recentSales.length === 0 ? (
              <p className="rounded-xl border-2 border-dashed border-border p-4 text-center text-sm font-bold text-muted-foreground">
                لا توجد مبيعات بعد.
              </p>
            ) : (
              recentSales.map((s) => (
                <div key={s.id} className="rounded-xl border-2 border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-black">{s.student_name}</p>
                    <span className="kpi-number text-base">{formatCurrency(s.total_amount)}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {s.booklet_title} × {formatNumber(s.quantity)} · {s.sold_by} ·{" "}
                    {formatDateTime(s.sold_at)}
                  </p>
                </div>
              ))
            )}
          </div>
        </Panel>
      </div>

      <Panel title="الأصناف المسجَّلة" description="اضغط لعرض التفاصيل">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {items.map((b) => (
            <BookletCard key={b.id} booklet={b} />
          ))}
        </div>
      </Panel>
    </AppShell>
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

function BookletSelect({
  items,
  value,
  onChange,
  placeholder,
}: {
  items: BookletItem[];
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-12 w-full rounded-xl border-2 border-border bg-background px-3 text-sm font-black outline-none focus:border-primary"
    >
      <option value="">{placeholder}</option>
      {items.map((b) => (
        <option key={b.id} value={b.id}>
          {b.title} · {formatCurrency(b.price)} · {formatNumber(b.in_stock)} متاح
        </option>
      ))}
    </select>
  );
}

function BookletCard({ booklet }: { booklet: BookletItem }) {
  const Icon =
    booklet.kind === "book" ? BookOpen : booklet.kind === "exam" ? FileText : GraduationCap;
  return (
    <div className="rounded-xl border-2 border-border p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Icon className="size-5 shrink-0 text-primary" />
          <p className="truncate font-black">{booklet.title}</p>
        </div>
        <StatusBadge tone={KIND_TONE[booklet.kind]}>{KIND_LABELS[booklet.kind]}</StatusBadge>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{booklet.subject}</p>
      <p className="kpi-number mt-2 text-xl">{formatCurrency(booklet.price)}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {formatNumber(booklet.page_count)} صفحة · {formatNumber(booklet.in_stock)} متاح ·{" "}
        {formatNumber(booklet.delivered)} مُسلَّم
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        ورق لكل نسخة: {formatNumber(booklet.paper_per_unit)} · مطبوعة مسبقاً:{" "}
        {formatNumber(booklet.printed)}
      </p>
      {booklet.in_stock < 10 ? (
        <div className="mt-2 text-xs font-black text-destructive">قارب على النفاد</div>
      ) : null}
    </div>
  );
}
