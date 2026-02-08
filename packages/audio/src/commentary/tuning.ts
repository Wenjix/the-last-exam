/**
 * Tuning configuration for commentary cadence and round pacing.
 *
 * Phase timing constants (from game-core) sum to 55s per round:
 *
 *   briefing     5 s
 *   bidding      5 s
 *   strategy    10 s
 *   execution   30 s  (mock: 2 s)
 *   scoring      5 s
 *   ─────────────────
 *   Total       55 s
 */

export type TuningPhase =
  | 'briefing'
  | 'bidding'
  | 'strategy'
  | 'execution'
  | 'scoring'
  | 'final_standings';

export type Verbosity = 'concise' | 'normal' | 'verbose';

export interface CommentaryTuningConfig {
  readonly heartbeatIntervalMs: number;
  readonly maxCommentaryPerPhase: Readonly<Record<TuningPhase, number>>;
  readonly commentaryDelayMs: number;
  readonly verbosity: Verbosity;
}

export const DEFAULT_TUNING: CommentaryTuningConfig = {
  heartbeatIntervalMs: 15_000,
  maxCommentaryPerPhase: {
    briefing: 2,
    bidding: 1,
    strategy: 2,
    execution: 4,
    scoring: 3,
    final_standings: 5,
  },
  commentaryDelayMs: 500,
  verbosity: 'normal',
};

const PHASE_DURATION_REFERENCE_MS: Readonly<Record<TuningPhase, number>> = {
  briefing: 5_000,
  bidding: 5_000,
  strategy: 10_000,
  execution: 30_000,
  scoring: 5_000,
  final_standings: 0,
};

const HEARTBEAT_PHASE_THRESHOLD_MS = 30_000;

export function getPhaseCommentaryBudget(
  phase: TuningPhase,
  tuning: CommentaryTuningConfig = DEFAULT_TUNING,
): number {
  return tuning.maxCommentaryPerPhase[phase] ?? 0;
}

export function getRecommendedHeartbeatInterval(
  phase: TuningPhase,
  tuning: CommentaryTuningConfig = DEFAULT_TUNING,
): number {
  const duration = PHASE_DURATION_REFERENCE_MS[phase] ?? 0;

  if (duration < HEARTBEAT_PHASE_THRESHOLD_MS) {
    return 0;
  }

  return Math.min(tuning.heartbeatIntervalMs, Math.floor(duration / 2));
}
