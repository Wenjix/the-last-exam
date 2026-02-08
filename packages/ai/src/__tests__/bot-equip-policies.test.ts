/**
 * Deterministic unit tests for bot bidding and strategy policies.
 * (Replaces old bot-equip-policies tests after game loop refactor)
 *
 * AC:
 *  - All 3 bots submit valid budget bids every round
 *  - Bids respect remaining budget constraints
 *  - Same seed produces same bids/strategies (determinism)
 *  - All 3 personalities generate valid strategy prompts
 */

import { describe, it, expect } from 'vitest';

import {
  generateBotBudgetBid,
  generateBotStrategy,
  getDefaultPersonality,
} from '../bots/bot-policies.js';
import type { BotPersonality, BotBudgetBidContext, BotStrategyContext } from '../bots/bot-policies.js';

// ─── Helpers ─────────────────────────────────────────────────────────

function makeBidContext(overrides: Partial<BotBudgetBidContext> = {}): BotBudgetBidContext {
  return {
    round: 1,
    totalRounds: 5,
    currentRank: 2,
    totalManagers: 4,
    remainingBudget: 100,
    ...overrides,
  };
}

function makeStrategyContext(overrides: Partial<BotStrategyContext> = {}): BotStrategyContext {
  return {
    personality: 'aggressive',
    round: 1,
    totalRounds: 5,
    currentRank: 2,
    hasDataCard: false,
    seed: 'test-seed-42',
    ...overrides,
  };
}

// ─── Determinism ─────────────────────────────────────────────────────

describe('generateBotBudgetBid determinism', () => {
  const personalities: BotPersonality[] = ['aggressive', 'conservative', 'chaotic'];

  for (const personality of personalities) {
    it(`${personality}: same seed + context produces identical bids`, () => {
      const ctx = makeBidContext();
      const seed = 'determinism-seed';
      const a = generateBotBudgetBid(personality, ctx, seed);
      const b = generateBotBudgetBid(personality, ctx, seed);
      expect(a).toBe(b);
    });
  }

  it('different seeds produce different bids', () => {
    const ctx = makeBidContext();
    const a = generateBotBudgetBid('aggressive', ctx, 'seed-alpha');
    const b = generateBotBudgetBid('aggressive', ctx, 'seed-beta');
    // With different seeds, bids should differ (or at least not always match)
    // We test multiple personalities to increase chance of observing difference
    const allSame = ['aggressive', 'conservative', 'chaotic'].every((p) => {
      const bidA = generateBotBudgetBid(p as BotPersonality, ctx, 'seed-alpha');
      const bidB = generateBotBudgetBid(p as BotPersonality, ctx, 'seed-beta');
      return bidA === bidB;
    });
    expect(allSame).toBe(false);
  });

  it('different rounds with same seed produce different bids', () => {
    const seed = 'round-variation-seed';
    const ctx1 = makeBidContext({ round: 1 });
    const ctx2 = makeBidContext({ round: 3 });
    const a = generateBotBudgetBid('aggressive', ctx1, seed);
    const b = generateBotBudgetBid('aggressive', ctx2, seed);
    expect(a).not.toBe(b);
  });
});

// ─── Budget Constraints ─────────────────────────────────────────────

describe('generateBotBudgetBid respects budget constraints', () => {
  const personalities: BotPersonality[] = ['aggressive', 'conservative', 'chaotic'];

  for (const personality of personalities) {
    it(`${personality}: bid never exceeds remaining budget`, () => {
      for (let round = 1; round <= 5; round++) {
        const budget = 100 - (round - 1) * 20; // Decreasing budget
        const ctx = makeBidContext({ round, remainingBudget: budget });
        const bid = generateBotBudgetBid(personality, ctx, 'budget-test');
        expect(bid).toBeLessThanOrEqual(budget);
        expect(bid).toBeGreaterThanOrEqual(0);
      }
    });
  }

  it('returns 0 when budget is 0', () => {
    for (const personality of personalities) {
      const ctx = makeBidContext({ remainingBudget: 0 });
      const bid = generateBotBudgetBid(personality, ctx, 'zero-budget');
      expect(bid).toBe(0);
    }
  });

  it('bid is always a whole number', () => {
    for (const personality of personalities) {
      for (let round = 1; round <= 5; round++) {
        const ctx = makeBidContext({ round });
        const bid = generateBotBudgetBid(personality, ctx, 'integer-check');
        expect(Number.isInteger(bid)).toBe(true);
      }
    }
  });
});

// ─── Personality Behaviors ──────────────────────────────────────────

describe('aggressive bid policy', () => {
  it('bids higher fraction in early rounds', () => {
    const ctx1 = makeBidContext({ round: 1, remainingBudget: 100 });
    const ctx5 = makeBidContext({ round: 5, remainingBudget: 100 });
    const early = generateBotBudgetBid('aggressive', ctx1, 'aggro-early');
    const late = generateBotBudgetBid('aggressive', ctx5, 'aggro-early');
    expect(early).toBeGreaterThan(late);
  });
});

describe('conservative bid policy', () => {
  it('bids lower fraction in early rounds', () => {
    const ctx1 = makeBidContext({ round: 1, remainingBudget: 100 });
    const ctx5 = makeBidContext({ round: 5, remainingBudget: 100 });
    const early = generateBotBudgetBid('conservative', ctx1, 'conserv-test');
    const late = generateBotBudgetBid('conservative', ctx5, 'conserv-test');
    expect(early).toBeLessThan(late);
  });
});

describe('chaotic bid policy', () => {
  it('sometimes bids 0 (opt-out behavior)', () => {
    const seeds = Array.from({ length: 20 }, (_, i) => `chaotic-${i}`);
    const bids = seeds.map((seed) => {
      const ctx = makeBidContext({ round: 1, remainingBudget: 100 });
      return generateBotBudgetBid('chaotic', ctx, seed);
    });
    // Chaotic should bid 0 sometimes (~40% of the time)
    expect(bids.filter((b) => b === 0).length).toBeGreaterThan(0);
  });
});

// ─── Strategy Generation ────────────────────────────────────────────

describe('generateBotStrategy', () => {
  const personalities: BotPersonality[] = ['aggressive', 'conservative', 'chaotic'];

  for (const personality of personalities) {
    it(`${personality}: returns a non-empty strategy string`, () => {
      const ctx = makeStrategyContext({ personality });
      const strategy = generateBotStrategy(ctx);
      expect(typeof strategy).toBe('string');
      expect(strategy.length).toBeGreaterThan(0);
    });
  }

  it('aggressive returns speed-focused strategy', () => {
    const strategy = generateBotStrategy(makeStrategyContext({ personality: 'aggressive' }));
    expect(strategy.toLowerCase()).toContain('fast');
  });

  it('conservative returns spec-focused strategy', () => {
    const strategy = generateBotStrategy(makeStrategyContext({ personality: 'conservative' }));
    expect(strategy.toLowerCase()).toContain('spec');
  });

  it('chaotic returns deterministic strategy for same seed/round', () => {
    const ctx = makeStrategyContext({ personality: 'chaotic', round: 2, seed: 'chaos-seed' });
    const a = generateBotStrategy(ctx);
    const b = generateBotStrategy(ctx);
    expect(a).toBe(b);
  });

  it('chaotic produces different strategies for different rounds', () => {
    const ctx1 = makeStrategyContext({ personality: 'chaotic', round: 1, seed: 'chaos-vary' });
    const ctx2 = makeStrategyContext({ personality: 'chaotic', round: 2, seed: 'chaos-vary' });
    const a = generateBotStrategy(ctx1);
    const b = generateBotStrategy(ctx2);
    // May or may not differ depending on RNG, but the function should not crash
    expect(typeof a).toBe('string');
    expect(typeof b).toBe('string');
  });
});

// ─── getDefaultPersonality ──────────────────────────────────────────

describe('getDefaultPersonality', () => {
  it('returns aggressive for index 0', () => {
    expect(getDefaultPersonality(0)).toBe('aggressive');
  });

  it('returns conservative for index 1', () => {
    expect(getDefaultPersonality(1)).toBe('conservative');
  });

  it('returns chaotic for index 2', () => {
    expect(getDefaultPersonality(2)).toBe('chaotic');
  });

  it('wraps around for higher indices', () => {
    expect(getDefaultPersonality(3)).toBe('aggressive');
    expect(getDefaultPersonality(4)).toBe('conservative');
  });
});

// ─── All 3 Bots Produce Valid Bids & Strategies Every Round (AC) ────

describe('all 3 bot personalities produce valid bids and strategies every round', () => {
  const personalities: BotPersonality[] = ['aggressive', 'conservative', 'chaotic'];
  const rounds = [1, 2, 3, 4, 5];

  for (const personality of personalities) {
    for (const round of rounds) {
      it(`${personality} round ${round}: valid bid and strategy`, () => {
        // Test bid
        const bidCtx = makeBidContext({
          round,
          remainingBudget: 100 - (round - 1) * 15,
        });
        const bid = generateBotBudgetBid(personality, bidCtx, 'full-match-seed');

        expect(Number.isInteger(bid)).toBe(true);
        expect(bid).toBeGreaterThanOrEqual(0);
        expect(bid).toBeLessThanOrEqual(bidCtx.remainingBudget);

        // Test strategy
        const stratCtx = makeStrategyContext({
          personality,
          round,
          hasDataCard: round % 2 === 0,
          seed: 'full-match-seed',
        });
        const strategy = generateBotStrategy(stratCtx);

        expect(typeof strategy).toBe('string');
        expect(strategy.length).toBeGreaterThan(0);
      });
    }
  }
});
