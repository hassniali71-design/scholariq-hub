import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { AttendancePoint, PerformancePoint, RevenuePoint } from "@/types";

const axisStyle = { fontSize: 12, fontWeight: 800, fill: "var(--color-foreground)" } as const;

const tooltipStyle = {
  borderRadius: 12,
  border: "2px solid var(--color-border)",
  background: "var(--color-card)",
  fontWeight: 800,
  color: "var(--color-foreground)",
  direction: "rtl" as const,
};

export function RevenueChart({ data }: { data: RevenuePoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="profitFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-chart-2)" stopOpacity={0.3} />
            <stop offset="100%" stopColor="var(--color-chart-2)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="4 4" stroke="var(--color-border)" vertical={false} />
        <XAxis dataKey="month" tick={axisStyle} axisLine={false} tickLine={false} />
        <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={60} />
        <Tooltip contentStyle={tooltipStyle} />
        <Legend wrapperStyle={{ fontWeight: 800, fontSize: 12 }} />
        <Area
          type="monotone"
          dataKey="revenue"
          name="الإيرادات"
          stroke="var(--color-chart-1)"
          strokeWidth={3}
          fill="url(#revFill)"
        />
        <Area
          type="monotone"
          dataKey="profit"
          name="صافي الربح"
          stroke="var(--color-chart-2)"
          strokeWidth={3}
          fill="url(#profitFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function AttendanceChart({ data }: { data: AttendancePoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="4 4" stroke="var(--color-border)" vertical={false} />
        <XAxis dataKey="day" tick={axisStyle} axisLine={false} tickLine={false} />
        <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={40} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--color-muted)" }} />
        <Legend wrapperStyle={{ fontWeight: 800, fontSize: 12 }} />
        <Bar dataKey="present" name="حضور" fill="var(--color-chart-1)" radius={[8, 8, 0, 0]} />
        <Bar dataKey="absent" name="غياب" fill="var(--color-chart-5)" radius={[8, 8, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function PerformanceChart({ data }: { data: PerformancePoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="4 4" stroke="var(--color-border)" vertical={false} />
        <XAxis dataKey="subject" tick={axisStyle} axisLine={false} tickLine={false} interval={0} />
        <YAxis domain={[0, 100]} tick={axisStyle} axisLine={false} tickLine={false} width={40} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--color-muted)" }} />
        <Bar dataKey="avg" name="متوسط الدرجات" radius={[8, 8, 0, 0]}>
          {data.map((entry) => (
            <Cell
              key={entry.subject}
              fill={entry.avg >= 80 ? "var(--color-chart-2)" : "var(--color-chart-3)"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ScoreTrendChart({ data }: { data: { label: string; score: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="4 4" stroke="var(--color-border)" vertical={false} />
        <XAxis dataKey="label" tick={axisStyle} axisLine={false} tickLine={false} />
        <YAxis domain={[0, 100]} tick={axisStyle} axisLine={false} tickLine={false} width={40} />
        <Tooltip contentStyle={tooltipStyle} />
        <Line
          type="monotone"
          dataKey="score"
          name="النتيجة"
          stroke="var(--color-chart-1)"
          strokeWidth={4}
          dot={{ r: 5, strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** تقييم أداء المدرسين — عمود لكل مدرس بلونه حسب مستوى الالتزام. */
export function TeacherPerformanceChart({
  data,
}: {
  data: { name: string; score: number; punctuality: number; delivery: number; rating: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={340}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="4 4" stroke="var(--color-border)" vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ ...axisStyle, fontSize: 13 }}
          axisLine={false}
          tickLine={false}
          interval={0}
        />
        <YAxis domain={[0, 100]} tick={axisStyle} axisLine={false} tickLine={false} width={44} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--color-muted)" }} />
        <Legend wrapperStyle={{ fontWeight: 800, fontSize: 13 }} />
        <Bar dataKey="score" name="التقييم العام" radius={[10, 10, 0, 0]}>
          {data.map((entry) => (
            <Cell
              key={entry.name}
              fill={
                entry.score >= 80
                  ? "var(--color-chart-2)"
                  : entry.score >= 50
                    ? "var(--color-chart-3)"
                    : "var(--color-chart-5)"
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** متوسط أداء وحضور السنتر حسب اليوم. */
export function CenterDayChart({
  data,
}: {
  data: { day: string; attendance: number; payments: number; sessions: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={340}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="4 4" stroke="var(--color-border)" vertical={false} />
        <XAxis
          dataKey="day"
          tick={{ ...axisStyle, fontSize: 14 }}
          axisLine={false}
          tickLine={false}
          interval={0}
        />
        <YAxis tick={axisStyle} axisLine={false} tickLine={false} width={44} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--color-muted)" }} />
        <Legend wrapperStyle={{ fontWeight: 800, fontSize: 14 }} />
        <Bar
          dataKey="attendance"
          name="حضور مسجّل"
          fill="var(--color-chart-1)"
          radius={[8, 8, 0, 0]}
        />
        <Bar
          dataKey="sessions"
          name="حصص اليوم"
          fill="var(--color-chart-2)"
          radius={[8, 8, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** الحضور الأسبوعي — نسخة كبيرة بخطوط أوضح تملأ الكارت بالكامل. */
export function WeeklyAttendanceChart({ data }: { data: AttendancePoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={420}>
      <BarChart data={data} margin={{ top: 12, right: 12, left: 12, bottom: 4 }} barGap={10}>
        <CartesianGrid strokeDasharray="4 4" stroke="var(--color-border)" vertical={false} />
        <XAxis
          dataKey="day"
          tick={{ ...axisStyle, fontSize: 16, fontWeight: 900 }}
          axisLine={false}
          tickLine={false}
          interval={0}
        />
        <YAxis tick={{ ...axisStyle, fontSize: 15 }} axisLine={false} tickLine={false} width={48} />
        <Tooltip
          contentStyle={{ ...tooltipStyle, fontSize: 15 }}
          cursor={{ fill: "var(--color-muted)" }}
        />
        <Legend wrapperStyle={{ fontWeight: 900, fontSize: 16, paddingTop: 8 }} />
        <Bar dataKey="present" name="حضور" fill="var(--color-chart-1)" radius={[10, 10, 0, 0]} />
        <Bar dataKey="absent" name="غياب" fill="var(--color-chart-5)" radius={[10, 10, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
