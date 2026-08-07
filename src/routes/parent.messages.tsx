import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCheck, MessageSquareText, XCircle } from "lucide-react";

import { Panel, StatCard, StatusBadge } from "@/components/dashboard/StatCard";
import { AppShell } from "@/components/layout/AppShell";
import { formatNumber } from "@/lib/format";
import { whatsappLogs } from "@/lib/mock-data";
import type { WhatsAppLog } from "@/types";

export const Route = createFileRoute("/parent/messages")({
  head: () => ({
    meta: [
      { title: "سجل رسائل الواتساب — ولي الأمر" },
      {
        name: "description",
        content: "أرشيف كامل لإشعارات الحضور والدرجات والواجبات والمدفوعات المرسلة لولي الأمر.",
      },
      { property: "og:title", content: "سجل رسائل الواتساب — ولي الأمر" },
      {
        property: "og:description",
        content: "أرشيف كل الإشعارات المرسلة من السنتر إلى ولي الأمر.",
      },
    ],
  }),
  component: MessagesPage,
});

const templateLabel: Record<WhatsAppLog["template"], string> = {
  attendance: "حضور",
  payment: "سداد",
  grade: "درجات",
  homework: "واجب",
  absence: "غياب",
};

function MessagesPage() {
  const [filter, setFilter] = useState<"all" | WhatsAppLog["template"]>("all");
  const list = whatsappLogs.filter((w) => filter === "all" || w.template === filter);
  const delivered = whatsappLogs.filter((w) => w.delivered).length;

  return (
    <AppShell
      role="parent"
      title="سجل رسائل الواتساب"
      description="كل إشعار أُرسل من السنتر موثق هنا — بدون أعذار"
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="إجمالي الرسائل" value={formatNumber(whatsappLogs.length)} icon={MessageSquareText} />
        <StatCard label="تم تسليمها" value={formatNumber(delivered)} icon={CheckCheck} tone="success" />
        <StatCard
          label="فشل التسليم"
          value={formatNumber(whatsappLogs.length - delivered)}
          icon={XCircle}
          tone="destructive"
        />
      </div>

      <Panel
        title="الأرشيف"
        description="فلترة حسب نوع الإشعار"
        actions={
          <div className="flex flex-wrap gap-2">
            {(["all", "attendance", "grade", "homework", "payment"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={
                  filter === f
                    ? "rounded-xl border-2 border-navy bg-navy px-3 py-2 text-xs font-black text-navy-foreground"
                    : "rounded-xl border-2 border-border px-3 py-2 text-xs font-black hover:border-primary"
                }
              >
                {f === "all" ? "الكل" : templateLabel[f]}
              </button>
            ))}
          </div>
        }
      >
        <div className="space-y-3">
          {list.map((w) => (
            <div key={w.id} className="rounded-xl border-2 border-border p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <StatusBadge tone="primary">{templateLabel[w.template]}</StatusBadge>
                  <span className="text-xs font-black text-muted-foreground">{w.sent_at}</span>
                </div>
                <StatusBadge tone={w.delivered ? "success" : "destructive"}>
                  {w.delivered ? "تم التسليم" : "لم تُسلَّم"}
                </StatusBadge>
              </div>
              <p className="mt-3 text-sm font-extrabold text-foreground">{w.message}</p>
            </div>
          ))}
          {list.length === 0 ? (
            <p className="py-8 text-center font-black text-muted-foreground">لا توجد رسائل بهذا النوع</p>
          ) : null}
        </div>
      </Panel>
    </AppShell>
  );
}
