import { MessageSquareText, Send, X } from "lucide-react";
import { useMemo, useState } from "react";

import { Panel } from "@/components/dashboard/StatCard";
import { pushNotification, useDataStore } from "@/lib/data-store";
import { buildDmKind, getDmThread, parseDmKind } from "@/lib/dm-messages";
import { formatDateTime } from "@/lib/format";

interface Conversation {
  studentId: string;
  studentName: string;
  lastBody: string;
  lastAt: string;
}

/**
 * رسائل حقيقية بين المدرس وطلابه — نفس آلية student.teachers.tsx's
 * QuickMessageModal (notifications بـkind يحدد الأطراف، بلا جدول محادثات
 * جديد). المدرس يشوف كل طالب راسله ويقدر يرد عليه.
 */
export function StudentMessagesCard({ teacherId }: { teacherId: string }) {
  const state = useDataStore();
  const [openStudentId, setOpenStudentId] = useState<string | null>(null);

  const conversations = useMemo(() => {
    const map = new Map<string, Conversation>();
    for (const n of state.notifications) {
      const parsed = parseDmKind(n.kind);
      if (!parsed || parsed.teacherId !== teacherId) continue;
      const existing = map.get(parsed.studentId);
      if (existing && existing.lastAt >= n.created_at) continue;
      const student = state.students.find((s) => s.id === parsed.studentId);
      map.set(parsed.studentId, {
        studentId: parsed.studentId,
        studentName: student?.full_name ?? n.title,
        lastBody: n.body ?? "",
        lastAt: n.created_at,
      });
    }
    return [...map.values()].sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1));
  }, [state.notifications, state.students, teacherId]);

  const openConversation = conversations.find((c) => c.studentId === openStudentId) ?? null;

  return (
    <Panel title="رسائل الطلاب" description="محادثات حقيقية بينك وبين طلابك">
      {conversations.length === 0 ? (
        <p className="rounded-xl border-2 border-dashed border-border p-6 text-center text-sm font-bold text-muted-foreground">
          لا توجد رسائل من طلابك بعد.
        </p>
      ) : (
        <div className="space-y-2">
          {conversations.map((c) => (
            <button
              key={c.studentId}
              type="button"
              onClick={() => setOpenStudentId(c.studentId)}
              className="flex w-full items-center justify-between gap-3 rounded-xl border-2 border-border p-3 text-right hover:border-primary"
            >
              <div className="flex min-w-0 items-center gap-2">
                <MessageSquareText className="size-4 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="text-sm font-black text-foreground">{c.studentName}</p>
                  <p className="truncate text-xs font-bold text-muted-foreground">{c.lastBody}</p>
                </div>
              </div>
              <span className="shrink-0 text-[11px] font-bold text-muted-foreground">
                {formatDateTime(c.lastAt)}
              </span>
            </button>
          ))}
        </div>
      )}

      {openConversation ? (
        <ThreadModal
          teacherId={teacherId}
          studentId={openConversation.studentId}
          studentName={openConversation.studentName}
          onClose={() => setOpenStudentId(null)}
        />
      ) : null}
    </Panel>
  );
}

function ThreadModal({
  teacherId,
  studentId,
  studentName,
  onClose,
}: {
  teacherId: string;
  studentId: string;
  studentName: string;
  onClose: () => void;
}) {
  const state = useDataStore();
  const [text, setText] = useState("");
  const thread = getDmThread(state.notifications, studentId, teacherId);

  function send() {
    const trimmed = text.trim();
    if (!trimmed) return;
    pushNotification(buildDmKind(studentId, teacherId, "teacher"), "info", studentName, trimmed);
    setText("");
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="flex h-[28rem] w-full max-w-md flex-col rounded-2xl border-2 border-border bg-background p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-black text-foreground">محادثة مع {studentName}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="flex-1 space-y-2 overflow-y-auto pr-1">
          {thread.map((n) => (
            <div
              key={n.id}
              className={
                n.kind.endsWith(":teacher")
                  ? "mr-auto max-w-[85%] rounded-2xl rounded-bl-sm bg-primary/10 px-3 py-2 text-sm font-bold text-foreground"
                  : "ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-muted px-3 py-2 text-sm font-bold text-foreground"
              }
            >
              {n.body}
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            maxLength={300}
            placeholder={`اكتب ردك لـ${studentName}…`}
            className="h-11 flex-1 resize-none rounded-xl border-2 border-border bg-background p-2.5 text-sm font-bold outline-none focus:border-primary"
          />
          <button
            type="button"
            disabled={!text.trim()}
            onClick={send}
            className="flex h-11 shrink-0 items-center justify-center rounded-xl bg-navy px-4 text-sm font-black text-navy-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Send className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
