import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, Clock, Frown, Meh, Smile, TrendingDown, TrendingUp, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Panel, StatCard, StatusBadge } from "@/components/dashboard/StatCard";
import { AppShell } from "@/components/layout/AppShell";
import { StudentClassificationCard } from "@/components/teacher/StudentClassificationCard";
import { useCurrentTeacher } from "@/hooks/use-current-teacher";
import { formatNumber, formatPercent } from "@/lib/format";
import {
  classifyStudent,
  classificationReason,
  getAssessmentScore,
  getStudentsForTeacher,
  recordAssessmentScore,
  recordAttendance,
  useDataStore,
} from "@/lib/data-store";
import { cn } from "@/lib/utils";
import type { AssessmentScore, AttendanceStatus } from "@/types";

export const Route = createFileRoute("/teacher/assessments")({
  head: () => ({
    meta: [
      { title: "التقييمات والغياب — المدرس" },
      {
        name: "description",
        content: "إدارة الحضور والواجبات والأنشطة والسلوك بأثر رجعي لكل طالب.",
      },
      { property: "og:title", content: "التقييمات والغياب — المدرس" },
      {
        property: "og:description",
        content: "إدارة كاملة للحضور وتقييم الواجب والأنشطة والسلوك.",
      },
    ],
  }),
  component: AssessmentsPage,
});

type Tab = "attendance" | "homework" | "activity" | "behavior";

const TABS: { key: Tab; label: string }[] = [
  { key: "attendance", label: "الحضور والغياب" },
  { key: "homework", label: "تقييم الواجب المنزلي" },
  { key: "activity", label: "تقييم المهام والأنشطة" },
  { key: "behavior", label: "السلوك" },
];

const attendanceMeta: Record<
  AttendanceStatus,
  { text: string; tone: "success" | "warning" | "destructive"; icon: typeof CheckCircle2 }
> = {
  present: { text: "حاضر", tone: "success", icon: CheckCircle2 },
  late: { text: "متأخر", tone: "warning", icon: Clock },
  absent: { text: "غائب", tone: "destructive", icon: XCircle },
};

const behaviorLevels = [
  { value: 0, label: "يحتاج انتباه", icon: Frown, tone: "destructive" as const },
  { value: 5, label: "محايد", icon: Meh, tone: "warning" as const },
  { value: 10, label: "إيجابي", icon: Smile, tone: "success" as const },
];

function AssessmentsPage() {
  const state = useDataStore();
  const teacher = useCurrentTeacher();
  const myStudents = getStudentsForTeacher(state, teacher.id);
  const [tab, setTab] = useState<Tab>("attendance");

  const latestAttendance = (studentId: string): AttendanceStatus | null =>
    state.attendanceRecords.find((a) => a.student_id === studentId)?.status ?? null;

  const scoreOf = (studentId: string, category: AssessmentScore["category"]) =>
    getAssessmentScore(state, studentId, category);

  const setAttendance = (studentId: string, status: AttendanceStatus) => {
    recordAttendance(studentId, status, "manual");
    toast.success("تم تحديث الحضور");
  };

  const setScore = (
    studentId: string,
    category: AssessmentScore["category"],
    value: number,
    maxValue: number,
  ) => {
    recordAssessmentScore({
      studentId,
      teacherId: teacher.id,
      category,
      source: "manual",
      value,
      maxValue,
    });
    toast.success("تم حفظ الدرجة");
  };

  const excellent = myStudents.filter((s) => classifyStudent(s) === "excellent");
  const needsAttention = myStudents.filter((s) => classifyStudent(s) === "needs_attention");

  return (
    <AppShell
      role="teacher"
      title="التقييمات والغياب"
      description="الحضور، تقييم الواجب، الأنشطة، والسلوك — إدارة بأثر رجعي"
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="عدد الطلاب" value={formatNumber(myStudents.length)} icon={CheckCircle2} />
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

      <Panel
        title="أدوات التقييم"
        description="اختر أداة، وأي تعديل هنا يُحفظ فوراً ويظل قابلاً للتصحيح بأثر رجعي"
        actions={
          <div className="flex flex-wrap gap-2">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={
                  tab === t.key
                    ? "rounded-xl border-2 border-navy bg-navy px-3 py-2 text-xs font-black text-navy-foreground"
                    : "rounded-xl border-2 border-border bg-background px-3 py-2 text-xs font-black text-foreground hover:border-primary"
                }
              >
                {t.label}
              </button>
            ))}
          </div>
        }
      >
        {myStudents.length === 0 ? (
          <p className="py-8 text-center font-black text-muted-foreground">
            لا يوجد طلاب مرتبطون بك بعد
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {myStudents.map((s) => (
              <div key={s.id} className="rounded-xl border-2 border-border p-4">
                <p className="font-black text-foreground">{s.full_name}</p>

                {tab === "attendance" ? (
                  <div className="mt-3 flex gap-1.5">
                    {(Object.keys(attendanceMeta) as AttendanceStatus[]).map((status) => {
                      const meta = attendanceMeta[status];
                      const active = latestAttendance(s.id) === status;
                      return (
                        <button
                          key={status}
                          type="button"
                          onClick={() => setAttendance(s.id, status)}
                          className={cn(
                            "flex flex-1 items-center justify-center gap-1.5 rounded-lg border-2 py-2 text-xs font-black transition-colors",
                            active
                              ? meta.tone === "success"
                                ? "border-success bg-success/10 text-success"
                                : meta.tone === "warning"
                                  ? "border-warning bg-warning/10 text-warning"
                                  : "border-destructive bg-destructive/10 text-destructive"
                              : "border-border hover:border-primary",
                          )}
                        >
                          <meta.icon className="size-3.5" />
                          {meta.text}
                        </button>
                      );
                    })}
                  </div>
                ) : null}

                {tab === "homework" || tab === "activity" ? (
                  <ScoreButtons
                    current={scoreOf(s.id, tab)}
                    onScore={(value) => setScore(s.id, tab, value, 10)}
                  />
                ) : null}

                {tab === "behavior" ? (
                  <div className="mt-3 flex gap-1.5">
                    {behaviorLevels.map((level) => {
                      const current = scoreOf(s.id, "behavior");
                      const active = current?.value === level.value;
                      return (
                        <button
                          key={level.value}
                          type="button"
                          onClick={() => setScore(s.id, "behavior", level.value, 10)}
                          className={cn(
                            "flex flex-1 flex-col items-center gap-1 rounded-lg border-2 py-2 text-xs font-black transition-colors",
                            active
                              ? level.tone === "success"
                                ? "border-success bg-success/10 text-success"
                                : level.tone === "warning"
                                  ? "border-warning bg-warning/10 text-warning"
                                  : "border-destructive bg-destructive/10 text-destructive"
                              : "border-border hover:border-primary",
                          )}
                        >
                          <level.icon className="size-4" />
                          {level.label}
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
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
              {myStudents.map((s) => {
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
                      {behavior ? behaviorLevels.find((l) => l.value === behavior.value)?.label ?? "—" : "—"}
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
              })}
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

function ScoreButtons({
  current,
  onScore,
}: {
  current: AssessmentScore | undefined;
  onScore: (value: number) => void;
}) {
  return (
    <div className="mt-3">
      {current ? (
        <p className="mb-2 text-xs font-bold text-muted-foreground">
          الدرجة الحالية: {formatNumber(current.value)} / {formatNumber(current.max_value)}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-1.5">
        {[0, 2, 4, 6, 8, 10].map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onScore(v)}
            className={cn(
              "size-9 rounded-lg border-2 text-sm font-black transition-colors",
              current?.value === v
                ? "border-navy bg-navy text-navy-foreground"
                : "border-border hover:border-primary",
            )}
          >
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}
