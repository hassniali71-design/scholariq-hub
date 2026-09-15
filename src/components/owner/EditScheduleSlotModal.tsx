import { Loader2, Pencil, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { upsertScheduleSlot } from "@/lib/data-store";
import { WEEKDAYS } from "@/lib/owner-metrics";
import { cn } from "@/lib/utils";
import type { ScheduleSlot } from "@/types";

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
  return t
    .replace(" AM", " ص")
    .replace(" PM", " م")
    .replace("AM", "ص")
    .replace("PM", "م");
}

interface EditScheduleSlotModalProps {
  slot: ScheduleSlot | null;
  onClose: () => void;
}

/**
 * طلب صريح: تعديل حر لميعاد موجود (اليوم/الساعة/القاعة) — بيحدّث نفس صف
 * `schedule_slots` في المصدر المركزي (نفس id)، فبيتزامن فوراً مع كل مكان
 * بيقرأ من scheduleSlots (بوابة الكاشير، وضع الحصة، جدول اليوم عند المالك)
 * وبالتبعية مع كل طالب منضم للمجموعة دي — بدون أي خطوة إضافية.
 */
export function EditScheduleSlotModal({ slot, onClose }: EditScheduleSlotModalProps) {
  const [weekday, setWeekday] = useState("");
  const [time, setTime] = useState("");
  const [room, setRoom] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!slot) return;
    setWeekday(slot.weekday);
    setTime(slot.time);
    setRoom(slot.room ?? "");
  }, [slot]);

  if (!slot) return null;

  function handleSave() {
    if (!slot) return;
    if (!weekday || !time) {
      toast.error("اختر اليوم والساعة");
      return;
    }
    setSaving(true);
    try {
      upsertScheduleSlot({
        id: slot.id,
        teacherId: slot.teacher_id,
        teacherName: slot.teacher_name,
        subjectId: slot.subject_id,
        subject: slot.subject,
        grade: slot.grade,
        weekday,
        time,
        room: room.trim(),
        groupId: slot.group_id,
      });
      toast.success("تم تعديل الموعد وتحديثه لكل الطلاب المنضمين");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "فشل تعديل الموعد");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="card-crisp max-h-[92vh] w-full max-w-lg overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Pencil className="size-5" />
            </span>
            <div>
              <p className="text-lg font-black text-foreground">تعديل الموعد</p>
              <p className="mt-0.5 text-sm font-bold text-muted-foreground">
                {slot.teacher_name} · {slot.subject} · {slot.grade}
              </p>
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

        <div className="mt-5 space-y-4">
          <FieldLabel label="اليوم">
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
          </FieldLabel>

          <FieldLabel label="الساعة">
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
          </FieldLabel>

          <FieldLabel label="القاعة (اختياري)">
            <input
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              placeholder="مثال: التفوق"
              className="w-full rounded-xl border-2 border-border bg-background px-3 py-2.5 text-base font-bold text-foreground outline-none focus:border-primary"
            />
          </FieldLabel>
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border-2 border-border px-4 py-2 text-sm font-black text-foreground hover:border-primary"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !weekday || !time}
            className="flex items-center gap-2 rounded-xl bg-navy px-4 py-2 text-sm font-black text-navy-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            حفظ التعديل
          </button>
        </div>
      </div>
    </div>
  );
}

function FieldLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-black text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
