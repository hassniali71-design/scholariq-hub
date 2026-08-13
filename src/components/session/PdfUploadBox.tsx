import { FileText, Loader2, RefreshCcw, Upload } from "lucide-react";
import { useRef } from "react";

interface PdfUploadBoxProps {
  busy: boolean;
  failed: { error: string | null } | null;
  onFile: (file: File) => void;
  onRetry: () => void;
  /** Once a lesson is already showing, a slim trigger instead of the full drop-zone — keeps the slide deck above the fold. */
  compact?: boolean;
}

/** Upload box for §7-د's PDF → AI pipeline. Drag-drop or click-to-pick, PDF only. */
export function PdfUploadBox({ busy, failed, onFile, onRetry, compact = false }: PdfUploadBoxProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  if (busy) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-border p-10 text-center">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="font-black text-foreground">جارٍ معالجة الدرس بالذكاء الاصطناعي…</p>
      </div>
    );
  }

  if (failed) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-destructive/40 bg-destructive/5 p-10 text-center">
        <p className="font-black text-destructive">فشلت معالجة الملف</p>
        {failed.error ? (
          <p className="text-xs font-bold text-muted-foreground">{failed.error}</p>
        ) : null}
        <button
          type="button"
          onClick={onRetry}
          className="flex items-center gap-2 rounded-xl bg-navy px-4 py-2.5 text-sm font-black text-navy-foreground hover:opacity-90"
        >
          <RefreshCcw className="size-4" /> إعادة المحاولة
        </button>
      </div>
    );
  }

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept="application/pdf"
      className="hidden"
      onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) onFile(file);
        e.target.value = "";
      }}
    />
  );

  if (compact) {
    return (
      <div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex items-center gap-2 rounded-xl border-2 border-dashed border-border px-4 py-2.5 text-sm font-black text-muted-foreground transition-colors hover:border-primary hover:text-primary"
        >
          <Upload className="size-4" /> رفع درس آخر (PDF)
        </button>
        {fileInput}
      </div>
    );
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) onFile(file);
      }}
      role="button"
      tabIndex={0}
      className="flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-border p-10 text-center transition-colors hover:border-primary"
    >
      <Upload className="size-8 text-primary" />
      <p className="font-black text-foreground">اسحب ملف PDF هنا أو اضغط لاختيار ملف الدرس</p>
      <p className="flex items-center gap-1 text-xs font-bold text-muted-foreground">
        <FileText className="size-3.5" /> PDF فقط
      </p>
      {fileInput}
    </div>
  );
}
