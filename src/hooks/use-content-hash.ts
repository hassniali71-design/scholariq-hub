import { useCallback, useState } from "react";

/**
 * SHA-256 of a file's bytes (Web Crypto — no new dependency).
 * Used to skip re-running the AI pipeline on a file that was already
 * processed (TEACHER_MODULE_SPEC.md §7-د step 2-3 / §10).
 */
export function useContentHash() {
  const [hashing, setHashing] = useState(false);

  const computeHash = useCallback(async (file: File): Promise<string> => {
    setHashing(true);
    try {
      const buffer = await file.arrayBuffer();
      const digest = await crypto.subtle.digest("SHA-256", buffer);
      return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    } finally {
      setHashing(false);
    }
  }, []);

  return { computeHash, hashing };
}
