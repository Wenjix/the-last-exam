import seedrandom from 'seedrandom';

export interface BudgetBidEntry {
  readonly managerId: string;
  readonly amount: number;
  readonly currentRank: number; // 1-based, lower = better standing
  readonly remainingBudget: number;
}

export interface BidResult {
  readonly winnerId: string | null;
  readonly winningBid: number;
  readonly updatedBudgets: Record<string, number>;
  readonly allBids: Array<{ managerId: string; amount: number }>;
}

/**
 * Resolve a sealed-bid auction for a data card.
 *
 * Rules:
 * 1. Highest bid wins the data card.
 * 2. Tie-break: lower-ranked manager wins (underdog advantage).
 * 3. Remaining ties broken by seeded RNG.
 * 4. Only the winner pays their bid. Others keep their budget.
 * 5. Bid of 0 = opt out.
 *
 * Pure function — same inputs + seed always produce same output.
 */
export function resolveSealedBid(bids: readonly BudgetBidEntry[], seed: string): BidResult {
  const rng = seedrandom(seed);

  const allBids = bids.map((b) => ({ managerId: b.managerId, amount: b.amount }));

  // Filter to non-zero bids
  const nonZeroBids = bids.filter((b) => b.amount > 0);

  if (nonZeroBids.length === 0) {
    // No one bid — no winner
    const updatedBudgets: Record<string, number> = {};
    for (const b of bids) {
      updatedBudgets[b.managerId] = b.remainingBudget;
    }
    return { winnerId: null, winningBid: 0, updatedBudgets, allBids };
  }

  // Sort: highest bid first, then higher rank number (underdog), then RNG
  const withTiebreak = nonZeroBids.map((bid) => ({
    ...bid,
    rngTiebreak: rng(),
  }));

  withTiebreak.sort((a, b) => {
    if (b.amount !== a.amount) return b.amount - a.amount;
    // Underdog advantage: higher rank number = lower standing = wins ties
    if (b.currentRank !== a.currentRank) return b.currentRank - a.currentRank;
    return b.rngTiebreak - a.rngTiebreak;
  });

  const winner = withTiebreak[0]!;

  // Update budgets — only deduct from winner
  const updatedBudgets: Record<string, number> = {};
  for (const b of bids) {
    if (b.managerId === winner.managerId) {
      updatedBudgets[b.managerId] = b.remainingBudget - winner.amount;
    } else {
      updatedBudgets[b.managerId] = b.remainingBudget;
    }
  }

  return {
    winnerId: winner.managerId,
    winningBid: winner.amount,
    updatedBudgets,
    allBids,
  };
}

/**
 * Validate a budget bid amount.
 * Returns null if valid, or an error message string.
 */
export function validateBudgetBid(amount: number, remainingBudget: number): string | null {
  if (!Number.isInteger(amount)) return 'Bid must be an integer';
  if (amount < 0) return 'Bid must be non-negative';
  if (amount > remainingBudget)
    return `Bid (${amount}) exceeds remaining budget (${remainingBudget})`;
  return null;
}
