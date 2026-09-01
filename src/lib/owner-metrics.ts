import type { DataState } from "@/lib/data-store";
import type { Group } from "@/types";

export const WEEKDAYS = [
  "الأحد",
  "الإثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
  "السبت",
] as const;

/**
 * المدفوعات تُسجَّل بوقت عربي مختصر (nowTime) وليس ISO، فأي صف غير قابل للتحليل يُحتسب
 * ضمن الشهر الحالي — الفترة الجارية هي المرجع الافتراضي في كل حسابات هذه الصفحة.
 */
function inCurrentMonth(value: string | null | undefined): boolean {
  if (!value) return true;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return true;
  const d = new Date(parsed);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

export interface OwnerKpis {
  monthRevenue: number;
  netProfit: number;
  activeStudents: number;
  teacherCompliance: number;
  expensesTotal: number;
  salariesTotal: number;
  overdueTotal: number;
  avgAttendance: number;
  inSafe: number;
  netMarginPct: number;
}

export function computeOwnerKpis(state: DataState): OwnerKpis {
  const monthRevenue = state.payments
    .filter((p) => inCurrentMonth(p.created_at))
    .reduce((s, p) => s + Number(p.amount), 0);
  const salariesTotal = state.payrollRecords
    .filter((p) => inCurrentMonth(p.paid_at))
    .reduce((s, p) => s + Number(p.amount), 0);
  const expensesTotal = state.expenses
    .filter((e) => inCurrentMonth(e.spent_at))
    .reduce((s, e) => s + Number(e.amount), 0);
  const netProfit = monthRevenue - salariesTotal - expensesTotal;
  const overdueTotal = state.students.reduce((s, st) => s + Number(st.balance_due), 0);
  const avgAttendance = state.students.length
    ? Math.round(state.students.reduce((s, st) => s + st.attendance_rate, 0) / state.students.length)
    : 0;
  const perf = buildTeacherPerformance(state);
  const teacherCompliance = perf.length
    ? Math.round(perf.reduce((s, t) => s + t.score, 0) / perf.length)
    : 0;
  const inSafe = state.safeHandovers.reduce((s, h) => s + Number(h.amount), 0);

  return {
    monthRevenue,
    netProfit,
    activeStudents: state.students.length,
    teacherCompliance,
    expensesTotal,
    salariesTotal,
    overdueTotal,
    avgAttendance,
    inSafe,
    netMarginPct: monthRevenue ? Math.round((netProfit / monthRevenue) * 100) : 0,
  };
}

export interface TeacherPerformanceRow {
  teacherId: string;
  name: string;
  subject: string;
  punctuality: number;
  delivery: number;
  rating: number;
  score: number;
  studentsCount: number;
  groupsCount: number;
}

/** تقييم أداء المدرس = التزام بالمواعيد + تسليم الحضور/التقييمات + متوسط درجات طلابه. */
export function buildTeacherPerformance(state: DataState): TeacherPerformanceRow[] {
  return state.teachers.map((t) => {
    const groups = state.groups.filter((g) => g.teacher_id === t.id);
    const groupNames = new Set(groups.map((g) => g.name));
    const students = state.students.filter((s) => s.subject_ids.includes(t.subject_id));

    const attendanceForTeacher = state.attendanceRecords.filter((a) => groupNames.has(a.group_name));
    const punctuality = groups.length
      ? Math.min(100, Math.round((attendanceForTeacher.length / (groups.length * 5)) * 100))
      : 0;

    const homework = state.homeworkTasks.filter((h) => h.subject === t.subject);
    const graded = homework.filter((h) => h.status === "graded").length;
    const delivery = homework.length ? Math.round((graded / homework.length) * 100) : punctuality;

    const rating = students.length
      ? Math.round(students.reduce((s, st) => s + st.avg_score, 0) / students.length)
      : 0;

    const score = Math.round((punctuality + delivery + rating) / 3);
    return {
      teacherId: t.id,
      name: t.full_name,
      subject: t.subject,
      punctuality,
      delivery,
      rating,
      score,
      studentsCount: students.length,
      groupsCount: groups.length,
    };
  });
}

export interface DayActivityPoint {
  day: string;
  attendance: number;
  payments: number;
  sessions: number;
}

/** متوسط أداء وحضور السنتر حسب اليوم — حضور + مدفوعات + حركة الحصص. */
export function buildDailyCenterActivity(state: DataState): DayActivityPoint[] {
  return WEEKDAYS.map((day) => {
    const dayGroups = state.groups.filter((g) => g.weekday === day);
    const names = new Set(dayGroups.map((g) => g.name));
    return {
      day,
      attendance: state.attendanceRecords.filter((a) => names.has(a.group_name)).length,
      payments: state.payments.length && dayGroups.length ? dayGroups.length : 0,
      sessions: dayGroups.length,
    };
  });
}

export interface WeeklyAttendancePoint {
  day: string;
  present: number;
  absent: number;
}

export function buildWeeklyAttendance(state: DataState): WeeklyAttendancePoint[] {
  return WEEKDAYS.map((day) => {
    const names = new Set(state.groups.filter((g) => g.weekday === day).map((g) => g.name));
    const rows = state.attendanceRecords.filter((a) => names.has(a.group_name));
    return {
      day,
      present: rows.filter((r) => r.status !== "absent").length,
      absent: rows.filter((r) => r.status === "absent").length,
    };
  });
}

/* ---------------- المجموعات النشطة الآن + حوكمة الحصص ---------------- */

export interface ActiveGroupRow {
  group: Group;
  started: boolean;
  activated: boolean;
  lateMinutes: number;
}

function parseSlotMinutes(time: string): number | null {
  const match = /(\d{1,2})[:.](\d{2})/.exec(time);
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  // "٤:٠٠ م" أو "4:00 PM" — أي علامة مساء تحوّل للنظام الـ 24 ساعة.
  if (/م|pm/i.test(time) && hours < 12) hours += 12;
  if (/ص|am/i.test(time) && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

/**
 * الحصة تُحتسب نشطة فقط بشرطين معاً: مرور وقت بدايتها فعلياً (NOW)، وقيام المدرس
 * بتفعيلها من صفحته (رفع واجب / تسجيل حضور / بدء جلسة). الشرط الثاني ناقص = تأخير.
 */
export function buildActiveGroupsNow(state: DataState, now = new Date()): ActiveGroupRow[] {
  const today = WEEKDAYS[now.getDay()]!;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  return state.groups
    .filter((g) => g.weekday === today)
    .map((g) => {
      const start = parseSlotMinutes(g.time);
      const started = start !== null && nowMinutes >= start;
      const activated =
        state.attendanceRecords.some((a) => a.group_name === g.name) ||
        state.sessionRecords.some((s) => s.group_id === g.id) ||
        state.homeworkTasks.some((h) => h.subject === g.subject && h.status !== "pending");
      const lateMinutes = started && !activated && start !== null ? nowMinutes - start : 0;
      return { group: g, started, activated, lateMinutes };
    })
    .sort((a, b) => (a.group.time < b.group.time ? -1 : 1));
}

/* ---------------- محرك التنبيهات الواقعي ---------------- */

export interface DecisionAlert {
  id: string;
  severity: "info" | "warning" | "critical";
  title: string;
  body: string;
}

export function buildDecisionAlerts(state: DataState, now = new Date()): DecisionAlert[] {
  const alerts: DecisionAlert[] = [];

  // 1) طلاب متأخرون عن سداد الاشتراك.
  const overdueStudents = state.students.filter(
    (s) => s.balance_due > 0 && s.payment_status !== "paid",
  );
  for (const s of overdueStudents.slice(0, 8)) {
    alerts.push({
      id: `due-${s.id}`,
      severity: s.payment_status === "overdue" ? "critical" : "warning",
      title: `متأخر سداد: ${s.full_name}`,
      body: `${s.grade} · ${s.group_name} · المستحق ${s.balance_due} جنيه`,
    });
  }

  // 2) مدرس لم يسلّم الحضور/التقييم بعد بداية حصته.
  for (const row of buildActiveGroupsNow(state, now)) {
    if (row.started && !row.activated) {
      alerts.push({
        id: `late-${row.group.id}`,
        severity: row.lateMinutes > 15 ? "critical" : "warning",
        title: `لم تُفعَّل حصة ${row.group.name}`,
        body: `${row.group.teacher_name} · ${row.group.time} · تأخير ${row.lateMinutes} دقيقة بدون حضور أو واجب`,
      });
    }
  }

  // 3) مجموعات وصلت للحد الأقصى.
  for (const g of state.groups.filter((g) => g.capacity > 0 && g.enrolled >= g.capacity)) {
    alerts.push({
      id: `cap-${g.id}`,
      severity: "warning",
      title: `مجموعة ${g.name} وصلت للسعة القصوى`,
      body: `${g.enrolled} / ${g.capacity} · ${g.teacher_name}`,
    });
  }

  // 4) نقص المخزون أو بنك الأسئلة.
  for (const b of state.booklets.filter((b) => b.in_stock <= 5)) {
    alerts.push({
      id: `stk-${b.id}`,
      severity: b.in_stock === 0 ? "critical" : "warning",
      title: `نقص مخزون: ${b.title}`,
      body: `المتبقي ${b.in_stock} نسخة فقط · ${b.subject}`,
    });
  }
  if (state.sessionQuestions.length < 10) {
    alerts.push({
      id: "qbank",
      severity: "warning",
      title: "بنك الأسئلة شبه فاضي",
      body: `${state.sessionQuestions.length} سؤال فقط متاح لوضع الحصة`,
    });
  }

  const order = { critical: 0, warning: 1, info: 2 } as const;
  return alerts.sort((a, b) => order[a.severity] - order[b.severity]);
}

/* ---------------- تحليل مالي لكل مدرس ---------------- */

export interface TeacherFinanceRow {
  teacherId: string;
  name: string;
  subject: string;
  studentsCount: number;
  revenue: number;
  salary: number;
  net: number;
}

export function buildTeacherFinance(state: DataState): TeacherFinanceRow[] {
  return state.teachers
    .map((t) => {
      const students = state.students.filter((s) => s.subject_ids.includes(t.subject_id));
      const codes = new Set(students.map((s) => s.code));
      const revenue = state.payments
        .filter((p) => codes.has(p.student_code))
        .reduce((s, p) => s + Number(p.amount), 0);
      const salary = state.payrollRecords
        .filter((p) => p.person_id === t.id || p.person_name === t.full_name)
        .reduce((s, p) => s + Number(p.amount), 0);
      return {
        teacherId: t.id,
        name: t.full_name,
        subject: t.subject,
        studentsCount: students.length,
        revenue,
        salary,
        net: revenue - salary,
      };
    })
    .sort((a, b) => b.net - a.net);
}
