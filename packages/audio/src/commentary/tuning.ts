/**
 * Tuning configuration for commentary cadence and round pacing.
 *
 * Provides sensible defaults for commentary frequency, verbosity,
 * and heartbeat intervals so that rounds feel engaging without
 * spamming or leaving dead air.
 *
 * Phase timing constants live in `@tle/game-core` and already
 * sum to 150 s (2.5 min) per round:
 *
 *   briefing    10 s
 *   hidden_bid  30 s
 *   bid_resolve  5 s
 *   equip       30 s
 *   run         60 s
 *   resolve     15 s
 *   ──────────────────
 *   Total      150 s  (2.5 min per round)
 *
 * This module does NOT modify those constants. It only provides
 * per-phase commentary budgets and recommended heartbeat intervals
 * that callers (e.g. the server match loop) can use to throttle
 * and pace commentary output.
 */

// ── Phase type (local, mirrors game-core) ─────────────────────────

/**
 * Match phases. Mirrors `MatchPhase` from `@tle/game-core` so the
 * audio package avoids a hard dependency on game-core.
 */
export type TuningPhase =
  | 'briefing'
  | 'hidden_bid'
  | 'bid_resolve'
  | 'equip'
  | 'run'
  | 'resolve'
  | 'final_standings';

// ── Verbosity ─────────────────────────────────────────────────────

export type Verbosity = 'concise' | 'normal' | 'verbose';

// ── Config interface ──────────────────────────────────────────────

export interface CommentaryTuningConfig {
  /**
   * Base heartbeat interval in milliseconds.
   * Only applies to phases long enough to warrant heartbeats.
   * @default 15_000
   */
  readonly heartbeatIntervalMs: number;

  /**
   * Maximum commentary items emitted per phase.
   * Keyed by phase name. Phases not listed get 0 (no commentary).
   */
  readonly maxCommentaryPerPhase: Readonly<Record<TuningPhase, number>>;

  /**
   * Small delay (ms) before emitting commentary after a phase
   * transition, giving the UI time to settle before audio starts.
   * @default 500
   */
  readonly commentaryDelayMs: number;

  /**
   * Controls template length / detail level.
   * - `concise`  -- shorter lines, fewer filler phrases
   * - `normal`   -- balanced (default)
   * - `verbose`  -- more colour, longer lines
   * @default 'normal'
   */
  readonly verbosity: Verbosity;
}

// ── Defaults ──────────────────────────────────────────────────────

/**
 * Default tuning values. Designed around the 150 s round budget:
 *
 * | Phase          | Duration | Max commentary | Heartbeats? |
 * |----------------|----------|---------------|-------------|
 * | briefing       |    10 s  |  2            | No          |
 * | hidden_bid     |    30 s  |  1            | No          |
 * | bid_resolve    |     5 s  |  3            | No          |
 * | equip          |    30 s  |  1            | No          |
 * | run            |    60 s  |  4            | Yes (15 s)  |
 * | resolve        |    15 s  |  3            | No          |
 * | final_standings|     --   |  5            | No          |
 */
export const DEFAULT_TUNING: CommentaryTuningConfig = {
  heartbeatIntervalMs: 15_000,
  maxCommentaryPerPhase: {
    briefing: 2,
    hidden_bid: 1,
    bid_resolve: 3,
    equip: 1,
    run: 4,
    resolve: 3,
    final_standings: 5,
  },
  commentaryDelayMs: 500,
  verbosity: 'normal',
};

// ── Phase duration reference (mirrors game-core, read-only) ───────

/**
 * Phase durations in milliseconds, mirrored here for convenience
 * when computing heartbeat recommendations. Source of truth is
 * `PHASE_DURATIONS_MS` in `@tle/game-core`.
 */
const PHASE_DURATION_REFERENCE_MS: Readonly<Record<TuningPhase, number>> = {
  briefing: 10_000,
  hidden_bid: 30_000,
  bid_resolve: 5_000,
  equip: 30_000,
  run: 60_000,
  resolve: 15_000,
  final_standings: 0,
};

/**
 * Minimum phase duration (ms) before heartbeat commentary is
 * considered worthwhile. Phases shorter than this threshold
 * return `0` from {@link getRecommendedHeartbeatInterval},
 * meaning heartbeats should not be started.
 */
const HEARTBEAT_PHASE_THRESHOLD_MS = 30_000;

// ── Public helpers ────────────────────────────────────────────────

/**
 * Returns the maximum number of commentary items that should be
 * emitted during the given phase.
 *
 * @param phase  The current match phase.
 * @param tuning Optional tuning config override.
 */
export function getPhaseCommentaryBudget(
  phase: TuningPhase,
  tuning: CommentaryTuningConfig = DEFAULT_TUNING,
): number {
  return tuning.maxCommentaryPerPhase[phase] ?? 0;
}

/**
 * Returns the recommended heartbeat interval (ms) for a phase.
 *
 * - For short phases (< 30 s), returns `0` meaning "no heartbeats".
 * - For longer phases, returns the configured heartbeat interval,
 *   clamped so that at least one heartbeat fires during the phase.
 *
 * @param phase  The current match phase.
 * @param tuning Optional tuning config override.
 */
export function getRecommendedHeartbeatInterval(
  phase: TuningPhase,
  tuning: CommentaryTuningConfig = DEFAULT_TUNING,
): number {
  const duration = PHASE_DURATION_REFERENCE_MS[phase] ?? 0;

  // Short or instant phases -- no heartbeats
  if (duration < HEARTBEAT_PHASE_THRESHOLD_MS) {
    return 0;
  }

  // Clamp interval so at least one heartbeat fires
  return Math.min(tuning.heartbeatIntervalMs, Math.floor(duration / 2));
}
