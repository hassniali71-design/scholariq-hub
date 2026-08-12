import { StatusBadge } from "@/components/dashboard/StatCard";
import { TeacherNoteInput } from "@/components/teacher/TeacherNoteInput";
import { formatNumber, formatPercent } from "@/lib/format";
import type { StudentClassification } from "@/lib/data-store";
import type { Student } from "@/types";

const classificationMeta: Record<
  StudentClassification,
  { text: string; tone: "success" | "warning" | "destructive" }
> = {
  excellent: { text: "ممتاز", tone: "success" },
  average: { text: "متوسط", tone: "warning" },
  needs_attention: { text: "يحتاج متابعة", tone: "destructive" },
};

interface StudentClassificationCardProps {
  student: Student;
  classification: StudentClassification;
  /** Shown only when provided — used by the "طلاب يحتاجون متابعة" panel. */
  reason?: string;
  /** Shown only when provided — persists a quick note via `addTeacherNote`. */
  onAddNote?: (note: string) => void;
}

export function StudentClassificationCard({
  student,
  classification,
  reason,
  onAddNote,
}: StudentClassificationCardProps) {
  const meta = classificationMeta[classification];

  return (
    <div className="rounded-xl border-2 border-border p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="font-black text-foreground">{student.full_name}</p>
        <StatusBadge tone={meta.tone}>{meta.text}</StatusBadge>
      </div>
      <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold text-muted-foreground">
        <span>حضور {formatPercent(student.attendance_rate)}</span>
        <span>· متوسط {formatNumber(student.avg_score)}</span>
      </div>
      {reason ? <p className="mt-2 text-xs font-extrabold text-destructive">{reason}</p> : null}
      {onAddNote ? <TeacherNoteInput onSubmit={onAddNote} /> : null}
    </div>
  );
}
