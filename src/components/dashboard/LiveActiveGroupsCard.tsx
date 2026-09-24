import { CheckCircle2, Clock, PlayCircle, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/dashboard/StatCard";
import {
  getEnrolledCount,
  pushNotification,
  startGroupSession,
  useDataStore,
} from "@/lib/data-store";
import { formatNumber } from "@/lib/format";
import type { Group } from "@/types";

/**
 * بطاقة "المجموعات النشطة الآن" + عداد تأخير حي.
 *
 * المنطق:
 *  - يقرأ **مواعيد اليوم من `state.scheduleSlots`** (مش من `group.weekday/time` القديمة).
 *    مجموعة متجدولة بأكتر من يوم/معاد (`GroupScheduleModal`/`AddScheduleSlotModal`) بتتسجّل
 *    كصف مستقل لكل يوم في `scheduleSlots`، لكن `group.weekday/time` القديمة بتفضل بتحمل
 *    **أول يوم مُختار بس** (`GroupScheduleModal.handleSave`) — فلو الكارت ده فضل بيقرا من
 *    الحقل القديم، أي معاد تاني غير الأول كان بيختفي تماماً من "المجموعات النشطة" (البج
 *    المُبلَّغ من السنتر الحقيقي: "بيجيب حصتين بس ويعطل" رغم وجود حصص تانية شغالة فعلاً).
 *    مجموعات قديمة اتجدولت قبل نظام المواعيد المتعددة ومعندهاش أي صف في scheduleSlots
 *    لسه بترجع للحقول القديمة كـfallback وحيد، عشان محدش يختفي من غير داعي.
 *  - يحدد لكل معاد: هل حان وقت بدئه (started)؟ هل فعّله **الموظف** (activated)؟
 *  - `activated` معتمد حصراً على `groupActivations` (Migration 0029) — يُكتب فقط
 *    من `startGroupSession`/`markAttendanceForGroup` (فعل الموظف). أي حركة من
 *    المدرس في وضع الحصة (تسجيل حضور من الروستر، رفع واجب، إنهاء الحصة) لا تُحسب
 *    هنا إطلاقاً — فصل متعمّد بطلب صريح.
 *  - العداد يحدّث كل ثانية `useEffect setInterval(1s)` ويتوقف لحظة تفعيل الموظف.
 */

const WEEKDAYS_AR = [
  "الأحد",
  "الإثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
  "السبت",
] as const;

interface LiveGroup {
  group: Group;
  slotId: string;
  time: string;
  room: string;
  enrolled: number;
  started: boolean;
  activated: boolean;
  scheduledMs: number; // epoch ms
  firstActionMs: number | null; // أول action حقيقي
  nowMs: number;
}

function parseTimeToMs(time: string, now: Date): number | null {
  const match = /(\d{1,2})[:.](\d{2})/.exec(time);
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (/م|pm/i.test(time) && hours < 12) hours += 12;
  if (/ص|am/i.test(time) && hours === 12) hours = 0;
  const d = new Date(now);
  d.setHours(hours, minutes, 0, 0);
  return d.getTime();
}

function computeLive(state: ReturnType<typeof useDataStore>, now: Date): LiveGroup[] {
  const today = WEEKDAYS_AR[now.getDay()];
  const nowMs = now.getTime();

  const todaysSlots: { group: Group; slotId: string; time: string; room: string }[] = [];
  const groupIdsWithAnySlot = new Set(
    state.scheduleSlots.filter((sl) => sl.group_id).map((sl) => sl.group_id!),
  );
  for (const sl of state.scheduleSlots) {
    if (sl.weekday !== today || !sl.group_id) continue;
    const group = state.groups.find((g) => g.id === sl.group_id);
    if (!group) continue;
    todaysSlots.push({ group, slotId: sl.id, time: sl.time || group.time, room: sl.room || group.room });
  }
  // مجموعات قديمة اتجدولت قبل نظام المواعيد المتعددة ومعندهاش أي صف في
  // scheduleSlots أصلاً — fallback وحيد على حقولها القديمة عشان محدش يختفي.
  for (const g of state.groups) {
    if (g.scheduling_status !== "scheduled" || g.weekday !== today) continue;
    if (groupIdsWithAnySlot.has(g.id)) continue;
    todaysSlots.push({ group: g, slotId: `legacy-${g.id}`, time: g.time, room: g.room });
  }

  return todaysSlots
    .map(({ group, slotId, time, room }) => {
      const scheduledMs = parseTimeToMs(time, now) ?? 0;
      const started = scheduledMs > 0 && nowMs >= scheduledMs;
      // نفس اليوم فقط — تفعيل من أمس ما يفضلش شغال النهاردة.
      const todaysActivations = state.groupActivations.filter((a) => {
        if (a.group_id !== group.id) return false;
        const t = new Date(a.activated_at);
        return (
          t.getFullYear() === now.getFullYear() &&
          t.getMonth() === now.getMonth() &&
          t.getDate() === now.getDate()
        );
      });
      const firstActivation = todaysActivations
        .map((a) => new Date(a.activated_at).getTime())
        .sort((a, b) => a - b)[0];
      const firstActionMs = firstActivation ?? Number.POSITIVE_INFINITY;
      const activated = Number.isFinite(firstActionMs);
      return {
        group,
        slotId,
        time,
        room,
        enrolled: getEnrolledCount(state, group.id),
        started,
        activated,
        scheduledMs,
        firstActionMs: activated ? firstActionMs : null,
        nowMs,
      };
    })
    .sort((a, b) => a.scheduledMs - b.scheduledMs);
}

function formatLiveClock(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "00:00";
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function LiveActiveGroupsCard({
  /** البند 1: الموظف فقط يبدأ الحصة أو يسجّل تأخيراً — المالك عرض فقط. */
  canControl = false,
}: {
  canControl?: boolean;
} = {}) {
  const state = useDataStore();
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const live = computeLive(state, now);
  const today = WEEKDAYS_AR[now.getDay()];

  if (live.length === 0) {
    return (
      <div className="card-crisp p-5">
        <p className="flex items-center gap-2 text-xl font-black text-foreground">
          <PlayCircle className="size-6 text-primary" />
          المجموعات النشطة الآن
        </p>
        <p className="mt-1 text-sm font-bold text-muted-foreground">
          {today} · لا توجد حصص مجدولة اليوم في جدول {state.center.name}.
        </p>
      </div>
    );
  }

  return (
    <div className="card-crisp p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-xl font-black text-foreground">
          <PlayCircle className="size-6 text-primary" />
          المجموعات النشطة الآن
        </p>
        <StatusBadge tone="primary">{formatNumber(live.length)} حصة اليوم · {today}</StatusBadge>
      </div>
      <p className="mt-1 text-sm font-bold text-muted-foreground">
        العداد يتحدث كل ثانية. الحصة تُعتبر "بدأت" فقط لما الموظف يفعّلها من صفحته.
      </p>
      <div className="mt-4 space-y-3">
        {live.map((row) => (
          <LiveRow key={row.slotId} row={row} canControl={canControl} />
        ))}
      </div>
    </div>
  );
}

function LiveRow({ row, canControl }: { row: LiveGroup; canControl: boolean }) {
  const { group, time, room, enrolled, started, activated, scheduledMs, firstActionMs, nowMs } = row;
  const lateMs = !activated && started ? nowMs - scheduledMs : 0;
  let display: string;
  let tone: "success" | "warning" | "destructive" | "primary" | "neutral";
  let label: string;
  if (activated && firstActionMs !== null) {
    const sessionDuration = firstActionMs - scheduledMs;
    if (sessionDuration <= 0) {
      display = "بدأت في الموعد";
      tone = "success";
      label = "✅ بدأت في الموعد";
    } else {
      const startedLate = formatLiveClock(sessionDuration);
      display = `تأخر ${startedLate}`;
      tone = "warning";
      label = "بدأت متأخرة";
    }
  } else if (started) {
    display = formatLiveClock(lateMs);
    tone = lateMs > 15 * 60 * 1000 ? "destructive" : "warning";
    label = "موعد الحصة الآن — في انتظار بدء الموظف";
  } else {
    const remaining = scheduledMs - nowMs;
    display = `بعد ${formatLiveClock(remaining)}`;
    tone = "neutral";
    label = "لم يحن الموعد بعد";
  }
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 p-4 ${
        activated
          ? "border-success/40 bg-success/5"
          : started
            ? "border-destructive/40 bg-destructive/5"
            : "border-border"
      }`}
    >
      <div className="min-w-0">
        <p className="text-base font-black text-foreground">{group.name}</p>
        <p className="text-sm font-bold text-muted-foreground">
          {group.teacher_name} · {group.grade} · قاعة {room} · {group.subject}
        </p>
        <p className="mt-1 flex items-center gap-2 text-xs font-bold text-muted-foreground">
          <Users className="size-3" />
          {formatNumber(enrolled)} / {formatNumber(group.capacity)} طالب · الموعد{" "}
          {time}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {started && !activated && canControl ? (
          <DelayButton groupName={group.name} />
        ) : null}
        {started && !activated && canControl ? (
          <button
            type="button"
            onClick={() => {
              const result = startGroupSession(group.id);
              if (result.marked === 0) {
                toast.info(`كل طلاب ${group.name} حضورهم مسجَّل بالفعل`);
              } else {
                toast.success(
                  `تم تسجيل بدء حصة ${group.name} — ${result.marked} طالب`,
                );
              }
            }}
            className="flex items-center gap-1.5 rounded-xl bg-navy px-3 py-1.5 text-xs font-black text-navy-foreground hover:opacity-90"
          >
            <CheckCircle2 className="size-3.5" /> سجّل بدء الحصة
          </button>
        ) : null}
        <div className="text-left">
          <StatusBadge tone={tone}>{label}</StatusBadge>
          <p className="mt-1 flex items-center justify-end gap-1 font-mono text-lg font-black text-foreground">
            <Clock className="size-4 text-primary" />
            {display}
          </p>
        </div>
      </div>
    </div>
  );
}

/** البند 1: زر "تأخير" بدقائق يدوية — يُنشئ تنبيهاً للمالك والمدرس. */
function DelayButton({ groupName }: { groupName: string }) {
  const [open, setOpen] = useState(false);
  const [minutes, setMinutes] = useState(10);
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-xl border-2 border-warning/50 px-3 py-1.5 text-xs font-black text-warning hover:bg-warning/10"
      >
        تسجيل تأخير
      </button>
    );
  }
  return (
    <span className="flex items-center gap-1">
      <input
        type="number"
        min={1}
        max={120}
        value={minutes}
        onChange={(e) => setMinutes(Math.max(1, Number(e.target.value) || 1))}
        className="w-16 rounded-lg border-2 border-warning/50 bg-background px-2 py-1 text-xs font-black outline-none"
      />
      <button
        type="button"
        onClick={() => {
          pushNotification(
            "session_delay",
            "warning",
            `تأخير حصة ${groupName}`,
            `سجّل الموظف تأخيراً قدره ${minutes} دقيقة لبدء حصة ${groupName}.`,
          );
          setOpen(false);
          toast.warning(`تم تسجيل تأخير ${minutes} دقيقة وإبلاغ المالك والمدرس`);
        }}
        className="rounded-lg bg-warning px-2 py-1 text-xs font-black text-white"
      >
        تأكيد
      </button>
    </span>
  );
}
