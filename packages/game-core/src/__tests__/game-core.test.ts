/**
 * Comprehensive deterministic unit tests for @tle/game-core
 * Issue: ao7.12
 *
 * Covers: FSM, Auction, Scoring, Timing, Equip, Standings, and full simulation.
 * All tests are fast (<1s total) and repeatable with fixed seeds.
 */

import {
  // FSM
  createInitialState,
  advanceFsm,
  simulateFullMatch,
  isValidTransition,
  getRngValue,
  PHASES,
  TOTAL_ROUNDS,
  InvalidTransitionError,
  // Auction
  resolveAuction,
  validateBid,
  // Scoring
  calculateCorrectness,
  calculateLatencyFactor,
  calculateResourceFactor,
  calculateScore,
  SCORING_CONFIG,
  // Timing
  PHASE_DURATIONS_MS,
  calculateDeadline,
  remainingMs,
  isDeadlineExpired,
  fullRoundDurationMs,
  // Equip
  validateEquipSelection,
  getDefaultEquipSelection,
  // Standings
  calculateStandings,
  finalizaStandings,
} from '../index.js';

import type {
  FsmTransitionAction,
  BidEntry,
  HarnessResult,
  RoundScore,
  EquipSelection,
  AuctionResult,
} from '../index.js';

// ---------------------------------------------------------------------------
// 1. FSM Tests
// ---------------------------------------------------------------------------
describe('FSM', () => {
  const TEST_SEED = 'test-seed-alpha';
  const ADVANCE: FsmTransitionAction = { type: 'ADVANCE_PHASE' };

  describe('createInitialState(seed)', () => {
    it('produces correct initial state fields', () => {
      const state = createInitialState(TEST_SEED);
      expect(state.round).toBe(1);
      expect(state.phase).toBe('briefing');
      expect(state.seed).toBe(TEST_SEED);
      expect(state.isTerminal).toBe(false);
      expect(state.rngState).toBeTruthy();
    });

    it('preserves seed in state', () => {
      const state = createInitialState('unique-seed-42');
      expect(state.seed).toBe('unique-seed-42');
    });

    it('different seeds produce different rngState', () => {
      const s1 = createInitialState('seed-a');
      const s2 = createInitialState('seed-b');
      expect(s1.rngState).not.toBe(s2.rngState);
    });
  });

  describe('advanceFsm(state)', () => {
    it('progresses through all phases in correct order for round 1', () => {
      let state = createInitialState(TEST_SEED);
      const expectedPhases: string[] = [
        'briefing',
        'hidden_bid',
        'bid_resolve',
        'equip',
        'run',
        'resolve',
      ];

      // First state is briefing, already captured
      expect(state.phase).toBe(expectedPhases[0]);

      for (let i = 1; i < expectedPhases.length; i++) {
        const result = advanceFsm(state, ADVANCE);
        state = result.state;
        expect(state.phase).toBe(expectedPhases[i]);
        expect(state.round).toBe(1);
        expect(state.isTerminal).toBe(false);
      }
    });

    it('advances from round 1 resolve to round 2 briefing', () => {
      let state = createInitialState(TEST_SEED);
      // Advance through all 6 phases of round 1
      for (let i = 0; i < PHASES.length; i++) {
        const result = advanceFsm(state, ADVANCE);
        state = result.state;
      }
      // Should be at round 2 briefing
      expect(state.round).toBe(2);
      expect(state.phase).toBe('briefing');
      expect(state.isTerminal).toBe(false);
    });

    it('progresses through all 5 rounds to final_standings', () => {
      let state = createInitialState(TEST_SEED);
      for (let round = 1; round <= TOTAL_ROUNDS; round++) {
        for (let phaseIdx = 0; phaseIdx < PHASES.length; phaseIdx++) {
          const result = advanceFsm(state, ADVANCE);
          state = result.state;

          if (round === TOTAL_ROUNDS && phaseIdx === PHASES.length - 1) {
            // After round 5 resolve -> final_standings
            expect(state.phase).toBe('final_standings');
            expect(state.isTerminal).toBe(true);
          }
        }
      }
    });

    it('returns correct transition metadata', () => {
      const state = createInitialState(TEST_SEED);
      const result = advanceFsm(state, ADVANCE);
      expect(result.transition.fromRound).toBe(1);
      expect(result.transition.fromPhase).toBe('briefing');
      expect(result.transition.toRound).toBe(1);
      expect(result.transition.toPhase).toBe('hidden_bid');
    });

    it('throws InvalidTransitionError on terminal state', () => {
      let state = createInitialState(TEST_SEED);
      // Advance to terminal state
      while (!state.isTerminal) {
        const result = advanceFsm(state, ADVANCE);
        state = result.state;
      }
      expect(state.phase).toBe('final_standings');
      expect(() => advanceFsm(state, ADVANCE)).toThrow(InvalidTransitionError);
    });

    it('InvalidTransitionError carries correct fields', () => {
      let state = createInitialState(TEST_SEED);
      while (!state.isTerminal) {
        const result = advanceFsm(state, ADVANCE);
        state = result.state;
      }
      try {
        advanceFsm(state, ADVANCE);
        // Should not reach here
        expect(true).toBe(false);
      } catch (e) {
        expect(e).toBeInstanceOf(InvalidTransitionError);
        const err = e as InstanceType<typeof InvalidTransitionError>;
        expect(err.currentPhase).toBe('final_standings');
        expect(err.currentRound).toBe(5);
        expect(err.reason).toContain('terminal');
      }
    });

    it('does not mutate input state', () => {
      const state = createInitialState(TEST_SEED);
      const originalPhase = state.phase;
      const originalRound = state.round;
      advanceFsm(state, ADVANCE);
      expect(state.phase).toBe(originalPhase);
      expect(state.round).toBe(originalRound);
    });
  });

  describe('determinism', () => {
    it('same seed produces identical state sequence', () => {
      const states1 = simulateFullMatch('determinism-test');
      const states2 = simulateFullMatch('determinism-test');

      expect(states1.length).toBe(states2.length);
      for (let i = 0; i < states1.length; i++) {
        expect(states1[i].round).toBe(states2[i].round);
        expect(states1[i].phase).toBe(states2[i].phase);
        expect(states1[i].seed).toBe(states2[i].seed);
        expect(states1[i].rngState).toBe(states2[i].rngState);
        expect(states1[i].isTerminal).toBe(states2[i].isTerminal);
      }
    });

    it('different seeds produce different rng sequences', () => {
      const states1 = simulateFullMatch('seed-one');
      const states2 = simulateFullMatch('seed-two');
      // Phase sequences are identical by design (structural),
      // but rng states should differ
      expect(states1[0].rngState).not.toBe(states2[0].rngState);
    });

    it('getRngValue returns consistent values for same state', () => {
      const state = createInitialState('rng-test');
      const v1 = getRngValue(state);
      const v2 = getRngValue(state);
      expect(v1).toBe(v2);
      expect(typeof v1).toBe('number');
      expect(v1).toBeGreaterThanOrEqual(0);
      expect(v1).toBeLessThan(1);
    });
  });

  describe('simulateFullMatch(seed)', () => {
    it('returns exactly 31 states (6 phases x 5 rounds + final_standings)', () => {
      const states = simulateFullMatch(TEST_SEED);
      // 1 initial + 30 transitions = 31 states total
      expect(states.length).toBe(31);
    });

    it('first state is round 1 briefing', () => {
      const states = simulateFullMatch(TEST_SEED);
      expect(states[0].round).toBe(1);
      expect(states[0].phase).toBe('briefing');
      expect(states[0].isTerminal).toBe(false);
    });

    it('last state is final_standings and terminal', () => {
      const states = simulateFullMatch(TEST_SEED);
      const last = states[states.length - 1];
      expect(last.phase).toBe('final_standings');
      expect(last.isTerminal).toBe(true);
      expect(last.round).toBe(5);
    });

    it('phase sequence within each round is correct', () => {
      const states = simulateFullMatch(TEST_SEED);
      for (let round = 1; round <= TOTAL_ROUNDS; round++) {
        const roundStates = states.filter(
          (s) => s.round === round && s.phase !== 'final_standings',
        );
        const phaseNames = roundStates.map((s) => s.phase);
        expect(phaseNames).toEqual([
          'briefing',
          'hidden_bid',
          'bid_resolve',
          'equip',
          'run',
          'resolve',
        ]);
      }
    });

    it('all seeds are preserved throughout simulation', () => {
      const states = simulateFullMatch(TEST_SEED);
      for (const state of states) {
        expect(state.seed).toBe(TEST_SEED);
      }
    });
  });

  describe('isValidTransition()', () => {
    it('accepts valid phase transitions within a round', () => {
      expect(isValidTransition('briefing', 1, 'hidden_bid', 1)).toBe(true);
      expect(isValidTransition('hidden_bid', 1, 'bid_resolve', 1)).toBe(true);
      expect(isValidTransition('bid_resolve', 1, 'equip', 1)).toBe(true);
      expect(isValidTransition('equip', 1, 'run', 1)).toBe(true);
      expect(isValidTransition('run', 1, 'resolve', 1)).toBe(true);
    });

    it('accepts valid round boundary transitions', () => {
      expect(isValidTransition('resolve', 1, 'briefing', 2)).toBe(true);
      expect(isValidTransition('resolve', 4, 'briefing', 5)).toBe(true);
    });

    it('accepts resolve round 5 to final_standings', () => {
      expect(isValidTransition('resolve', 5, 'final_standings', 5)).toBe(true);
    });

    it('rejects invalid transitions', () => {
      expect(isValidTransition('briefing', 1, 'equip', 1)).toBe(false);
      expect(isValidTransition('briefing', 1, 'briefing', 2)).toBe(false);
      expect(isValidTransition('final_standings', 5, 'briefing', 6)).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// 2. Auction Tests
// ---------------------------------------------------------------------------
describe('Auction', () => {
  const AUCTION_SEED = 'auction-seed-42';

  describe('resolveAuction(bids, seed)', () => {
    it('highest bidder wins first pick', () => {
      const bids: BidEntry[] = [
        { managerId: 'a', amount: 10, currentRank: 1 },
        { managerId: 'b', amount: 50, currentRank: 2 },
        { managerId: 'c', amount: 30, currentRank: 3 },
      ];
      const results = resolveAuction(bids, AUCTION_SEED);
      expect(results[0].managerId).toBe('b');
      expect(results[0].pickOrder).toBe(1);
      expect(results[0].amount).toBe(50);
    });

    it('sorts all bidders by bid amount descending', () => {
      const bids: BidEntry[] = [
        { managerId: 'a', amount: 10, currentRank: 1 },
        { managerId: 'b', amount: 50, currentRank: 2 },
        { managerId: 'c', amount: 30, currentRank: 3 },
      ];
      const results = resolveAuction(bids, AUCTION_SEED);
      expect(results.map((r) => r.amount)).toEqual([50, 30, 10]);
      expect(results.map((r) => r.pickOrder)).toEqual([1, 2, 3]);
    });

    it('tie-breaking: lower-ranked manager (higher rank number) wins ties', () => {
      const bids: BidEntry[] = [
        { managerId: 'leader', amount: 20, currentRank: 1 },
        { managerId: 'trailer', amount: 20, currentRank: 3 },
        { managerId: 'middle', amount: 20, currentRank: 2 },
      ];
      const results = resolveAuction(bids, AUCTION_SEED);
      // Lower-ranked (rank 3) should win the tie -> first pick
      expect(results[0].managerId).toBe('trailer');
      expect(results[1].managerId).toBe('middle');
      expect(results[2].managerId).toBe('leader');
    });

    it('remaining ties broken by seeded RNG (deterministic)', () => {
      const bids: BidEntry[] = [
        { managerId: 'x', amount: 20, currentRank: 2 },
        { managerId: 'y', amount: 20, currentRank: 2 },
      ];
      const results1 = resolveAuction(bids, AUCTION_SEED);
      const results2 = resolveAuction(bids, AUCTION_SEED);
      // Same seed -> same order
      expect(results1[0].managerId).toBe(results2[0].managerId);
      expect(results1[1].managerId).toBe(results2[1].managerId);
    });

    it('different seeds may produce different RNG tiebreaks', () => {
      const bids: BidEntry[] = [
        { managerId: 'x', amount: 20, currentRank: 2 },
        { managerId: 'y', amount: 20, currentRank: 2 },
      ];
      // This is probabilistic but with two different seeds, we just verify
      // both return valid results with correct structure
      const r1 = resolveAuction(bids, 'seed-aaa');
      const r2 = resolveAuction(bids, 'seed-bbb');
      expect(r1.length).toBe(2);
      expect(r2.length).toBe(2);
      expect(r1[0].pickOrder).toBe(1);
      expect(r1[1].pickOrder).toBe(2);
    });

    it('handles single bidder', () => {
      const bids: BidEntry[] = [{ managerId: 'solo', amount: 100, currentRank: 1 }];
      const results = resolveAuction(bids, AUCTION_SEED);
      expect(results.length).toBe(1);
      expect(results[0].managerId).toBe('solo');
      expect(results[0].pickOrder).toBe(1);
    });

    it('handles all same bids with different ranks', () => {
      const bids: BidEntry[] = [
        { managerId: 'a', amount: 10, currentRank: 1 },
        { managerId: 'b', amount: 10, currentRank: 2 },
        { managerId: 'c', amount: 10, currentRank: 3 },
        { managerId: 'd', amount: 10, currentRank: 4 },
      ];
      const results = resolveAuction(bids, AUCTION_SEED);
      expect(results.length).toBe(4);
      // Lower-ranked (higher number) should be earlier in pick order
      expect(results[0].managerId).toBe('d');
      expect(results[1].managerId).toBe('c');
      expect(results[2].managerId).toBe('b');
      expect(results[3].managerId).toBe('a');
    });

    it('handles all different bids', () => {
      const bids: BidEntry[] = [
        { managerId: 'a', amount: 5, currentRank: 1 },
        { managerId: 'b', amount: 25, currentRank: 2 },
        { managerId: 'c', amount: 15, currentRank: 3 },
      ];
      const results = resolveAuction(bids, AUCTION_SEED);
      expect(results[0].managerId).toBe('b');
      expect(results[1].managerId).toBe('c');
      expect(results[2].managerId).toBe('a');
    });

    it('handles partial ties (some tied, some not)', () => {
      const bids: BidEntry[] = [
        { managerId: 'a', amount: 30, currentRank: 1 },
        { managerId: 'b', amount: 30, currentRank: 3 },
        { managerId: 'c', amount: 10, currentRank: 2 },
      ];
      const results = resolveAuction(bids, AUCTION_SEED);
      // b (rank 3) beats a (rank 1) on tie, c is last (lowest bid)
      expect(results[0].managerId).toBe('b');
      expect(results[1].managerId).toBe('a');
      expect(results[2].managerId).toBe('c');
    });

    it('returns empty array for empty bids', () => {
      const results = resolveAuction([], AUCTION_SEED);
      expect(results).toEqual([]);
    });
  });

  describe('validateBid()', () => {
    it('accepts valid bid within default range', () => {
      expect(validateBid(10)).toBeNull();
      expect(validateBid(0)).toBeNull();
    });

    it('accepts valid bid within custom range', () => {
      expect(validateBid(5, 1, 100)).toBeNull();
      expect(validateBid(1, 1, 100)).toBeNull();
      expect(validateBid(100, 1, 100)).toBeNull();
    });

    it('rejects non-integer bid', () => {
      expect(validateBid(10.5)).toBe('Bid must be an integer');
      expect(validateBid(0.1)).toBe('Bid must be an integer');
    });

    it('rejects bid below minimum', () => {
      expect(validateBid(0, 1, 100)).toBe('Bid must be at least 1');
      expect(validateBid(-1, 0)).toContain('at least');
    });

    it('rejects bid above maximum', () => {
      expect(validateBid(101, 0, 100)).toBe('Bid must be at most 100');
    });

    it('rejects NaN', () => {
      expect(validateBid(NaN)).toBe('Bid must be an integer');
    });
  });
});

// ---------------------------------------------------------------------------
// 3. Scoring Tests
// ---------------------------------------------------------------------------
describe('Scoring', () => {
  describe('calculateCorrectness()', () => {
    it('returns 0 for 0 total tests', () => {
      const result = calculateCorrectness({
        totalTests: 0,
        passedTests: 0,
        durationMs: 100,
      });
      expect(result).toBe(0);
    });

    it('returns 1 for all tests passing', () => {
      const result = calculateCorrectness({
        totalTests: 10,
        passedTests: 10,
        durationMs: 100,
      });
      expect(result).toBe(1);
    });

    it('returns correct ratio for partial passes', () => {
      const result = calculateCorrectness({
        totalTests: 10,
        passedTests: 7,
        durationMs: 100,
      });
      expect(result).toBeCloseTo(0.7, 5);
    });

    it('returns 0 when no tests pass', () => {
      const result = calculateCorrectness({
        totalTests: 5,
        passedTests: 0,
        durationMs: 100,
      });
      expect(result).toBe(0);
    });
  });

  describe('calculateLatencyFactor()', () => {
    it('returns 1 at 0ms', () => {
      expect(calculateLatencyFactor(0)).toBe(1);
    });

    it('returns 1 for negative duration', () => {
      expect(calculateLatencyFactor(-100)).toBe(1);
    });

    it('returns 0 at baseline (60s)', () => {
      expect(calculateLatencyFactor(SCORING_CONFIG.LATENCY_BASELINE_MS)).toBe(0);
    });

    it('returns 0 above baseline', () => {
      expect(calculateLatencyFactor(SCORING_CONFIG.LATENCY_BASELINE_MS + 1000)).toBe(0);
    });

    it('returns 0.5 at half baseline', () => {
      expect(calculateLatencyFactor(SCORING_CONFIG.LATENCY_BASELINE_MS / 2)).toBeCloseTo(0.5, 5);
    });

    it('scales linearly between 0 and baseline', () => {
      const quarter = SCORING_CONFIG.LATENCY_BASELINE_MS * 0.25;
      expect(calculateLatencyFactor(quarter)).toBeCloseTo(0.75, 5);
    });
  });

  describe('calculateResourceFactor()', () => {
    it('returns 1 when undefined', () => {
      expect(calculateResourceFactor(undefined)).toBe(1);
    });

    it('returns 1 when 0', () => {
      expect(calculateResourceFactor(0)).toBe(1);
    });

    it('returns 1 for negative value', () => {
      expect(calculateResourceFactor(-100)).toBe(1);
    });

    it('returns 0 at baseline (512MB)', () => {
      expect(calculateResourceFactor(SCORING_CONFIG.MEMORY_BASELINE_BYTES)).toBe(0);
    });

    it('returns 0 above baseline', () => {
      expect(calculateResourceFactor(SCORING_CONFIG.MEMORY_BASELINE_BYTES + 1)).toBe(0);
    });

    it('returns 0.5 at half baseline', () => {
      expect(calculateResourceFactor(SCORING_CONFIG.MEMORY_BASELINE_BYTES / 2)).toBeCloseTo(0.5, 5);
    });
  });

  describe('calculateScore()', () => {
    it('incorrect submissions (0 correctness) get exactly 0 total score', () => {
      const harness: HarnessResult = {
        totalTests: 10,
        passedTests: 0,
        durationMs: 1000,
        memoryUsedBytes: 1000,
      };
      const result = calculateScore(harness);
      expect(result.totalScore).toBe(0);
      expect(result.correctness).toBe(0);
      expect(result.baseScore).toBe(0);
    });

    it('0 total tests produces 0 score', () => {
      const harness: HarnessResult = {
        totalTests: 0,
        passedTests: 0,
        durationMs: 1000,
      };
      const result = calculateScore(harness);
      expect(result.totalScore).toBe(0);
    });

    it('perfect submission with fast time gets maximum weighted score', () => {
      const harness: HarnessResult = {
        totalTests: 10,
        passedTests: 10,
        durationMs: 0,
        memoryUsedBytes: 0,
      };
      const result = calculateScore(harness);
      expect(result.correctness).toBe(1);
      expect(result.baseScore).toBe(SCORING_CONFIG.MAX_BASE_SCORE);
      expect(result.latencyFactor).toBe(1);
      expect(result.resourceFactor).toBe(1);
      // Weighted: 1000 * (0.7 + 0.2*1 + 0.1*1) = 1000
      expect(result.totalScore).toBe(1000);
    });

    it('weighted scoring: 70% correctness + 20% latency + 10% resources', () => {
      const harness: HarnessResult = {
        totalTests: 10,
        passedTests: 10,
        durationMs: SCORING_CONFIG.LATENCY_BASELINE_MS, // latencyFactor = 0
        memoryUsedBytes: SCORING_CONFIG.MEMORY_BASELINE_BYTES, // resourceFactor = 0
      };
      const result = calculateScore(harness);
      // Weighted: 1000 * (0.7 + 0.2*0 + 0.1*0) = 700
      expect(result.totalScore).toBe(700);
    });

    it('LLM bonus capped at 10% of base score', () => {
      const harness: HarnessResult = {
        totalTests: 10,
        passedTests: 10,
        durationMs: 0,
        memoryUsedBytes: 0,
      };
      const result = calculateScore(harness, { rawScore: 1.0 });
      // LLM bonus: 1.0 * 0.1 * 1000 = 100
      expect(result.llmBonus).toBe(100);
      // Total: 1000 + 100 = 1100
      expect(result.totalScore).toBe(1100);
    });

    it('LLM bonus on 0-score submission = 0', () => {
      const harness: HarnessResult = {
        totalTests: 10,
        passedTests: 0,
        durationMs: 1000,
      };
      const result = calculateScore(harness, { rawScore: 1.0 });
      expect(result.llmBonus).toBe(0);
      expect(result.totalScore).toBe(0);
    });

    it('LLM rawScore is clamped to [0, 1]', () => {
      const harness: HarnessResult = {
        totalTests: 10,
        passedTests: 10,
        durationMs: 0,
        memoryUsedBytes: 0,
      };
      // rawScore > 1 should be clamped to 1
      const result = calculateScore(harness, { rawScore: 5.0 });
      expect(result.llmBonus).toBe(100); // max is 0.1 * 1000
    });

    it('LLM rawScore < 0 is clamped to 0', () => {
      const harness: HarnessResult = {
        totalTests: 10,
        passedTests: 10,
        durationMs: 0,
        memoryUsedBytes: 0,
      };
      const result = calculateScore(harness, { rawScore: -0.5 });
      expect(result.llmBonus).toBe(0);
    });

    it('partial correctness with no LLM bonus', () => {
      const harness: HarnessResult = {
        totalTests: 10,
        passedTests: 5,
        durationMs: 0,
        memoryUsedBytes: 0,
      };
      const result = calculateScore(harness);
      expect(result.correctness).toBe(0.5);
      expect(result.baseScore).toBe(500);
      // Weighted: 500 * (0.7 + 0.2*1 + 0.1*1) = 500
      expect(result.totalScore).toBe(500);
    });

    it('latency and resource factors are 0 when baseScore is 0', () => {
      const harness: HarnessResult = {
        totalTests: 10,
        passedTests: 0,
        durationMs: 100,
        memoryUsedBytes: 100,
      };
      const result = calculateScore(harness);
      expect(result.latencyFactor).toBe(0);
      expect(result.resourceFactor).toBe(0);
    });

    it('scores are rounded to 2 decimal places', () => {
      const harness: HarnessResult = {
        totalTests: 3,
        passedTests: 1,
        durationMs: 10_000,
        memoryUsedBytes: 100_000_000,
      };
      const result = calculateScore(harness);
      // Verify rounding by checking decimal places
      const scoreStr = result.totalScore.toString();
      const parts = scoreStr.split('.');
      if (parts.length > 1) {
        expect(parts[1].length).toBeLessThanOrEqual(2);
      }
    });
  });
});

// ---------------------------------------------------------------------------
// 4. Timing Tests
// ---------------------------------------------------------------------------
describe('Timing', () => {
  describe('PHASE_DURATIONS_MS', () => {
    it('briefing is 10s', () => {
      expect(PHASE_DURATIONS_MS.briefing).toBe(10_000);
    });

    it('hidden_bid is 30s', () => {
      expect(PHASE_DURATIONS_MS.hidden_bid).toBe(30_000);
    });

    it('bid_resolve is 5s', () => {
      expect(PHASE_DURATIONS_MS.bid_resolve).toBe(5_000);
    });

    it('equip is 30s', () => {
      expect(PHASE_DURATIONS_MS.equip).toBe(30_000);
    });

    it('run is 60s', () => {
      expect(PHASE_DURATIONS_MS.run).toBe(60_000);
    });

    it('resolve is 15s', () => {
      expect(PHASE_DURATIONS_MS.resolve).toBe(15_000);
    });

    it('final_standings is 0 (instant)', () => {
      expect(PHASE_DURATIONS_MS.final_standings).toBe(0);
    });
  });

  describe('calculateDeadline()', () => {
    it('produces correct future timestamp for briefing phase', () => {
      const start = new Date('2025-01-01T00:00:00Z');
      const deadline = calculateDeadline('briefing', start);
      expect(deadline).not.toBeNull();
      expect(deadline!.getTime()).toBe(start.getTime() + 10_000);
    });

    it('produces correct future timestamp for run phase', () => {
      const start = new Date('2025-01-01T00:00:00Z');
      const deadline = calculateDeadline('run', start);
      expect(deadline).not.toBeNull();
      expect(deadline!.getTime()).toBe(start.getTime() + 60_000);
    });

    it('returns null for final_standings (0 duration)', () => {
      const start = new Date('2025-01-01T00:00:00Z');
      const deadline = calculateDeadline('final_standings', start);
      expect(deadline).toBeNull();
    });
  });

  describe('remainingMs()', () => {
    it('returns correct remaining time when deadline is in the future', () => {
      const now = new Date('2025-01-01T00:00:10Z');
      const deadline = new Date('2025-01-01T00:00:30Z');
      expect(remainingMs(deadline, now)).toBe(20_000);
    });

    it('returns 0 when deadline has passed', () => {
      const now = new Date('2025-01-01T00:01:00Z');
      const deadline = new Date('2025-01-01T00:00:30Z');
      expect(remainingMs(deadline, now)).toBe(0);
    });

    it('returns 0 when deadline is exactly now', () => {
      const now = new Date('2025-01-01T00:00:30Z');
      const deadline = new Date('2025-01-01T00:00:30Z');
      expect(remainingMs(deadline, now)).toBe(0);
    });

    it('returns 0 for null deadline', () => {
      expect(remainingMs(null, new Date())).toBe(0);
    });
  });

  describe('isDeadlineExpired()', () => {
    it('returns false when deadline is in the future', () => {
      const now = new Date('2025-01-01T00:00:10Z');
      const deadline = new Date('2025-01-01T00:00:30Z');
      expect(isDeadlineExpired(deadline, now)).toBe(false);
    });

    it('returns true when deadline has passed', () => {
      const now = new Date('2025-01-01T00:01:00Z');
      const deadline = new Date('2025-01-01T00:00:30Z');
      expect(isDeadlineExpired(deadline, now)).toBe(true);
    });

    it('returns true when deadline is exactly now', () => {
      const now = new Date('2025-01-01T00:00:30Z');
      expect(isDeadlineExpired(new Date('2025-01-01T00:00:30Z'), now)).toBe(true);
    });

    it('returns true for null deadline (instant phase)', () => {
      expect(isDeadlineExpired(null)).toBe(true);
    });
  });

  describe('fullRoundDurationMs()', () => {
    it('returns sum of all phase durations', () => {
      const expected = 10_000 + 30_000 + 5_000 + 30_000 + 60_000 + 15_000;
      expect(fullRoundDurationMs()).toBe(expected);
      expect(fullRoundDurationMs()).toBe(150_000); // 150 seconds
    });
  });
});

// ---------------------------------------------------------------------------
// 5. Equip Validation Tests
// ---------------------------------------------------------------------------
describe('Equip', () => {
  const auctionResults: AuctionResult[] = [
    { managerId: 'm1', amount: 50, pickOrder: 1 },
    { managerId: 'm2', amount: 30, pickOrder: 2 },
  ];
  const availableTools = ['tool-a', 'tool-b', 'tool-c', 'tool-d'];
  const availableHazards = ['hazard-x', 'hazard-y'];

  describe('validateEquipSelection()', () => {
    it('accepts valid equip selection', () => {
      const selection: EquipSelection = {
        managerId: 'm1',
        toolIds: ['tool-a', 'tool-b'],
        hazardIds: ['hazard-x'],
      };
      const result = validateEquipSelection(
        selection,
        auctionResults,
        availableTools,
        availableHazards,
      );
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('accepts empty tool and hazard selection', () => {
      const selection: EquipSelection = {
        managerId: 'm1',
        toolIds: [],
        hazardIds: [],
      };
      const result = validateEquipSelection(
        selection,
        auctionResults,
        availableTools,
        availableHazards,
      );
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('rejects manager who did not participate in auction', () => {
      const selection: EquipSelection = {
        managerId: 'unknown',
        toolIds: ['tool-a'],
        hazardIds: [],
      };
      const result = validateEquipSelection(
        selection,
        auctionResults,
        availableTools,
        availableHazards,
      );
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0]).toContain('did not participate');
    });

    it('rejects invalid tool IDs', () => {
      const selection: EquipSelection = {
        managerId: 'm1',
        toolIds: ['tool-a', 'nonexistent-tool'],
        hazardIds: [],
      };
      const result = validateEquipSelection(
        selection,
        auctionResults,
        availableTools,
        availableHazards,
      );
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("'nonexistent-tool'"))).toBe(true);
    });

    it('rejects duplicate tools', () => {
      const selection: EquipSelection = {
        managerId: 'm1',
        toolIds: ['tool-a', 'tool-a'],
        hazardIds: [],
      };
      const result = validateEquipSelection(
        selection,
        auctionResults,
        availableTools,
        availableHazards,
      );
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Duplicate'))).toBe(true);
    });

    it('rejects too many tools exceeding max per round', () => {
      const selection: EquipSelection = {
        managerId: 'm1',
        toolIds: ['tool-a', 'tool-b', 'tool-c', 'tool-d'],
        hazardIds: [],
      };
      const result = validateEquipSelection(
        selection,
        auctionResults,
        availableTools,
        availableHazards,
        3, // max 3 tools
      );
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Too many tools'))).toBe(true);
    });

    it('rejects invalid hazard IDs', () => {
      const selection: EquipSelection = {
        managerId: 'm1',
        toolIds: [],
        hazardIds: ['hazard-x', 'unknown-hazard'],
      };
      const result = validateEquipSelection(
        selection,
        auctionResults,
        availableTools,
        availableHazards,
      );
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("'unknown-hazard'"))).toBe(true);
    });

    it('accumulates multiple errors', () => {
      const selection: EquipSelection = {
        managerId: 'm1',
        toolIds: ['tool-a', 'tool-a', 'bad-tool'],
        hazardIds: ['bad-hazard'],
      };
      const result = validateEquipSelection(
        selection,
        auctionResults,
        availableTools,
        availableHazards,
      );
      expect(result.valid).toBe(false);
      // Should have errors for: invalid tool, duplicate tools, invalid hazard
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
    });

    it('respects custom maxToolsPerRound', () => {
      const selection: EquipSelection = {
        managerId: 'm1',
        toolIds: ['tool-a', 'tool-b'],
        hazardIds: [],
      };
      // With max 1, selecting 2 should fail
      const result = validateEquipSelection(
        selection,
        auctionResults,
        availableTools,
        availableHazards,
        1,
      );
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Too many tools'))).toBe(true);
    });
  });

  describe('getDefaultEquipSelection()', () => {
    it('returns empty selection for given managerId', () => {
      const selection = getDefaultEquipSelection('mgr-42');
      expect(selection.managerId).toBe('mgr-42');
      expect(selection.toolIds).toEqual([]);
      expect(selection.hazardIds).toEqual([]);
    });
  });
});

// ---------------------------------------------------------------------------
// 6. Standings Tests
// ---------------------------------------------------------------------------
describe('Standings', () => {
  const STANDINGS_SEED = 'standings-seed-99';
  const managerIds = ['alice', 'bob', 'charlie'];

  function makeRoundScore(managerId: string, round: number, totalScore: number): RoundScore {
    return {
      managerId,
      round,
      score: {
        correctness: 1,
        baseScore: totalScore,
        latencyFactor: 1,
        resourceFactor: 1,
        llmBonus: 0,
        totalScore,
      },
    };
  }

  describe('calculateStandings()', () => {
    it('accumulates scores correctly across rounds', () => {
      const scores: RoundScore[] = [
        makeRoundScore('alice', 1, 100),
        makeRoundScore('bob', 1, 200),
        makeRoundScore('charlie', 1, 150),
        makeRoundScore('alice', 2, 300),
        makeRoundScore('bob', 2, 100),
        makeRoundScore('charlie', 2, 100),
      ];

      const standings = calculateStandings(managerIds, scores, 2, STANDINGS_SEED);
      expect(standings.length).toBe(3);

      // Alice: 100 + 300 = 400
      const alice = standings.find((s) => s.managerId === 'alice')!;
      expect(alice.totalScore).toBe(400);

      // Bob: 200 + 100 = 300
      const bob = standings.find((s) => s.managerId === 'bob')!;
      expect(bob.totalScore).toBe(300);

      // Charlie: 150 + 100 = 250
      const charlie = standings.find((s) => s.managerId === 'charlie')!;
      expect(charlie.totalScore).toBe(250);
    });

    it('sorts by total score descending', () => {
      const scores: RoundScore[] = [
        makeRoundScore('alice', 1, 100),
        makeRoundScore('bob', 1, 300),
        makeRoundScore('charlie', 1, 200),
      ];

      const standings = calculateStandings(managerIds, scores, 1, STANDINGS_SEED);
      expect(standings[0].managerId).toBe('bob');
      expect(standings[0].rank).toBe(1);
      expect(standings[1].managerId).toBe('charlie');
      expect(standings[1].rank).toBe(2);
      expect(standings[2].managerId).toBe('alice');
      expect(standings[2].rank).toBe(3);
    });

    it('assigns ranks 1-based', () => {
      const scores: RoundScore[] = [
        makeRoundScore('alice', 1, 100),
        makeRoundScore('bob', 1, 200),
        makeRoundScore('charlie', 1, 50),
      ];

      const standings = calculateStandings(managerIds, scores, 1, STANDINGS_SEED);
      expect(standings.map((s) => s.rank)).toEqual([1, 2, 3]);
    });

    it('tie-breaking by latest round score (higher wins)', () => {
      const scores: RoundScore[] = [
        // Both tied at 300 total
        makeRoundScore('alice', 1, 200),
        makeRoundScore('alice', 2, 100),
        makeRoundScore('bob', 1, 100),
        makeRoundScore('bob', 2, 200),
        makeRoundScore('charlie', 1, 50),
        makeRoundScore('charlie', 2, 50),
      ];

      const standings = calculateStandings(managerIds, scores, 2, STANDINGS_SEED);
      // Alice and Bob both have 300 total
      // Bob scored 200 in round 2 vs Alice 100, so Bob wins tiebreak
      const topTwo = standings.filter((s) => s.totalScore === 300);
      expect(topTwo[0].managerId).toBe('bob');
      expect(topTwo[1].managerId).toBe('alice');
    });

    it('tie-breaking is deterministic with same seed', () => {
      const scores: RoundScore[] = [
        makeRoundScore('alice', 1, 100),
        makeRoundScore('bob', 1, 100),
        makeRoundScore('charlie', 1, 100),
      ];

      const standings1 = calculateStandings(managerIds, scores, 1, STANDINGS_SEED);
      const standings2 = calculateStandings(managerIds, scores, 1, STANDINGS_SEED);

      expect(standings1.map((s) => s.managerId)).toEqual(standings2.map((s) => s.managerId));
    });

    it('handles managers with no scores (0 total)', () => {
      const standings = calculateStandings(managerIds, [], 1, STANDINGS_SEED);
      expect(standings.length).toBe(3);
      standings.forEach((s) => {
        expect(s.totalScore).toBe(0);
      });
    });

    it('roundScores array has correct length matching completedRounds', () => {
      const scores: RoundScore[] = [
        makeRoundScore('alice', 1, 100),
        makeRoundScore('alice', 2, 200),
        makeRoundScore('bob', 1, 150),
        makeRoundScore('bob', 2, 150),
        makeRoundScore('charlie', 1, 80),
        makeRoundScore('charlie', 2, 90),
      ];

      const standings = calculateStandings(managerIds, scores, 2, STANDINGS_SEED);
      standings.forEach((s) => {
        expect(s.roundScores.length).toBe(2);
      });
    });

    it('roundScores contain correct per-round values', () => {
      const scores: RoundScore[] = [
        makeRoundScore('alice', 1, 100),
        makeRoundScore('alice', 2, 200),
      ];

      const standings = calculateStandings(['alice'], scores, 2, STANDINGS_SEED);
      expect(standings[0].roundScores).toEqual([100, 200]);
    });
  });

  describe('finalizaStandings()', () => {
    it('calculates standings for 5 completed rounds', () => {
      const scores: RoundScore[] = [];
      for (let round = 1; round <= 5; round++) {
        scores.push(makeRoundScore('alice', round, 100));
        scores.push(makeRoundScore('bob', round, 200));
      }

      const standings = finalizaStandings(['alice', 'bob'], scores, STANDINGS_SEED);
      expect(standings.length).toBe(2);
      expect(standings[0].managerId).toBe('bob');
      expect(standings[0].totalScore).toBe(1000); // 200 * 5
      expect(standings[1].managerId).toBe('alice');
      expect(standings[1].totalScore).toBe(500); // 100 * 5
    });

    it('produces roundScores of length 5', () => {
      const scores: RoundScore[] = [];
      for (let round = 1; round <= 5; round++) {
        scores.push(makeRoundScore('alice', round, round * 10));
      }

      const standings = finalizaStandings(['alice'], scores, STANDINGS_SEED);
      expect(standings[0].roundScores.length).toBe(5);
      expect(standings[0].roundScores).toEqual([10, 20, 30, 40, 50]);
    });
  });
});

// ---------------------------------------------------------------------------
// 7. Full 5-Round Simulation Integration Test
// ---------------------------------------------------------------------------
describe('Full 5-round simulation (integration)', () => {
  const SIMULATION_SEED = 'integration-test-seed-777';

  it('simulateFullMatch produces exactly 31 states', () => {
    const states = simulateFullMatch(SIMULATION_SEED);
    expect(states.length).toBe(31);
  });

  it('final state is terminal', () => {
    const states = simulateFullMatch(SIMULATION_SEED);
    const finalState = states[states.length - 1];
    expect(finalState.isTerminal).toBe(true);
    expect(finalState.phase).toBe('final_standings');
  });

  it('running twice with same seed produces identical results', () => {
    const run1 = simulateFullMatch(SIMULATION_SEED);
    const run2 = simulateFullMatch(SIMULATION_SEED);

    expect(run1.length).toBe(run2.length);

    for (let i = 0; i < run1.length; i++) {
      expect(run1[i].round).toBe(run2[i].round);
      expect(run1[i].phase).toBe(run2[i].phase);
      expect(run1[i].seed).toBe(run2[i].seed);
      expect(run1[i].rngState).toBe(run2[i].rngState);
      expect(run1[i].isTerminal).toBe(run2[i].isTerminal);
    }
  });

  it('all non-terminal states have isTerminal === false', () => {
    const states = simulateFullMatch(SIMULATION_SEED);
    for (let i = 0; i < states.length - 1; i++) {
      expect(states[i].isTerminal).toBe(false);
    }
  });

  it('phase and round sequence matches expected full match progression', () => {
    const states = simulateFullMatch(SIMULATION_SEED);

    let stateIndex = 0;
    for (let round = 1; round <= 5; round++) {
      for (const phase of PHASES) {
        expect(states[stateIndex].round).toBe(round);
        expect(states[stateIndex].phase).toBe(phase);
        stateIndex++;
      }
    }
    // Last state should be final_standings
    expect(states[stateIndex].phase).toBe('final_standings');
    expect(states[stateIndex].round).toBe(5);
    expect(stateIndex).toBe(30);
  });

  it('all states preserve the seed', () => {
    const states = simulateFullMatch(SIMULATION_SEED);
    for (const state of states) {
      expect(state.seed).toBe(SIMULATION_SEED);
    }
  });

  it('rngState changes with each transition', () => {
    const states = simulateFullMatch(SIMULATION_SEED);
    const rngStates = states.map((s) => s.rngState);
    // All rngStates should be unique (each transition advances RNG)
    const uniqueRngStates = new Set(rngStates);
    expect(uniqueRngStates.size).toBe(rngStates.length);
  });
});
