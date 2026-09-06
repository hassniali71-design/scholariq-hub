import { Download, X } from "lucide-react";

/**
 * البند 5 — نافذة معاينة الملف المرفوع (PDF أو صورة) بدل التحميل المباشر.
 */
export function FilePreviewModal({
  title,
  url,
  fileName,
  mime,
  onClose,
}: {
  title: string;
  url: string;
  fileName: string | null;
  mime: string | null;
  onClose: () => void;
}) {
  const isImage = (mime ?? "").startsWith("image/");
  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="flex h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border-2 border-border bg-background"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b-2 border-border p-4">
          <p className="min-w-0 flex-1 text-base font-black text-foreground">{title}</p>
          <a
            href={url}
            download={fileName ?? title}
            className="flex items-center gap-1.5 rounded-xl border-2 border-border px-3 py-1.5 text-xs font-black text-foreground hover:border-primary"
          >
            <Download className="size-4" /> تحميل
          </a>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-navy p-2 text-navy-foreground hover:opacity-90"
            aria-label="إغلاق"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="flex-1 overflow-auto bg-canvas p-3">
          {isImage ? (
            <img src={url} alt={title} className="mx-auto max-w-full rounded-xl" />
          ) : (
            <iframe src={url} title={title} className="h-full w-full rounded-xl bg-white" />
          )}
        </div>
      </div>
    </div>
  );
}
