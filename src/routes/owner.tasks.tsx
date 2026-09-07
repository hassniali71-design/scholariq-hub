import { createFileRoute } from "@tanstack/react-router";
import { CheckCheck, Clock, ListTodo } from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";

import { Panel, StatCard, StatusBadge } from "@/components/dashboard/StatCard";
import { AppShell } from "@/components/layout/AppShell";
import { DailyTasksCard } from "@/components/tasks/DailyTasksCard";
import { deleteTask, setTaskStatus, useDataStore } from "@/lib/data-store";
import { formatDateTime, formatNumber } from "@/lib/format";
import type { Task, TaskStatus } from "@/types";

export const Route = createFileRoute("/owner/tasks")({
  head: () => ({
    meta: [
      { title: "كل المهام — لوحة المالك" },
      {
        name: "description",
        content: "كل المهام المسجلة على كل أدوار السنتر (مدرس/موظف/مالك) مع إحصائياتها.",
      },
    ],
  }),
  component: OwnerTasksPage,
});

function OwnerTasksPage() {
  const state = useDataStore();
  const { tasks } = state;
  const open = tasks.filter((t) => t.status === "pending" || t.status === "in_progress");
  const done = tasks.filter((t) => t.status === "done");
  const urgent = open.filter((t) => t.is_urgent);
  const today = new Date().toDateString();

  const stats = useMemo(() => {
    const completedToday = done.filter(
      (t) => new Date(t.completed_at ?? 0).toDateString() === today,
    );
    return {
      open: open.length,
      done: done.length,
      urgent: urgent.length,
      todayDone: completedToday.length,
    };
  }, [tasks, today]);

  return (
    <AppShell role="owner" title="كل المهام" description="كل المهام الموكلة على كل أدوار السنتر">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="مهام مفتوحة"
          value={formatNumber(stats.open)}
          icon={ListTodo}
          tone="warning"
        />
        <StatCard
          label="مهام مستعجلة"
          value={formatNumber(stats.urgent)}
          icon={Clock}
          tone="destructive"
        />
        <StatCard
          label="مهام مكتملة"
          value={formatNumber(stats.done)}
          icon={CheckCheck}
          tone="success"
        />
        <StatCard
          label="أُنجِزت اليوم"
          value={formatNumber(stats.todayDone)}
          icon={CheckCheck}
          tone="primary"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="بطاقة الأحداث اليومية" description="إضافة مهمة جديدة تظهر فوراً للمكلَّف">
          <DailyTasksCard role="owner" />
        </Panel>
        <Panel
          title="المهام المستعجلة مفتوحة"
          description="المهام التي تم تعليمها كمستعجلة ولم تكتمل بعد"
        >
          <TaskList tasks={urgent} allowDelete />
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="كل المهام المفتوحة" description="مرتبة بالأحدث أولاً">
          <TaskList
            tasks={[...open].sort((a, b) => (a.created_at < b.created_at ? 1 : -1))}
            allowDelete
          />
        </Panel>
        <Panel
          title="المهام المنجزة"
          description="آخر 20 مهمة مكتملة"
          actions={
            done.length > 0 ? (
              <span className="text-xs font-bold text-muted-foreground">
                {formatNumber(done.length)} إجمالي
              </span>
            ) : undefined
          }
        >
          <TaskList
            tasks={[...done]
              .sort((a, b) =>
                (a.completed_at ?? a.created_at) < (b.completed_at ?? b.created_at) ? 1 : -1,
              )
              .slice(0, 20)}
            showStatus
          />
        </Panel>
      </div>
    </AppShell>
  );
}

function TaskList({
  tasks,
  allowDelete,
  showStatus,
}: {
  tasks: Task[];
  allowDelete?: boolean;
  showStatus?: boolean;
}) {
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
                  toast.success(done ? "تم إعادة فتح المهمة" : "تم إنجاز المهمة");
                }}
                className="mt-1 size-5 cursor-pointer accent-success"
                aria-label="إنجاز"
              />
              <div className="min-w-0">
                <p
                  className={`text-base font-black ${done ? "text-muted-foreground line-through" : "text-foreground"}`}
                >
                  {t.is_urgent ? "🚨 " : ""}
                  {t.title}
                </p>
                <p className="text-xs font-bold text-muted-foreground">
                  {t.assignee_name} ({t.assignee_role}) · {t.task_type} ·{" "}
                  {formatDateTime(t.created_at)}
                  {t.completed_at ? ` · نُجِزت ${formatDateTime(t.completed_at)}` : ""}
                </p>
                {t.note ? (
                  <p className="mt-1 text-xs font-bold text-muted-foreground">📝 {t.note}</p>
                ) : null}
              </div>
            </label>
            <div className="flex items-center gap-2">
              <StatusBadge
                tone={
                  t.status === "done"
                    ? "success"
                    : t.status === "in_progress"
                      ? "primary"
                      : t.status === "cancelled"
                        ? "neutral"
                        : "warning"
                }
              >
                {t.status === "pending"
                  ? "لم تبدأ"
                  : t.status === "in_progress"
                    ? "قيد التنفيذ"
                    : t.status === "done"
                      ? "مكتملة"
                      : "ملغاة"}
              </StatusBadge>
              {allowDelete ? (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm("حذف المهمة؟")) {
                      deleteTask(t.id);
                      toast.success("تم حذف المهمة");
                    }
                  }}
                  className="rounded-lg border-2 border-border p-1.5 text-destructive hover:border-destructive"
                  aria-label="حذف"
                >
                  🗑
                </button>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export type { TaskStatus };
