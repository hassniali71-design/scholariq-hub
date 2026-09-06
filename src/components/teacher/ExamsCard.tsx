import { FileText, Play, Timer, Trash2, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Panel } from "@/components/dashboard/StatCard";
import { FilePreviewModal } from "@/components/teacher/FilePreviewModal";
import { StudentScoreKeyboard } from "@/components/teacher/StudentScoreKeyboard";
import {
  addTeacherLaunch,
  deleteTeacherLaunch,
  getTeacherLaunchesForGroup,
  recordAssessmentScore,
  useDataStore,
} from "@/lib/data-store";
import { cn } from "@/lib/utils";
import type { Group, Student } from "@/types";

const ACCEPTED = ["application/pdf", "image/png", "image/jpeg", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const r = reader.result;
      if (typeof r === "string") resolve(r.slice(r.indexOf(",") + 1));
      else reject(new Error("تعذّر قراءة الملف"));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * البند 5 — كارت «الامتحانات»: اسم الامتحان، المدة بالدقائق، رفع ورقة
 * الأسئلة (PDF/صورة)، زر تشغيل يبدأ عدّاً تنازلياً، ولوحة رصد درجات.
 * يُخزَّن على `teacher_launches` بنوع `online_quiz` (المدة في duration_min).
 */
export function ExamsCard({
  group,
  teacherId,
  sessionId,
  students,
}: {
  group: Group;
  teacherId: string;
  sessionId: string;
  students: Student[];
}) {
  const state = useDataStore();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [title, setTitle] = useState("");
  const [minutes, setMinutes] = useState(30);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ title: string; url: string; mime: string | null } | null>(
    null,
  );
  const [running, setRunning] = useState<{ id: string; endsAt: number } | null>(null);
  const [now, setNow] = useState(Date.now());
  const [gradingId, setGradingId] = useState<string | null>(null);

  const exams = useMemo(
    () => getTeacherLaunchesForGroup(state, group.id).filter((l) => l.launch_type === "online_quiz"),
    [state.teacherLaunches, group.id],
  );

  // عدّاد التشغيل — يعمل فقط أثناء امتحان جارٍ.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);
  const remaining = running ? Math.max(0, Math.round((running.endsAt - now) / 1000)) : 0;

  const upload = async (file: File) => {
    if (file.size > MAX_BYTES) {
      toast.error("حجم الملف يتجاوز 10MB");
      return;
    }
    if (!ACCEPTED.includes(file.type)) {
      toast.error("PDF أو صورة فقط");
      return;
    }
    if (!title.trim()) {
      toast.error("اكتب اسم الامتحان أولاً");
      return;
    }
    setBusy(true);
    try {
      const data = await fileToBase64(file);
      addTeacherLaunch({
        groupId: group.id,
        teacherId,
        launchType: "online_quiz",
        title: title.trim(),
        durationMin: minutes,
        fileData: data,
        fileName: file.name,
        fileMime: file.type,
      });
      setTitle("");
      toast.success("تم حفظ الامتحان");
    } catch {
      toast.error("فشل رفع الملف");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title="الامتحانات" description="اسم الامتحان + المدة + ورقة الأسئلة، ثم التشغيل ورصد الدرجات.">
      <div className="space-y-3">
        <div className="space-y-2 rounded-xl border-2 border-dashed border-border bg-canvas/30 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
              placeholder="اسم الامتحان (مثال: امتحان الباب الثالث)"
              className="min-w-0 flex-1 rounded-xl border-2 border-border bg-background px-3 py-2 text-sm font-bold outline-none focus:border-primary"
            />
            <label className="flex items-center gap-1.5 text-xs font-black text-muted-foreground">
              المدة (دقيقة)
              <input
                type="number"
                min={5}
                max={180}
                value={minutes}
                onChange={(e) => setMinutes(Math.max(5, Number(e.target.value) || 5))}
                className="w-20 rounded-xl border-2 border-border bg-background px-2 py-2 text-sm font-black outline-none focus:border-primary"
              />
            </label>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED.join(",")}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void upload(f);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className="flex items-center gap-2 rounded-xl bg-navy px-4 py-2 text-xs font-black text-navy-foreground hover:opacity-90 disabled:opacity-40"
            >
              <Upload className="size-4" /> {busy ? "جاري الرفع…" : "رفع ورقة الأسئلة"}
            </button>
          </div>
        </div>

        {running ? (
          <div className="flex items-center justify-between rounded-xl border-2 border-warning/40 bg-warning/10 p-3">
            <p className="flex items-center gap-2 text-sm font-black text-warning">
              <Timer className="size-4" /> امتحان جارٍ — المتبقي{" "}
              <span className="font-mono">
                {String(Math.floor(remaining / 60)).padStart(2, "0")}:
                {String(remaining % 60).padStart(2, "0")}
              </span>
            </p>
            <button
              type="button"
              onClick={() => setRunning(null)}
              className="rounded-lg border-2 border-border px-3 py-1 text-[11px] font-black hover:bg-muted"
            >
              إيقاف
            </button>
          </div>
        ) : null}

        <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
          {exams.length === 0 ? (
            <p className="rounded-xl border-2 border-dashed border-border p-6 text-center text-sm font-bold text-muted-foreground">
              لا توجد امتحانات بعد.
            </p>
          ) : (
            exams.map((ex) => (
              <div key={ex.id} className="rounded-xl border-2 border-border bg-background p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="flex items-center gap-2 text-sm font-black text-foreground">
                    <FileText className="size-4 text-primary" />
                    {ex.title}
                    <span className="text-[11px] font-bold text-muted-foreground">
                      · {ex.duration_min ?? 0} دقيقة
                    </span>
                  </p>
                  <div className="flex items-center gap-1.5">
                    {ex.file_data ? (
                      <button
                        type="button"
                        onClick={() =>
                          setPreview({
                            title: ex.title,
                            url: `data:${ex.file_mime ?? "application/pdf"};base64,${ex.file_data}`,
                            mime: ex.file_mime,
                          })
                        }
                        className="rounded-lg border-2 border-primary/40 bg-primary/10 px-2 py-1 text-[11px] font-black text-primary hover:bg-primary/20"
                      >
                        عرض الورقة
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => {
                        setRunning({ id: ex.id, endsAt: Date.now() + (ex.duration_min ?? 30) * 60000 });
                        setNow(Date.now());
                        toast.success(`بدأ امتحان "${ex.title}"`);
                      }}
                      className="flex items-center gap-1 rounded-lg bg-navy px-2.5 py-1 text-[11px] font-black text-navy-foreground hover:opacity-90"
                    >
                      <Play className="size-3.5" /> تشغيل
                    </button>
                    <button
                      type="button"
                      onClick={() => setGradingId(gradingId === ex.id ? null : ex.id)}
                      className="rounded-lg border-2 border-border px-2.5 py-1 text-[11px] font-black hover:bg-muted"
                    >
                      لوحة الدرجات
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`حذف "${ex.title}"؟`)) {
                          deleteTeacherLaunch(ex.id);
                          toast.success("تم الحذف");
                        }
                      }}
                      className="rounded-lg border-2 border-destructive/30 p-1.5 text-destructive hover:bg-destructive/10"
                      aria-label="حذف"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>

                {gradingId === ex.id ? (
                  <ExamGrades
                    students={students}
                    teacherId={teacherId}
                    sessionId={sessionId}
                    examTitle={ex.title}
                  />
                ) : null}
              </div>
            ))
          )}
        </div>
      </div>

      {preview ? (
        <FilePreviewModal
          title={preview.title}
          url={preview.url}
          fileName={null}
          mime={preview.mime}
          onClose={() => setPreview(null)}
        />
      ) : null}
    </Panel>
  );
}

function ExamGrades({
  students,
  teacherId,
  sessionId,
  examTitle,
}: {
  students: Student[];
  teacherId: string;
  sessionId: string;
  examTitle: string;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState(0);
  return (
    <div className="mt-3 max-h-64 space-y-1.5 overflow-y-auto rounded-xl border-2 border-border p-2">
      {students.map((s) => (
        <div key={s.id} className="rounded-lg border-2 border-border p-2">
          <button
            type="button"
            onClick={() => {
              setOpenId(openId === s.id ? null : s.id);
              setDraft(0);
            }}
            className={cn("w-full text-right text-xs font-black text-foreground")}
          >
            {s.full_name}
          </button>
          {openId === s.id ? (
            <div className="mt-2 space-y-2">
              <StudentScoreKeyboard value={draft} onChange={setDraft} min={0} max={10} />
              <button
                type="button"
                onClick={() => {
                  recordAssessmentScore({
                    studentId: s.id,
                    teacherId,
                    category: "other",
                    source: "manual",
                    value: draft,
                    maxValue: 10,
                    sessionId,
                    lessonId: null,
                  });
                  setOpenId(null);
                  toast.success(`تم رصد درجة ${examTitle} للطالب ${s.full_name}`);
                }}
                className="w-full rounded-lg bg-navy py-1.5 text-[11px] font-black text-navy-foreground"
              >
                حفظ
              </button>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
