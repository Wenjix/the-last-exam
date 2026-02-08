/** Input from runner harness results */
export interface HarnessResult {
  readonly totalTests: number;
  readonly passedTests: number;
  readonly durationMs: number;
  readonly memoryUsedBytes?: number;
}

/** Optional LLM bonus evaluation */
export interface LlmBonusInput {
  readonly rawScore: number; // 0-1 scale from LLM judge
}

/** Full score breakdown */
export interface ScoreResult {
  readonly correctness: number; // 0-1
  readonly baseScore: number; // Points from correctness
  readonly latencyFactor: number; // 0-1 multiplier
  readonly resourceFactor: number; // 0-1 multiplier
  readonly llmBonus: number; // Capped at 10% of base
  readonly totalScore: number; // Final score
}

/** Scoring configuration constants */
export const SCORING_CONFIG = {
  /** Maximum base score for a fully correct solution */
  MAX_BASE_SCORE: 1000,
  /** Maximum LLM bonus as fraction of base score */
  LLM_BONUS_CAP: 0.1,
  /** Time limit for latency scoring (ms) */
  LATENCY_BASELINE_MS: 60_000,
  /** Memory limit for resource scoring (bytes) */
  MEMORY_BASELINE_BYTES: 512 * 1024 * 1024,
} as const;

/**
 * Calculate correctness ratio from harness results.
 * Failed/incorrect submissions get exactly 0.
 */
export function calculateCorrectness(harness: HarnessResult): number {
  if (harness.totalTests === 0) return 0;
  return harness.passedTests / harness.totalTests;
}

/**
 * Calculate latency factor (0-1). Lower latency = higher factor.
 * Uses inverse linear scaling against baseline.
 */
export function calculateLatencyFactor(durationMs: number): number {
  if (durationMs <= 0) return 1;
  if (durationMs >= SCORING_CONFIG.LATENCY_BASELINE_MS) return 0;
  return 1 - durationMs / SCORING_CONFIG.LATENCY_BASELINE_MS;
}

/**
 * Calculate resource factor (0-1). Lower usage = higher factor.
 */
export function calculateResourceFactor(memoryUsedBytes?: number): number {
  if (memoryUsedBytes === undefined || memoryUsedBytes <= 0) return 1;
  if (memoryUsedBytes >= SCORING_CONFIG.MEMORY_BASELINE_BYTES) return 0;
  return 1 - memoryUsedBytes / SCORING_CONFIG.MEMORY_BASELINE_BYTES;
}

/**
 * Calculate the full score for a submission.
 *
 * CRITICAL RULES:
 * - Incorrect submissions (correctness = 0) get EXACTLY 0 total score
 * - LLM bonus is capped at 10% of base score
 * - LLM bonus on a 0-score submission = 0 (cannot override correctness)
 */
export function calculateScore(harness: HarnessResult, llmBonus?: LlmBonusInput): ScoreResult {
  const correctness = calculateCorrectness(harness);

  // Base score from correctness (0 if any tests fail proportionally)
  const baseScore = correctness * SCORING_CONFIG.MAX_BASE_SCORE;

  // Latency and resource factors only apply if there's a base score
  const latencyFactor = baseScore > 0 ? calculateLatencyFactor(harness.durationMs) : 0;
  const resourceFactor = baseScore > 0 ? calculateResourceFactor(harness.memoryUsedBytes) : 0;

  // Weighted base score with latency/resource adjustments
  // Correctness is 70%, latency is 20%, resources is 10%
  const weightedBase = baseScore * (0.7 + 0.2 * latencyFactor + 0.1 * resourceFactor);

  // LLM bonus: capped at 10% of base, and 0 if submission failed
  let llmBonusScore = 0;
  if (llmBonus && baseScore > 0) {
    const rawBonus = Math.max(0, Math.min(1, llmBonus.rawScore));
    llmBonusScore = rawBonus * SCORING_CONFIG.LLM_BONUS_CAP * baseScore;
  }

  const totalScore = Math.round((weightedBase + llmBonusScore) * 100) / 100;

  return {
    correctness,
    baseScore: Math.round(baseScore * 100) / 100,
    latencyFactor: Math.round(latencyFactor * 1000) / 1000,
    resourceFactor: Math.round(resourceFactor * 1000) / 1000,
    llmBonus: Math.round(llmBonusScore * 100) / 100,
    totalScore,
  };
}
