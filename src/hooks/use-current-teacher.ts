import { useSession } from "@/hooks/use-current-student";
import { resolveCurrentTeacher, useDataStore } from "@/lib/data-store";
import type { Teacher } from "@/types";

/**
 * The teacher the active session belongs to, or `null` if no teacher
 * account is signed in (or the session's `user_id` doesn't match any
 * `Teacher.user_id`).
 *
 * Real fix for TEACHER_MODULE_SPEC.md §15 decision #7's Phase 1 placeholder
 * (was `teachers[0]!` unconditionally — every teacher account saw the same
 * teacher's data, confirmed by a real multi-account browser trial). Mirrors
 * `useCurrentStudent`'s session→entity resolution exactly.
 *
 * Breaking change vs the previous `Teacher` return: consumers MUST check
 * for `null` and either render a redirect to `/login` or a "loading"
 * placeholder. See `<TeacherGate>` for the canonical pattern.
 */
export function useCurrentTeacher(): Teacher | null {
  const data = useDataStore();
  const session = useSession();
  return resolveCurrentTeacher(data, session?.identifier);
}
