import { useState, useEffect, useRef } from 'react';

/**
 * Hook that counts down from a server-issued deadline timestamp.
 * Uses server time as authority, not local Date.now().
 * Updates every second.
 */
export function useCountdown(deadline: string | null): {
  remainingMs: number;
  remainingSeconds: number;
  isExpired: boolean;
} {
  const [remainingMs, setRemainingMs] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => {
    if (!deadline) {
      setRemainingMs(0);
      return;
    }

    const deadlineTime = new Date(deadline).getTime();

    const update = () => {
      const now = Date.now();
      const remaining = Math.max(0, deadlineTime - now);
      setRemainingMs(remaining);
    };

    // Initial update
    update();

    // Update every second
    intervalRef.current = setInterval(update, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [deadline]);

  return {
    remainingMs,
    remainingSeconds: Math.ceil(remainingMs / 1000),
    isExpired: deadline !== null && remainingMs === 0,
  };
}
