import { useSyncExternalStore } from "react";

import { getSession, subscribeAuth, type Session } from "@/lib/auth";
import { resolveCurrentStudent, useDataStore } from "@/lib/data-store";
import type { Student } from "@/types";

function getServerSession(): Session | null {
  return null;
}

export function useSession(): Session | null {
  return useSyncExternalStore(subscribeAuth, getSession, getServerSession);
}

/**
 * The student the active session is about.
 * Students authenticate with their own code, parents with their child's code,
 * so the same lookup serves both portals.
 */
export function useCurrentStudent(): Student {
  const data = useDataStore();
  const session = useSession();
  return resolveCurrentStudent(data, session?.identifier);
}
