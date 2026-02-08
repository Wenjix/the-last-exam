import seedrandom from 'seedrandom';

export interface BidEntry {
  readonly managerId: string;
  readonly amount: number;
  readonly currentRank: number; // 1-based, lower = better standing
}

export interface AuctionResult {
  readonly managerId: string;
  readonly amount: number;
  readonly pickOrder: number; // 1 = first pick of tools
}

/**
 * Resolve hidden bid auction with deterministic tie-breaking.
 *
 * Rules:
 * 1. Higher bid = earlier pick order
 * 2. Tie-break: lower-ranked manager (by current standings) wins first (comeback mechanic)
 * 3. Remaining ties broken by seeded RNG
 *
 * Pure function — same inputs + seed always produce same output.
 */
export function resolveAuction(bids: readonly BidEntry[], seed: string): AuctionResult[] {
  const rng = seedrandom(seed);

  // Assign random tiebreaker to each bid
  const withTiebreak = bids.map((bid) => ({
    ...bid,
    rngTiebreak: rng(),
  }));

  // Sort: highest bid first, then lower rank first (comeback), then RNG
  const sorted = [...withTiebreak].sort((a, b) => {
    // 1. Higher bid wins
    if (b.amount !== a.amount) return b.amount - a.amount;
    // 2. Lower-ranked (higher rank number) wins ties — comeback mechanic
    if (b.currentRank !== a.currentRank) return b.currentRank - a.currentRank;
    // 3. Seeded RNG for final tiebreak
    return b.rngTiebreak - a.rngTiebreak;
  });

  return sorted.map((entry, index) => ({
    managerId: entry.managerId,
    amount: entry.amount,
    pickOrder: index + 1,
  }));
}

/**
 * Validate a bid amount against constraints.
 */
export function validateBid(
  amount: number,
  min: number = 0,
  max: number = Infinity,
): string | null {
  if (!Number.isInteger(amount)) return 'Bid must be an integer';
  if (amount < min) return `Bid must be at least ${min}`;
  if (amount > max) return `Bid must be at most ${max}`;
  return null; // Valid
}
