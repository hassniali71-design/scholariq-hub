import { useSession } from "@/hooks/use-current-student";
import { resolveCurrentTeacher, useDataStore } from "@/lib/data-store";
import type { Teacher } from "@/types";

/**
 * The teacher the active session belongs to.
 *
 * Real fix for TEACHER_MODULE_SPEC.md §15 decision #7's Phase 1 placeholder
 * (was `teachers[0]!` unconditionally — every teacher account saw the same
 * teacher's data, confirmed by a real multi-account browser trial). Mirrors
 * `useCurrentStudent`'s session→entity resolution exactly.
 */
export function useCurrentTeacher(): Teacher {
  const data = useDataStore();
  const session = useSession();
  return resolveCurrentTeacher(data, session?.identifier);
}
