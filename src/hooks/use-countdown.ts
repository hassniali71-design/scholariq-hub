import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Countdown timer used by the in-class session engine.
 * Returns remaining seconds plus explicit controls (no auto-start).
 */
export function useCountdown(initialSeconds: number, onComplete?: () => void) {
  const [remaining, setRemaining] = useState(initialSeconds);
  const [running, setRunning] = useState(false);
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;

  useEffect(() => {
    setRemaining(initialSeconds);
    setRunning(false);
  }, [initialSeconds]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(id);
          setRunning(false);
          completeRef.current?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  const start = useCallback(() => setRunning(true), []);
  const pause = useCallback(() => setRunning(false), []);
  const reset = useCallback(
    (seconds?: number) => {
      setRunning(false);
      setRemaining(seconds ?? initialSeconds);
    },
    [initialSeconds],
  );

  const progress = initialSeconds > 0 ? 1 - remaining / initialSeconds : 0;

  return { remaining, running, progress, start, pause, reset, setRemaining };
}
