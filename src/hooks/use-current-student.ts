import { useSyncExternalStore } from "react";

import { getSession, subscribeAuth, type Session } from "@/lib/auth";
import { resolveCurrentStudent, useDataStore } from "@/lib/data-store";
import type { Student } from "@/types";

/**
 * `getSession()` parses JSON on every call, which would break the
 * referential stability `useSyncExternalStore` requires. Cache the parsed
 * value and only refresh it when the serialized session actually changes.
 */
let cachedKey: string | null = null;
let cachedSession: Session | null = null;

function getSessionSnapshot(): Session | null {
  const next = getSession();
  const key = next ? JSON.stringify(next) : null;
  if (key !== cachedKey) {
    cachedKey = key;
    cachedSession = next;
  }
  return cachedSession;
}

function getServerSession(): Session | null {
  return null;
}

export function useSession(): Session | null {
  return useSyncExternalStore(subscribeAuth, getSessionSnapshot, getServerSession);
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
