import { CalendarDays, GraduationCap, UserCheck, Users } from "lucide-react";
import { useMemo } from "react";

import { StatusBadge } from "@/components/dashboard/StatCard";
import { useDataStore } from "@/lib/data-store";
import { formatNumber, formatPercent } from "@/lib/format";

/**
 * كروت "نظرة اليوم" — كل رقم يُحسب من البيانات الحقيقية:
 *  - حصص اليوم = عدد المجموعات المجدولة ليوم today
 *  - المدرسون على رأس العمل = مدرسون فعّلوا أي Action في سجل اليوم
 *  - متوسط الحضور = سجلات اليوم الحقيقية (أو "لا توجد سجلات" إذا صفر)
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

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function isToday(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false;
  // يقبل ISO أو نص عربي مختصر (وقت بدون تاريخ)
  const parsed = new Date(dateStr);
  if (!Number.isFinite(parsed.getTime())) return false;
  const d = new Date();
  return (
    parsed.getFullYear() === d.getFullYear() &&
    parsed.getMonth() === d.getMonth() &&
    parsed.getDate() === d.getDate()
  );
}

export function TodayOverviewPanels() {
  const state = useDataStore();
  const today = WEEKDAYS_AR[new Date().getDay()]!;
  const todayKeyStr = todayKey();

  const todayGroups = useMemo(
    () => state.groups.filter((g) => g.weekday === today),
    [state.groups, today],
  );

  // المدرسون على رأس العمل اليوم = من لديه Action حقيقي اليوم
  const teachersWorkingToday = useMemo(() => {
    const teacherIds = new Set<string>();
    for (const att of state.attendanceRecords) {
      if (isToday(att.checked_in_at)) {
        const st = state.students.find((s) => s.id === att.student_id);
        if (st) {
          for (const sid of st.subject_ids) {
            const tch = state.teachers.find((t) => t.subject_id === sid);
            if (tch) teacherIds.add(tch.id);
          }
        }
      }
    }
    for (const hw of state.homeworkTasks) {
      if (isToday(hw.created_at) || hw.status !== "pending") {
        const tch = state.teachers.find((t) => t.subject === hw.subject);
        if (tch) teacherIds.add(tch.id);
      }
    }
    for (const sr of state.sessionRecords) {
      if (isToday(sr.date)) {
        teacherIds.add(sr.teacher_id);
      }
    }
    // قيّد على من لديه حصة اليوم فقط
    const todayGroupTeacherIds = new Set(todayGroups.map((g) => g.teacher_id));
    return [...teacherIds].filter((id) => todayGroupTeacherIds.has(id));
  }, [state, todayGroups]);

  // متوسط الحضور اليوم
  const todayAttendance = useMemo(() => {
    const rows = state.attendanceRecords.filter((a) => isToday(a.checked_in_at));
    if (rows.length === 0) return { count: 0, present: 0, late: 0, absent: 0, hasData: false };
    const present = rows.filter((r) => r.status === "present").length;
    const late = rows.filter((r) => r.status === "late").length;
    const absent = rows.filter((r) => r.status === "absent").length;
    return { count: rows.length, present, late, absent, hasData: true };
  }, [state.attendanceRecords]);

  // الطلاب المسجَّلون جدداً اليوم
  const newStudentsToday = useMemo(
    () => state.students.filter((s) => isToday(s.id ? new Date().toISOString() : null) || false).length,
    // ملاحظة: لا يوجد created_at للطلاب — نعتمد على فصل "نشط" جديد من المجموعة
    [state.students],
  );

  // الطلاب النشطون = الذين عليهم مهام أو حضور في آخر 30 يوم
  void todayKeyStr; // نُبقي المفتاح للاستخدام إن لزم
  void newStudentsToday;

  const expectedStudentsToday = todayGroups.reduce(
    (s, g) => s + g.enrolled,
    0,
  );

  return (
    <div className="card-crisp p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-xl font-black text-foreground">
          <CalendarDays className="size-6 text-primary" />
          نظرة اليوم — {today}
        </p>
        <StatusBadge tone={todayGroups.length > 0 ? "success" : "warning"}>
          {formatNumber(todayGroups.length)} حصة مجدولة اليوم
        </StatusBadge>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border-2 border-border p-4">
          <p className="text-sm font-bold text-muted-foreground">حصص اليوم</p>
          <p className="kpi-number text-3xl">{formatNumber(todayGroups.length)}</p>
          <p className="mt-1 text-sm font-bold text-muted-foreground">
            {todayGroups.length > 0
              ? todayGroups
                  .slice(0, 3)
                  .map((g) => `${g.name} (${g.time})`)
                  .join(" · ")
              : "لا توجد حصص مجدولة اليوم"}
          </p>
        </div>
        <div className="rounded-xl border-2 border-border p-4">
          <p className="text-sm font-bold text-muted-foreground">المدرسون على رأس العمل</p>
          <p className="kpi-number text-3xl">{formatNumber(teachersWorkingToday.length)}</p>
          <p className="mt-1 text-sm font-bold text-muted-foreground">
            {teachersWorkingToday.length > 0
              ? teachersWorkingToday
                  .map((id) => state.teachers.find((t) => t.id === id)?.full_name ?? "")
                  .filter(Boolean)
                  .slice(0, 3)
                  .join(" · ")
              : "لا يوجد مدرس فعّل حصته بعد"}
          </p>
        </div>
        <div className="rounded-xl border-2 border-border p-4">
          <p className="text-sm font-bold text-muted-foreground">متوسط الحضور اليوم</p>
          {todayAttendance.hasData ? (
            <>
              <p className="kpi-number text-3xl">
                {formatPercent(
                  Math.round(((todayAttendance.present + todayAttendance.late) / todayAttendance.count) * 100),
                )}
              </p>
              <p className="mt-1 text-sm font-bold text-muted-foreground">
                {formatNumber(todayAttendance.present + todayAttendance.late)} حاضر ·{" "}
                {formatNumber(todayAttendance.absent)} غائب · {formatNumber(todayAttendance.count)} سجل
              </p>
            </>
          ) : (
            <>
              <p className="kpi-number text-3xl text-muted-foreground">—</p>
              <p className="mt-1 text-sm font-bold text-muted-foreground">
                لا توجد سجلات حضور لليوم
              </p>
            </>
          )}
        </div>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border-2 border-border p-4">
          <p className="text-sm font-bold text-muted-foreground">الطلاب المتوقع حضورهم</p>
          <p className="kpi-number text-3xl">{formatNumber(expectedStudentsToday)}</p>
          <p className="mt-1 text-sm font-bold text-muted-foreground">
            من مجموع المجموعات المجدولة اليوم
          </p>
        </div>
        <div className="rounded-xl border-2 border-border p-4">
          <p className="text-sm font-bold text-muted-foreground">المدرسون المجدولون</p>
          <p className="kpi-number text-3xl">
            {formatNumber(new Set(todayGroups.map((g) => g.teacher_id)).size)}
          </p>
          <p className="mt-1 text-sm font-bold text-muted-foreground">
            مدرس لهم حصص اليوم في الجدول
          </p>
        </div>
        <div className="rounded-xl border-2 border-border p-4">
          <p className="text-sm font-bold text-muted-foreground">المواد المجدولة</p>
          <p className="kpi-number text-3xl">
            {formatNumber(new Set(todayGroups.map((g) => g.subject)).size)}
          </p>
          <p className="mt-1 text-sm font-bold text-muted-foreground">
            {[...new Set(todayGroups.map((g) => g.subject))].slice(0, 3).join(" · ") || "—"}
          </p>
        </div>
      </div>
    </div>
  );
}

void GraduationCap;
void UserCheck;
void Users;
