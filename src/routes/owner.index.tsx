import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Banknote, TrendingUp, UserCheck, Users, Wallet } from "lucide-react";

import { AttendanceChart, PerformanceChart, RevenueChart } from "@/components/dashboard/Charts";
import { Panel, StatCard, StatusBadge } from "@/components/dashboard/StatCard";
import { AppShell } from "@/components/layout/AppShell";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import { useDataStore } from "@/lib/data-store";
import { attendanceSeries, performanceSeries, revenueSeries } from "@/lib/mock-data";

export const Route = createFileRoute("/owner/")({
  head: () => ({
    meta: [
      { title: "برج التحكم — لوحة المالك" },
      {
        name: "description",
        content: "تحليلات لحظية للسنتر: الإيرادات، الحضور، التزام المدرسين بتايمرات الحصص.",
      },
      { property: "og:title", content: "برج التحكم — لوحة المالك" },
      {
        property: "og:description",
        content: "تحليلات لحظية للإيرادات والحضور والتزام المدرسين داخل السنتر.",
      },
    ],
  }),
  component: OwnerDashboard,
});

function OwnerDashboard() {
  const { students, teachers, groups } = useDataStore();
  const totalStudents = students.length;
  const avgCompliance = Math.round(
    teachers.reduce((sum, t) => sum + t.timer_compliance, 0) / teachers.length,
  );
  const monthRevenue = revenueSeries[revenueSeries.length - 1]!.revenue;
  const monthProfit = revenueSeries[revenueSeries.length - 1]!.profit;

  return (
    <AppShell
      role="owner"
      title="برج التحكم"
      description="نظرة شاملة على أداء السنتر خلال شهر أغسطس ٢٠٢٦"
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="إيرادات الشهر"
          value={formatCurrency(monthRevenue)}
          icon={Banknote}
          trend="+٧٪ عن يوليو"
        />
        <StatCard
          label="صافي الربح"
          value={formatCurrency(monthProfit)}
          icon={Wallet}
          tone="success"
          trend="+٩٪ عن يوليو"
        />
        <StatCard
          label="إجمالي الطلاب النشطين"
          value={formatNumber(totalStudents)}
          icon={Users}
          trend="+٤٢ طالب جديد"
        />
        <StatCard
          label="متوسط التزام المدرسين"
          value={formatPercent(avgCompliance)}
          icon={UserCheck}
          tone={avgCompliance >= 90 ? "success" : "warning"}
          trendDirection="down"
          trend="١٧ مخالفة تايمر هذا الشهر"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel
          title="التدفق المالي"
          description="الإيرادات مقابل صافي الربح خلال ٦ أشهر"
          className="xl:col-span-2"
        >
          <RevenueChart data={revenueSeries} />
        </Panel>

        <Panel title="متوسط الأداء حسب المادة" description="متوسط درجات التقييمات اللحظية">
          <PerformanceChart data={performanceSeries} />
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel
          title="الحضور الأسبوعي"
          description="إجمالي الحضور والغياب لكل يوم"
          className="xl:col-span-2"
        >
          <AttendanceChart data={attendanceSeries} />
        </Panel>

        <Panel title="تنبيهات تحتاج قراراً" description="مؤشرات خارج المعدل الطبيعي">
          <div className="space-y-3">
            <AlertRow
              tone="destructive"
              title="أ. كريم شوقي — التزام ٧٨٪"
              text="٩ مخالفات لتايمر الحصة خلال ٣٠ يوم"
            />
            <AlertRow
              tone="warning"
              title="مجموعة رياضيات الإثنين ممتلئة"
              text="٤٠ من ٤٠ — يلزم فتح مجموعة جديدة"
            />
            <AlertRow
              tone="warning"
              title="١٢ طالب متأخر في السداد"
              text="إجمالي مستحق ٦٬٤٠٠ ج.م"
            />
            <AlertRow
              tone="destructive"
              title="مخزون بنك أسئلة الكيمياء منخفض"
              text="١٢ نسخة فقط متبقية"
            />
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="أداء المدرسين" description="الالتزام بالتايمر والإيراد الشهري">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead>
                <tr className="border-b-2 border-border text-muted-foreground">
                  <th className="pb-3">المدرس</th>
                  <th className="pb-3">المادة</th>
                  <th className="pb-3">الطلاب</th>
                  <th className="pb-3">الالتزام</th>
                  <th className="pb-3">الإيراد</th>
                </tr>
              </thead>
              <tbody>
                {teachers.map((t) => (
                  <tr key={t.id} className="border-b border-border last:border-0">
                    <td className="py-3 font-black text-foreground">{t.full_name}</td>
                    <td className="py-3 font-bold text-muted-foreground">{t.subject}</td>
                    <td className="py-3 font-extrabold">{formatNumber(t.students)}</td>
                    <td className="py-3">
                      <StatusBadge
                        tone={
                          t.timer_compliance >= 90
                            ? "success"
                            : t.timer_compliance >= 80
                              ? "warning"
                              : "destructive"
                        }
                      >
                        {formatPercent(t.timer_compliance)}
                      </StatusBadge>
                    </td>
                    <td className="py-3 font-black text-primary">
                      {formatCurrency(t.monthly_revenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="المجموعات النشطة" description="الإشغال مقابل السعة القصوى">
          <div className="space-y-4">
            {groups.map((g) => {
              const pct = Math.round((g.enrolled / g.capacity) * 100);
              return (
                <div key={g.id} className="rounded-xl border-2 border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-black text-foreground">{g.name}</p>
                    <StatusBadge
                      tone={pct >= 100 ? "destructive" : pct >= 85 ? "warning" : "success"}
                    >
                      {formatNumber(g.enrolled)} / {formatNumber(g.capacity)}
                    </StatusBadge>
                  </div>
                  <p className="mt-1 text-xs font-bold text-muted-foreground">
                    {g.teacher_name} · {g.grade} · {g.room} · {g.weekday} {g.time}
                  </p>
                  <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      <Panel title="أعلى الطلاب أداءً" description="مؤشرات الحضور والنقاط والدرجات">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[...students]
            .sort((a, b) => b.avg_score - a.avg_score)
            .slice(0, 6)
            .map((s) => (
              <div key={s.id} className="rounded-xl border-2 border-border p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-black text-foreground">{s.full_name}</p>
                  <span className="kpi-number text-xl">{formatNumber(s.avg_score)}</span>
                </div>
                <p className="mt-1 text-xs font-bold text-muted-foreground">
                  {s.grade} · {s.group_name}
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <StatusBadge tone="primary">
                    <TrendingUp className="size-3.5" /> {formatPercent(s.attendance_rate)} حضور
                  </StatusBadge>
                  <StatusBadge tone="success">{formatNumber(s.points)} نقطة</StatusBadge>
                </div>
              </div>
            ))}
        </div>
      </Panel>
    </AppShell>
  );
}

function AlertRow({
  tone,
  title,
  text,
}: {
  tone: "warning" | "destructive";
  title: string;
  text: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border-2 border-border p-3">
      <AlertTriangle
        className={
          tone === "destructive" ? "mt-0.5 size-5 text-destructive" : "mt-0.5 size-5 text-warning"
        }
      />
      <div>
        <p className="text-sm font-black text-foreground">{title}</p>
        <p className="text-xs font-bold text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}
