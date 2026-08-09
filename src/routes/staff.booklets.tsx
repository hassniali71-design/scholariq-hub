import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, PackageCheck, PackageX } from "lucide-react";
import { toast } from "sonner";

import { Panel, StatCard, StatusBadge } from "@/components/dashboard/StatCard";
import { AppShell } from "@/components/layout/AppShell";
import { formatCurrency, formatNumber } from "@/lib/format";
import { deliverBooklet, useDataStore } from "@/lib/data-store";

export const Route = createFileRoute("/staff/booklets")({
  head: () => ({
    meta: [
      { title: "مخزون الملازم — السكرتارية" },
      {
        name: "description",
        content: "متابعة مخزون الملازم والشيتات وتسليمها للطلاب مع تنبيهات النفاد.",
      },
      { property: "og:title", content: "مخزون الملازم — السكرتارية" },
      {
        property: "og:description",
        content: "إدارة مخزون الملازم والشيتات وتسجيل عمليات التسليم.",
      },
    ],
  }),
  component: BookletsPage,
});

function BookletsPage() {
  const { booklets: items } = useDataStore();

  const deliver = (id: string) => {
    deliverBooklet(id);
    toast.success("تم تسليم نسخة وخصمها من المخزون");
  };

  const totalStock = items.reduce((s, b) => s + b.in_stock, 0);
  const totalDelivered = items.reduce((s, b) => s + b.delivered, 0);
  const lowStock = items.filter((b) => b.in_stock < 20).length;

  return (
    <AppShell role="staff" title="مخزون الملازم" description="متابعة النسخ المتاحة والمسلّمة">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="نسخ متاحة" value={formatNumber(totalStock)} icon={BookOpen} />
        <StatCard
          label="نسخ مسلّمة"
          value={formatNumber(totalDelivered)}
          icon={PackageCheck}
          tone="success"
        />
        <StatCard
          label="أصناف قاربت النفاد"
          value={formatNumber(lowStock)}
          icon={PackageX}
          tone="destructive"
        />
      </div>

      <Panel title="الأصناف" description="اضغط تسليم لخصم نسخة من المخزون">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((b) => (
            <div key={b.id} className="rounded-xl border-2 border-border p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="font-black text-foreground">{b.title}</p>
                <StatusBadge tone={b.in_stock < 20 ? "destructive" : "success"}>
                  {formatNumber(b.in_stock)} نسخة
                </StatusBadge>
              </div>
              <p className="mt-1 text-xs font-bold text-muted-foreground">{b.subject}</p>
              <p className="kpi-number mt-3 text-2xl">{formatCurrency(b.price)}</p>
              <p className="mt-1 text-xs font-extrabold text-muted-foreground">
                تم تسليم {formatNumber(b.delivered)} نسخة
              </p>
              <button
                onClick={() => deliver(b.id)}
                disabled={b.in_stock === 0}
                className="mt-4 h-11 w-full rounded-xl bg-navy text-sm font-black text-navy-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                تسليم نسخة
              </button>
            </div>
          ))}
        </div>
      </Panel>
    </AppShell>
  );
}
