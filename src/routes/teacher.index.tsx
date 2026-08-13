import { Link, createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  Award,
  CalendarDays,
  CheckCircle2,
  Layers,
  MonitorPlay,
  Timer,
  UserX,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Panel, StatCard, StatusBadge } from "@/components/dashboard/StatCard";
import { AppShell } from "@/components/layout/AppShell";
import { StudentClassificationCard } from "@/components/teacher/StudentClassificationCard";
import { SubjectRoomHeader } from "@/components/teacher/SubjectRoomHeader";
import { useCurrentTeacher } from "@/hooks/use-current-teacher";
import {
  addTeacherNote,
  classifyStudent,
  classificationReason,
  getGroupsForTeacher,
  getStudentsForTeacher,
  getTimerCompliance,
  useDataStore,
} from "@/lib/data-store";
import { formatNumber, formatPercent } from "@/lib/format";
import { getSubjectTheme } from "@/lib/subject-themes";

export const Route = createFileRoute("/teacher/")({
  head: () => ({
    meta: [
      { title: "لوحة المدرس — مركز قيادة الحصص" },
      {
        name: "description",
        content: "مجموعات المدرس ومواعيد الحصص ونسبة الالتزام بالتايمر وبدء وضع الحصة.",
      },
      { property: "og:title", content: "لوحة المدرس — مركز قيادة الحصص" },
      {
        property: "og:description",
        content: "إدارة المجموعات والحصص وبدء وضع العرض التفاعلي بالتايمرات.",
      },
    ],
  }),
  component: TeacherHome,
});

function TeacherHome() {
  const state = useDataStore();
  const { attendanceRecords, subjects } = state;
  const teacher = useCurrentTeacher();
  const myGroups = getGroupsForTeacher(state, teacher.id);
  const myStudents = getStudentsForTeacher(state, teacher.id);
  const subject = subjects.find((s) => s.id === teacher.subject_id);
  const subjectName = subject?.name ?? teacher.subject;
  const theme = getSubjectTheme(subject?.theme_key);
  const timerCompliance = getTimerCompliance(state, teacher.id);

  const myGroupNames = new Set(myGroups.map((g) => g.name));
  const absentLastSession = attendanceRecords.filter(
    (a) => myGroupNames.has(a.group_name) && a.status === "absent",
  ).length;
  const committed = myStudents.filter((s) => s.attendance_rate >= 90).length;
  const excellent = myStudents.filter((s) => classifyStudent(s) === "excellent").length;
  const needsAttention = myStudents.filter((s) => classifyStudent(s) === "needs_attention");

  const handleAddNote = (studentId: string, note: string) => {
    addTeacherNote(studentId, teacher.id, note);
    toast.success("تم حفظ الملاحظة");
  };

  return (
    <AppShell
      role="teacher"
      title={teacher.full_name}
      description={subjectName}
      actions={
        <Link
          to="/teacher/session"
          className="flex items-center gap-2 rounded-xl bg-navy px-5 py-3 text-sm font-black text-navy-foreground transition-opacity hover:opacity-90"
        >
          <MonitorPlay className="size-5" /> بدء وضع الحصة
        </Link>
      }
    >
      <SubjectRoomHeader
        teacherName={teacher.full_name}
        subjectName={subjectName}
        themeKey={subject?.theme_key}
        theme={theme}
        groupsCount={myGroups.length}
        studentsCount={myStudents.length}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="عدد الطلاب" value={formatNumber(myStudents.length)} icon={Users} />
        <StatCard
          label="الالتزام بالتايمر"
          value={formatPercent(timerCompliance)}
          icon={Timer}
          tone={timerCompliance >= 90 ? "success" : "warning"}
        />
        <StatCard
          label="حصص هذا الأسبوع"
          value={formatNumber(myGroups.length)}
          icon={CalendarDays}
        />
        <StatCard label="المجموعات" value={formatNumber(myGroups.length)} icon={Layers} />
        <StatCard
          label="الطلاب الملتزمون"
          value={formatNumber(committed)}
          icon={CheckCircle2}
          tone="success"
        />
        <StatCard
          label="الطلاب الغائبون (آخر حصة)"
          value={formatNumber(absentLastSession)}
          icon={UserX}
          tone="destructive"
        />
        <StatCard
          label="الطلاب المتفوقون"
          value={formatNumber(excellent)}
          icon={Award}
          tone="success"
        />
        <StatCard
          label="يحتاجون متابعة"
          value={formatNumber(needsAttention.length)}
          icon={AlertTriangle}
          tone="warning"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="جدول مجموعاتي" description="المواعيد والقاعات">
          <div className="space-y-3">
            {myGroups.map((g) => (
              <div
                key={g.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-border p-4"
              >
                <div>
                  <p className="font-black text-foreground">{g.name}</p>
                  <p className="text-xs font-bold text-muted-foreground">
                    {g.grade} · {g.room} · {formatNumber(g.enrolled)} طالب
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge tone="primary">
                    {g.weekday} {g.time}
                  </StatusBadge>
                  <Link
                    to="/teacher/session"
                    className="rounded-xl border-2 border-navy px-3 py-2 text-xs font-black text-navy hover:bg-navy hover:text-navy-foreground"
                  >
                    ابدأ
                  </Link>
                </div>
              </div>
            ))}
            {myGroups.length === 0 ? (
              <p className="py-6 text-center font-black text-muted-foreground">
                لا توجد مجموعات مرتبطة بك بعد
              </p>
            ) : null}
          </div>
        </Panel>

        <Panel title={`مستوى الطلاب في ${subjectName}`} description="المتوسط والتصنيف لكل طالب">
          <div className="grid gap-4">
            {myStudents
              .slice()
              .sort((a, b) => b.avg_score - a.avg_score)
              .map((s) => (
                <StudentClassificationCard key={s.id} student={s} classification={classifyStudent(s)} />
              ))}
            {myStudents.length === 0 ? (
              <p className="py-6 text-center font-black text-muted-foreground">
                لا يوجد طلاب مرتبطون بك بعد
              </p>
            ) : null}
          </div>
        </Panel>
      </div>

      <Panel
        title="طلاب يحتاجون متابعة"
        description="حسب التصنيف: متوسط أقل من ٦٠ أو حضور أقل من ٧٥٪"
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {needsAttention.map((s) => (
            <StudentClassificationCard
              key={s.id}
              student={s}
              classification="needs_attention"
              reason={classificationReason(s)}
              onAddNote={(note) => handleAddNote(s.id, note)}
            />
          ))}
          {needsAttention.length === 0 ? (
            <p className="col-span-full py-6 text-center font-black text-muted-foreground">
              لا يوجد طلاب في هذا التصنيف حالياً
            </p>
          ) : null}
        </div>
      </Panel>
    </AppShell>
  );
}
