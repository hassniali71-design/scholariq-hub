import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, ClipboardList, Clock, ShieldAlert, Timer } from "lucide-react";

import { Panel, StatCard, StatusBadge } from "@/components/dashboard/StatCard";
import { AppShell } from "@/components/layout/AppShell";
import {
  TeacherComplianceCard,
  type SeasonMetrics,
} from "@/components/owner/TeacherComplianceCard";
import {
  getPendingCorrectionsCountForTeacher,
  getStudentsForTeacher,
  getTeacherBehaviorAverage,
  getTimerCompliance,
  useDataStore,
} from "@/lib/data-store";
import { formatNumber, formatPercent } from "@/lib/format";
import {
  buildTeacherWeeklyMetrics,
  WEEKDAYS,
} from "@/lib/owner-metrics";

/**
 * Section 0 fix: real cumulative season metrics. The previous placeholder
 * returned `85` / `88` for every teacher regardless of data. Now we
 * aggregate from `state.assessmentScores` (avg of all student scores) and
 * `state.attendanceRecords` (present / total) for the students linked to
 * this teacher. Returns 0 when no data exists (avoids fake 85%).
 */
function buildTeacherSeasonMetrics(state: ReturnType<typeof useDataStore>, teacherId: string): SeasonMetrics {
  const students = getStudentsForTeacher(state, teacherId);
  if (students.length === 0) return { avgScore: 0, attendance: 0, behavior: null };
  const studentIds = new Set(students.map((s) => s.id));
  const scores = state.assessmentScores.filter(
    (a) => a.student_id !== undefined && studentIds.has(a.student_id),
  );
  const avgScore =
    scores.length === 0
      ? 0
      : Math.round(
          scores.reduce((s, a) => {
            const ratio = a.max_value > 0 ? (a.value / a.max_value) * 100 : 0;
            return s + ratio;
          }, 0) / scores.length,
        );
  const present = state.attendanceRecords.filter(
    (a) => a.student_id !== undefined && studentIds.has(a.student_id) && a.status === "present",
  ).length;
  const total = state.attendanceRecords.filter(
    (a) => a.student_id !== undefined && studentIds.has(a.student_id),
  ).length;
  const attendance = total === 0 ? 0 : Math.round((present / total) * 100);
  const behaviorRatio = getTeacherBehaviorAverage(state, teacherId);
  return {
    avgScore,
    attendance,
    behavior: behaviorRatio === null ? null : Math.round(behaviorRatio * 100),
  };
}

export const Route = createFileRoute("/owner/compliance")({
  head: () => ({
    meta: [
      { title: "التزام المدرسين (SLA) — لوحة المالك" },
      {
        name: "description",
        content: "بطاقات عمودية لمدى التزام كل مدرس — 3 تراكمية + 3 أسبوعية من أفعاله الفعلية.",
      },
    ],
  }),
  component: CompliancePage,
});

function CompliancePage() {
  const state = useDataStore();
  const { teachers, sessionRecords, timerExtensions, sessionEvents } = state;

  // 4 كروت وصفية أعلى الصفحة
  const complianceMap = new Map(teachers.map((t) => [t.id, getTimerCompliance(state, t.id)]));
  const avg = teachers.length
    ? Math.round(
        teachers.reduce((s, t) => s + (complianceMap.get(t.id) ?? 0), 0) / teachers.length,
      )
    : 0;
  const totalBreaches = teachers.reduce((s, t) => s + t.sla_breaches, 0);
  const totalPendingCorrections = teachers.reduce(
    (s, t) => s + getPendingCorrectionsCountForTeacher(state, t.id),
    0,
  );
  const behaviorValues = teachers
    .map((t) => getTeacherBehaviorAverage(state, t.id))
    .filter((v): v is number => v !== null);
  const avgBehavior = behaviorValues.length
    ? Math.round((behaviorValues.reduce((s, v) => s + v, 0) / behaviorValues.length) * 100)
    : null;

  // متوسط تأخير البدء — من sessionEvents (الـ first event في كل session)
  const avgLateSeconds = (() => {
    const late: number[] = [];
    for (const r of sessionRecords) {
      const schedAt = new Date(r.date).getTime();
      if (!Number.isFinite(schedAt)) continue;
      const firstEvent = sessionEvents
        .filter((e) => e.session_id === r.id)
        .map((e) => new Date(e.at).getTime())
        .filter((v) => Number.isFinite(v))
        .sort((a, b) => a - b)[0];
      if (firstEvent === undefined) continue;
      const delta = (firstEvent - schedAt) / 1000;
      if (delta > 0) late.push(delta);
    }
    return late.length === 0 ? 0 : Math.round(late.reduce((s, v) => s + v, 0) / late.length);
  })();
  const avgLateMin = Math.floor(avgLateSeconds / 60);
  const avgLateSec = avgLateSeconds % 60;
  const totalExt = timerExtensions.reduce((s, e) => s + Number(e.added_seconds || 0), 0);
  const extMin = Math.floor(totalExt / 60);

  // ترتيب المدرسين حسب الالتزام
  const sortedTeachers = [...teachers].sort(
    (a, b) => (complianceMap.get(b.id) ?? 0) - (complianceMap.get(a.id) ?? 0),
  );

  return (
    <AppShell
      role="owner"
      title="التزام المدرسين (SLA)"
      description="قياس الالتزام من أفعال المدرس الفعلية في وضع الحصة"
    >
      {/* 4 كروت وصفية للحوكمة */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="متوسط الالتزام العام"
          value={formatPercent(avg)}
          icon={Timer}
          tone={avg >= 90 ? "success" : avg > 0 ? "warning" : "primary"}
          trend={teachers.length > 0 ? `${formatNumber(teachers.length)} مدرس` : "لا يوجد مدرسون"}
        />
        <StatCard
          label="إجمالي المخالفات"
          value={formatNumber(totalBreaches)}
          icon={ShieldAlert}
          tone={totalBreaches > 0 ? "destructive" : "success"}
          trend={totalBreaches > 0 ? "مُسجَّلة في بيانات المدرسين" : "لا توجد مخالفات"}
        />
        <StatCard
          label="حصص مكتملة المراحل"
          value={formatNumber(sessionRecords.length)}
          icon={CheckCircle2}
          tone={sessionRecords.length > 0 ? "success" : "primary"}
          trend={
            sessionRecords.length > 0
              ? "من سجل الحصص الفعلي"
              : "لا توجد حصص مُسجَّلة بعد"
          }
        />
        <StatCard
          label="إجمالي تمديد التايمر"
          value={totalExt > 0 ? `${formatNumber(extMin)} د` : "0 د"}
          icon={Clock}
          tone={totalExt > 0 ? "warning" : "primary"}
          trend={
            avgLateSeconds > 0
              ? `متوسط تأخير البدء: ${avgLateMin}:${String(avgLateSec).padStart(2, "0")}`
              : "لم يُسجَّل تأخير في البدء"
          }
        />
        <StatCard
          label="محاولات تحتاج تصحيح"
          value={formatNumber(totalPendingCorrections)}
          icon={ClipboardList}
          tone={totalPendingCorrections > 0 ? "warning" : "success"}
          trend={
            totalPendingCorrections > 0
              ? "تراكمت من آخر 24 ساعة"
              : "كل المدرسين خلّصوا"
          }
        />
        <StatCard
          label="متوسط درجة السلوك"
          value={avgBehavior === null ? "—" : formatPercent(avgBehavior)}
          icon={ShieldAlert}
          tone={avgBehavior === null ? "primary" : avgBehavior >= 70 ? "success" : "warning"}
          trend={avgBehavior === null ? "لم يُقيَّم بعد" : "لكل طلاب المدرسين"}
        />
      </div>

      <Panel
        title="بطاقات المدرسين"
        description="كل بطاقة: 3 مؤشرات تراكمية (الموسم) + 3 مؤشرات أسبوعية من أفعاله الفعلية"
      >
        {teachers.length === 0 ? (
          <p className="rounded-xl border-2 border-dashed border-border p-6 text-center text-base font-bold text-muted-foreground">
            لا يوجد مدرسون مُسجَّلون بعد.
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sortedTeachers.map((t, i) => (
              <TeacherComplianceCard
                key={t.id}
                teacher={t}
                rank={i + 1}
                weekly={buildTeacherWeeklyMetrics(state, t.id)}
                season={buildTeacherSeasonMetrics(state, t.id)}
              />
            ))}
          </div>
        )}
      </Panel>

      <p className="rounded-xl border-2 border-info/30 bg-info/5 p-4 text-sm font-bold text-foreground">
        📊 المؤشرات الأسبوعية تُحسب من الأفعال الفعلية: `recordAssessmentScore` (لإطلاق الواجبات)،
        `homeworkTasks` (لمتابعة الواجبات)، `recordRandomPick` + `addTeacherNote` (للتفاعل).
        كلما زاد استخدام المدرس لوضع الحصة، كلما ظهرت أرقامه الأسبوعية في لوحة المالك.
      </p>
    </AppShell>
  );
}

void WEEKDAYS;
