import { useMemo, useState } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";

import {
  addStudentToGroup,
  enrollStudentInAdditionalGroup,
  getEligibleStudentsForGroup,
  useDataStore,
} from "@/lib/data-store";
import type { Group } from "@/types";

/**
 * إضافة طالب/طلاب لمجموعة موجودة بالفعل — بدون الحاجة لإنشاء مجموعة جديدة من
 * الصفر لكل طالب ينضم لاحقاً. يستخدم addStudentToGroup الموجودة أصلاً في
 * data-store.ts (كانت بلا أي واجهة تستدعيها).
 *
 * لو الطالب عنده مجموعة أساسية مختلفة بالفعل، الإضافة هنا بتسجّله في المجموعة
 * دي كـ"مادة إضافية" (Migration 0030) من غير ما تنقله من مجموعته الأساسية —
 * الأساس بيتغيّر فقط لو الطالب بلا مجموعة أصلاً.
 */
export function AddStudentToGroupModal({
  group,
  onClose,
}: {
  group: Group | null;
  onClose: () => void;
}) {
  const state = useDataStore();
  const [query, setQuery] = useState("");

  const eligible = useMemo(() => {
    if (!group) return [];
    return getEligibleStudentsForGroup(state, group.grade_id, group.subject_id, group.id).filter(
      (s) => s.group_id !== group.id,
    );
  }, [state, group]);

  const filtered = eligible.filter(
    (s) => !query.trim() || s.full_name.includes(query) || s.code.toLowerCase().includes(query.toLowerCase()),
  );

  if (!group) return null;

  function handleAdd(studentId: string, studentName: string, hasOtherPrimaryGroup: boolean) {
    const result = hasOtherPrimaryGroup
      ? enrollStudentInAdditionalGroup(studentId, group!.id)
      : addStudentToGroup(studentId, group!.id);
    if (result.ok) {
      toast.success(
        hasOtherPrimaryGroup
          ? `تمت إضافة ${studentName} لمجموعة ${group!.name} كمادة إضافية`
          : `تمت إضافة ${studentName} لمجموعة ${group!.name}`,
      );
    } else {
      toast.error(result.reason ?? "تعذّرت الإضافة");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-2xl border-2 border-border bg-background p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-black text-foreground">إضافة طالب لمجموعة "{group.name}"</h3>
            <p className="text-xs font-bold text-muted-foreground">
              {group.enrolled}/{group.capacity} طالب حالياً — {group.subject} · {group.grade}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
            aria-label="إغلاق"
          >
            <X className="size-4" />
          </button>
        </div>

        {group.enrolled >= group.capacity ? (
          <p className="rounded-xl border-2 border-warning/40 bg-warning/10 p-3 text-sm font-bold text-warning">
            المجموعة وصلت للسعة القصوى — زوّد السعة أولاً من تعديل المجموعة قبل إضافة طالب جديد.
          </p>
        ) : null}

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="بحث بالاسم أو الكود…"
          className="mt-3 w-full rounded-xl border-2 border-border bg-background px-3 py-2 text-sm font-bold outline-none focus:border-primary"
        />

        <div className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
          {filtered.length === 0 ? (
            <p className="rounded-xl border-2 border-dashed border-border p-6 text-center text-sm font-bold text-muted-foreground">
              لا يوجد طلاب مؤهلون (نفس الصف والمادة) غير مسجَّلين في هذه المجموعة بالفعل.
            </p>
          ) : (
            filtered.map((s) => {
              const hasOtherPrimaryGroup = !!s.group_id && s.group_id !== group.id;
              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-3 rounded-xl border-2 border-border p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black text-foreground">{s.full_name}</p>
                    <p className="text-xs font-bold text-muted-foreground">
                      {s.code} · {s.group_name}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={group.enrolled >= group.capacity}
                    onClick={() => handleAdd(s.id, s.full_name, hasOtherPrimaryGroup)}
                    className="shrink-0 rounded-lg bg-navy px-3 py-1.5 text-xs font-black text-navy-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {hasOtherPrimaryGroup ? "إضافة كمادة إضافية" : "إضافة"}
                  </button>
                </div>
              );
            })
            ))
          )}
        </div>
      </div>
    </div>
  );
}
