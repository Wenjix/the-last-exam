import type { MatchPhase } from '../fsm/types.js';

/** Phase duration constants in milliseconds */
export const PHASE_DURATIONS_MS: Record<string, number> = {
  briefing: 5_000,
  bidding: 5_000,
  strategy: 10_000,
  execution: 30_000,
  scoring: 5_000,
  final_standings: 0,
};

/** Calculate absolute deadline timestamp from phase start */
export function calculateDeadline(phase: MatchPhase, startTime: Date): Date | null {
  const duration = PHASE_DURATIONS_MS[phase];
  if (!duration || duration === 0) return null;
  return new Date(startTime.getTime() + duration);
}

/** Calculate remaining time in ms from deadline */
export function remainingMs(deadline: Date | null, now: Date = new Date()): number {
  if (!deadline) return 0;
  return Math.max(0, deadline.getTime() - now.getTime());
}

/** Check if a phase deadline has expired */
export function isDeadlineExpired(deadline: Date | null, now: Date = new Date()): boolean {
  if (!deadline) return true; // No deadline = instant phase
  return now.getTime() >= deadline.getTime();
}

/** Get the expected duration for a full round in ms */
export function fullRoundDurationMs(): number {
  return (
    PHASE_DURATIONS_MS.briefing +
    PHASE_DURATIONS_MS.bidding +
    PHASE_DURATIONS_MS.strategy +
    PHASE_DURATIONS_MS.execution +
    PHASE_DURATIONS_MS.scoring
  );
}
