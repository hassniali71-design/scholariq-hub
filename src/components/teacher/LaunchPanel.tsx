import { ClipboardList, Plus, Send, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Panel } from "@/components/dashboard/StatCard";
import {
  deleteTeacherLaunch,
  getTeacherLaunchesForGroup,
  useDataStore,
  addTeacherLaunch,
} from "@/lib/data-store";
import { cn } from "@/lib/utils";
import type { TeacherLaunch, TeacherLaunchType } from "@/types";

/**
 * المرحلة A — كارت "إطلاق المهام" في صفحة الحصة.
 * المدرس يختار نوع (واجب، واجب للتصحيح، مهمة صف، واجب إلكتروني، اختبار إلكتروني،
 * قراءة، تسميع)، يكتب العنوان، ويختار وقت التسليم (للإلكتروني).
 */
export function LaunchPanel({
  groupId,
  teacherId,
  variant = "session",
}: {
  groupId: string;
  teacherId: string;
  variant?: "session" | "curriculum";
}) {
  const state = useDataStore();
  const [showAdd, setShowAdd] = useState(false);

  const launches = useMemo(
    () => getTeacherLaunchesForGroup(state, groupId),
    [state.teacherLaunches, groupId],
  );

  return (
    <Panel
      title="إطلاق المهام والواجبات"
      description="كل ما يطلقه المدرس يظهر هنا فوراً — وللطلاب في نفس اللحظة"
      actions={
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 rounded-xl bg-navy px-4 py-2 text-xs font-black text-navy-foreground transition-opacity hover:opacity-90"
        >
          <Plus className="size-4" /> إطلاق جديد
        </button>
      }
    >
      <div className={cn("space-y-2 overflow-y-auto pr-1", variant === "session" ? "max-h-72" : "max-h-[420px]")}>
        {launches.length === 0 ? (
          <p className="rounded-xl border-2 border-dashed border-border p-6 text-center text-sm font-bold text-muted-foreground">
            لا توجد مهام مُطلقة بعد. اضغط «إطلاق جديد» لتسجيل أول واجب أو نشاط.
          </p>
        ) : (
          launches.map((l) => (
            <LaunchRow
              key={l.id}
              launch={l}
              onDelete={() => {
                if (confirm(`حذف "${l.title}"؟`)) {
                  deleteTeacherLaunch(l.id);
                  toast.success("تم الحذف");
                }
              }}
            />
          ))
        )}
      </div>

      {showAdd ? (
        <AddLaunchModal
          onClose={() => setShowAdd(false)}
          onCreate={(input) => {
            addTeacherLaunch({ ...input, groupId, teacherId });
            setShowAdd(false);
            toast.success("تم إطلاق المهمة");
          }}
        />
      ) : null}
    </Panel>
  );
}

const TYPE_LABEL: Record<TeacherLaunchType, string> = {
  homework: "واجب بيتي",
  homework_with_correction: "واجب مع تصحيح",
  in_class_task: "مهمة داخل الحصة",
  interactive_activity: "نشاط تفاعلي",
  online_homework: "واجب إلكتروني",
  online_quiz: "اختبار إلكتروني",
  reading_assignment: "مراجعة / قراءة",
  oral_recitation: "تسميع",
};

const TYPE_TONE: Record<TeacherLaunchType, string> = {
  homework: "bg-primary/10 text-primary",
  homework_with_correction: "bg-info/10 text-info",
  in_class_task: "bg-success/10 text-success",
  interactive_activity: "bg-warning/15 text-warning",
  online_homework: "bg-primary/10 text-primary",
  online_quiz: "bg-destructive/10 text-destructive",
  reading_assignment: "bg-info/10 text-info",
  oral_recitation: "bg-success/10 text-success",
};

function LaunchRow({ launch, onDelete }: { launch: TeacherLaunch; onDelete: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border-2 border-border bg-background p-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("rounded-lg px-2 py-0.5 text-[11px] font-black", TYPE_TONE[launch.launch_type])}>
            {TYPE_LABEL[launch.launch_type]}
          </span>
          <p className="text-sm font-black text-foreground">{launch.title}</p>
        </div>
        {launch.body ? (
          <p className="mt-1 line-clamp-2 text-xs font-bold text-muted-foreground">{launch.body}</p>
        ) : null}
        <p className="mt-1 text-[11px] font-bold text-muted-foreground">
          أُطلق {new Date(launch.created_at).toLocaleString("ar-EG", { numberingSystem: "latn" })}
          {launch.due_at
            ? ` · يُسلَّم قبل ${new Date(launch.due_at).toLocaleString("ar-EG", { numberingSystem: "latn" })}`
            : null}
          {launch.duration_min ? ` · ${launch.duration_min} دقيقة` : null}
        </p>
      </div>
      <button
        type="button"
        onClick={onDelete}
        className="rounded-lg border-2 border-destructive/30 p-1.5 text-destructive hover:bg-destructive/10"
        aria-label="حذف"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}

function AddLaunchModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (input: {
    launchType: TeacherLaunchType;
    title: string;
    body?: string | null;
    notes?: string | null;
    dueAt?: string | null;
    durationMin?: number | null;
  }) => void;
}) {
  const [launchType, setLaunchType] = useState<TeacherLaunchType>("homework");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [durationMin, setDurationMin] = useState("");

  const needsDueDate = launchType === "online_homework" || launchType === "online_quiz";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border-2 border-border bg-background p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-lg font-black text-foreground">
            <Send className="size-4" /> إطلاق جديد
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
            aria-label="إغلاق"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="space-y-3">
          <Field label="نوع المهمة">
            <div className="flex flex-wrap gap-2">
              {(Object.keys(TYPE_LABEL) as TeacherLaunchType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setLaunchType(t)}
                  className={cn(
                    "rounded-xl border-2 px-3 py-1.5 text-xs font-black",
                    launchType === t
                      ? "border-navy bg-navy text-navy-foreground"
                      : "border-border bg-background text-foreground hover:border-primary",
                  )}
                >
                  {TYPE_LABEL[t]}
                </button>
              ))}
            </div>
          </Field>
          <Field label="عنوان المهمة" required>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
              placeholder="مثال: حل تمارين ص 12"
              className="w-full rounded-xl border-2 border-border bg-background px-3 py-2 text-sm font-bold text-foreground outline-none focus:border-primary"
            />
          </Field>
          <Field label="تفاصيل / ملاحظات">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={200}
              rows={2}
              placeholder="تعليمات للطلاب..."
              className="w-full rounded-xl border-2 border-border bg-background px-3 py-2 text-sm font-bold text-foreground outline-none focus:border-primary"
            />
          </Field>
          {needsDueDate ? (
            <Field label="وقت التسليم">
              <input
                type="datetime-local"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                className="w-full rounded-xl border-2 border-border bg-background px-3 py-2 text-sm font-bold text-foreground outline-none focus:border-primary"
              />
            </Field>
          ) : null}
          {launchType === "in_class_task" || launchType === "interactive_activity" ? (
            <Field label="المدة المتوقعة (دقيقة)">
              <input
                type="number"
                min={1}
                max={120}
                value={durationMin}
                onChange={(e) => setDurationMin(e.target.value)}
                className="w-full rounded-xl border-2 border-border bg-background px-3 py-2 text-sm font-bold text-foreground outline-none focus:border-primary"
              />
            </Field>
          ) : null}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border-2 border-border px-4 py-2 text-sm font-black text-foreground hover:bg-muted"
            >
              إلغاء
            </button>
            <button
              type="button"
              disabled={!title.trim()}
              onClick={() => {
                const dMin = durationMin.trim() ? Number(durationMin) : null;
                const dAt = dueAt ? new Date(dueAt).toISOString() : null;
                const b = body.trim();
                onCreate({
                  launchType,
                  title: title.trim(),
                  ...(b ? { body: b } : {}),
                  ...(dAt ? { dueAt: dAt } : {}),
                  ...(dMin && dMin > 0 ? { durationMin: dMin } : {}),
                });
              }}
              className="flex items-center gap-2 rounded-xl bg-navy px-5 py-2 text-sm font-black text-navy-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              <ClipboardList className="size-4" /> إطلاق
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-black text-muted-foreground">
        {label} {required ? <span className="text-destructive">*</span> : null}
      </label>
      {children}
    </div>
  );
}
