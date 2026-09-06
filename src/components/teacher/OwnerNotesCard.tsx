import { CheckCheck, Send, StickyNote } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Panel } from "@/components/dashboard/StatCard";
import { markNotificationRead, pushNotification, useDataStore } from "@/lib/data-store";
import { cn } from "@/lib/utils";

export const OWNER_NOTE_KIND = "owner_note";

const RECIPIENTS = [
  { key: "teacher", label: "المدرس" },
  { key: "staff", label: "الموظف" },
  { key: "all", label: "الجميع" },
] as const;

type RecipientKey = (typeof RECIPIENTS)[number]["key"];

/**
 * البند 1 — «ملاحظات المالك».
 * - المالك (canCompose) يختار المستلم ويكتب نصاً حراً ويرسل.
 * - المستلم يرى الملاحظة ويضغط «قراءة» → يُثبَّت وقت المشاهدة
 *   ويصل إشعار للمالك بأن الملاحظة قُرئت.
 * التخزين على جدول `notifications` الموجود (kind = owner_note:<recipient>).
 */
export function OwnerNotesCard({
  canCompose = false,
  audience,
}: {
  canCompose?: boolean;
  /** الدور الحالي — لفلترة الملاحظات الموجَّهة له. */
  audience: RecipientKey;
}) {
  const state = useDataStore();
  const [recipient, setRecipient] = useState<RecipientKey>("teacher");
  const [text, setText] = useState("");

  const notes = useMemo(
    () =>
      state.notifications.filter((n) => {
        if (!n.kind.startsWith(OWNER_NOTE_KIND)) return false;
        if (n.kind.startsWith(`${OWNER_NOTE_KIND}_read`)) return canCompose;
        const target = n.kind.split(":")[1] ?? "all";
        return canCompose || target === "all" || target === audience;
      }),
    [state.notifications, audience, canCompose],
  );

  return (
    <Panel
      title="ملاحظات المالك"
      description="ملاحظة نصية حرة من إدارة المركز — الضغط على «قراءة» يثبّت المشاهدة ويُبلغ المالك."
    >
      {canCompose ? (
        <div className="mb-3 space-y-2 rounded-xl border-2 border-dashed border-border bg-canvas/30 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-black text-muted-foreground">المستلم:</span>
            {RECIPIENTS.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => setRecipient(r.key)}
                className={cn(
                  "rounded-lg border-2 px-3 py-1 text-xs font-black transition-colors",
                  recipient === r.key
                    ? "border-navy bg-navy text-navy-foreground"
                    : "border-border hover:border-primary",
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder="اكتب الملاحظة هنا…"
            className="w-full rounded-xl border-2 border-border bg-background p-3 text-sm font-bold outline-none focus:border-primary"
          />
          <button
            type="button"
            disabled={!text.trim()}
            onClick={() => {
              pushNotification(
                `${OWNER_NOTE_KIND}:${recipient}`,
                "info",
                `ملاحظة من المالك — إلى ${RECIPIENTS.find((r) => r.key === recipient)!.label}`,
                text.trim(),
              );
              setText("");
              toast.success("تم إرسال الملاحظة");
            }}
            className="flex items-center gap-2 rounded-xl bg-navy px-4 py-2 text-xs font-black text-navy-foreground disabled:opacity-40"
          >
            <Send className="size-4" /> إرسال الملاحظة
          </button>
        </div>
      ) : null}

      <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
        {notes.length === 0 ? (
          <p className="rounded-xl border-2 border-dashed border-border p-6 text-center text-sm font-bold text-muted-foreground">
            لا توجد ملاحظات حالياً.
          </p>
        ) : (
          notes.map((n) => (
            <div
              key={n.id}
              className={cn(
                "rounded-xl border-2 p-3",
                n.read_at ? "border-border bg-background" : "border-warning/40 bg-warning/5",
              )}
            >
              <p className="flex items-center gap-2 text-sm font-black text-foreground">
                <StickyNote className="size-4 text-primary" />
                {n.title}
              </p>
              {n.body ? (
                <p className="mt-1 whitespace-pre-wrap text-xs font-bold text-muted-foreground">
                  {n.body}
                </p>
              ) : null}
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-muted-foreground">
                  {new Date(n.created_at).toLocaleString("ar-EG")}
                </span>
                {n.read_at ? (
                  <span className="flex items-center gap-1 text-[11px] font-black text-success">
                    <CheckCheck className="size-3.5" /> تمت القراءة
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      markNotificationRead(n.id);
                      pushNotification(
                        `${OWNER_NOTE_KIND}_read`,
                        "success",
                        "تمت قراءة ملاحظتك",
                        n.body ?? n.title,
                      );
                      toast.success("تم تثبيت المشاهدة وإبلاغ المالك");
                    }}
                    className="rounded-lg bg-navy px-3 py-1 text-[11px] font-black text-navy-foreground hover:opacity-90"
                  >
                    قراءة
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </Panel>
  );
}
