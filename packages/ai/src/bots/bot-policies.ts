import seedrandom from 'seedrandom';

export type BotPersonality = 'aggressive' | 'conservative' | 'balanced';

export interface BotBidContext {
  readonly round: number;
  readonly totalRounds: number;
  readonly currentRank: number; // 1 = first place
  readonly totalManagers: number;
  readonly currentScore: number;
  readonly maxBid: number;
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
