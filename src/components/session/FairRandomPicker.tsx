import type { RandomPickLog, Student } from "@/types";

/**
 * Weighted-random picker for the random-question activity (spec §7-هـ).
 * Logic only, no UI — matches the file's role in the module's file plan.
 *
 * weight = 1/(timesPickedTotal + 1) + recencyBonus
 *   - fewer total picks → higher weight
 *   - `log` is newest-first (recordRandomPick prepends), so a student's most
 *     recent pick's position in the array is a "turns since last picked"
 *     proxy — simpler and more meaningful for a single class period than
 *     wall-clock time, and avoids parsing the log's display-formatted
 *     `picked_at` strings.
 */
export function pickFairly(
  students: Student[],
  log: RandomPickLog[],
  sessionId: string,
  attendedStudentIds: Set<string>,
): Student | null {
  const alreadyPickedThisSession = new Set(
    log.filter((l) => l.session_id === sessionId).map((l) => l.student_id),
  );
  const eligible = students.filter(
    (s) => attendedStudentIds.has(s.id) && !alreadyPickedThisSession.has(s.id),
  );
  if (eligible.length === 0) return null;

  const weighted = eligible.map((student) => {
    const timesPickedTotal = log.filter((l) => l.student_id === student.id).length;
    const mostRecentIndex = log.findIndex((l) => l.student_id === student.id);
    const recencyBonus = mostRecentIndex === -1 ? 1 : Math.min(mostRecentIndex / 20, 1);
    return { student, weight: 1 / (timesPickedTotal + 1) + recencyBonus };
  });

  const totalWeight = weighted.reduce((sum, w) => sum + w.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const w of weighted) {
    roll -= w.weight;
    if (roll <= 0) return w.student;
  }
  return weighted[weighted.length - 1]!.student;
}
