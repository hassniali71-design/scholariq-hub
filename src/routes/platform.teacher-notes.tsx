import { createFileRoute, redirect } from "@tanstack/react-router";
import { Send, ScrollText, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Panel } from "@/components/dashboard/StatCard";
import { PlatformHeader } from "@/components/platform/PlatformHeader";
import { getSession } from "@/lib/auth";
import {
  createPlatformTeacherNote,
  deletePlatformTeacherNote,
  useDataStore,
} from "@/lib/data-store";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/platform/teacher-notes")({
  beforeLoad: () => {
    if (typeof window !== "undefined") {
      const session = getSession();
      if (!session?.isPlatformAdmin) {
        throw redirect({ to: "/" });
      }
    }
  },
  head: () => ({
    meta: [
      { title: "مقاولات المدرسين — إدارة المنصة" },
      {
        name: "description",
        content: "رسائل مدير المنصة لمدرسو كل المراكز حسب المادة.",
      },
    ],
  }),
  component: PlatformTeacherNotesPage,
});

function PlatformTeacherNotesPage() {
  const state = useDataStore();
  const session = typeof window !== "undefined" ? getSession() : null;
  const subjects = state.subjects;
  const [subjectId, setSubjectId] = useState<string>(subjects[0]?.id ?? "");
  const [body, setBody] = useState<string>("");

  const notes = useMemo(
    () =>
      subjectId
        ? state.platformTeacherNotes
            .filter((n) => n.subject_id === subjectId)
            .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
        : [],
    [state.platformTeacherNotes, subjectId],
  );

  const handleSave = () => {
    if (!subjectId) {
      toast.error("اختر المادة أولاً");
      return;
    }
    const trimmed = body.trim();
    if (!trimmed) {
      toast.error("اكتب نص المقاولة");
      return;
    }
    if (!session) {
      toast.error("انتهت الجلسة — سجّل الدخول مجدداً");
      return;
    }
    createPlatformTeacherNote(subjectId, trimmed, session.identifier, session.full_name);
    setBody("");
    toast.success("تم تسجيل المقاولة");
  };

  return (
    <div dir="rtl" className="min-h-screen bg-canvas">
      <PlatformHeader
        title="مقاولات المدرسين"
        subtitle="رسائل لمدرسو كل المراكز"
        active="clients"
      />

      <main className="mx-auto w-full max-w-5xl space-y-6 px-5 py-8">
        <header>
          <h1 className="flex items-center gap-3 text-3xl font-black text-foreground">
            <ScrollText className="size-7 text-primary" />
            مقاولات المدرسين
          </h1>
          <p className="mt-2 text-sm font-bold text-muted-foreground">
            رسالة من إدارة المنصة لمدرسو مادة معيّنة — تظهر تلقائياً لكل مدرس في هذه المادة عبر كل المراكز.
            يُسجَّل اسمك تلقائياً كتوقيع أسفل كل مقاولة.
          </p>
        </header>

        <Panel title="مقاولة جديدة" description="اختر المادة واكتب النص">
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-xs font-black text-muted-foreground">
                المادة
              </label>
              <div className="flex flex-wrap gap-2">
                {subjects.length === 0 ? (
                  <p className="rounded-xl border-2 border-dashed border-border p-4 text-sm font-bold text-muted-foreground">
                    لا توجد مواد مضافة — أضف مواد من إعدادات أحد المراكز أولاً.
                  </p>
                ) : (
                  subjects.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSubjectId(s.id)}
                      className={cn(
                        "rounded-xl border-2 px-4 py-2 text-sm font-black transition-colors",
                        subjectId === s.id
                          ? "border-navy bg-navy text-navy-foreground"
                          : "border-border bg-background text-foreground hover:border-primary",
                      )}
                    >
                      {s.name}
                    </button>
                  ))
                )}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-black text-muted-foreground">
                نص المقاولة
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={4}
                placeholder="مثال: الالتزام بالخطة الأسبوعية، رفع نتائج التقييمات قبل نهاية اليوم..."
                className="w-full rounded-xl border-2 border-border bg-background p-3 text-sm font-bold text-foreground outline-none focus:border-primary"
              />
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-muted-foreground">
                التوقيع: <span className="font-black text-foreground">{session?.full_name ?? "—"}</span>
              </p>
              <button
                type="button"
                onClick={handleSave}
                className="flex items-center gap-2 rounded-xl bg-navy px-5 py-3 text-sm font-black text-navy-foreground transition-opacity hover:opacity-90"
              >
                <Send className="size-4" /> حفظ المقاولة
              </button>
            </div>
          </div>
        </Panel>

        <Panel
          title="المقاولات السابقة"
          description={
            subjectId
              ? `مادة: ${subjects.find((s) => s.id === subjectId)?.name ?? ""}`
              : "اختر مادة لعرض مقاولاتها"
          }
        >
          {notes.length === 0 ? (
            <p className="rounded-xl border-2 border-dashed border-border p-6 text-center text-sm font-bold text-muted-foreground">
              لا توجد مقاولات لهذه المادة بعد.
            </p>
          ) : (
            <div className="space-y-3">
              {notes.map((n) => (
                <div
                  key={n.id}
                  className="rounded-2xl border-2 border-border bg-background p-4"
                >
                  <p className="whitespace-pre-wrap text-sm font-bold leading-7 text-foreground">
                    {n.body}
                  </p>
                  <div className="mt-3 flex items-center justify-between">
                    <p className="text-xs font-extrabold text-muted-foreground">
                      — <span className="text-foreground">{n.author_name}</span>
                      <span className="mx-1">·</span>
                      {formatDateTime(n.created_at)}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm("حذف هذه المقاولة؟")) {
                          deletePlatformTeacherNote(n.id);
                          toast.success("تم الحذف");
                        }
                      }}
                      className="flex items-center gap-1 rounded-lg border-2 border-destructive/30 px-2 py-1 text-[11px] font-black text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="size-3" /> حذف
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </main>
    </div>
  );
}
