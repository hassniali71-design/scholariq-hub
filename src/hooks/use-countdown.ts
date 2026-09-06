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
      setRemaining((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  // استدعاء onComplete هنا في useEffect منفصل، مش جوه دالة تحديث setRemaining نفسها —
  // React بيفترض إن دوال تحديث الحالة نقية (pure) بدون آثار جانبية، واستدعاء دالة
  // خارجية من جواها ممكن يتنفذ مرتين تحت React Strict Mode (وضع التطوير).
  useEffect(() => {
    if (running && remaining === 0) {
      setRunning(false);
      completeRef.current?.();
    }
  }, [running, remaining]);

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
