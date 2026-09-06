import { ScrollText } from "lucide-react";

import { Panel } from "@/components/dashboard/StatCard";
import { formatDateTime } from "@/lib/format";
import { getPlatformNotesForSubject, useDataStore } from "@/lib/data-store";
import { cn } from "@/lib/utils";

/**
 * بطاقة "رسالة من إدارة المنصة" (المقاولة).
 * تظهر لمدرسو مادة معيّنة عبر كل المراكز.
 * البيانات من `state.platformTeacherNotes` (لا center_id filter).
 */
export function PlatformTeacherNoteCard({ subjectId }: { subjectId: string | null | undefined }) {
  const state = useDataStore();
  if (!subjectId) return null;
  const notes = getPlatformNotesForSubject(state, subjectId);
  if (notes.length === 0) return null;

  return (
    <Panel
      title="رسالة من إدارة المنصة"
      description="مقاولة من مدير المنصة لمدرسو هذه المادة — عبر كل المراكز"
    >
      <div className="space-y-3">
        {notes.map((n) => (
          <div
            key={n.id}
            className={cn(
              "rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 p-4",
              "shadow-sm",
            )}
          >
            <div className="mb-2 flex items-center gap-2 text-xs font-black text-primary">
              <ScrollText className="size-4" />
              <span>مقاولة من إدارة المنصة</span>
            </div>
            <p className="whitespace-pre-wrap text-sm font-bold leading-7 text-foreground">
              {n.body}
            </p>
            <p className="mt-3 text-xs font-extrabold text-muted-foreground">
              — كتبها <span className="text-foreground">{n.author_name}</span>
              <span className="mx-1">·</span>
              {formatDateTime(n.created_at)}
            </p>
          </div>
        ))}
      </div>
    </Panel>
  );
}
