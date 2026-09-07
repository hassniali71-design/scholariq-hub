import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useDataStore } from "@/lib/data-store";
import { formatNumber } from "@/lib/format";

/**
 * الرسم الأسبوعي للحضور والغياب:
 *  - حضور = أزرق (`#2563eb`).
 *  - غياب = أحمر (`#dc2626`).
 *  - Typography أكبر للأرقام والعناوين (16-20).
 *  - مسافة بين الشريطين أكبر (`barCategoryGap`).
 *  - يحسب من سجلات الحضور الحقيقية الموزعة على آخر 7 أيام.
 */

const WEEKDAYS_AR = [
  "الأحد",
  "الإنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
  "السبت",
] as const;

const PRESENT_COLOR = "#2563eb"; // أزرق
const ABSENT_COLOR = "#dc2626"; // أحمر

function dateKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export function EnhancedWeeklyAttendance() {
  const state = useDataStore();
  const data = useMemo(() => {
    const today = new Date();
    // آخر 7 أيام
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (6 - i));
      const k = dateKey(d);
      const rows = state.attendanceRecords.filter((a) => {
        const t = new Date(a.checked_in_at);
        return Number.isFinite(t.getTime()) && dateKey(t) === k;
      });
      const present = rows.filter((r) => r.status !== "absent").length;
      const absent = rows.filter((r) => r.status === "absent").length;
      return {
        day: WEEKDAYS_AR[d.getDay()]!,
        date: k,
        present,
        absent,
      };
    });
  }, [state.attendanceRecords]);

  const totalPresent = data.reduce((s, d) => s + d.present, 0);
  const totalAbsent = data.reduce((s, d) => s + d.absent, 0);
  const hasData = totalPresent + totalAbsent > 0;

  return (
    <div className="card-crisp p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xl font-black text-foreground">الحضور والغياب الأسبوعي</p>
        <p className="text-sm font-bold text-muted-foreground">
          آخر 7 أيام من سجلات الحضور الحقيقية
        </p>
      </div>
      {!hasData ? (
        <p className="mt-4 rounded-xl border-2 border-dashed border-border p-6 text-center text-base font-bold text-muted-foreground">
          لا توجد سجلات حضور لهذا الأسبوع بعد.
        </p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-6">
            <div className="rounded-xl border-2 border-blue-500/40 bg-blue-500/5 p-4 text-center">
              <p className="text-base font-black text-blue-700">حضور</p>
              <p className="kpi-number text-5xl text-blue-700">{formatNumber(totalPresent)}</p>
            </div>
            <div className="rounded-xl border-2 border-red-500/40 bg-red-500/5 p-4 text-center">
              <p className="text-base font-black text-red-700">غياب</p>
              <p className="kpi-number text-5xl text-red-700">{formatNumber(totalAbsent)}</p>
            </div>
          </div>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} barCategoryGap="35%" barGap={12}>
                <CartesianGrid
                  strokeDasharray="4 4"
                  stroke="var(--color-border)"
                  vertical={false}
                />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 16, fontWeight: 900, fill: "var(--color-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                />
                <YAxis
                  tick={{ fontSize: 15, fontWeight: 800, fill: "var(--color-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: "2px solid var(--color-border)",
                    background: "var(--color-card)",
                    fontWeight: 800,
                    fontSize: 15,
                    color: "var(--color-foreground)",
                    direction: "rtl",
                  }}
                  cursor={{ fill: "var(--color-muted)" }}
                />
                <Legend wrapperStyle={{ fontWeight: 900, fontSize: 16, paddingTop: 8 }} />
                <Bar dataKey="present" name="حضور" radius={[10, 10, 0, 0]}>
                  {data.map((_, i) => (
                    <Cell key={`p-${i}`} fill={PRESENT_COLOR} />
                  ))}
                </Bar>
                <Bar dataKey="absent" name="غياب" radius={[10, 10, 0, 0]}>
                  {data.map((_, i) => (
                    <Cell key={`a-${i}`} fill={ABSENT_COLOR} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}
