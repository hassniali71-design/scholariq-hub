import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CheckCircle2, Clock, TrendingDown, TrendingUp, XCircle } from "lucide-react";

import { Panel, StatCard, StatusBadge } from "@/components/dashboard/StatCard";
import { AppShell } from "@/components/layout/AppShell";
import { BEHAVIOR_LEVELS } from "@/components/session/SessionSteps";
import { StudentClassificationCard } from "@/components/teacher/StudentClassificationCard";
import { useCurrentTeacher } from "@/hooks/use-current-teacher";
import { formatNumber, formatPercent } from "@/lib/format";
import {
  classifyStudent,
  classificationReason,
  getAssessmentScore,
  getAttendanceForSession,
  getGroupsForTeacher,
  getSessionRecordsForGroup,
  getStudentsForGroup,
  useDataStore,
  type DataState,
} from "@/lib/data-store";
import { cn } from "@/lib/utils";
import type { AttendanceStatus, Group } from "@/types";

export const Route = createFileRoute("/teacher/assessments")({
  head: () => ({
    meta: [
      { title: "التقييمات والغياب — المدرس" },
      {
        name: "description",
        content: "تقرير عام للحضور والواجب والأنشطة والسلوك — قراءة فقط.",
      },
      { property: "og:title", content: "التقييمات والغياب — المدرس" },
      { property: "og:description", content: "تقرير شامل قراءة فقط لأداء كل الطلاب." },
    ],
  }),
  component: AssessmentsPage,
});

const ALL = "all" as const;

function AssessmentsPage() {
  const state = useDataStore();
  const teacher = useCurrentTeacher();
  const myGroups = getGroupsForTeacher(state, teacher.id);
  const grades = useMemo(
    () => Array.from(new Set(myGroups.map((g) => g.grade))),
    [myGroups],
  );

  const [gradeFilter, setGradeFilter] = useState<string | typeof ALL>(ALL);
  const [groupFilter, setGroupFilter] = useState<string | typeof ALL>(ALL);

  const gradeGroups = gradeFilter === ALL ? myGroups : myGroups.filter((g) => g.grade === gradeFilter);
  const visibleGroups = groupFilter === ALL ? gradeGroups : gradeGroups.filter((g) => g.id === groupFilter);
  const visibleStudents = useMemo(
    () => visibleGroups.flatMap((g) => getStudentsForGroup(state, g.id)),
    [visibleGroups, state.students],
  );

  const scoreOf = (studentId: string, category: "homework" | "activity" | "behavior") =>
    getAssessmentScore(state, studentId, category);

  const excellent = visibleStudents.filter((s) => classifyStudent(s) === "excellent");
  const needsAttention = visibleStudents.filter((s) => classifyStudent(s) === "needs_attention");

  return (
    <AppShell
      role="teacher"
      title="التقييمات والغياب"
      description="تقرير عام قراءة فقط — للتسجيل والتعديل بأثر رجعي افتح الدرس المطلوب من وضع الحصة"
    >
      <Panel title="فلترة التقرير" description="حسب المرحلة والمجموعة">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <FilterPill active={gradeFilter === ALL} onClick={() => { setGradeFilter(ALL); setGroupFilter(ALL); }}>
              كل المراحل
            </FilterPill>
            {grades.map((grade) => (
              <FilterPill
                key={grade}
                active={gradeFilter === grade}
                onClick={() => { setGradeFilter(grade); setGroupFilter(ALL); }}
              >
                {grade}
              </FilterPill>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <FilterPill active={groupFilter === ALL} onClick={() => setGroupFilter(ALL)}>
              كل المجموعات
            </FilterPill>
            {gradeGroups.map((g) => (
              <FilterPill key={g.id} active={groupFilter === g.id} onClick={() => setGroupFilter(g.id)}>
                {g.name}
              </FilterPill>
            ))}
          </div>
        </div>
      </Panel>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="عدد الطلاب" value={formatNumber(visibleStudents.length)} icon={CheckCircle2} />
        <StatCard
          label="الطلاب المتفوقون"
          value={formatNumber(excellent.length)}
          icon={TrendingUp}
          tone="success"
        />
        <StatCard
          label="يحتاجون تحسين"
          value={formatNumber(needsAttention.length)}
          icon={TrendingDown}
          tone="warning"
        />
      </div>

      <Panel title="سجل الحضور" description="آخر الحصص المسجَّلة لكل مجموعة — قراءة فقط">
        <AttendanceGrid state={state} groups={visibleGroups} />
      </Panel>

      <Panel title="عرض عام للطلاب" description="نظرة شاملة على كل مؤشرات كل طالب">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-right text-sm">
            <thead>
              <tr className="border-b-2 border-border text-muted-foreground">
                <th className="pb-3">الطالب</th>
                <th className="pb-3">الحضور</th>
                <th className="pb-3">المتوسط</th>
                <th className="pb-3">الواجب</th>
                <th className="pb-3">الأنشطة</th>
                <th className="pb-3">السلوك</th>
                <th className="pb-3">المستوى</th>
              </tr>
            </thead>
            <tbody>
              {visibleStudents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center font-black text-muted-foreground">
                    لا يوجد طلاب ضمن هذا الفلتر
                  </td>
                </tr>
              ) : (
                visibleStudents.map((s) => {
                  const classification = classifyStudent(s);
                  const homework = scoreOf(s.id, "homework");
                  const activity = scoreOf(s.id, "activity");
                  const behavior = scoreOf(s.id, "behavior");
                  return (
                    <tr key={s.id} className="border-b border-border last:border-0">
                      <td className="py-3 font-black text-foreground">{s.full_name}</td>
                      <td className="py-3 font-extrabold">{formatPercent(s.attendance_rate)}</td>
                      <td className="py-3 font-black text-primary">{formatNumber(s.avg_score)}</td>
                      <td className="py-3 font-bold text-muted-foreground">
                        {homework ? `${formatNumber(homework.value)}/${formatNumber(homework.max_value)}` : "—"}
                      </td>
                      <td className="py-3 font-bold text-muted-foreground">
                        {activity ? `${formatNumber(activity.value)}/${formatNumber(activity.max_value)}` : "—"}
                      </td>
                      <td className="py-3 font-bold text-muted-foreground">
                        {behavior
                          ? (BEHAVIOR_LEVELS.find((l) => l.value === behavior.value)?.label ?? "—")
                          : "—"}
                      </td>
                      <td className="py-3">
                        <StatusBadge
                          tone={
                            classification === "excellent"
                              ? "success"
                              : classification === "needs_attention"
                                ? "destructive"
                                : "warning"
                          }
                        >
                          {classification === "excellent"
                            ? "ممتاز"
                            : classification === "needs_attention"
                              ? "يحتاج متابعة"
                              : "متوسط"}
                        </StatusBadge>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="أعلى الطلاب أداءً" description="الأعلى متوسطاً والتزاماً بالحضور">
          <div className="grid gap-3">
            {excellent.map((s) => (
              <StudentClassificationCard key={s.id} student={s} classification="excellent" />
            ))}
            {excellent.length === 0 ? (
              <p className="py-6 text-center font-black text-muted-foreground">
                لا يوجد طلاب في هذا التصنيف حالياً
              </p>
            ) : null}
          </div>
        </Panel>

        <Panel title="يحتاجون تحسين" description="حسب التصنيف الثلاثي مع سبب مولَّد">
          <div className="grid gap-3">
            {needsAttention.map((s) => (
              <StudentClassificationCard
                key={s.id}
                student={s}
                classification="needs_attention"
                reason={classificationReason(s)}
              />
            ))}
            {needsAttention.length === 0 ? (
              <p className="py-6 text-center font-black text-muted-foreground">
                لا يوجد طلاب في هذا التصنيف حالياً
              </p>
            ) : null}
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}

function FilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl border-2 px-3 py-2 text-xs font-black transition-colors",
        active
          ? "border-navy bg-navy text-navy-foreground"
          : "border-border bg-background text-foreground hover:border-primary",
      )}
    >
      {children}
    </button>
  );
}

const attendanceIcon: Record<AttendanceStatus, typeof CheckCircle2> = {
  present: CheckCircle2,
  late: Clock,
  absent: XCircle,
};

const ATTENDANCE_TEXT: Record<AttendanceStatus, string> = {
  present: "حاضر",
  late: "متأخر",
  absent: "غائب",
};

const ATTENDANCE_TONE: Record<AttendanceStatus, "success" | "warning" | "destructive"> = {
  present: "success",
  late: "warning",
  absent: "destructive",
};

const MAX_SESSIONS_SHOWN = 8;

/**
 * §13-هـ: pure report now — retroactive correction happens by reopening the
 * lesson in session mode's review panel, not by clicking cells here (that
 * separate editable grid was retired per the spec's final decision).
 */
function AttendanceGrid({ state, groups }: { state: DataState; groups: Group[] }) {
  if (groups.length === 0) {
    return (
      <p className="py-8 text-center font-black text-muted-foreground">
        لا توجد مجموعات ضمن هذا الفلتر
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map((g) => {
        const sessions = getSessionRecordsForGroup(state, g.id).slice(0, MAX_SESSIONS_SHOWN);
        const groupStudents = getStudentsForGroup(state, g.id);
        return (
          <div key={g.id}>
            <p className="mb-3 font-black text-foreground">{g.name}</p>
            {sessions.length === 0 || groupStudents.length === 0 ? (
              <p className="rounded-xl border-2 border-dashed border-border p-6 text-center text-sm font-bold text-muted-foreground">
                لا توجد حصص مسجّلة بعد لهذه المجموعة — تظهر هنا أول ما تُنهي حصة من وضع الحصة
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] text-right text-sm">
                  <thead>
                    <tr className="border-b-2 border-border text-muted-foreground">
                      <th className="pb-2">الطالب</th>
                      {sessions.map((s) => (
                        <th key={s.id} className="px-1 pb-2 text-center text-xs">
                          {s.date}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {groupStudents.map((st) => (
                      <tr key={st.id} className="border-b border-border last:border-0">
                        <td className="py-2 font-black text-foreground">{st.full_name}</td>
                        {sessions.map((s) => {
                          const record = getAttendanceForSession(state, st.id, s.id);
                          const Icon = record ? attendanceIcon[record.status] : null;
                          return (
                            <td key={s.id} className="py-2 text-center">
                              <span
                                title={record ? ATTENDANCE_TEXT[record.status] : "لم يُسجَّل"}
                                className={cn(
                                  "mx-auto flex size-9 items-center justify-center rounded-lg border-2",
                                  record
                                    ? ATTENDANCE_TONE[record.status] === "success"
                                      ? "border-success bg-success/10 text-success"
                                      : ATTENDANCE_TONE[record.status] === "warning"
                                        ? "border-warning bg-warning/10 text-warning"
                                        : "border-destructive bg-destructive/10 text-destructive"
                                    : "border-dashed border-border text-muted-foreground",
                                )}
                              >
                                {Icon ? <Icon className="size-4" /> : "—"}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
