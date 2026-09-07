import { createFileRoute, Navigate } from "@tanstack/react-router";
import { BookMarked, ExternalLink, MessageSquareText, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Panel } from "@/components/dashboard/StatCard";
import { AppShell } from "@/components/layout/AppShell";
import { useCurrentStudent } from "@/hooks/use-current-student";
import {
  getCurriculumProgress,
  getGroupResourcesForGroup,
  getGroupsForStudent,
  useDataStore,
} from "@/lib/data-store";
import { formatDateTime, formatNumber } from "@/lib/format";
import type { Group } from "@/types";

export const Route = createFileRoute("/student/teachers")({
  head: () => ({
    meta: [
      { title: "مدرّسيني ومنهجي — الطالب" },
      {
        name: "description",
        content: "قائمة مدرّسيك الحقيقيين في كل مادة، وروابط ومرفقات المنهج المشتركة من كل مجموعة.",
      },
    ],
  }),
  component: TeachersPage,
});

const RESOURCE_LABEL: Record<string, string> = {
  lesson_url: "رابط شرح",
  pdf: "PDF",
  external_link: "رابط خارجي",
  video: "فيديو",
  other: "مرفق",
};

function TeachersPage() {
  const state = useDataStore();
  const me = useCurrentStudent();
  useEffect(() => {
    if (!me) toast.error("الجلسة منتهية — سجّل الدخول من جديد");
  }, [me]);
  const myGroups = useMemo(() => (me ? getGroupsForStudent(state, me.id) : []), [state, me]);
  const [messageFor, setMessageFor] = useState<Group | null>(null);

  if (!me) return <Navigate to="/login" />;

  return (
    <AppShell
      role="student"
      title="مدرّسيني ومنهجي"
      description="كل مدرّس بتدرَّس له مادة، ومرفقات المنهج اللي شاركها معاك"
    >
      {myGroups.length === 0 ? (
        <Panel title="مدرّسيني" description="لا يوجد بعد">
          <p className="rounded-xl border-2 border-dashed border-border p-6 text-center text-sm font-bold text-muted-foreground">
            لسه مش مسجَّل في أي مجموعة/مادة.
          </p>
        </Panel>
      ) : (
        myGroups.map((g) => {
          const resources = getGroupResourcesForGroup(state, g.id);
          const progress = getCurriculumProgress(state, g.subject_id, g.grade_id);
          const pct =
            progress.lessonCount > 0
              ? Math.round((progress.doneCount / progress.lessonCount) * 100)
              : 0;
          return (
            <Panel
              key={g.id}
              title={g.subject}
              description={`${g.teacher_name} · ${g.weekday} ${g.time} · قاعة ${g.room}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-border bg-muted/40 p-3">
                <div>
                  <p className="text-sm font-black text-foreground">{g.teacher_name}</p>
                  <p className="text-xs font-bold text-muted-foreground">مدرّس {g.subject}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setMessageFor(g)}
                  className="flex items-center gap-1.5 rounded-lg border-2 border-primary/40 px-3 py-1.5 text-xs font-black text-primary hover:border-primary"
                >
                  <MessageSquareText className="size-3.5" /> رسالة سريعة
                </button>
              </div>

              {progress.lessonCount > 0 ? (
                <div className="mt-3 rounded-xl border-2 border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-black text-muted-foreground">تقدّم المنهج</p>
                    <p className="text-xs font-black text-foreground">
                      {formatNumber(progress.doneCount)} / {formatNumber(progress.lessonCount)} درس
                    </p>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {progress.nextLesson ? (
                    <p className="mt-2 text-[11px] font-bold text-muted-foreground">
                      الدرس القادم: {progress.nextLesson.title}
                    </p>
                  ) : (
                    <p className="mt-2 text-[11px] font-bold text-success">
                      أكملتوا كل دروس المنهج!
                    </p>
                  )}
                </div>
              ) : null}

              <div className="mt-3">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-black text-muted-foreground">
                  <BookMarked className="size-3.5" /> منهج ومرفقات المادة
                </p>
                {resources.length === 0 ? (
                  <p className="rounded-xl border-2 border-dashed border-border p-4 text-center text-xs font-bold text-muted-foreground">
                    لسه مفيش مرفقات مشتركة لهذه المادة.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {resources.map((r) => (
                      <a
                        key={r.id}
                        href={r.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="flex items-center justify-between gap-2 rounded-xl border-2 border-border p-3 hover:border-primary"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-foreground">{r.name}</p>
                          <p className="text-[11px] font-bold text-muted-foreground">
                            {RESOURCE_LABEL[r.resource_type] ?? r.resource_type}
                            {r.unit ? ` · ${r.unit}` : ""} · {formatDateTime(r.created_at)}
                          </p>
                        </div>
                        <ExternalLink className="size-4 shrink-0 text-primary" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </Panel>
          );
        })
      )}

      {messageFor ? (
        <QuickMessageModal group={messageFor} onClose={() => setMessageFor(null)} />
      ) : null}
    </AppShell>
  );
}

/**
 * رسالة سريعة تجميلية للمدرس — لا يوجد نظام مراسلة حقيقي بين الطالب والمدرس في
 * المشروع بعد، فهي بلا حفظ حقيقي (نفس روح الشات بوت الخفيف)، مجرد تفاعل بصري.
 */
function QuickMessageModal({ group, onClose }: { group: Group; onClose: () => void }) {
  const [text, setText] = useState("");
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border-2 border-border bg-background p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-black text-foreground">رسالة سريعة لـ{group.teacher_name}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="size-4" />
          </button>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          maxLength={300}
          placeholder={`اكتب رسالتك عن مادة ${group.subject}…`}
          className="w-full rounded-xl border-2 border-border bg-background p-2 text-sm font-bold outline-none focus:border-primary"
        />
        <button
          type="button"
          disabled={!text.trim()}
          onClick={() => {
            toast.success(`تم إرسال رسالتك لـ${group.teacher_name}`);
            onClose();
          }}
          className="mt-3 w-full rounded-xl bg-navy px-4 py-2.5 text-sm font-black text-navy-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          إرسال
        </button>
      </div>
    </div>
  );
}
