import { Check, Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/dashboard/StatCard";
import {
  createTask,
  deleteTask,
  getTasksForAssignee,
  setTaskStatus,
  useDataStore,
  type CreateTaskInput,
} from "@/lib/data-store";
import { formatDateTime, formatNumber } from "@/lib/format";
import { getSession } from "@/lib/auth";
import { cn } from "@/lib/utils";
import type { Task, TaskAssigneeRole, TaskPriority, TaskStatus, TaskType } from "@/types";

/**
 * بطاقة "الأحداث اليومية" + نافذة إضافة/عرض المهام.
 * تظهر في Dashboard المالك، وتعرض فقط المهام الحقيقية المُسجَّلة.
 */

const TASK_TYPES: { key: TaskType; label: string }[] = [
  { key: "general", label: "عام" },
  { key: "follow_up", label: "متابعة" },
  { key: "collection", label: "تحصيل" },
  { key: "curriculum", label: "منهج" },
  { key: "admin", label: "إدارية" },
  { key: "communication", label: "تواصل" },
];

const PRIORITIES: { key: TaskPriority; label: string; tone: "neutral" | "primary" | "destructive" }[] = [
  { key: "low", label: "منخفضة", tone: "neutral" },
  { key: "medium", label: "متوسطة", tone: "primary" },
  { key: "high", label: "عالية", tone: "destructive" },
];

const STATUS_TONE: Record<TaskStatus, "neutral" | "primary" | "success" | "warning"> = {
  pending: "warning",
  in_progress: "primary",
  done: "success",
  cancelled: "neutral",
};

const STATUS_LABEL: Record<TaskStatus, string> = {
  pending: "لم تبدأ",
  in_progress: "قيد التنفيذ",
  done: "مكتملة",
  cancelled: "ملغاة",
};

export interface DailyTasksCardProps {
  /** الدور الحالي — يحدّد من يطّلع على المهام. */
  role: TaskAssigneeRole;
  /** المعرّف الفريد للمستخدم (يُحدَّد تلقائياً من session عند owner). */
  assigneeId?: string | null;
  /** اسم المعيَّن (للعرض). */
  assigneeName?: string | undefined;
}

export function DailyTasksCard({ role, assigneeId, assigneeName }: DailyTasksCardProps) {
  const state = useDataStore();
  const session = typeof window !== "undefined" ? getSession() : null;
  const identifier = assigneeId ?? session?.identifier ?? null;
  const myTasks = getTasksForAssignee(state, role, identifier);
  const openTasks = myTasks.filter((t) => t.status === "pending" || t.status === "in_progress");
  const urgentCount = openTasks.filter((t) => t.is_urgent).length;
  const [showAll, setShowAll] = useState(false);
  const [openModal, setOpenModal] = useState(false);

  const preview = openTasks.slice(0, 4);
  const visible = showAll ? openTasks : preview;

  return (
    <>
      <div className="card-crisp p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-xl font-black text-foreground">
            <span className="text-2xl">📋</span>
            الأحداث اليومية
          </p>
          <StatusBadge tone={urgentCount > 0 ? "destructive" : openTasks.length > 0 ? "warning" : "success"}>
            {formatNumber(openTasks.length)} مفتوحة · {formatNumber(urgentCount)} مستعجل
          </StatusBadge>
        </div>
        <p className="mt-1 text-sm font-bold text-muted-foreground">
          {assigneeName
            ? `مهام ${assigneeName}`
            : role === "owner"
              ? "كل المهام الموكلة لأي شخص في السنتر"
              : "المهام الموكلة لك شخصياً"}
        </p>

        <div className="mt-4 space-y-2">
          {openTasks.length === 0 ? (
            <p className="rounded-xl border-2 border-dashed border-border p-4 text-center text-sm font-bold text-muted-foreground">
              لا توجد مهام مفتوحة — اضغط "إضافة مهمة" لتسجيل أول مهمة.
            </p>
          ) : (
            visible.map((t) => <TaskRow key={t.id} task={t} role={role} />)
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setOpenModal(true)}
            className="flex items-center gap-2 rounded-xl bg-navy px-4 py-2.5 text-base font-black text-navy-foreground hover:opacity-90"
          >
            + إضافة مهمة
          </button>
          {openTasks.length > preview.length ? (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="text-sm font-black text-primary hover:underline"
            >
              {showAll ? "عرض أحدث 4 مهام" : `عرض باقي المهام (${formatNumber(openTasks.length - preview.length)})`}
            </button>
          ) : null}
        </div>
      </div>

      {openModal ? (
        <AddTaskModal
          onClose={() => setOpenModal(false)}
          defaultRole={role}
          defaultAssigneeId={identifier}
          defaultAssigneeName={
            assigneeName ??
              (role === "owner" ? "المالك" : session?.full_name ?? "—")
          }
        />
      ) : null}
    </>
  );
}

function TaskRow({ task, role }: { task: Task; role: TaskAssigneeRole }) {
  const done = task.status === "done";
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 p-3",
        done
          ? "border-success/30 bg-success/5"
          : task.is_urgent
            ? "border-destructive/40 bg-destructive/5"
            : "border-border bg-background",
      )}
    >
      <label className="flex min-w-0 flex-1 items-start gap-3">
        <input
          type="checkbox"
          checked={done}
          onChange={() =>
            setTaskStatus(task.id, done ? "pending" : "done")
          }
          className="mt-1 size-5 cursor-pointer accent-success"
          aria-label="إنجاز المهمة"
        />
        <div className="min-w-0">
          <p
            className={cn(
              "text-base font-black",
              done ? "text-muted-foreground line-through" : "text-foreground",
            )}
          >
            {task.is_urgent ? "🚨 " : ""}
            {task.title}
          </p>
          <p className="text-xs font-bold text-muted-foreground">
            {task.assignee_name} · {TASK_TYPES.find((x) => x.key === task.task_type)?.label} ·{" "}
            {formatDateTime(task.created_at)}
            {task.note ? ` · ${task.note}` : ""}
          </p>
        </div>
      </label>
      <div className="flex items-center gap-2">
        <StatusBadge tone={STATUS_TONE[task.status]}>{STATUS_LABEL[task.status]}</StatusBadge>
        {role === "owner" ? (
          <button
            type="button"
            onClick={() => {
              if (window.confirm("حذف المهمة؟")) {
                deleteTask(task.id);
                toast.success("تم حذف المهمة");
              }
            }}
            className="rounded-lg border-2 border-border p-1.5 text-destructive hover:border-destructive"
            aria-label="حذف"
          >
            <Trash2 className="size-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

interface AddTaskModalProps {
  onClose: () => void;
  defaultRole: TaskAssigneeRole;
  defaultAssigneeId: string | null;
  defaultAssigneeName: string;
}

function AddTaskModal({ onClose, defaultRole, defaultAssigneeId, defaultAssigneeName }: AddTaskModalProps) {
  const state = useDataStore();
  const session = typeof window !== "undefined" ? getSession() : null;
  const [title, setTitle] = useState("");
  const [taskType, setTaskType] = useState<TaskType>("general");
  const [assigneeRole, setAssigneeRole] = useState<TaskAssigneeRole>(defaultRole);
  const [assigneeId, setAssigneeId] = useState<string>(defaultAssigneeId ?? "");
  const [assigneeName, setAssigneeName] = useState<string>(defaultAssigneeName);
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [isUrgent, setIsUrgent] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const candidateList = (() => {
    if (assigneeRole === "teacher") {
      return state.teachers.map((t) => ({ id: t.id, name: t.full_name }));
    }
    if (assigneeRole === "staff") {
      return state.staffPermissions.map((s) => ({ id: s.account_identifier, name: s.full_name }));
    }
    return [{ id: "owner", name: "المالك" }];
  })();

  function pickAssignee(value: string) {
    setAssigneeId(value);
    const found = candidateList.find((c) => c.id === value);
    if (found) setAssigneeName(found.name);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("اكتب عنوان المهمة");
      return;
    }
    setBusy(true);
    try {
      const input: CreateTaskInput = {
        title: title.trim(),
        taskType,
        assigneeRole,
        assigneeId: assigneeId || null,
        assigneeName: assigneeName || "—",
        createdById: session?.identifier ?? null,
        createdByName: session?.full_name ?? null,
        priority,
        isUrgent,
        note: note.trim() || null,
      };
      createTask(input);
      toast.success("تم حفظ المهمة وإضافة إشعار");
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="card-crisp w-full max-w-xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-xl font-black text-foreground">إضافة مهمة جديدة</p>
        <p className="mt-1 text-sm font-bold text-muted-foreground">
          المهمة تُحفظ فعلياً وتظهر للمُكلَّف وللمالك في نفس اللحظة
        </p>
        <form onSubmit={submit} className="mt-4 space-y-3">
          <Field label="المهمة *">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputClass}
              placeholder="مثال: تحصيل اشتراك الطالب أحمد"
              autoFocus
            />
          </Field>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="نوع المهمة">
              <select
                value={taskType}
                onChange={(e) => setTaskType(e.target.value as TaskType)}
                className={inputClass}
              >
                {TASK_TYPES.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="الأولوية">
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className={inputClass}
              >
                {PRIORITIES.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="المسؤول">
            <div className="grid gap-2 md:grid-cols-3">
              {(
                [
                  { key: "teacher", label: "مدرس" },
                  { key: "staff", label: "موظف" },
                  { key: "owner", label: "مالك" },
                ] as { key: TaskAssigneeRole; label: string }[]
              ).map((opt) => (
                <label
                  key={opt.key}
                  className={cn(
                    "flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 px-3 py-2 text-sm font-black",
                    assigneeRole === opt.key
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background text-foreground hover:border-primary",
                  )}
                >
                  <input
                    type="radio"
                    name="assigneeRole"
                    value={opt.key}
                    checked={assigneeRole === opt.key}
                    onChange={() => {
                      setAssigneeRole(opt.key);
                      setAssigneeId("");
                      if (opt.key === "owner") setAssigneeName("المالك");
                      else setAssigneeName("");
                    }}
                    className="sr-only"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </Field>
          {assigneeRole !== "owner" ? (
            <Field label={assigneeRole === "teacher" ? "اختر المدرس" : "اختر الموظف"}>
              <select
                value={assigneeId}
                onChange={(e) => pickAssignee(e.target.value)}
                className={inputClass}
              >
                <option value="">— اختر —</option>
                {candidateList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
          <label className="flex items-center gap-2 text-base font-black text-foreground">
            <input
              type="checkbox"
              checked={isUrgent}
              onChange={(e) => setIsUrgent(e.target.checked)}
              className="size-5 accent-destructive"
            />
            مستعجل 🚨 (يظهر فوراً في أعلى التنبيهات)
          </label>
          <Field label="ملاحظات">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className={inputClass}
              placeholder="أي تفاصيل إضافية..."
            />
          </Field>
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border-2 border-border px-4 py-2 text-sm font-black text-foreground hover:border-primary"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={busy}
              className="flex items-center gap-2 rounded-xl bg-navy px-4 py-2 text-sm font-black text-navy-foreground hover:opacity-90 disabled:opacity-50"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
              حفظ المهمة
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-black text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full rounded-xl border-2 border-border bg-background px-4 py-2.5 text-base font-extrabold text-foreground outline-none placeholder:font-bold placeholder:text-muted-foreground focus:border-primary";
