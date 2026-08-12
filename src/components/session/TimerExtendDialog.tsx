import { Plus, Timer } from "lucide-react";
import { useState } from "react";

interface TimerExtendDialogProps {
  onExtend: (seconds: number, reason: string | null) => void;
}

/** §7-ج: "+5 / +10 / مدة مخصصة" — opens inline instead of a modal, no new UI library needed. */
export function TimerExtendDialog({ onExtend }: TimerExtendDialogProps) {
  const [open, setOpen] = useState(false);
  const [customMinutes, setCustomMinutes] = useState(15);
  const [reason, setReason] = useState("");

  const submit = (seconds: number) => {
    onExtend(seconds, reason.trim() || null);
    setOpen(false);
    setReason("");
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-xl border-2 border-border px-5 py-3 text-sm font-black hover:border-primary"
      >
        <Timer className="size-4" /> تمديد الوقت
      </button>
    );
  }

  return (
    <div className="w-full max-w-sm rounded-2xl border-2 border-border p-4">
      <p className="mb-3 text-sm font-black text-foreground">تمديد وقت المرحلة</p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => submit(5 * 60)}
          className="rounded-lg border-2 border-border px-4 py-2 text-sm font-black hover:border-primary"
        >
          +٥ دقائق
        </button>
        <button
          type="button"
          onClick={() => submit(10 * 60)}
          className="rounded-lg border-2 border-border px-4 py-2 text-sm font-black hover:border-primary"
        >
          +١٠ دقائق
        </button>
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            min={1}
            value={customMinutes}
            onChange={(e) => setCustomMinutes(Number(e.target.value))}
            className="h-10 w-16 rounded-lg border-2 border-border bg-background px-2 text-center text-sm font-black outline-none focus:border-primary"
          />
          <button
            type="button"
            onClick={() => submit(Math.max(1, customMinutes) * 60)}
            className="flex items-center gap-1 rounded-lg bg-navy px-3 py-2 text-xs font-black text-navy-foreground hover:opacity-90"
          >
            <Plus className="size-3.5" /> مدة مخصصة
          </button>
        </div>
      </div>
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="السبب (اختياري)"
        className="mt-3 h-10 w-full rounded-lg border-2 border-border bg-background px-3 text-sm font-bold outline-none focus:border-primary"
      />
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="mt-2 text-xs font-bold text-muted-foreground hover:underline"
      >
        إلغاء
      </button>
    </div>
  );
}
