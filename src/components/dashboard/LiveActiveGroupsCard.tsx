import { Clock, PlayCircle, Users } from "lucide-react";
import { useEffect, useState } from "react";

import { StatusBadge } from "@/components/dashboard/StatCard";
import { useDataStore } from "@/lib/data-store";
import { formatNumber } from "@/lib/format";
import type { Group } from "@/types";

/**
 * بطاقة "المجموعات النشطة الآن" + عداد تأخير حي.
 *
 * المنطق:
 *  - يقرأ جدول اليوم من `state.groups` ويختار المجموعات المسجّلة ليوم `today`.
 *  - يحدد لكل مجموعة: هل حان وقت بدئها (started)؟ هل فعّلها المدرس (activated)؟
 *  - `activated` يتطلب Action حقيقي على `sessionRecords` (أول SessionEvent أو سجل حضور).
 *  - العداد يحدّث كل ثانية `useEffect setInterval(1s)` ويتوقف لحظة تفعيل المدرس.
 *
 * لا يعتبر فتح الصفحة أو تسجيل الدخول بداية الحصة. فقط:
 *  - رفع واجب (homework_status != pending) لنفس المادة
 *  - تسجيل حضور عبر الـ QR (attendanceRecords)
 *  - إنشاء SessionEvent أو SessionRecord للمجموعة
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
  return state.groups
    .filter((g) => g.weekday === today)
    .map((g) => {
      const scheduledMs = parseTimeToMs(g.time, now) ?? 0;
      const started = scheduledMs > 0 && nowMs >= scheduledMs;
      // البحث عن أول Action حقيقي مرتبط بالمجموعة:
      // 1) attendanceRecord على نفس اسم المجموعة
      const att = state.attendanceRecords.find(
        (a) => a.group_name === g.name && a.checked_in_at,
      );
      const attMs = att ? new Date(att.checked_in_at).getTime() : Number.POSITIVE_INFINITY;
      // 2) sessionRecord على نفس group_id
      const sr = state.sessionRecords.find((s) => s.group_id === g.id);
      const srMs = sr ? new Date(sr.date).getTime() : Number.POSITIVE_INFINITY;
      // 3) homework مرتبط بنفس المادة بحالة != pending
      const hw = state.homeworkTasks.find(
        (h) => h.subject === g.subject && h.status !== "pending",
      );
      const hwMs = hw?.created_at ? new Date(hw.created_at).getTime() : Number.POSITIVE_INFINITY;
      // 4) sessionEvent مرتبط بـ session
      const ev = sr
        ? state.sessionEvents
            .filter((e) => e.session_id === sr.id)
            .map((e) => new Date(e.at).getTime())
            .sort((a, b) => a - b)[0] ?? Number.POSITIVE_INFINITY
        : Number.POSITIVE_INFINITY;
      const firstActionMs = Math.min(attMs, srMs, hwMs, ev);
      const activated = Number.isFinite(firstActionMs) && firstActionMs < Number.POSITIVE_INFINITY;
      return {
        group: g,
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

export function LiveActiveGroupsCard() {
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
        العداد يتحدث كل ثانية. الحصة تُعتبر "بدأت" فقط عند أول Action حقيقي للمدرس.
      </p>
      <div className="mt-4 space-y-3">
        {live.map((row) => (
          <LiveRow key={row.group.id} row={row} />
        ))}
      </div>
    </div>
  );
}

function LiveRow({ row }: { row: LiveGroup }) {
  const { group, started, activated, scheduledMs, firstActionMs, nowMs } = row;
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
    label = "موعد الحصة الآن — في انتظار بدء المدرس";
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
          {group.teacher_name} · {group.grade} · قاعة {group.room} · {group.subject}
        </p>
        <p className="mt-1 flex items-center gap-2 text-xs font-bold text-muted-foreground">
          <Users className="size-3" />
          {formatNumber(group.enrolled)} / {formatNumber(group.capacity)} طالب · الموعد{" "}
          {group.time}
        </p>
      </div>
      <div className="text-left">
        <StatusBadge tone={tone}>{label}</StatusBadge>
        <p className="mt-1 flex items-center justify-end gap-1 font-mono text-lg font-black text-foreground">
          <Clock className="size-4 text-primary" />
          {display}
        </p>
      </div>
    </div>
  );
}
