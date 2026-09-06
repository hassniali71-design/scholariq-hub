import { FileUp, Trash2, Upload } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Panel } from "@/components/dashboard/StatCard";
import { FilePreviewModal } from "@/components/teacher/FilePreviewModal";
import {
  addTeacherLaunch,
  deleteTeacherLaunch,
  getTeacherLaunchesForGroup,
  useDataStore,
} from "@/lib/data-store";
import { cn } from "@/lib/utils";
import type { Group } from "@/types";

const ACCEPTED_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
];
const ACCEPTED_LABEL = "PDF / PNG / JPG / WEBP / GIF";
const MAX_BYTES = 10 * 1024 * 1024;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        const comma = result.indexOf(",");
        resolve(comma >= 0 ? result.slice(comma + 1) : result);
      } else {
        reject(new Error("لم نتمكن من قراءة الملف"));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function base64ToDataUrl(data: string, mime: string | null): string {
  if (!data) return "";
  if (data.startsWith("data:")) return data;
  return `data:${mime ?? "application/octet-stream"};base64,${data}`;
}

/**
 * Migration 0023/0024 / خطة C (C7/C8): رفع مراجعات/قراءة — PDF/صورة/Document
 * → `teacher_launches.launch_type='reading_assignment'` مع تخزين base64
 * في `file_data`. عرض المرفوعات السابقة مع رابط تحميل/معاينة.
 */
export function ReviewUploadPanel({
  group,
  teacherId,
}: {
  group: Group;
  teacherId: string;
}) {
  const state = useDataStore();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [title, setTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  /** البند 5: الملف يفتح في نافذة معاينة بدل التحميل المباشر. */
  const [preview, setPreview] = useState<{
    title: string;
    url: string;
    fileName: string | null;
    mime: string | null;
  } | null>(null);

  const reviews = useMemo(
    () =>
      getTeacherLaunchesForGroup(state, group.id).filter(
        (l) => l.launch_type === "reading_assignment",
      ),
    [state.teacherLaunches, group.id],
  );

  const handleFile = async (file: File) => {
    if (file.size > MAX_BYTES) {
      toast.error("حجم الملف يتجاوز 10MB");
      return;
    }
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error(`نوع الملف غير مدعوم — ${ACCEPTED_LABEL}`);
      return;
    }
    const name = title.trim() || file.name.replace(/\.[^.]+$/, "");
    setUploading(true);
    try {
      const data = await fileToBase64(file);
      addTeacherLaunch({
        groupId: group.id,
        teacherId,
        launchType: "reading_assignment",
        title: name,
        fileData: data,
        fileName: file.name,
        fileMime: file.type,
      });
      setTitle("");
      toast.success(`تم رفع "${name}" بنجاح`);
    } catch (err) {
      console.error(err);
      toast.error("فشل رفع الملف");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <Panel
      title="المراجعات والقراءة"
      description="PDF / صورة / مستند — للطلاب في صفحة المادة"
    >
      <div className="space-y-3">
        <div className="rounded-xl border-2 border-dashed border-border bg-canvas/30 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
              placeholder="اسم المراجعة (مثال: مراجعة ليلة الإمتحان)"
              className="min-w-0 flex-1 rounded-xl border-2 border-border bg-background px-3 py-2 text-sm font-bold outline-none focus:border-primary"
            />
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_TYPES.join(",")}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 rounded-xl bg-navy px-4 py-2 text-xs font-black text-navy-foreground hover:opacity-90 disabled:opacity-40"
            >
              <Upload className="size-4" /> {uploading ? "جاري الرفع…" : "رفع ملف"}
            </button>
          </div>
          <p className="mt-2 text-[11px] font-bold text-muted-foreground">
            الأنواع المدعومة: {ACCEPTED_LABEL} · حد أقصى 10MB
          </p>
        </div>

        <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
          {reviews.length === 0 ? (
            <p className="rounded-xl border-2 border-dashed border-border p-6 text-center text-sm font-bold text-muted-foreground">
              لا توجد مراجعات بعد. ارفع أول ملف لتظهر للطلاب في صفحة المادة.
            </p>
          ) : (
            reviews.map((r) => {
              const url = r.file_data ? base64ToDataUrl(r.file_data, r.file_mime) : "";
              const isImage = (r.file_mime ?? "").startsWith("image/");
              return (
                <div
                  key={r.id}
                  className="rounded-xl border-2 border-border bg-background p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="flex size-7 items-center justify-center rounded-lg bg-info/10 text-info">
                          <FileUp className="size-3.5" />
                        </span>
                        <p className="truncate text-sm font-black text-foreground">
                          {r.title}
                        </p>
                      </div>
                      <p className="mt-1 text-[11px] font-bold text-muted-foreground">
                        {r.file_name ?? "ملف بدون اسم"} ·{" "}
                        {new Date(r.created_at).toLocaleString("ar-EG", {
                          numberingSystem: "latn",
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {url ? (
                        <button
                          type="button"
                          onClick={() =>
                            setPreview({
                              title: r.title,
                              url,
                              fileName: r.file_name,
                              mime: r.file_mime,
                            })
                          }
                          className={cn(
                            "rounded-lg border-2 border-primary/40 bg-primary/10 px-2 py-1 text-[11px] font-black text-primary hover:bg-primary/20",
                          )}
                        >
                          {isImage ? "معاينة الصورة" : "فتح ومعاينة"}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`حذف "${r.title}"؟`)) {
                            deleteTeacherLaunch(r.id);
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
                </div>
              );
            })
          )}
        </div>
      </div>

      {preview ? (
        <FilePreviewModal
          title={preview.title}
          url={preview.url}
          fileName={preview.fileName}
          mime={preview.mime}
          onClose={() => setPreview(null)}
        />
      ) : null}
    </Panel>
  );
}
