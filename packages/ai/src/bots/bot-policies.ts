import seedrandom from 'seedrandom';

import type { EquipSelection } from '@tle/game-core';

export type BotPersonality = 'aggressive' | 'conservative' | 'balanced';

export interface BotBidContext {
  readonly round: number;
  readonly totalRounds: number;
  readonly currentRank: number; // 1 = first place
  readonly totalManagers: number;
  readonly currentScore: number;
  readonly maxBid: number;
}

// ─── Equip Policy Types ──────────────────────────────────────────────

/**
 * Lightweight tool descriptor carrying only the metadata the bot needs
 * to make equip decisions. Callers map full Tool objects to this shape.
 */
export interface ToolInfo {
  readonly id: string;
  /** Effect target (time, memory, hints, debug, tests, retries, template). */
  readonly effectTarget: string;
}

/**
 * Lightweight hazard descriptor for the active hazards this round.
 */
export interface HazardInfo {
  readonly id: string;
  /** Modifier target (time, memory, visibility, input, stdlib). */
  readonly modifierTarget: string;
}

export interface BotEquipContext {
  readonly managerId: string;
  readonly personality: BotPersonality;
  readonly round: number;
  readonly totalRounds: number;
  readonly currentRank: number; // 1 = first place
  readonly totalManagers: number;
  /** Tools this bot won in the auction (pick-order already resolved). */
  readonly wonTools: readonly ToolInfo[];
  /** Hazards active this round. Used for counter-strategy decisions. */
  readonly activeHazards: readonly HazardInfo[];
  /** Max tools a manager may equip per round. */
  readonly maxTools: number;
  readonly seed: string;
}

/**
 * Generate a deterministic bid based on bot personality.
 * Same seed + context always produces same bid.
 */
export function generateBotBid(
  personality: BotPersonality,
  context: BotBidContext,
  seed: string,
): number {
  const rng = seedrandom(`${seed}:bid:${context.round}:${personality}`);
  const noise = rng(); // 0-1

  let baseBid: number;

  switch (personality) {
    case 'aggressive':
      baseBid = aggressiveBid(context, noise);
      break;
    case 'conservative':
      baseBid = conservativeBid(context, noise);
      break;
    case 'balanced':
      baseBid = balancedBid(context, noise);
      break;
  }

  // Ensure valid integer in range
  return Math.max(0, Math.min(context.maxBid, Math.round(baseBid)));
}

/**
 * Aggressive: bid high early to establish dominance.
 * Spends 60-90% of max bid, higher in early rounds.
 */
function aggressiveBid(ctx: BotBidContext, noise: number): number {
  const roundFactor = 1 - (ctx.round - 1) / ctx.totalRounds; // Higher early
  const base = ctx.maxBid * (0.6 + 0.3 * roundFactor);
  return base + noise * ctx.maxBid * 0.1;
}

/**
 * Conservative: bid low, save resources for later rounds.
 * Spends 10-40% of max bid, higher in later rounds.
 */
function conservativeBid(ctx: BotBidContext, noise: number): number {
  const roundFactor = (ctx.round - 1) / ctx.totalRounds; // Higher late
  const base = ctx.maxBid * (0.1 + 0.3 * roundFactor);
  return base + noise * ctx.maxBid * 0.1;
}

/**
 * Balanced: adapt to current standings.
 * Bid higher when behind, lower when ahead.
 */
function balancedBid(ctx: BotBidContext, noise: number): number {
  // rankFactor: 0 when first, 1 when last
  const rankFactor = (ctx.currentRank - 1) / Math.max(1, ctx.totalManagers - 1);
  const base = ctx.maxBid * (0.3 + 0.4 * rankFactor);
  return base + noise * ctx.maxBid * 0.1;
}

/**
 * Get the default personality for each bot slot (0-indexed).
 */
export function getDefaultPersonality(botIndex: number): BotPersonality {
  const personalities: BotPersonality[] = ['aggressive', 'conservative', 'balanced'];
  return personalities[botIndex % personalities.length];
}

// ─── Equip Policies ──────────────────────────────────────────────────

/**
 * Priority tiers for the aggressive personality.
 * Higher-tier effect targets are selected first.
 */
const AGGRESSIVE_PRIORITY: readonly string[] = [
  'retries', // Extra attempts are extremely valuable
  'time', // More time = more room to solve
  'memory', // Memory relief is important
  'hints', // Algorithmic hints give a direct edge
  'tests', // Revealing hidden tests helps accuracy
  'debug', // Debugging is useful but situational
  'template', // Templates are nice-to-have
];

/**
 * Targets the conservative bot considers "safe" — defensive tools that
 * reduce downside risk rather than boost upside.
 */
const SAFE_TARGETS: ReadonlySet<string> = new Set(['time', 'memory', 'retries', 'tests']);

/**
 * Mapping from hazard modifier targets to the tool effect targets that
 * directly counter them. Conservative bots prioritize counters.
 */
const COUNTER_MAP: Readonly<Record<string, string>> = {
  time: 'time', // time-crunch → extra-time
  memory: 'memory', // memory-squeeze → memory-boost
  visibility: 'tests', // fog-of-war → test-preview
};

/**
 * Generate a deterministic equip selection based on bot personality.
 * Same seed + context always produces the same selection.
 *
 * The returned EquipSelection only contains toolIds that were actually
 * won by this manager in the auction, respecting `maxTools`.
 * hazardIds is always empty (bots do not self-impose hazards).
 */
export function generateBotEquip(context: BotEquipContext): EquipSelection {
  const { personality, wonTools, maxTools, managerId } = context;

  // Nothing to equip
  if (wonTools.length === 0 || maxTools <= 0) {
    return { managerId, toolIds: [], hazardIds: [] };
  }

  let selectedIds: string[];

  switch (personality) {
    case 'aggressive':
      selectedIds = aggressiveEquip(context);
      break;
    case 'conservative':
      selectedIds = conservativeEquip(context);
      break;
    case 'balanced':
      selectedIds = balancedEquip(context);
      break;
  }

  return { managerId, toolIds: selectedIds, hazardIds: [] };
}

/**
 * Aggressive / Greedy: always equip the most impactful tools.
 * Sorts available tools by a fixed priority tier, takes top N.
 * Uses seeded RNG only to break ties between tools at the same tier.
 */
function aggressiveEquip(ctx: BotEquipContext): string[] {
  const rng = seedrandom(`${ctx.seed}:equip:${ctx.round}:aggressive`);

  const scored = ctx.wonTools.map((t) => {
    const tierIndex = AGGRESSIVE_PRIORITY.indexOf(t.effectTarget);
    // Unknown targets get lowest priority
    const priority = tierIndex >= 0 ? AGGRESSIVE_PRIORITY.length - tierIndex : 0;
    return { id: t.id, priority, tiebreak: rng() };
  });

  scored.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return b.tiebreak - a.tiebreak;
  });

  return scored.slice(0, ctx.maxTools).map((s) => s.id);
}

/**
 * Conservative / Risk-averse: prefer tools that directly counter active
 * hazards, then safe/defensive tools, deprioritizing aggressive options.
 * Will skip equipping a tool slot if only "risky" tools remain.
 */
function conservativeEquip(ctx: BotEquipContext): string[] {
  const rng = seedrandom(`${ctx.seed}:equip:${ctx.round}:conservative`);

  // Determine which effect targets counter current hazards
  const counterTargets = new Set<string>();
  for (const h of ctx.activeHazards) {
    const counter = COUNTER_MAP[h.modifierTarget];
    if (counter) counterTargets.add(counter);
  }

  const scored = ctx.wonTools.map((t) => {
    let priority = 0;
    // Tier 1: directly counters an active hazard
    if (counterTargets.has(t.effectTarget)) priority += 20;
    // Tier 2: safe/defensive tool
    if (SAFE_TARGETS.has(t.effectTarget)) priority += 10;
    return { id: t.id, priority, tiebreak: rng() };
  });

  scored.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return b.tiebreak - a.tiebreak;
  });

  // Conservative bots skip tools they consider unsafe (priority 0)
  const safe = scored.filter((s) => s.priority > 0);
  return safe.slice(0, ctx.maxTools).map((s) => s.id);
}

/**
 * Balanced / Adaptive: blends aggressive and conservative strategies
 * depending on current standings.
 *
 * When behind (high rank number) → behaves more like aggressive.
 * When ahead (low rank number)  → behaves more like conservative.
 * Mid-pack → takes a balanced selection with some RNG shuffle.
 */
function balancedEquip(ctx: BotEquipContext): string[] {
  const rng = seedrandom(`${ctx.seed}:equip:${ctx.round}:balanced`);

  // 0 = first place, 1 = last place
  const rankFactor = ctx.totalManagers > 1 ? (ctx.currentRank - 1) / (ctx.totalManagers - 1) : 0.5;

  // Determine which effect targets counter current hazards
  const counterTargets = new Set<string>();
  for (const h of ctx.activeHazards) {
    const counter = COUNTER_MAP[h.modifierTarget];
    if (counter) counterTargets.add(counter);
  }

  const scored = ctx.wonTools.map((t) => {
    // Aggressive component: fixed tier priority
    const tierIndex = AGGRESSIVE_PRIORITY.indexOf(t.effectTarget);
    const aggressiveScore = tierIndex >= 0 ? AGGRESSIVE_PRIORITY.length - tierIndex : 0;

    // Conservative component: counter + safety
    let conservativeScore = 0;
    if (counterTargets.has(t.effectTarget)) conservativeScore += 20;
    if (SAFE_TARGETS.has(t.effectTarget)) conservativeScore += 10;

    // Blend: when behind lean aggressive, when ahead lean conservative
    const blended = aggressiveScore * rankFactor + conservativeScore * (1 - rankFactor);

    return { id: t.id, priority: blended, tiebreak: rng() };
  });

  scored.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return b.tiebreak - a.tiebreak;
  });

  return scored.slice(0, ctx.maxTools).map((s) => s.id);
}
