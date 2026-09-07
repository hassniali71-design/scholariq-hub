import { Quote, Radio, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Panel } from "@/components/dashboard/StatCard";
import {
  addSubjectQuote,
  deleteSubjectQuote,
  launchSubjectQuote,
  useDataStore,
} from "@/lib/data-store";
import { cn } from "@/lib/utils";

/**
 * إدارة عبارات المواد (Migration 0033) — المالك يضيف عبارات لكل مادة ويطلق
 * واحدة منها لتظهر في "غرفة المادة" عند المدرس بدل الاقتباس الثابت في
 * daily-quotes.ts. بلا إطلاق، يبقى السلوك القديم كما هو تماماً.
 */
export function SubjectQuotesCard() {
  const state = useDataStore();
  const { subjects, subjectQuotes } = state;
  const [subjectId, setSubjectId] = useState<string>(subjects[0]?.id ?? "");
  const [text, setText] = useState("");

  const quotesForSubject = subjectQuotes.filter((q) => q.subject_id === subjectId);

  return (
    <Panel
      title="عبارات المواد"
      description="أضف عبارات تحفيزية لكل مادة وأطلق واحدة لتظهر للمدرس بخط أكبر في غرفة المادة."
    >
      <div className="space-y-3 rounded-xl border-2 border-dashed border-border bg-canvas/30 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-black text-muted-foreground">المادة:</span>
          {subjects.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSubjectId(s.id)}
              className={cn(
                "rounded-lg border-2 px-3 py-1 text-xs font-black transition-colors",
                subjectId === s.id
                  ? "border-navy bg-navy text-navy-foreground"
                  : "border-border hover:border-primary",
              )}
            >
              {s.name}
            </button>
          ))}
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          placeholder="اكتب عبارة جديدة لهذه المادة…"
          className="w-full rounded-xl border-2 border-border bg-background p-3 text-sm font-bold outline-none focus:border-primary"
        />
        <button
          type="button"
          disabled={!text.trim() || !subjectId}
          onClick={() => {
            addSubjectQuote(subjectId, text);
            setText("");
            toast.success("تمت إضافة العبارة");
          }}
          className="flex items-center gap-2 rounded-xl bg-navy px-4 py-2 text-xs font-black text-navy-foreground disabled:opacity-40"
        >
          <Quote className="size-4" /> إضافة العبارة
        </button>
      </div>

      <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
        {quotesForSubject.length === 0 ? (
          <p className="rounded-xl border-2 border-dashed border-border p-6 text-center text-sm font-bold text-muted-foreground">
            لا توجد عبارات مضافة لهذه المادة بعد — سيظهر اقتباس المادة الثابت للمدرس بدلاً منها.
          </p>
        ) : (
          quotesForSubject.map((q) => (
            <div
              key={q.id}
              className={cn(
                "flex items-start justify-between gap-3 rounded-xl border-2 p-3",
                q.is_active ? "border-success/50 bg-success/5" : "border-border bg-background",
              )}
            >
              <p className="text-sm font-bold text-foreground">{q.text}</p>
              <div className="flex shrink-0 items-center gap-2">
                {q.is_active ? (
                  <span className="flex items-center gap-1 text-[11px] font-black text-success">
                    <Radio className="size-3.5" /> مُطلَقة الآن
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      launchSubjectQuote(q.id, subjectId);
                      toast.success("تم إطلاق العبارة للمدرس");
                    }}
                    className="rounded-lg bg-navy px-3 py-1 text-[11px] font-black text-navy-foreground hover:opacity-90"
                  >
                    إطلاق
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => deleteSubjectQuote(q.id)}
                  className="rounded-lg border-2 border-destructive/40 p-1.5 text-destructive hover:bg-destructive/10"
                  aria-label="حذف العبارة"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </Panel>
  );
}
