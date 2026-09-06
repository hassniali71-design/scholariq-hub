import { Search, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { Panel } from "@/components/dashboard/StatCard";
import { OwnerPasswordConfirmModal } from "@/components/owner/OwnerPasswordConfirmModal";
import { deleteActivityEntry, deleteAllActivityLog } from "@/lib/data-store";
import { formatDateTime, formatNumber } from "@/lib/format";
import type { ActivityEntry } from "@/types";

/**
 * §0.3 — كرت سجل النشاط scrollable + بحث + حذف فرد/كل مع تأكيد.
 */
export function ActivityLogPanel({ entries }: { entries: ActivityEntry[] }) {
  const [query, setQuery] = useState("");
  const [confirmingClearAll, setConfirmingClearAll] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((a) => {
      const haystack = `${a.title} ${a.detail ?? ""} ${a.actor ?? ""} ${a.kind}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [entries, query]);

  return (
    <Panel
      title="سجل النشاط الموحّد"
      description={`${formatNumber(entries.length)} حدث مسجَّل`}
      actions={
        entries.length > 0 ? (
          <button
            type="button"
            onClick={() => setConfirmingClearAll(true)}
            className="flex items-center gap-1.5 rounded-lg border-2 border-destructive/40 px-3 py-1.5 text-xs font-black text-destructive hover:border-destructive"
            aria-label="حذف كل السجل"
          >
            <Trash2 className="size-4" />
            حذف الكل
          </button>
        ) : undefined
      }
    >
      <div className="mb-3 relative">
        <Search className="absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="بحث (مثل: مدرس، دفع، حذف)…"
          className="h-10 w-full rounded-xl border-2 border-border bg-background pr-9 pl-3 text-sm font-bold outline-none focus:border-primary"
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="مسح البحث"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>

      <div className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
        {entries.length === 0 ? (
          <p className="rounded-xl border-2 border-dashed border-border p-6 text-center text-sm font-bold text-muted-foreground">
            السجل فاضي — أي حدث في النظام سيظهر هنا.
          </p>
        ) : filtered.length === 0 ? (
          <p className="rounded-xl border-2 border-dashed border-border p-6 text-center text-sm font-bold text-muted-foreground">
            لا توجد نتائج للبحث "{query}".
          </p>
        ) : (
          filtered.map((e) => <Row key={e.id} entry={e} />)
        )}
      </div>

      <OwnerPasswordConfirmModal
        open={confirmingClearAll}
        title="حذف كل سجل النشاط"
        description="سيتم حذف كل سجلات النشاط نهائياً."
        confirmLabel="نعم، احذف الكل"
        destructive
        onClose={() => setConfirmingClearAll(false)}
        onConfirm={() => {
          deleteAllActivityLog();
          toast.success("تم حذف كل سجلات النشاط");
        }}
      />
    </Panel>
  );
}

function Row({ entry }: { entry: ActivityEntry }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border-2 border-border p-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-black text-foreground">{entry.title}</p>
        <p className="mt-0.5 text-xs font-bold text-muted-foreground">
          {formatDateTime(entry.created_at)}
          {entry.actor ? ` · ${entry.actor}` : ""}
          {entry.detail ? ` · ${entry.detail}` : ""}
        </p>
      </div>
      <button
        type="button"
        onClick={() => {
          deleteActivityEntry(entry.id);
          toast.success("تم حذف العنصر");
        }}
        className="rounded-lg border-2 border-border p-1.5 text-destructive hover:border-destructive"
        aria-label="حذف"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}
