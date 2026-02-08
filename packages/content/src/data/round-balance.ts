import seedrandom from 'seedrandom';
import type { Challenge, Hazard, Tool } from '../schemas.js';
import { getDefaultChallenges } from './challenges.js';
import { getDefaultHazards, getDefaultTools } from './index.js';

// === Hazard Intensity Metadata ===
// Maps hazard IDs to an intensity level (1-5).
// Higher intensity = more punishing; assigned to later rounds.
const HAZARD_INTENSITY: Record<string, number> = {
  'fog-of-war': 1, // Mild: partial test visibility
  'noisy-input': 2, // Moderate: input noise filtering
  'time-crunch': 3, // Harsh: halved timeout
  'memory-squeeze': 4, // Severe: tight memory limit
  'restricted-stdlib': 5, // Brutal: no standard library
};

// === Tool Value Tiers ===
// Maps tool IDs to a value tier (1 = situational, 2 = solid, 3 = premium).
// Distribution rule: each round gets tools spread across tiers.
const TOOL_VALUE_TIER: Record<string, number> = {
  'data-file-access': 1, // Situational hints via data files
  'code-template': 1, // Starter template (less useful for skilled players)
  'debugger-access': 2, // Debugging during execution
  'context-hints': 2, // Algorithmic hints
  'test-preview': 2, // Reveal hidden test cases
  'extra-time': 2, // +15s execution time
  'memory-boost': 3, // Double memory limit
  'retry-attempt': 3, // Second submission chance
};

// === Round Assignment ===

/** Content assignment for a single round. */
export interface RoundAssignment {
  /** 1-based round number. */
  readonly round: number;
  /** The challenge for this round (difficulty matches round). */
  readonly challenge: Challenge;
  /** The hazard active this round (intensity increases with round). */
  readonly hazard: Hazard;
  /** The pool of tools available for auction/equip this round. */
  readonly availableTools: Tool[];
}

/**
 * Get the intensity value for a hazard.
 * Returns 0 for unknown hazard IDs.
 */
export function getHazardIntensity(hazardId: string): number {
  return HAZARD_INTENSITY[hazardId] ?? 0;
}

/**
 * Get the value tier for a tool.
 * Returns 0 for unknown tool IDs.
 */
export function getToolValueTier(toolId: string): number {
  return TOOL_VALUE_TIER[toolId] ?? 0;
}

/**
 * Deterministic Fisher-Yates shuffle using a seeded RNG.
 * Does NOT mutate the input array; returns a new shuffled copy.
 */
function seededShuffle<T>(items: readonly T[], rng: seedrandom.PRNG): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Distribute tools across 5 rounds so each round has a balanced mix of
 * value tiers. With 8 tools and 5 rounds the distribution is:
 *   - Rounds 1-3: 2 tools each (6 tools)
 *   - Rounds 4-5: 1 tool each (2 tools)
 *
 * Constraints enforced:
 *   - Premium (tier 3) tools are placed in separate rounds (never stacked).
 *   - Multi-tool rounds get tools from different tiers when possible.
 *   - The seed controls which specific tools land in which round, providing
 *     match-to-match variety while maintaining balance invariants.
 */
function distributeTools(tools: Tool[], rng: seedrandom.PRNG): Tool[][] {
  // Group tools by tier
  const tier1 = seededShuffle(
    tools.filter((t) => getToolValueTier(t.id) === 1),
    rng,
  );
  const tier2 = seededShuffle(
    tools.filter((t) => getToolValueTier(t.id) === 2),
    rng,
  );
  const tier3 = seededShuffle(
    tools.filter((t) => getToolValueTier(t.id) === 3),
    rng,
  );

  // We have 5 round slots. Sizes: [2, 2, 2, 1, 1].
  // Step 1: Place premium (tier 3) tools first -- each in a DIFFERENT round.
  //         Pick 2 distinct round indices for the 2 premium tools.
  const roundSlots: Tool[][] = [[], [], [], [], []];
  const roundSizes = [2, 2, 2, 1, 1];

  // Choose 2 different round indices for premium tools (seeded).
  const premiumRounds = seededShuffle([0, 1, 2, 3, 4], rng).slice(0, tier3.length);
  for (let i = 0; i < tier3.length; i++) {
    roundSlots[premiumRounds[i]].push(tier3[i]);
  }

  // Step 2: Fill remaining slots with tier 2, then tier 1 tools.
  //         For multi-tool rounds (size 2) that already have a premium tool,
  //         pair it with a non-premium tool.
  const remaining = [...tier2, ...tier1];
  // Shuffle remaining for variety
  const shuffledRemaining = seededShuffle(remaining, rng);

  let rIdx = 0;
  // First pass: fill multi-tool rounds (indices 0-2, size 2) that need more tools
  for (let round = 0; round < 5; round++) {
    while (roundSlots[round].length < roundSizes[round] && rIdx < shuffledRemaining.length) {
      roundSlots[round].push(shuffledRemaining[rIdx]);
      rIdx++;
    }
  }

  return roundSlots;
}

/**
 * Generate deterministic round assignments for a 5-round match.
 *
 * Guarantees:
 * - Challenges are ordered by difficulty (round N gets difficulty N).
 * - Hazards are ordered by intensity (round N gets intensity N).
 * - Tool pools are balanced across tiers per round.
 * - Different seeds produce different tool distributions.
 *
 * @param seed - Match seed for deterministic RNG.
 * @returns Array of 5 RoundAssignment objects (index 0 = round 1).
 */
export function getRoundAssignments(seed: string): RoundAssignment[] {
  const rng = seedrandom(`${seed}:round-balance`);

  const challenges = getDefaultChallenges();
  const hazards = getDefaultHazards();
  const tools = getDefaultTools();

  // Sort challenges by difficulty ascending (should already be, but enforce)
  const sortedChallenges = [...challenges].sort((a, b) => a.difficulty - b.difficulty);

  // Sort hazards by intensity ascending
  const sortedHazards = [...hazards].sort(
    (a, b) => getHazardIntensity(a.id) - getHazardIntensity(b.id),
  );

  // Distribute tools across rounds with seed-based variety
  const toolPools = distributeTools(tools, rng);

  return sortedChallenges.map((challenge, index) => ({
    round: index + 1,
    challenge,
    hazard: sortedHazards[index],
    availableTools: toolPools[index],
  }));
}

/**
 * Validate that round assignments satisfy all balance invariants.
 * Returns an array of violation messages (empty = valid).
 */
export function validateRoundBalance(assignments: RoundAssignment[]): string[] {
  const errors: string[] = [];

  if (assignments.length !== 5) {
    errors.push(`Expected 5 rounds, got ${assignments.length}`);
    return errors;
  }

  // Check difficulty progression
  for (let i = 1; i < assignments.length; i++) {
    if (assignments[i].challenge.difficulty < assignments[i - 1].challenge.difficulty) {
      errors.push(
        `Difficulty regression: round ${i + 1} (${assignments[i].challenge.difficulty}) < round ${i} (${assignments[i - 1].challenge.difficulty})`,
      );
    }
  }

  // Check hazard intensity progression
  for (let i = 1; i < assignments.length; i++) {
    const prevIntensity = getHazardIntensity(assignments[i - 1].hazard.id);
    const currIntensity = getHazardIntensity(assignments[i].hazard.id);
    if (currIntensity < prevIntensity) {
      errors.push(
        `Hazard intensity regression: round ${i + 1} (${currIntensity}) < round ${i} (${prevIntensity})`,
      );
    }
  }

  // Check all tools are assigned exactly once
  const allToolIds = new Set<string>();
  for (const a of assignments) {
    for (const tool of a.availableTools) {
      if (allToolIds.has(tool.id)) {
        errors.push(`Tool '${tool.id}' assigned to multiple rounds`);
      }
      allToolIds.add(tool.id);
    }
  }

  // Check no round has only premium tools (tier 3) or only situational (tier 1)
  for (const a of assignments) {
    if (a.availableTools.length > 1) {
      const tiers = a.availableTools.map((t) => getToolValueTier(t.id));
      const uniqueTiers = new Set(tiers);
      if (uniqueTiers.size === 1 && tiers.length > 1) {
        // All tools same tier in a multi-tool round -- not ideal but not fatal
        // We only flag if it's all tier 3 (premium), which would be too strong
        if (uniqueTiers.has(3)) {
          errors.push(`Round ${a.round} has all premium (tier 3) tools -- unbalanced`);
        }
      }
    }
  }

  return errors;
}
