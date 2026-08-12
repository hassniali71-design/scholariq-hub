import { useDataStore } from "@/lib/data-store";
import type { Teacher } from "@/types";

/**
 * The teacher the active session belongs to.
 *
 * Phase 1 default (TEACHER_MODULE_SPEC.md §15 decision #7): `Teacher.user_id`
 * exists in the schema but no account↔teacher linking has been built yet, so
 * this always resolves to the center's first teacher — same placeholder the
 * page already relied on before this hook existed. Swap the body for a
 * session-based lookup (mirroring `useCurrentStudent`) once that linking work
 * is scheduled.
 */
export function useCurrentTeacher(): Teacher {
  const { teachers } = useDataStore();
  return teachers[0]!;
}
