import seedrandom from 'seedrandom';
import type { ScoreResult } from '../scoring/scoring.js';

export interface RoundScore {
  readonly managerId: string;
  readonly round: number;
  readonly score: ScoreResult;
}

export interface StandingEntry {
  readonly managerId: string;
  readonly totalScore: number;
  readonly rank: number;
  readonly roundScores: number[];
}

/**
 * Calculate running standings from accumulated round scores.
 * Returns standings sorted by rank (1 = best).
 * Deterministic tie-breaking: higher score in latest round wins;
 * remaining ties broken by seeded RNG.
 */
export function calculateStandings(
  managerIds: readonly string[],
  roundScores: readonly RoundScore[],
  completedRounds: number,
  seed: string,
): StandingEntry[] {
  const rng = seedrandom(seed + ':standings');

  // Accumulate per-manager scores
  const scoresByManager = new Map<string, number[]>();
  for (const id of managerIds) {
    scoresByManager.set(id, Array(completedRounds).fill(0) as number[]);
  }

  for (const rs of roundScores) {
    const scores = scoresByManager.get(rs.managerId);
    if (scores && rs.round >= 1 && rs.round <= completedRounds) {
      scores[rs.round - 1] = rs.score.totalScore;
    }
  }

  // Build entries with totals
  const entries = managerIds.map((id) => {
    const scores = scoresByManager.get(id) || [];
    const totalScore = scores.reduce((sum, s) => sum + s, 0);
    return {
      managerId: id,
      totalScore: Math.round(totalScore * 100) / 100,
      roundScores: scores,
      rngTiebreak: rng(),
    };
  });

  // Sort: highest total first, then latest round score, then RNG
  entries.sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    // Tie-break by most recent round score (higher wins)
    for (let r = completedRounds - 1; r >= 0; r--) {
      const aScore = a.roundScores[r] || 0;
      const bScore = b.roundScores[r] || 0;
      if (bScore !== aScore) return bScore - aScore;
    }
    // Final: seeded RNG
    return b.rngTiebreak - a.rngTiebreak;
  });

  return entries.map((e, i) => ({
    managerId: e.managerId,
    totalScore: e.totalScore,
    rank: i + 1,
    roundScores: e.roundScores,
  }));
}

/**
 * Calculate final standings after all 5 rounds.
 */
export function finalizaStandings(
  managerIds: readonly string[],
  allRoundScores: readonly RoundScore[],
  seed: string,
): StandingEntry[] {
  return calculateStandings(managerIds, allRoundScores, 5, seed);
}
