import type { RunnerResult, ScoreBreakdown } from '@tle/contracts';
import type { HarnessResult, LlmBonusInput, ScoreResult } from './scoring.js';
import { calculateScore } from './scoring.js';

/**
 * The result of scoring a runner result, including both the game-core
 * ScoreResult and the contracts-compatible ScoreBreakdown.
 */
export interface ScoredRunnerResult {
  /** Full score breakdown (game-core internal representation). */
  readonly scoreResult: ScoreResult;
  /** Contracts-compatible score breakdown for inclusion in RunnerResult. */
  readonly scoreBreakdown: ScoreBreakdown;
}

/** Zero score returned for failed submissions. */
const ZERO_SCORE: ScoreResult = {
  correctness: 0,
  baseScore: 0,
  latencyFactor: 0,
  resourceFactor: 0,
  llmBonus: 0,
  totalScore: 0,
};

const ZERO_BREAKDOWN: ScoreBreakdown = {
  correctness: 0,
  baseScore: 0,
  totalScore: 0,
  latencyFactor: 0,
  resourceFactor: 0,
  llmBonus: 0,
};

/**
 * Convert a RunnerResult (from the runner harness) into a HarnessResult
 * (game-core scoring input).
 *
 * This bridges the gap between the contracts-level runner output and the
 * game-core scoring engine.
 */
export function runnerResultToHarnessInput(result: RunnerResult): HarnessResult {
  const totalTests = result.harnessResults.length;
  const passedTests = result.harnessResults.filter((t) => t.passed).length;

  return {
    totalTests,
    passedTests,
    durationMs: result.executionMetadata.durationMs,
    memoryUsedBytes: result.executionMetadata.memoryUsedBytes,
  };
}

/**
 * Convert a game-core ScoreResult into a contracts-compatible ScoreBreakdown.
 */
export function scoreResultToBreakdown(score: ScoreResult): ScoreBreakdown {
  return {
    correctness: score.correctness,
    baseScore: score.baseScore,
    totalScore: score.totalScore,
    latencyFactor: score.latencyFactor,
    resourceFactor: score.resourceFactor,
    llmBonus: score.llmBonus,
  };
}

/**
 * Score a runner result using the game-core scoring engine.
 *
 * CORRECTNESS GATE:
 * - If `result.success` is false (sandbox failure, timeout, etc.),
 *   the submission receives EXACTLY 0 points. No partial credit.
 * - If the harness ran but all tests failed (passedTests = 0),
 *   the submission also receives 0 via calculateScore's correctness logic.
 * - Only submissions that passed at least one test receive a non-zero score.
 *
 * This function is deterministic: same RunnerResult always produces the same score.
 *
 * @param result   - The runner result from harness execution.
 * @param llmBonus - Optional LLM judge bonus (separate issue 5li.2).
 * @returns        - Scored result with both internal and contracts representations.
 */
export function scoreRunnerResult(
  result: RunnerResult,
  llmBonus?: LlmBonusInput,
): ScoredRunnerResult {
  // CORRECTNESS GATE: failed submissions get zero score, period.
  if (!result.success) {
    return {
      scoreResult: ZERO_SCORE,
      scoreBreakdown: ZERO_BREAKDOWN,
    };
  }

  // No harness results means nothing to score -- zero.
  if (result.harnessResults.length === 0) {
    return {
      scoreResult: ZERO_SCORE,
      scoreBreakdown: ZERO_BREAKDOWN,
    };
  }

  // Convert runner result to game-core harness input and score it.
  const harnessInput = runnerResultToHarnessInput(result);
  const scoreResult = calculateScore(harnessInput, llmBonus);

  return {
    scoreResult,
    scoreBreakdown: scoreResultToBreakdown(scoreResult),
  };
}
