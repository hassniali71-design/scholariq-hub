import { Loader2, Lock, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { verifyOwnerPassword } from "@/lib/auth";

interface OwnerPasswordConfirmModalProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}

/**
 * §0.3 — Modal تأكيد بكلمة سر المالك لكل عملية حساسة (حذف جذري، حذف الكل).
 * لا يمكن تأكيد أي شيء قبل التحقق الفعلي من كلمة السر على الخادم.
 */
export function OwnerPasswordConfirmModal({
  open,
  title,
  description,
  confirmLabel,
  destructive = false,
  onClose,
  onConfirm,
}: OwnerPasswordConfirmModalProps) {
  const [password, setPassword] = useState("");
  const [verifying, setVerifying] = useState(false);

  if (!open) return null;

  async function handleConfirm() {
    if (!password.trim()) {
      toast.error("أدخل كلمة السر");
      return;
    }
    setVerifying(true);
    try {
      const result = await verifyOwnerPassword(password);
      if (!result.ok) {
        toast.error(result.error ?? "كلمة السر غير صحيحة");
        return;
      }
      await onConfirm();
      setPassword("");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "فشل التحقق");
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="card-crisp w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className={`flex size-10 items-center justify-center rounded-xl ${
                destructive
                  ? "bg-destructive/10 text-destructive"
                  : "bg-primary/10 text-primary"
              }`}
            >
              <Lock className="size-5" />
            </span>
            <div>
              <p className="text-lg font-black text-foreground">{title}</p>
              <p className="mt-0.5 text-sm font-bold text-muted-foreground">{description}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
            aria-label="إغلاق"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-5">
          <label className="mb-1.5 block text-sm font-black text-muted-foreground">
            أعد إدخال كلمة سر المالك للتأكيد
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleConfirm();
            }}
            placeholder="••••••••"
            className="w-full rounded-xl border-2 border-border bg-background px-4 py-3 text-base font-extrabold text-foreground outline-none focus:border-primary"
          />
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border-2 border-border px-4 py-2 text-sm font-black text-foreground hover:border-primary"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={verifying}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-black transition-opacity disabled:opacity-50 ${
              destructive
                ? "bg-destructive text-destructive-foreground hover:opacity-90"
                : "bg-navy text-navy-foreground hover:opacity-90"
            }`}
          >
            {verifying ? <Loader2 className="size-4 animate-spin" /> : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
