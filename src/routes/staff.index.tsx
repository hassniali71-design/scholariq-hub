import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, Clock, QrCode, ScanLine, UserX, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Panel, StatCard, StatusBadge } from "@/components/dashboard/StatCard";
import { AppShell } from "@/components/layout/AppShell";
import { formatCurrency, formatNumber } from "@/lib/format";
import { recordAttendance, useDataStore } from "@/lib/data-store";
import type { AttendanceStatus, Student } from "@/types";

export const Route = createFileRoute("/staff/")({
  head: () => ({
    meta: [
      { title: "بوابة الحضور السريع — السكرتارية" },
      {
        name: "description",
        content: "تسجيل حضور الطلاب بسرعة عبر QR أو الباركود مع عرض حالة السداد فوراً.",
      },
      { property: "og:title", content: "بوابة الحضور السريع — السكرتارية" },
      {
        property: "og:description",
        content: "مسح كود الطالب وتسجيل الحضور وعرض حالة السداد في ثانية واحدة.",
      },
    ],
  }),
  component: StaffGate,
});

const statusMeta: Record<
  AttendanceStatus,
  { text: string; tone: "success" | "warning" | "destructive" }
> = {
  present: { text: "حاضر", tone: "success" },
  late: { text: "متأخر", tone: "warning" },
  absent: { text: "غائب", tone: "destructive" },
};

function StaffGate() {
  const { students, attendanceRecords: log } = useDataStore();
  const [code, setCode] = useState("");
  const [lastScanId, setLastScanId] = useState<string | null>(null);
  const lastScan: Student = students.find((s) => s.id === lastScanId) ?? students[0]!;

  const handleScan = (e: React.FormEvent) => {
    e.preventDefault();
    const found = students.find((s) => s.code.toLowerCase() === code.trim().toLowerCase());
    if (!found) {
      toast.error("كود غير معروف", { description: "تأكد من كود الطالب ثم أعد المحاولة." });
      return;
    }
    setLastScanId(found.id);
    recordAttendance(found.id, "present", "qr");
    setCode("");
    toast.success(`تم تسجيل حضور ${found.full_name}`, {
      description:
        found.payment_status === "paid"
          ? "الاشتراك مسدد — تم إرسال إشعار واتساب لولي الأمر."
          : `تنبيه: مستحقات ${formatCurrency(found.balance_due)}`,
    });
  };

  const present = log.filter((l) => l.status === "present").length;
  const late = log.filter((l) => l.status === "late").length;
  const absent = log.filter((l) => l.status === "absent").length;

  return (
    <AppShell
      role="staff"
      title="بوابة الحضور السريع"
      description="امسح كود الطالب أو أدخله يدوياً لتسجيل الحضور فوراً"
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="حضور اليوم"
          value={formatNumber(present)}
          icon={CheckCircle2}
          tone="success"
        />
        <StatCard label="متأخرون" value={formatNumber(late)} icon={Clock} tone="warning" />
        <StatCard label="غياب" value={formatNumber(absent)} icon={UserX} tone="destructive" />
        <StatCard label="مسحات اليوم" value={formatNumber(log.length)} icon={ScanLine} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
        <Panel title="ماسح الكود" description="QR / Barcode أو إدخال يدوي سريع">
          <form onSubmit={handleScan} className="space-y-4">
            <div className="flex items-center justify-center rounded-2xl border-2 border-dashed border-border bg-canvas py-10">
              <div className="text-center">
                <QrCode className="mx-auto size-20 text-navy" />
                <p className="mt-3 text-base font-black text-foreground">وجّه الكود أمام الماسح</p>
                <p className="text-xs font-bold text-muted-foreground">
                  يعمل مع قارئ الباركود USB وكاميرا التابلت
                </p>
              </div>
            </div>

            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="STD-10234"
              className="h-16 w-full rounded-2xl border-2 border-border bg-background px-4 text-center font-mono text-2xl font-black tracking-widest outline-none focus:border-primary"
            />

            <button
              type="submit"
              className="h-14 w-full rounded-2xl bg-navy text-lg font-black text-navy-foreground transition-opacity hover:opacity-90"
            >
              تسجيل الحضور
            </button>

            <div className="flex flex-wrap gap-2">
              {students.slice(0, 4).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setCode(s.code)}
                  className="rounded-xl border-2 border-border px-3 py-2 font-mono text-xs font-black hover:border-primary"
                >
                  {s.code}
                </button>
              ))}
            </div>
          </form>
        </Panel>

        <div className="space-y-6">
          <Panel title="بطاقة آخر طالب" description="حالة الاشتراك والملازم">
            <div className="rounded-2xl border-2 border-border p-5">
              <p className="text-2xl font-black text-foreground">{lastScan.full_name}</p>
              <p className="mt-1 font-mono text-sm font-extrabold text-muted-foreground">
                {lastScan.code} · {lastScan.grade}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <StatusBadge
                  tone={
                    lastScan.payment_status === "paid"
                      ? "success"
                      : lastScan.payment_status === "pending"
                        ? "warning"
                        : "destructive"
                  }
                >
                  {lastScan.payment_status === "paid"
                    ? "الاشتراك مسدد"
                    : `مستحق ${formatCurrency(lastScan.balance_due)}`}
                </StatusBadge>
                <StatusBadge tone="primary">{lastScan.group_name}</StatusBadge>
                <StatusBadge tone="neutral">ولي الأمر: {lastScan.guardian_phone}</StatusBadge>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-3 text-center">
                <MiniStat label="الحضور" value={`${lastScan.attendance_rate}٪`} />
                <MiniStat label="المتوسط" value={`${lastScan.avg_score}`} />
                <MiniStat label="النقاط" value={formatNumber(lastScan.points)} />
              </div>
            </div>
          </Panel>

          <Panel title="سجل اليوم" description="آخر عمليات تسجيل الدخول">
            <div className="space-y-3">
              {log.slice(0, 8).map((rec) => (
                <div
                  key={rec.id}
                  className="flex items-center justify-between gap-3 rounded-xl border-2 border-border p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-black text-foreground">{rec.student_name}</p>
                    <p className="truncate text-xs font-bold text-muted-foreground">
                      {rec.group_name} · {rec.checked_in_at}
                    </p>
                  </div>
                  <StatusBadge tone={statusMeta[rec.status].tone}>
                    {rec.status === "absent" ? (
                      <XCircle className="size-3.5" />
                    ) : (
                      <CheckCircle2 className="size-3.5" />
                    )}
                    {statusMeta[rec.status].text}
                  </StatusBadge>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border-2 border-border py-3">
      <p className="kpi-number text-xl">{value}</p>
      <p className="text-[11px] font-extrabold text-muted-foreground">{label}</p>
    </div>
  );
}
