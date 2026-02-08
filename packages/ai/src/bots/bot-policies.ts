import seedrandom from 'seedrandom';

export type BotPersonality = 'aggressive' | 'conservative' | 'chaotic';

export interface BotBudgetBidContext {
  readonly round: number;
  readonly totalRounds: number;
  readonly currentRank: number; // 1 = first place
  readonly totalManagers: number;
  readonly remainingBudget: number;
}

export interface BotStrategyContext {
  readonly personality: BotPersonality;
  readonly round: number;
  readonly totalRounds: number;
  readonly currentRank: number;
  readonly hasDataCard: boolean;
  readonly seed: string;
}

/**
 * Generate a deterministic budget bid based on bot personality.
 * Same seed + context always produces same bid.
 */
export function generateBotBudgetBid(
  personality: BotPersonality,
  context: BotBudgetBidContext,
  seed: string,
): number {
  const rng = seedrandom(`${seed}:bid:${context.round}:${personality}`);
  const noise = rng(); // 0-1

  let fraction: number;

  switch (personality) {
    case 'aggressive':
      fraction = aggressiveBidFraction(context, noise);
      break;
    case 'conservative':
      fraction = conservativeBidFraction(context, noise);
      break;
    case 'chaotic':
      fraction = chaoticBidFraction(context, noise);
      break;
  }

  const bid = Math.round(context.remainingBudget * fraction);
  return Math.max(0, Math.min(context.remainingBudget, bid));
}

/**
 * Aggressive: 40-60% of remaining budget early, tapers in later rounds.
 */
function aggressiveBidFraction(ctx: BotBudgetBidContext, noise: number): number {
  const roundFactor = 1 - (ctx.round - 1) / ctx.totalRounds; // Higher early
  return 0.4 + 0.2 * roundFactor + noise * 0.05;
}

/**
 * Conservative: 5-15% early, saves for rounds 4-5.
 */
function conservativeBidFraction(ctx: BotBudgetBidContext, noise: number): number {
  const roundFactor = (ctx.round - 1) / ctx.totalRounds; // Higher late
  return 0.05 + 0.1 * roundFactor + noise * 0.05;
}

/**
 * Chaotic: wild variance — 0 or all-in, seeded RNG.
 */
function chaoticBidFraction(_ctx: BotBudgetBidContext, noise: number): number {
  // ~40% chance to bid 0, ~20% chance to go all-in, rest moderate
  if (noise < 0.4) return 0;
  if (noise > 0.8) return 0.9 + noise * 0.1;
  return 0.1 + noise * 0.3;
}

/**
 * Generate a mock strategy prompt based on personality.
 */
export function generateBotStrategy(context: BotStrategyContext): string {
  switch (context.personality) {
    case 'aggressive':
      return 'Solve fast, skip edge cases. Optimize for speed over correctness. Submit early.';
    case 'conservative':
      return 'Follow spec exactly. Handle all edge cases. Test thoroughly before submitting.';
    case 'chaotic': {
      const rng = seedrandom(`${context.seed}:strategy:${context.round}`);
      const strategies = [
        'Write the solution backwards. Start from output, work to input.',
        'Use the most unusual data structure possible. Creativity over convention.',
        'Solve it with recursion. Everything is recursion.',
        'Ignore the problem constraints. Find a loophole.',
      ];
      return strategies[Math.floor(rng() * strategies.length)]!;
    }
  }
}

/**
 * Get the default personality for each bot slot (0-indexed).
 */
export function getDefaultPersonality(botIndex: number): BotPersonality {
  const personalities: BotPersonality[] = ['aggressive', 'conservative', 'chaotic'];
  return personalities[botIndex % personalities.length];
}
