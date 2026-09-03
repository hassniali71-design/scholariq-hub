import { createFileRoute } from "@tanstack/react-router";
import { Clock, ListTodo } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";

import { Panel, StatCard, StatusBadge } from "@/components/dashboard/StatCard";
import { AppShell } from "@/components/layout/AppShell";
import { DailyTasksCard } from "@/components/tasks/DailyTasksCard";
import { getSession } from "@/lib/auth";
import { getTasksForAssignee, setTaskStatus, useDataStore } from "@/lib/data-store";
import { formatDateTime, formatNumber } from "@/lib/format";
import type { Task } from "@/types";

export const Route = createFileRoute("/teacher/tasks")({
  head: () => ({
    meta: [
      { title: "مهامي — لوحة المدرس" },
      {
        name: "description",
        content: "كل المهام الموكلة لك شخصياً في السنتر كمدرس.",
      },
    ],
  }),
  component: TeacherTasksPage,
});

function TeacherTasksPage() {
  const state = useDataStore();
  const session = typeof window !== "undefined" ? getSession() : null;
  const myTasks = useMemo(
    () => getTasksForAssignee(state, "teacher", session?.identifier ?? null),
    [state, session?.identifier],
  );
  const open = myTasks.filter((t) => t.status === "pending" || t.status === "in_progress");
  const done = myTasks.filter((t) => t.status === "done");
  const urgent = open.filter((t) => t.is_urgent);

  return (
    <AppShell
      role="teacher"
      title="مهامي"
      description={`كل المهام الموكلة لك في ${state.center.name}`}
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label="مهام مفتوحة" value={formatNumber(open.length)} icon={ListTodo} tone="warning" />
        <StatCard label="مهام مستعجلة" value={formatNumber(urgent.length)} icon={Clock} tone="destructive" />
        <StatCard label="مهام منجزة" value={formatNumber(done.length)} icon={ListTodo} tone="success" />
      </div>

      <Panel
        title="الأحداث اليومية"
        description="إضافة مهمة جديدة لنفسك أو لزميل"
      >
        <DailyTasksCard
          role="teacher"
          assigneeId={session?.identifier ?? null}
          assigneeName={session?.full_name}
        />
      </Panel>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="مهامي المستعجلة">
          <TaskList tasks={urgent} />
        </Panel>
        <Panel title="مهامي المفتوحة">
          <TaskList
            tasks={[...open].sort((a, b) => (a.created_at < b.created_at ? 1 : -1))}
          />
        </Panel>
      </div>
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
        return (
          <div
            key={t.id}
            className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 p-3 ${
              done
                ? "border-success/30 bg-success/5"
                : t.is_urgent
                  ? "border-destructive/40 bg-destructive/5"
                  : "border-border bg-background"
            }`}
          >
            <label className="flex min-w-0 flex-1 items-start gap-3">
              <input
                type="checkbox"
                checked={done}
                onChange={() => {
                  setTaskStatus(t.id, done ? "pending" : "done");
                  toast.success(done ? "أُعيدت للمفتوحة" : "تم إنجاز المهمة");
                }}
                className="mt-1 size-5 cursor-pointer accent-success"
                aria-label="إنجاز"
              />
              <div className="min-w-0">
                <p className={`text-base font-black ${done ? "text-muted-foreground line-through" : "text-foreground"}`}>
                  {t.is_urgent ? "🚨 " : ""}
                  {t.title}
                </p>
                <p className="text-xs font-bold text-muted-foreground">
                  {t.task_type} · {formatDateTime(t.created_at)}
                  {t.note ? ` · ${t.note}` : ""}
                </p>
              </div>
            </label>
            <StatusBadge
              tone={done ? "success" : t.status === "in_progress" ? "primary" : "warning"}
            >
              {done ? "مكتملة" : t.status === "in_progress" ? "قيد التنفيذ" : "لم تبدأ"}
            </StatusBadge>
          </div>
        );
      })}
    </div>
  );
}
