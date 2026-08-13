import { StatusBadge } from "@/components/dashboard/StatCard";
import type { Lesson } from "@/types";

const aiStatusMeta: Record<
  Lesson["ai_status"],
  { text: string; tone: "success" | "warning" | "destructive" | "neutral" }
> = {
  idle: { text: "لم يُرفع بعد", tone: "neutral" },
  processing: { text: "جارٍ المعالجة", tone: "warning" },
  ready: { text: "جاهز", tone: "success" },
  failed: { text: "فشلت المعالجة", tone: "destructive" },
};

/** The actual uploaded `Lesson` behind a planned `CurriculumLesson`, once linked (§9-ب). */
export function LessonLinkCard({ lesson }: { lesson: Lesson }) {
  const meta = aiStatusMeta[lesson.ai_status];
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-muted px-3 py-2 text-xs font-bold">
      <span className="truncate text-foreground">{lesson.title}</span>
      <StatusBadge tone={meta.tone}>{meta.text}</StatusBadge>
      {lesson.source_file_name ? (
        <span className="text-muted-foreground">{lesson.source_file_name}</span>
      ) : null}
    </div>
  );
}
