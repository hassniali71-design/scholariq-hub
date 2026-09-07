import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { CheckCheck, Clock, ListTodo, PieChart } from "lucide-react";

import { Panel, StatCard, StatusBadge } from "@/components/dashboard/StatCard";
import { AppShell } from "@/components/layout/AppShell";
import { getSession } from "@/lib/auth";
import { getTasksForAssignee, setTaskStatus, useDataStore } from "@/lib/data-store";
import { formatDateTime, formatNumber, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Task, TaskStatus } from "@/types";

export const Route = createFileRoute("/staff/tasks")({
  head: () => ({
    meta: [
      { title: "مهامي — لوحة الموظف" },
      { name: "description", content: "كل المهام الموكلة لي شخصياً في السنتر." },
    ],
  }),
  component: StaffTasksPage,
});

const STATUS_LABEL: Record<TaskStatus, string> = {
  pending: "لم تبدأ",
  in_progress: "قيد التنفيذ",
  done: "منجزة",
  cancelled: "مؤجلة",
};

const STATUS_TONE: Record<TaskStatus, "success" | "warning" | "primary" | "neutral"> = {
  done: "success",
  in_progress: "primary",
  pending: "warning",
  cancelled: "neutral",
};

function startOfWeek(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return d.getTime();
}

function StaffTasksPage() {
  const state = useDataStore();
  const session = typeof window !== "undefined" ? getSession() : null;
  const myTasks = useMemo(
    () => getTasksForAssignee(state, "staff", session?.identifier ?? null),
    [state, session?.identifier],
  );
  const now = new Date();
  const weekStart = startOfWeek();
  const open = myTasks.filter((t) => t.status !== "done" && t.status !== "cancelled");
  const done = myTasks.filter((t) => t.status === "done");
  const cancelled = myTasks.filter((t) => t.status === "cancelled");
  const urgent = open.filter(
    (t) => t.is_urgent || (t.due_at && new Date(t.due_at) < now && t.status !== "done"),
  );

  const weekDone = done.filter(
    (t) => t.completed_at && Date.parse(t.completed_at) >= weekStart,
  ).length;
  const last30 = now.getTime() - 30 * 86400000;
  const last30Done = done.filter((t) => t.completed_at && Date.parse(t.completed_at) >= last30);
  const avgHours = last30Done.length
    ? Math.round(
        last30Done.reduce((s, t) => {
          const start = Date.parse(t.created_at);
          const end = Date.parse(t.completed_at ?? t.created_at);
          return s + Math.max(0, (end - start) / 3600000);
        }, 0) / last30Done.length,
      )
    : 0;
  const withDue = done.filter((t) => t.due_at && t.completed_at);
  const onTime = withDue.filter((t) => Date.parse(t.completed_at!) <= Date.parse(t.due_at!)).length;
  const onTimeRate = withDue.length ? Math.round((onTime / withDue.length) * 100) : null;

  return (
    <AppShell
      role="staff"
      title="مهامي"
      description={`كل المهام الموكلة لك شخصياً في ${state.center.name}`}
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="مهام مفتوحة"
          value={formatNumber(open.length)}
          icon={ListTodo}
          tone="warning"
        />
        <StatCard
          label="مهام مستعجلة/متأخرة"
          value={formatNumber(urgent.length)}
          icon={Clock}
          tone="destructive"
        />
        <StatCard
          label="منجزة هذا الأسبوع"
          value={formatNumber(weekDone)}
          icon={CheckCheck}
          tone="success"
        />
        <StatCard
          label="متوسط زمن الإنجاز (س)"
          value={avgHours ? `${formatNumber(avgHours)} س` : "—"}
          icon={Clock}
        />
        <StatCard
          label="نسبة الالتزام بالمواعيد"
          value={onTimeRate !== null ? formatPercent(onTimeRate) : "—"}
          icon={CheckCheck}
          tone={onTimeRate !== null && onTimeRate >= 80 ? "success" : "warning"}
        />
        <StatCard label="مهام مؤجلة" value={formatNumber(cancelled.length)} icon={Clock} />
      </div>

      <Panel title="ملخص الأداء" description="نظرة سريعة على حال المهام">
        <PerformanceDashboard
          done={done.length}
          overdue={open.filter((t) => t.due_at && new Date(t.due_at) < now).length}
          urgent={urgent.length}
          open={open.length}
        />
      </Panel>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="مستعجل/متأخر" description="أولوية قصوى أو مرّ الموعد">
          <TaskList tasks={urgent} />
        </Panel>
        <Panel title="مهامي المفتوحة" description="مرتبة بالأحدث">
          <TaskList tasks={[...open].sort((a, b) => (a.created_at < b.created_at ? 1 : -1))} />
        </Panel>
      </div>

      <Panel title="مهامي المنجزة" description="كل القائمة (سكرول)">
        <div className="max-h-[600px] overflow-y-auto">
          <TaskList
            tasks={[...done].sort((a, b) =>
              (a.completed_at ?? a.created_at) < (b.completed_at ?? b.created_at) ? 1 : -1,
            )}
          />
        </div>
      </Panel>
    </AppShell>
  );
}

function TaskList({ tasks }: { tasks: Task[] }) {
  if (tasks.length === 0) {
    return (
      <p className="rounded-xl border-2 border-dashed border-border p-6 text-center text-sm font-bold text-muted-foreground">
        لا توجد مهام في هذا القسم.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {tasks.map((t) => {
        const done = t.status === "done";
        const overdue = t.due_at && new Date(t.due_at) < new Date() && !done;
        return (
          <div
            key={t.id}
            className={cn(
              "rounded-xl border-2 p-3",
              done
                ? "border-success/30 bg-success/5"
                : overdue
                  ? "border-destructive/40 bg-destructive/5"
                  : t.is_urgent
                    ? "border-destructive/40 bg-destructive/5"
                    : "border-border bg-background",
            )}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={done}
                    onChange={() => setTaskStatus(t.id, done ? "pending" : "done")}
                    className="size-5 cursor-pointer accent-success"
                    aria-label="إنجاز"
                  />
                  <p
                    className={cn(
                      "text-base font-black",
                      done ? "text-muted-foreground line-through" : "text-foreground",
                    )}
                  >
                    {t.is_urgent ? "🚨 " : ""}
                    {t.title}
                  </p>
                  {overdue ? <StatusBadge tone="destructive">متأخرة</StatusBadge> : null}
                </div>
                <p className="mt-1 text-xs font-bold text-muted-foreground">
                  {t.task_type} · {formatDateTime(t.created_at)}
                  {t.completed_at ? ` · نُجِزت ${formatDateTime(t.completed_at)}` : ""}
                </p>
                {t.note ? (
                  <p className="mt-1 text-xs font-bold text-muted-foreground">📝 {t.note}</p>
                ) : null}
              </div>
              <StatusBadge tone={STATUS_TONE[t.status]}>{STATUS_LABEL[t.status]}</StatusBadge>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {(["pending", "in_progress", "done", "cancelled"] as TaskStatus[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setTaskStatus(t.id, s)}
                  className={cn(
                    "rounded-lg border-2 px-2 py-1 text-[11px] font-black",
                    t.status === s
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-primary",
                  )}
                >
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PerformanceDashboard({
  done,
  overdue,
  urgent,
  open,
}: {
  done: number;
  overdue: number;
  urgent: number;
  open: number;
}) {
  const total = done + open || 1;
  const donePct = (done / total) * 100;
  const overduePct = (overdue / total) * 100;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <p className="mb-2 flex items-center gap-2 text-sm font-black">
          <PieChart className="size-4 text-primary" /> منجز / متأخر
        </p>
        <DonutChart done={donePct} overdue={overduePct} />
        <p className="mt-2 text-center text-xs font-black text-muted-foreground">
          {formatNumber(done)} منجز · {formatNumber(overdue)} متأخر
        </p>
      </div>
      <div>
        <p className="mb-2 text-sm font-black">مستعجل مقابل مفتوح</p>
        <BarStack urgent={urgent} open={open - urgent} />
        <div className="mt-2 flex justify-between text-xs font-black text-muted-foreground">
          <span>🔴 مستعجل: {formatNumber(urgent)}</span>
          <span>🟡 مفتوح: {formatNumber(Math.max(0, open - urgent))}</span>
        </div>
      </div>
    </div>
  );
}

function DonutChart({ done, overdue }: { done: number; overdue: number }) {
  const r = 36;
  const c = 2 * Math.PI * r;
  const rest = Math.max(0, 100 - done - overdue);
  return (
    <svg viewBox="0 0 100 100" className="mx-auto size-32">
      <circle cx="50" cy="50" r={r} fill="none" stroke="#e5e7eb" strokeWidth="14" />
      <circle
        cx="50"
        cy="50"
        r={r}
        fill="none"
        stroke="#16a34a"
        strokeWidth="14"
        strokeDasharray={`${(done / 100) * c} ${c}`}
        transform="rotate(-90 50 50)"
      />
      <circle
        cx="50"
        cy="50"
        r={r}
        fill="none"
        stroke="#dc2626"
        strokeWidth="14"
        strokeDasharray={`${(overdue / 100) * c} ${c}`}
        strokeDashoffset={`${-(done / 100) * c}`}
        transform="rotate(-90 50 50)"
      />
      <circle
        cx="50"
        cy="50"
        r={r}
        fill="none"
        stroke="#f59e0b"
        strokeWidth="14"
        strokeDasharray={`${(rest / 100) * c} ${c}`}
        strokeDashoffset={`${-((done + overdue) / 100) * c}`}
        transform="rotate(-90 50 50)"
      />
      <text x="50" y="55" textAnchor="middle" className="fill-foreground text-[14px] font-black">
        {Math.round(done)}٪
      </text>
    </svg>
  );
}

function BarStack({ urgent, open }: { urgent: number; open: number }) {
  const total = urgent + open || 1;
  const u = (urgent / total) * 100;
  const o = (open / total) * 100;
  return (
    <div className="space-y-1.5">
      <div className="h-6 overflow-hidden rounded-lg border-2 border-border">
        <div className="flex h-full">
          <div className="h-full bg-destructive" style={{ width: `${u}%` }} />
          <div className="h-full bg-warning" style={{ width: `${o}%` }} />
        </div>
      </div>
      <p className="text-center text-xs font-black text-muted-foreground">
        {formatNumber(urgent)} / {formatNumber(total)} مستعجل
      </p>
    </div>
  );
}
