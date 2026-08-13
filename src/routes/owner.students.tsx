import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AlertCircle, Search, Star, User, Users } from "lucide-react";

import { Panel, StatCard, StatusBadge } from "@/components/dashboard/StatCard";
import { AppShell } from "@/components/layout/AppShell";
import { classifyStudent, useDataStore } from "@/lib/data-store";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { PaymentStatus, Student } from "@/types";

/**
 * DESIGN_ATMOSPHERE_SPEC.md §5 — display-only ranking, not a data-store rule:
 * top 20% by points within the student's own group. Reuses `classifyStudent`
 * for the "needs attention" tier (no new classification logic there).
 */
function isTopPerformerInGroup(student: Student, allStudents: Student[]): boolean {
  const groupmates = allStudents.filter((s) => s.group_id === student.group_id);
  if (groupmates.length === 0) return false;
  const sorted = [...groupmates].sort((a, b) => b.points - a.points);
  const rank = sorted.findIndex((s) => s.id === student.id);
  return (rank + 1) / sorted.length <= 0.2;
}

type StudentVisualStatus = "top" | "attention" | "normal";

function studentVisualStatus(student: Student, allStudents: Student[]): StudentVisualStatus {
  if (classifyStudent(student) === "needs_attention") return "attention";
  if (isTopPerformerInGroup(student, allStudents)) return "top";
  return "normal";
}

const visualStatusMeta: Record<
  StudentVisualStatus,
  { icon: typeof Star; border: string; label: string }
> = {
  top: { icon: Star, border: "border-r-primary", label: "متفوق" },
  attention: { icon: AlertCircle, border: "border-r-muted-foreground", label: "يحتاج متابعة" },
  normal: { icon: User, border: "border-r-border", label: "عادي" },
};

export const Route = createFileRoute("/owner/students")({
  head: () => ({
    meta: [
      { title: "الطلاب والمجموعات — لوحة المالك" },
      {
        name: "description",
        content: "قاعدة بيانات الطلاب وحالة السداد ونسب الحضور وتوزيع المجموعات.",
      },
      { property: "og:title", content: "الطلاب والمجموعات — لوحة المالك" },
      {
        property: "og:description",
        content: "إدارة بيانات الطلاب وحالات السداد وتوزيع المجموعات داخل السنتر.",
      },
    ],
  }),
  component: StudentsPage,
});

const paymentLabel: Record<
  PaymentStatus,
  { text: string; tone: "success" | "warning" | "destructive" }
> = {
  paid: { text: "مسدد", tone: "success" },
  pending: { text: "قيد السداد", tone: "warning" },
  overdue: { text: "متأخر", tone: "destructive" },
};

function StudentsPage() {
  const { students, groups } = useDataStore();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | PaymentStatus>("all");

  const filtered = useMemo(
    () =>
      students.filter(
        (s) =>
          (filter === "all" || s.payment_status === filter) &&
          (s.full_name.includes(query) || s.code.toLowerCase().includes(query.toLowerCase())),
      ),
    [students, query, filter],
  );

  const due = students.reduce((sum, s) => sum + s.balance_due, 0);
  const avgAttendance = Math.round(
    students.reduce((sum, s) => sum + s.attendance_rate, 0) / Math.max(1, students.length),
  );

  return (
    <AppShell
      role="owner"
      title="الطلاب والمجموعات"
      description="قاعدة بيانات موحدة معزولة بمعرّف السنتر"
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="عدد الطلاب" value={formatNumber(students.length)} icon={Users} />
        <StatCard
          label="مستحقات غير محصلة"
          value={formatCurrency(due)}
          icon={Users}
          tone="destructive"
        />
        <StatCard
          label="عدد المجموعات"
          value={formatNumber(groups.length)}
          icon={Users}
          tone="success"
        />
        <StatCard
          label="متوسط الحضور"
          value={formatPercent(avgAttendance)}
          icon={Users}
          tone="success"
        />
      </div>

      <Panel title="نظرة الطلاب البصرية" description="متفوق (أعلى 20% نقاطاً في مجموعته) · يحتاج متابعة · عادي">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {students.map((s) => {
            const status = studentVisualStatus(s, students);
            const meta = visualStatusMeta[status];
            return (
              <div
                key={s.id}
                className={cn("rounded-xl border-2 border-r-4 border-border p-4", meta.border)}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate font-black text-foreground">{s.full_name}</p>
                  <meta.icon
                    className={cn(
                      "size-4 shrink-0",
                      status === "top"
                        ? "fill-primary text-primary"
                        : status === "attention"
                          ? "text-muted-foreground"
                          : "text-muted-foreground",
                    )}
                  />
                </div>
                <p className="mt-1 text-xs font-bold text-muted-foreground">{s.group_name}</p>
                <p className="mt-2 text-xs font-extrabold text-muted-foreground">
                  {formatNumber(s.points)} نقطة · {formatPercent(s.attendance_rate)} حضور
                </p>
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel
        title="سجل الطلاب"
        description="بحث بالاسم أو كود الطالب مع فلترة حالة السداد"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="بحث عن طالب..."
                className="h-11 w-56 rounded-xl border-2 border-border bg-background pr-9 pl-3 text-sm font-bold outline-none focus:border-primary"
              />
            </div>
            {(["all", "paid", "pending", "overdue"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={
                  filter === f
                    ? "rounded-xl border-2 border-navy bg-navy px-3 py-2 text-xs font-black text-navy-foreground"
                    : "rounded-xl border-2 border-border bg-background px-3 py-2 text-xs font-black text-foreground hover:border-primary"
                }
              >
                {f === "all" ? "الكل" : paymentLabel[f].text}
              </button>
            ))}
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-right text-sm">
            <thead>
              <tr className="border-b-2 border-border text-muted-foreground">
                <th className="pb-3">الطالب</th>
                <th className="pb-3">الكود</th>
                <th className="pb-3">المجموعة</th>
                <th className="pb-3">الحضور</th>
                <th className="pb-3">المتوسط</th>
                <th className="pb-3">السداد</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className="border-b border-border last:border-0">
                  <td className="py-3">
                    <p className="font-black text-foreground">{s.full_name}</p>
                    <p className="text-xs font-bold text-muted-foreground">
                      ولي الأمر: {s.guardian_name} · {s.guardian_phone}
                    </p>
                  </td>
                  <td className="py-3 font-mono font-extrabold">{s.code}</td>
                  <td className="py-3 font-bold text-muted-foreground">{s.group_name}</td>
                  <td className="py-3 font-extrabold">{formatPercent(s.attendance_rate)}</td>
                  <td className="py-3 font-black text-primary">{formatNumber(s.avg_score)}</td>
                  <td className="py-3">
                    <StatusBadge tone={paymentLabel[s.payment_status].tone}>
                      {paymentLabel[s.payment_status].text}
                      {s.balance_due > 0 ? ` · ${formatCurrency(s.balance_due)}` : ""}
                    </StatusBadge>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center font-black text-muted-foreground">
                    لا توجد نتائج مطابقة
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="جدول المجموعات" description="المواعيد والقاعات والمدرس المسؤول">
        <div className="grid gap-4 md:grid-cols-2">
          {groups.map((g) => (
            <div key={g.id} className="rounded-xl border-2 border-border p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="font-black text-foreground">{g.name}</p>
                <StatusBadge tone="primary">{g.room}</StatusBadge>
              </div>
              <p className="mt-1 text-xs font-bold text-muted-foreground">
                {g.teacher_name} · {g.grade}
              </p>
              <p className="mt-2 text-sm font-extrabold">
                {g.weekday} — {g.time} · {formatNumber(g.enrolled)} طالب
              </p>
            </div>
          ))}
        </div>
      </Panel>
    </AppShell>
  );
}
