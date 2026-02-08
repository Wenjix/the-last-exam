import type { MatchPhase } from '../fsm/types.js';

/** Phase duration constants in milliseconds (from Architecture Decision #4) */
export const PHASE_DURATIONS_MS: Record<string, number> = {
  briefing: 10_000,
  hidden_bid: 30_000,
  bid_resolve: 5_000,
  equip: 30_000,
  run: 60_000,
  resolve: 15_000,
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
    PHASE_DURATIONS_MS.hidden_bid +
    PHASE_DURATIONS_MS.bid_resolve +
    PHASE_DURATIONS_MS.equip +
    PHASE_DURATIONS_MS.run +
    PHASE_DURATIONS_MS.resolve
  );
}
