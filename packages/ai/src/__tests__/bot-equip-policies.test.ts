/**
 * Deterministic unit tests for bot equip policies.
 * Issue: 5li.4
 *
 * AC:
 *  - All 3 bots submit valid equip selections every round
 *  - Selections respect auction results (only won tools)
 *  - Same seed produces same equips (determinism)
 */

import { describe, it, expect } from 'vitest';

import { generateBotEquip } from '../bots/bot-policies.js';
import type {
  BotEquipContext,
  BotPersonality,
  ToolInfo,
  HazardInfo,
} from '../bots/bot-policies.js';

// ─── Helpers ─────────────────────────────────────────────────────────

const ALL_TOOLS: ToolInfo[] = [
  { id: 'extra-time', effectTarget: 'time' },
  { id: 'memory-boost', effectTarget: 'memory' },
  { id: 'context-hints', effectTarget: 'hints' },
  { id: 'debugger-access', effectTarget: 'debug' },
  { id: 'test-preview', effectTarget: 'tests' },
  { id: 'retry-attempt', effectTarget: 'retries' },
  { id: 'code-template', effectTarget: 'template' },
  { id: 'data-file-access', effectTarget: 'hints' },
];

const TIME_HAZARD: HazardInfo = { id: 'time-crunch', modifierTarget: 'time' };
const MEMORY_HAZARD: HazardInfo = { id: 'memory-squeeze', modifierTarget: 'memory' };
const VISIBILITY_HAZARD: HazardInfo = { id: 'fog-of-war', modifierTarget: 'visibility' };
const NOISY_HAZARD: HazardInfo = { id: 'noisy-input', modifierTarget: 'input' };
const STDLIB_HAZARD: HazardInfo = { id: 'restricted-stdlib', modifierTarget: 'stdlib' };

function makeContext(overrides: Partial<BotEquipContext> = {}): BotEquipContext {
  return {
    managerId: 'bot-0',
    personality: 'aggressive',
    round: 1,
    totalRounds: 5,
    currentRank: 2,
    totalManagers: 4,
    wonTools: ALL_TOOLS.slice(0, 4),
    activeHazards: [],
    maxTools: 3,
    seed: 'test-seed-42',
    ...overrides,
  };
}

// ─── Determinism ─────────────────────────────────────────────────────

describe('generateBotEquip determinism', () => {
  const personalities: BotPersonality[] = ['aggressive', 'conservative', 'balanced'];

  for (const personality of personalities) {
    it(`${personality}: same seed + context produces identical selections`, () => {
      const ctx = makeContext({ personality });
      const a = generateBotEquip(ctx);
      const b = generateBotEquip(ctx);
      expect(a).toStrictEqual(b);
    });
  }

  it('different seeds produce different tie-break ordering', () => {
    // Use tools with the same priority tier so RNG tie-breaking has an effect.
    // Both 'context-hints' and 'data-file-access' have effectTarget 'hints',
    // and 'debugger-access' has 'debug' — all low priority. With 3 equal-tier
    // tools, seed differences surface in ordering.
    const sameTierTools: ToolInfo[] = [
      { id: 'tool-a', effectTarget: 'hints' },
      { id: 'tool-b', effectTarget: 'hints' },
      { id: 'tool-c', effectTarget: 'hints' },
      { id: 'tool-d', effectTarget: 'hints' },
    ];
    const ctxA = makeContext({
      seed: 'seed-alpha',
      personality: 'aggressive',
      wonTools: sameTierTools,
      maxTools: 3,
    });
    const ctxB = makeContext({
      seed: 'seed-beta',
      personality: 'aggressive',
      wonTools: sameTierTools,
      maxTools: 3,
    });
    const a = generateBotEquip(ctxA);
    const b = generateBotEquip(ctxB);
    // With 4 same-priority tools and 3 picks, different seeds should yield
    // different subsets or orderings
    expect(a.toolIds.join(',')).not.toBe(b.toolIds.join(','));
  });

  it('different rounds with same seed produce different tie-break ordering', () => {
    const sameTierTools: ToolInfo[] = [
      { id: 'tool-a', effectTarget: 'hints' },
      { id: 'tool-b', effectTarget: 'hints' },
      { id: 'tool-c', effectTarget: 'hints' },
      { id: 'tool-d', effectTarget: 'hints' },
    ];
    const ctx1 = makeContext({
      round: 1,
      personality: 'aggressive',
      wonTools: sameTierTools,
      maxTools: 3,
    });
    const ctx2 = makeContext({
      round: 2,
      personality: 'aggressive',
      wonTools: sameTierTools,
      maxTools: 3,
    });
    const a = generateBotEquip(ctx1);
    const b = generateBotEquip(ctx2);
    // Round is mixed into seed, so tie-breaking differs
    expect(a.toolIds.join(',')).not.toBe(b.toolIds.join(','));
  });
});

// ─── Auction Respect ─────────────────────────────────────────────────

describe('generateBotEquip respects auction results', () => {
  const personalities: BotPersonality[] = ['aggressive', 'conservative', 'balanced'];

  for (const personality of personalities) {
    it(`${personality}: only selects tools from wonTools`, () => {
      const wonTools = ALL_TOOLS.slice(0, 3); // Only 3 tools won
      const wonIds = new Set(wonTools.map((t) => t.id));
      const ctx = makeContext({ personality, wonTools, maxTools: 3 });
      const result = generateBotEquip(ctx);

      for (const toolId of result.toolIds) {
        expect(wonIds.has(toolId)).toBe(true);
      }
    });
  }

  it('returns empty selection when no tools were won', () => {
    const ctx = makeContext({ wonTools: [] });
    const result = generateBotEquip(ctx);
    expect(result.toolIds).toHaveLength(0);
    expect(result.hazardIds).toHaveLength(0);
  });

  it('returns empty selection when maxTools is 0', () => {
    const ctx = makeContext({ maxTools: 0 });
    const result = generateBotEquip(ctx);
    expect(result.toolIds).toHaveLength(0);
  });

  it('never exceeds maxTools limit', () => {
    const ctx = makeContext({ wonTools: ALL_TOOLS, maxTools: 2 });
    const result = generateBotEquip(ctx);
    expect(result.toolIds.length).toBeLessThanOrEqual(2);
  });

  it('never selects duplicate tools', () => {
    for (const personality of personalities) {
      const ctx = makeContext({ personality, wonTools: ALL_TOOLS, maxTools: 5 });
      const result = generateBotEquip(ctx);
      const unique = new Set(result.toolIds);
      expect(unique.size).toBe(result.toolIds.length);
    }
  });
});

// ─── Common Properties ───────────────────────────────────────────────

describe('generateBotEquip common properties', () => {
  it('managerId in output matches context', () => {
    const ctx = makeContext({ managerId: 'bot-7' });
    const result = generateBotEquip(ctx);
    expect(result.managerId).toBe('bot-7');
  });

  it('hazardIds is always empty (bots do not self-impose hazards)', () => {
    const personalities: BotPersonality[] = ['aggressive', 'conservative', 'balanced'];
    for (const personality of personalities) {
      const ctx = makeContext({ personality });
      const result = generateBotEquip(ctx);
      expect(result.hazardIds).toStrictEqual([]);
    }
  });

  it('when wonTools < maxTools, equips at most wonTools count', () => {
    const wonTools = ALL_TOOLS.slice(0, 2);
    const ctx = makeContext({ wonTools, maxTools: 5, personality: 'aggressive' });
    const result = generateBotEquip(ctx);
    expect(result.toolIds.length).toBeLessThanOrEqual(2);
  });
});

// ─── Aggressive Policy ──────────────────────────────────────────────

describe('aggressive equip policy', () => {
  it('prioritizes high-impact tools (retries, time, memory)', () => {
    const ctx = makeContext({
      personality: 'aggressive',
      wonTools: ALL_TOOLS,
      maxTools: 3,
    });
    const result = generateBotEquip(ctx);

    // Aggressive priority: retries > time > memory > hints > tests > debug > template
    // With all 8 tools available and maxTools=3, top 3 should be retries, time, memory
    expect(result.toolIds).toContain('retry-attempt');
    expect(result.toolIds).toContain('extra-time');
    expect(result.toolIds).toContain('memory-boost');
  });

  it('selects all available tools when fewer than maxTools', () => {
    const wonTools = [ALL_TOOLS[0], ALL_TOOLS[1]]; // extra-time, memory-boost
    const ctx = makeContext({
      personality: 'aggressive',
      wonTools,
      maxTools: 5,
    });
    const result = generateBotEquip(ctx);
    expect(result.toolIds).toHaveLength(2);
  });
});

// ─── Conservative Policy ─────────────────────────────────────────────

describe('conservative equip policy', () => {
  it('prioritizes counter-tools when hazards are active', () => {
    const ctx = makeContext({
      personality: 'conservative',
      wonTools: ALL_TOOLS,
      maxTools: 3,
      activeHazards: [TIME_HAZARD, MEMORY_HAZARD],
    });
    const result = generateBotEquip(ctx);

    // Should prioritize extra-time (counters time-crunch) and memory-boost (counters memory-squeeze)
    expect(result.toolIds).toContain('extra-time');
    expect(result.toolIds).toContain('memory-boost');
  });

  it('prioritizes test-preview when fog-of-war is active', () => {
    const ctx = makeContext({
      personality: 'conservative',
      wonTools: ALL_TOOLS,
      maxTools: 3,
      activeHazards: [VISIBILITY_HAZARD],
    });
    const result = generateBotEquip(ctx);

    // visibility hazard should be countered by tests effect target
    expect(result.toolIds).toContain('test-preview');
  });

  it('skips unsafe tools (only equips safe/counter tools)', () => {
    const ctx = makeContext({
      personality: 'conservative',
      wonTools: [
        { id: 'debugger-access', effectTarget: 'debug' },
        { id: 'code-template', effectTarget: 'template' },
        { id: 'context-hints', effectTarget: 'hints' },
      ],
      maxTools: 3,
      activeHazards: [], // no hazards to counter
    });
    const result = generateBotEquip(ctx);

    // None of these tools are "safe" (time, memory, retries, tests) or counter hazards
    // Conservative bot should skip all of them
    expect(result.toolIds).toHaveLength(0);
  });

  it('equips safe tools even without active hazards', () => {
    const ctx = makeContext({
      personality: 'conservative',
      wonTools: [
        { id: 'extra-time', effectTarget: 'time' },
        { id: 'retry-attempt', effectTarget: 'retries' },
        { id: 'debugger-access', effectTarget: 'debug' },
      ],
      maxTools: 3,
      activeHazards: [],
    });
    const result = generateBotEquip(ctx);

    // time and retries are safe, debug is not
    expect(result.toolIds).toContain('extra-time');
    expect(result.toolIds).toContain('retry-attempt');
    expect(result.toolIds).not.toContain('debugger-access');
  });
});

// ─── Balanced Policy ─────────────────────────────────────────────────

describe('balanced equip policy', () => {
  it('when behind (high rank), leans toward aggressive picks', () => {
    const ctx = makeContext({
      personality: 'balanced',
      currentRank: 4, // last place
      totalManagers: 4,
      wonTools: ALL_TOOLS,
      maxTools: 3,
    });
    const result = generateBotEquip(ctx);

    // When in last place (rankFactor = 1), aggressive weight is maximal
    // Should behave like aggressive — high-impact tools
    expect(result.toolIds).toContain('retry-attempt');
  });

  it('when ahead (low rank), leans toward conservative picks', () => {
    const ctx = makeContext({
      personality: 'balanced',
      currentRank: 1, // first place
      totalManagers: 4,
      wonTools: ALL_TOOLS,
      maxTools: 3,
      activeHazards: [TIME_HAZARD],
    });
    const result = generateBotEquip(ctx);

    // When in first place (rankFactor = 0), conservative weight is maximal
    // Should prioritize counter-tools and safe tools
    expect(result.toolIds).toContain('extra-time'); // counters time-crunch
  });

  it('always selects up to maxTools (unlike conservative)', () => {
    const ctx = makeContext({
      personality: 'balanced',
      wonTools: ALL_TOOLS,
      maxTools: 3,
      activeHazards: [],
    });
    const result = generateBotEquip(ctx);

    // Balanced always fills slots (does not skip "unsafe" tools)
    expect(result.toolIds).toHaveLength(3);
  });
});

// ─── All 3 Bots Produce Valid Equips Every Round (AC) ────────────────

describe('all 3 bot personalities produce valid equips every round', () => {
  const personalities: BotPersonality[] = ['aggressive', 'conservative', 'balanced'];
  const rounds = [1, 2, 3, 4, 5];
  const hazardSets: readonly HazardInfo[][] = [
    [],
    [TIME_HAZARD],
    [TIME_HAZARD, MEMORY_HAZARD],
    [VISIBILITY_HAZARD, NOISY_HAZARD],
    [TIME_HAZARD, MEMORY_HAZARD, VISIBILITY_HAZARD, NOISY_HAZARD, STDLIB_HAZARD],
  ];

  for (const personality of personalities) {
    for (let r = 0; r < rounds.length; r++) {
      it(`${personality} round ${rounds[r]}: valid equip selection`, () => {
        const wonTools = ALL_TOOLS.slice(0, 4 + r); // vary available tools per round
        const wonIds = new Set(wonTools.map((t) => t.id));
        const ctx = makeContext({
          managerId: `bot-${personality}`,
          personality,
          round: rounds[r],
          wonTools,
          activeHazards: hazardSets[r],
          maxTools: 3,
          seed: 'full-match-seed',
        });
        const result = generateBotEquip(ctx);

        // Valid structure
        expect(result.managerId).toBe(`bot-${personality}`);
        expect(Array.isArray(result.toolIds)).toBe(true);
        expect(Array.isArray(result.hazardIds)).toBe(true);

        // Respects maxTools
        expect(result.toolIds.length).toBeLessThanOrEqual(3);

        // Only won tools
        for (const toolId of result.toolIds) {
          expect(wonIds.has(toolId)).toBe(true);
        }

        // No duplicates
        expect(new Set(result.toolIds).size).toBe(result.toolIds.length);

        // No self-imposed hazards
        expect(result.hazardIds).toStrictEqual([]);
      });
    }
  }
});
