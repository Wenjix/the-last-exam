/**
 * Round balance and content ordering tests for @tle/content
 * Issue: h2x.1
 *
 * Verifies:
 * - Difficulty progression (round 1 easiest, round 5 hardest)
 * - Hazard intensity progression
 * - Tool value distribution balance
 * - Multi-seed simulation: outcome variance, no dominant strategy
 * - Determinism: same seed = same result
 */

import { describe, it, expect } from 'vitest';
import {
  getRoundAssignments,
  validateRoundBalance,
  getHazardIntensity,
  getToolValueTier,
  getDefaultHazards,
  getDefaultTools,
} from '../index.js';
import type { RoundAssignment } from '../index.js';
import { calculateScore, calculateStandings } from '@tle/game-core';
import type { HarnessResult, RoundScore } from '@tle/game-core';
import seedrandom from 'seedrandom';

// ---------------------------------------------------------------------------
// 1. Structural Invariants
// ---------------------------------------------------------------------------
describe('Round Balance - Structural Invariants', () => {
  const SEED = 'balance-test-seed-42';

  it('produces exactly 5 round assignments', () => {
    const assignments = getRoundAssignments(SEED);
    expect(assignments.length).toBe(5);
  });

  it('rounds are numbered 1 through 5', () => {
    const assignments = getRoundAssignments(SEED);
    expect(assignments.map((a) => a.round)).toEqual([1, 2, 3, 4, 5]);
  });

  it('each round has exactly one challenge', () => {
    const assignments = getRoundAssignments(SEED);
    for (const a of assignments) {
      expect(a.challenge).toBeDefined();
      expect(a.challenge.id).toBeTruthy();
    }
  });

  it('each round has exactly one hazard', () => {
    const assignments = getRoundAssignments(SEED);
    for (const a of assignments) {
      expect(a.hazard).toBeDefined();
      expect(a.hazard.id).toBeTruthy();
    }
  });

  it('each round has at least 1 tool in the pool', () => {
    const assignments = getRoundAssignments(SEED);
    for (const a of assignments) {
      expect(a.availableTools.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('all 8 tools are distributed exactly once across all rounds', () => {
    const assignments = getRoundAssignments(SEED);
    const allToolIds = assignments.flatMap((a) => a.availableTools.map((t) => t.id));
    const defaultToolIds = getDefaultTools().map((t) => t.id);

    expect(allToolIds.length).toBe(8);
    expect(new Set(allToolIds).size).toBe(8);
    expect(new Set(allToolIds)).toEqual(new Set(defaultToolIds));
  });

  it('all 5 challenges are assigned exactly once', () => {
    const assignments = getRoundAssignments(SEED);
    const challengeIds = assignments.map((a) => a.challenge.id);
    expect(new Set(challengeIds).size).toBe(5);
  });

  it('all 5 hazards are assigned exactly once', () => {
    const assignments = getRoundAssignments(SEED);
    const hazardIds = assignments.map((a) => a.hazard.id);
    expect(new Set(hazardIds).size).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// 2. Difficulty Progression
// ---------------------------------------------------------------------------
describe('Round Balance - Difficulty Progression', () => {
  const SEED = 'difficulty-prog-seed';

  it('challenge difficulty is strictly non-decreasing across rounds', () => {
    const assignments = getRoundAssignments(SEED);
    for (let i = 1; i < assignments.length; i++) {
      expect(assignments[i].challenge.difficulty).toBeGreaterThanOrEqual(
        assignments[i - 1].challenge.difficulty,
      );
    }
  });

  it('round 1 has the easiest challenge (difficulty 1)', () => {
    const assignments = getRoundAssignments(SEED);
    expect(assignments[0].challenge.difficulty).toBe(1);
  });

  it('round 5 has the hardest challenge (difficulty 5)', () => {
    const assignments = getRoundAssignments(SEED);
    expect(assignments[4].challenge.difficulty).toBe(5);
  });

  it('difficulty covers the full range 1-5', () => {
    const assignments = getRoundAssignments(SEED);
    const difficulties = assignments.map((a) => a.challenge.difficulty);
    expect(difficulties).toEqual([1, 2, 3, 4, 5]);
  });
});

// ---------------------------------------------------------------------------
// 3. Hazard Intensity Progression
// ---------------------------------------------------------------------------
describe('Round Balance - Hazard Intensity Progression', () => {
  const SEED = 'hazard-prog-seed';

  it('hazard intensity is strictly non-decreasing across rounds', () => {
    const assignments = getRoundAssignments(SEED);
    for (let i = 1; i < assignments.length; i++) {
      const prevIntensity = getHazardIntensity(assignments[i - 1].hazard.id);
      const currIntensity = getHazardIntensity(assignments[i].hazard.id);
      expect(currIntensity).toBeGreaterThanOrEqual(prevIntensity);
    }
  });

  it('round 1 hazard has the lowest intensity', () => {
    const assignments = getRoundAssignments(SEED);
    expect(getHazardIntensity(assignments[0].hazard.id)).toBe(1);
  });

  it('round 5 hazard has the highest intensity', () => {
    const assignments = getRoundAssignments(SEED);
    expect(getHazardIntensity(assignments[4].hazard.id)).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// 4. Tool Distribution Balance
// ---------------------------------------------------------------------------
describe('Round Balance - Tool Distribution', () => {
  const SEED = 'tool-dist-seed';

  it('tool pool sizes sum to 8 (all tools distributed)', () => {
    const assignments = getRoundAssignments(SEED);
    const totalTools = assignments.reduce((sum, a) => sum + a.availableTools.length, 0);
    expect(totalTools).toBe(8);
  });

  it('no round has more than 2 tools', () => {
    const assignments = getRoundAssignments(SEED);
    for (const a of assignments) {
      expect(a.availableTools.length).toBeLessThanOrEqual(2);
    }
  });

  it('premium tools (tier 3) are not all in the first 2 rounds', () => {
    const assignments = getRoundAssignments(SEED);
    const premiumInEarlyRounds = assignments
      .slice(0, 2)
      .flatMap((a) => a.availableTools)
      .filter((t) => getToolValueTier(t.id) === 3);
    const totalPremium = getDefaultTools().filter((t) => getToolValueTier(t.id) === 3).length;

    // Not all premium tools should be in first 2 rounds
    expect(premiumInEarlyRounds.length).toBeLessThan(totalPremium);
  });

  it('all known tool IDs have a defined tier', () => {
    const tools = getDefaultTools();
    for (const tool of tools) {
      expect(getToolValueTier(tool.id)).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// 5. Validation Function
// ---------------------------------------------------------------------------
describe('Round Balance - validateRoundBalance()', () => {
  it('returns no errors for a valid assignment', () => {
    const assignments = getRoundAssignments('validation-seed');
    const errors = validateRoundBalance(assignments);
    expect(errors).toEqual([]);
  });

  it('detects wrong number of rounds', () => {
    const errors = validateRoundBalance([] as unknown as RoundAssignment[]);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain('Expected 5 rounds');
  });
});

// ---------------------------------------------------------------------------
// 6. Determinism
// ---------------------------------------------------------------------------
describe('Round Balance - Determinism', () => {
  it('same seed produces identical assignments', () => {
    const a1 = getRoundAssignments('determinism-check');
    const a2 = getRoundAssignments('determinism-check');

    expect(a1.length).toBe(a2.length);
    for (let i = 0; i < a1.length; i++) {
      expect(a1[i].challenge.id).toBe(a2[i].challenge.id);
      expect(a1[i].hazard.id).toBe(a2[i].hazard.id);
      expect(a1[i].availableTools.map((t) => t.id)).toEqual(a2[i].availableTools.map((t) => t.id));
    }
  });

  it('different seeds produce different tool distributions', () => {
    const seeds = ['seed-alpha', 'seed-beta', 'seed-gamma', 'seed-delta', 'seed-epsilon'];
    const distributions = seeds.map((s) =>
      getRoundAssignments(s)
        .map((a) =>
          a.availableTools
            .map((t) => t.id)
            .sort()
            .join(','),
        )
        .join('|'),
    );

    // Not all distributions should be identical
    const unique = new Set(distributions);
    expect(unique.size).toBeGreaterThan(1);
  });
});

// ---------------------------------------------------------------------------
// 7. Hazard and Tool Metadata
// ---------------------------------------------------------------------------
describe('Round Balance - Metadata', () => {
  it('all hazards have a defined intensity', () => {
    const hazards = getDefaultHazards();
    for (const h of hazards) {
      expect(getHazardIntensity(h.id)).toBeGreaterThan(0);
    }
  });

  it('hazard intensities cover the range 1-5', () => {
    const hazards = getDefaultHazards();
    const intensities = hazards.map((h) => getHazardIntensity(h.id)).sort();
    expect(intensities).toEqual([1, 2, 3, 4, 5]);
  });

  it('tool value tiers include 1, 2, and 3', () => {
    const tools = getDefaultTools();
    const tiers = new Set(tools.map((t) => getToolValueTier(t.id)));
    expect(tiers.has(1)).toBe(true);
    expect(tiers.has(2)).toBe(true);
    expect(tiers.has(3)).toBe(true);
  });

  it('unknown IDs return 0 for both intensity and tier', () => {
    expect(getHazardIntensity('nonexistent')).toBe(0);
    expect(getToolValueTier('nonexistent')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 8. Multi-Seed Simulation -- Outcome Variance
// ---------------------------------------------------------------------------
describe('Round Balance - Multi-Seed Simulation (no dominant strategy)', () => {
  const NUM_SEEDS = 10;
  const MANAGER_IDS = ['alice', 'bob', 'charlie', 'diana'];

  /**
   * Simulate a simplified match with the given seed.
   * Each manager uses a fixed "strategy" (bid amount, tool preference).
   * Returns final standings.
   */
  function simulateMatch(seed: string) {
    const rng = seedrandom(`${seed}:sim`);
    const assignments = getRoundAssignments(seed);

    // Manager strategies (fixed per manager, simulating different approaches):
    // alice: Always bids high, prefers premium tools -> good early, may burn out
    // bob: Moderate bids, balanced approach -> consistent
    // charlie: Low bids, focuses on correctness -> slow start, strong finish
    // diana: Random strategy -> wildcard
    const strategies: Record<
      string,
      { bidStyle: 'high' | 'moderate' | 'low' | 'random'; skillBase: number }
    > = {
      alice: { bidStyle: 'high', skillBase: 0.85 },
      bob: { bidStyle: 'moderate', skillBase: 0.8 },
      charlie: { bidStyle: 'low', skillBase: 0.9 },
      diana: { bidStyle: 'random', skillBase: 0.75 },
    };

    const allRoundScores: RoundScore[] = [];

    for (const assignment of assignments) {
      const round = assignment.round;
      const difficulty = assignment.challenge.difficulty;
      const hazardIntensity = getHazardIntensity(assignment.hazard.id);

      for (const managerId of MANAGER_IDS) {
        const strategy = strategies[managerId];
        const rngVal = rng();

        // Simulate correctness based on skill, difficulty, hazard
        // Higher difficulty and hazard reduce correctness
        const difficultyPenalty = (difficulty - 1) * 0.08; // 0.0 to 0.32
        const hazardPenalty = (hazardIntensity - 1) * 0.04; // 0.0 to 0.16
        const randomFactor = (rngVal - 0.5) * 0.2; // -0.1 to 0.1

        // Tool bonus: having more/better tools helps
        const toolBonus =
          assignment.availableTools.length * 0.02 +
          assignment.availableTools.reduce((s, t) => s + getToolValueTier(t.id) * 0.01, 0);

        // Strategy effects
        let strategyBonus = 0;
        if (strategy.bidStyle === 'high') {
          // High bidders get tools early but tire out
          strategyBonus = round <= 2 ? 0.05 : -0.03;
        } else if (strategy.bidStyle === 'low') {
          // Conservative players ramp up
          strategyBonus = round >= 4 ? 0.05 : -0.02;
        } else if (strategy.bidStyle === 'random') {
          strategyBonus = (rng() - 0.5) * 0.15;
        }

        const rawCorrectness =
          strategy.skillBase -
          difficultyPenalty -
          hazardPenalty +
          randomFactor +
          toolBonus +
          strategyBonus;
        const correctness = Math.max(0, Math.min(1, rawCorrectness));

        // Simulate test results
        const totalTests = assignment.challenge.testCases.length;
        const passedTests = Math.round(correctness * totalTests);

        // Simulate duration (harder problems take longer, with some variance)
        const baseDuration = difficulty * 8000 + hazardIntensity * 3000;
        const durationMs = Math.max(1000, baseDuration + rng() * 5000 - 2500);

        const harness: HarnessResult = {
          totalTests,
          passedTests,
          durationMs,
          memoryUsedBytes: Math.round(50_000_000 + rng() * 100_000_000),
        };

        const scoreResult = calculateScore(harness);

        allRoundScores.push({
          managerId,
          round,
          score: scoreResult,
        });
      }
    }

    return calculateStandings(MANAGER_IDS, allRoundScores, 5, seed);
  }

  it('runs 10 seeds and produces valid standings for each', () => {
    for (let i = 0; i < NUM_SEEDS; i++) {
      const seed = `multi-seed-sim-${i}`;
      const standings = simulateMatch(seed);
      expect(standings.length).toBe(MANAGER_IDS.length);
      expect(standings.map((s) => s.rank)).toEqual([1, 2, 3, 4]);
    }
  });

  it('no single manager wins every match (no dominant strategy)', () => {
    const winCounts: Record<string, number> = {};
    for (const id of MANAGER_IDS) winCounts[id] = 0;

    for (let i = 0; i < NUM_SEEDS; i++) {
      const seed = `dominant-check-${i}`;
      const standings = simulateMatch(seed);
      winCounts[standings[0].managerId]++;
    }

    // No single manager should win all 10 matches
    for (const count of Object.values(winCounts)) {
      expect(count).toBeLessThan(NUM_SEEDS);
    }
  });

  it('outcome variance: at least 2 different winners across seeds', () => {
    const winners = new Set<string>();

    for (let i = 0; i < NUM_SEEDS; i++) {
      const seed = `variance-check-${i}`;
      const standings = simulateMatch(seed);
      winners.add(standings[0].managerId);
    }

    expect(winners.size).toBeGreaterThanOrEqual(2);
  });

  it('rank distribution: at least 3 managers achieve rank 1 or 2 across seeds', () => {
    const topTwoCount: Record<string, number> = {};
    for (const id of MANAGER_IDS) topTwoCount[id] = 0;

    // Use more seeds for a wider range of outcomes
    for (let i = 0; i < 30; i++) {
      const seed = `rank-dist-${i}`;
      const standings = simulateMatch(seed);
      topTwoCount[standings[0].managerId]++;
      topTwoCount[standings[1].managerId]++;
    }

    // At least 3 out of 4 managers should appear in top 2 across 30 matches
    const managersInTopTwo = Object.values(topTwoCount).filter((c) => c > 0).length;
    expect(managersInTopTwo).toBeGreaterThanOrEqual(3);
  });

  it('score totals vary meaningfully between seeds', () => {
    const winnerScores: number[] = [];

    for (let i = 0; i < NUM_SEEDS; i++) {
      const seed = `score-variance-${i}`;
      const standings = simulateMatch(seed);
      winnerScores.push(standings[0].totalScore);
    }

    const minScore = Math.min(...winnerScores);
    const maxScore = Math.max(...winnerScores);

    // Scores should vary by at least 5% of the max
    expect(maxScore - minScore).toBeGreaterThan(maxScore * 0.05);
  });

  it('same seed produces identical simulation results', () => {
    const standings1 = simulateMatch('determinism-sim');
    const standings2 = simulateMatch('determinism-sim');

    expect(standings1.length).toBe(standings2.length);
    for (let i = 0; i < standings1.length; i++) {
      expect(standings1[i].managerId).toBe(standings2[i].managerId);
      expect(standings1[i].totalScore).toBe(standings2[i].totalScore);
      expect(standings1[i].rank).toBe(standings2[i].rank);
    }
  });
});

// ---------------------------------------------------------------------------
// 9. Balance invariants across many seeds
// ---------------------------------------------------------------------------
describe('Round Balance - Invariants Across Seeds', () => {
  const SEEDS = Array.from({ length: 50 }, (_, i) => `invariant-seed-${i}`);

  it('all 50 seeds pass validation', () => {
    for (const seed of SEEDS) {
      const assignments = getRoundAssignments(seed);
      const errors = validateRoundBalance(assignments);
      expect(errors).toEqual([]);
    }
  });

  it('challenge ordering is always difficulty 1-5 regardless of seed', () => {
    for (const seed of SEEDS) {
      const assignments = getRoundAssignments(seed);
      const difficulties = assignments.map((a) => a.challenge.difficulty);
      expect(difficulties).toEqual([1, 2, 3, 4, 5]);
    }
  });

  it('hazard ordering is always intensity 1-5 regardless of seed', () => {
    for (const seed of SEEDS) {
      const assignments = getRoundAssignments(seed);
      const intensities = assignments.map((a) => getHazardIntensity(a.hazard.id));
      expect(intensities).toEqual([1, 2, 3, 4, 5]);
    }
  });
});
