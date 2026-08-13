import { createFileRoute } from "@tanstack/react-router";

import { Panel } from "@/components/dashboard/StatCard";
import { UnitTree } from "@/components/curriculum/UnitTree";
import { AppShell } from "@/components/layout/AppShell";
import { useCurrentTeacher } from "@/hooks/use-current-teacher";
import {
  getCurriculumLessonsForUnit,
  getCurriculumUnitsForSubjectGrade,
  getGroupsForTeacher,
  useDataStore,
} from "@/lib/data-store";

export const Route = createFileRoute("/teacher/curriculum")({
  head: () => ({
    meta: [
      { title: "الخطة والمنهج — المدرس" },
      {
        name: "description",
        content: "متابعة تقدم المنهج ووحدات ودروس كل مادة، مرتبطة تلقائياً بما يُدرَّس فعلياً.",
      },
      { property: "og:title", content: "الخطة والمنهج — المدرس" },
      {
        property: "og:description",
        content: "خريطة المنهج ووحداته ونسبة الإنجاز، محدَّثة تلقائياً من وضع الحصة.",
      },
    ],
  }),
  component: CurriculumPage,
});

function CurriculumPage() {
  const state = useDataStore();
  const teacher = useCurrentTeacher();
  const myGroups = getGroupsForTeacher(state, teacher.id);
  const findLinkedLesson = (lessonId: string) => state.lessons.find((l) => l.id === lessonId);

  /** Unique subject+grade combos across the teacher's own groups — one Panel each. */
  const subjectGrades = new Map<string, { subjectId: string; gradeId: string }>();
  for (const g of myGroups) {
    subjectGrades.set(`${g.subject_id}:${g.grade_id}`, { subjectId: g.subject_id, gradeId: g.grade_id });
  }

  return (
    <AppShell
      role="teacher"
      title="الخطة والمنهج"
      description="ذاكرة تشغيل المنهج — تُحدَّث تلقائياً من أحداث وضع الحصة، بدون أي إدخال يدوي"
    >
      {subjectGrades.size === 0 ? (
        <Panel title="الخطة والمنهج">
          <p className="py-8 text-center font-black text-muted-foreground">
            لا توجد مجموعات مرتبطة بك بعد
          </p>
        </Panel>
      ) : (
        [...subjectGrades.values()].map(({ subjectId, gradeId }) => {
          const subjectName = state.subjects.find((s) => s.id === subjectId)?.name ?? "";
          const gradeName = state.grades.find((g) => g.id === gradeId)?.name ?? "";
          const units = getCurriculumUnitsForSubjectGrade(state, subjectId, gradeId);
          return (
            <Panel
              key={`${subjectId}:${gradeId}`}
              title={`${subjectName} — ${gradeName}`}
              description="تقدّم المنهج لكل وحدة، ورابط مباشر للدرس الفعلي بمجرد رفعه"
            >
              {units.length === 0 ? (
                <p className="py-6 text-center font-black text-muted-foreground">
                  لا توجد خطة منهج مضافة لهذه المادة بعد
                </p>
              ) : (
                <div className="grid gap-4">
                  {units.map((u) => (
                    <UnitTree
                      key={u.id}
                      unit={u}
                      lessons={getCurriculumLessonsForUnit(state, u.id)}
                      findLinkedLesson={findLinkedLesson}
                    />
                  ))}
                </div>
              )}
            </Panel>
          );
        })
      )}
    </AppShell>
  );
}
