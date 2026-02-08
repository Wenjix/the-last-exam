/** Template-based commentary for key game events — character-themed */

export function briefingCommentary(round: number): string {
  const intros = [
    `Time-fracture #${round} stabilizes... the Archive reveals the next challenge. Champions, prepare yourselves.`,
    `The Archive hums as fracture #${round} crystallizes. A new trial emerges from the data streams.`,
    `Round ${round} begins. Proctor Null watches with cold precision as the challenge materializes.`,
    `Fracture #${round} opens. The Archivist whispers: "This one will separate the pretenders from the worthy."`,
    `Round ${round} is upon us. The code-streams converge on a single point of truth.`,
  ];
  return intros[(round - 1) % intros.length]!;
}

export function biddingCommentary(round: number): string {
  return `The data card is revealed for round ${round}. Champions weigh their budgets — knowledge has a price in the Archive.`;
}

export function bidResultCommentary(winner: string | null, amount: number): string {
  if (!winner) {
    return `No one bids. The data card dissolves back into the Archive, its secrets unclaimed.`;
  }
  return `${winner} seizes the intel for ${amount} points! That knowledge could be the difference between glory and oblivion.`;
}

export function strategyCommentary(round: number): string {
  return `Agents receive their instructions for round ${round}. The champions craft their battle plans — every word shapes the code to come.`;
}

export function executionCommentary(round: number): string {
  const comments = [
    `Round ${round} execution! Code flows through the Archive as all four agents race to solve the challenge.`,
    `The clock ticks in round ${round}. Cult of S.A.M. fires first — will speed triumph over precision?`,
    `Round ${round} is live. iClaudius methodically follows protocol while Star3.14 takes a creative detour.`,
  ];
  return comments[(round - 1) % comments.length]!;
}

export function roundResultCommentary(round: number, topScorer: string, score: number): string {
  return `Round ${round} complete! ${topScorer} leads with ${score.toFixed(0)} points. The standings shift in the Archive's eternal ledger.`;
}

export function finalStandingsCommentary(winner: string, totalScore: number): string {
  return `The Archive falls silent. ${winner} claims the crown with ${totalScore.toFixed(0)} points. Proctor Null nods — the last exam is over.`;
}

export function heartbeatCommentary(round: number, elapsedMs: number): string {
  const seconds = Math.floor(elapsedMs / 1000);
  return `${seconds} seconds into round ${round}. The agents are deep in the code-streams...`;
}
