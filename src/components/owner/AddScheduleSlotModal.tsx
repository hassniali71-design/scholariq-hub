import { CalendarClock, Loader2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { getGroupsForGrade, upsertScheduleSlot, useDataStore } from "@/lib/data-store";
import { WEEKDAYS } from "@/lib/owner-metrics";
import { cn } from "@/lib/utils";

interface AddScheduleSlotModalProps {
  open: boolean;
  onClose: () => void;
}

const TIMES_12 = [
  "08:00 AM",
  "09:00 AM",
  "10:00 AM",
  "11:00 AM",
  "12:00 PM",
  "01:00 PM",
  "02:00 PM",
  "03:00 PM",
  "04:00 PM",
  "05:00 PM",
  "06:00 PM",
  "07:00 PM",
  "08:00 PM",
  "09:00 PM",
];

function format12hArabic(t: string): string {
  return t.replace(" AM", " ص").replace(" PM", " م").replace("AM", "ص").replace("PM", "م");
}

/**
 * طلب صريح: مدرس له قاعات ومواعيد مختلفة لنفس المجموعة (مثلاً "الصف الثاني
 * عربي" في قاعتين ومعادين مختلفين تماماً) — دول نفس طلاب المجموعة بالظبط، مش
 * مجموعة جديدة، عشان ميتعدوش مرتين. GroupScheduleModal بيعرض بس المجموعات
 * "المعلَّقة" (لسه ما اتجدولتش خالص)، فمفيش طريقة تضيف معاد إضافي مستقل
 * (يوم/ساعة/قاعة مختلفين) لمجموعة اتجدولت بالفعل — وده كان بيضطر أصحاب
 * السنتر يعملوا مجموعة "مكررة" جديدة بنفس الطلاب بدل ما يضيفوا معاد تاني لنفس
 * المجموعة، وده اللي كان بيسبب اختفاء الطلاب من المجموعة الأصلية (createGroup
 * كانت بتسرق group_id الأساسي بتاعهم). هذا المودال بيضيف صف schedule_slots
 * جديد لنفس المجموعة الموجودة — بدون ما يلمس طلابها أو ينشئ أي مجموعة جديدة.
 */
export function AddScheduleSlotModal({ open, onClose }: AddScheduleSlotModalProps) {
  const state = useDataStore();
  const { grades } = state;

  const [gradeId, setGradeId] = useState<string>("");
  const [groupId, setGroupId] = useState<string>("");
  const [weekday, setWeekday] = useState<string>("");
  const [time, setTime] = useState<string>("");
  const [room, setRoom] = useState("");
  const [saving, setSaving] = useState(false);

  const scheduledGroups = useMemo(() => {
    if (!gradeId) return [];
    return getGroupsForGrade(state, gradeId).filter((g) => g.scheduling_status === "scheduled");
  }, [state, gradeId]);

  const selectedGroup = useMemo(
    () => state.groups.find((g) => g.id === groupId) ?? null,
    [state.groups, groupId],
  );

  function reset() {
    setGradeId("");
    setGroupId("");
    setWeekday("");
    setTime("");
    setRoom("");
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleSave() {
    if (!selectedGroup) {
      toast.error("اختر المجموعة");
      return;
    }
    if (!weekday || !time) {
      toast.error("اختر اليوم والساعة");
      return;
    }
    setSaving(true);
    try {
      upsertScheduleSlot({
        teacherId: selectedGroup.teacher_id,
        teacherName: selectedGroup.teacher_name,
        subjectId: selectedGroup.subject_id,
        subject: selectedGroup.subject,
        grade: selectedGroup.grade,
        weekday,
        time,
        room: room.trim(),
        groupId: selectedGroup.id,
      });
      toast.success("تم إضافة المعاد — نفس طلاب المجموعة بالظبط، بدون تكرار");
      handleClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "فشل إضافة المعاد");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={handleClose}
    >
      <div
        className="card-crisp max-h-[92vh] w-full max-w-xl overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <CalendarClock className="size-5" />
            </span>
            <div>
              <p className="text-lg font-black text-foreground">معاد إضافي لمجموعة موجودة</p>
              <p className="mt-0.5 text-sm font-bold text-muted-foreground">
                نفس المجموعة ونفس طلابها بالظبط، في يوم/قاعة مختلفة — مفيش تكرار للطلاب.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
            aria-label="إغلاق"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <Field label="الصف">
            <select
              value={gradeId}
              onChange={(e) => {
                setGradeId(e.target.value);
                setGroupId("");
              }}
              className={selectClass}
            >
              <option value="">اختر الصف</option>
              {grades.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="المجموعة">
            <select
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              disabled={!gradeId}
              className={selectClass}
            >
              <option value="">
                {!gradeId
                  ? "اختر الصف أولاً"
                  : scheduledGroups.length === 0
                    ? "لا توجد مجموعات مجدولة في هذا الصف"
                    : "اختر المجموعة"}
              </option>
              {scheduledGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} · {g.subject} · {g.teacher_name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="اليوم">
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setWeekday(d)}
                  className={cn(
                    "rounded-xl border-2 px-3 py-2 text-sm font-black transition-colors",
                    weekday === d
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-foreground hover:border-primary",
                  )}
                >
                  {d}
                </button>
              ))}
            </div>
          </Field>

          <Field label="الساعة">
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
              {TIMES_12.map((tm) => (
                <button
                  key={tm}
                  type="button"
                  onClick={() => setTime(tm)}
                  className={cn(
                    "rounded-xl border-2 px-2 py-2 text-xs font-black transition-colors",
                    time === tm
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background text-foreground hover:border-primary",
                  )}
                >
                  {format12hArabic(tm)}
                </button>
              ))}
            </div>
          </Field>

          <Field label="القاعة (اختياري)">
            <input
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              placeholder="مثال: 2"
              className={selectClass}
            />
          </Field>

          {selectedGroup ? (
            <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-3 text-sm font-bold text-foreground">
              <p className="font-black">{selectedGroup.name}</p>
              <p className="mt-0.5 text-xs font-bold text-muted-foreground">
                {selectedGroup.teacher_name} · {selectedGroup.subject} · {selectedGroup.grade} ·{" "}
                {selectedGroup.enrolled} طالب
              </p>
            </div>
          ) : null}
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-xl border-2 border-border px-4 py-2 text-sm font-black text-foreground hover:border-primary"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !selectedGroup || !weekday || !time}
            className="flex items-center gap-2 rounded-xl bg-navy px-4 py-2 text-sm font-black text-navy-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            إضافة المعاد
          </button>
        </div>
      </div>
    </div>
  );
}

const selectClass =
  "w-full rounded-xl border-2 border-border bg-background px-3 py-2.5 text-base font-bold text-foreground outline-none focus:border-primary";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-black text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
