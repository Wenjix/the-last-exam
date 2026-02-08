/** Template-based commentary for key game events */

export function briefingCommentary(round: number): string {
  const intros = [
    `Round ${round} begins! Let's see what challenge awaits our competitors.`,
    `Here we go with Round ${round}. The tension is building!`,
    `Round ${round} is underway. Managers, prepare your strategies.`,
    `Welcome to Round ${round}! Every point counts from here.`,
    `And we're into Round ${round}. The competition heats up!`,
  ];
  return intros[(round - 1) % intros.length]!;
}

export function bidRevealCommentary(round: number, highBidder: string, amount: number): string {
  return `Round ${round} bid reveal! ${highBidder} takes the lead with a bold bid of ${amount}. This should give them first pick of tools.`;
}

export function equipCommentary(round: number): string {
  return `Round ${round} equipment phase. Managers are selecting their tools and preparing for the challenge ahead.`;
}

export function runStartCommentary(round: number): string {
  const comments = [
    `Round ${round} run phase! Agents are coding furiously. Who will crack it first?`,
    `The clock is ticking in Round ${round}. All agents are now working on the challenge.`,
    `Round ${round} execution underway. Let's see who delivers the best solution.`,
  ];
  return comments[(round - 1) % comments.length]!;
}

export function roundResultCommentary(round: number, topScorer: string, score: number): string {
  return `Round ${round} complete! ${topScorer} leads this round with ${score.toFixed(0)} points. The standings are shifting!`;
}

export function finalStandingsCommentary(winner: string, totalScore: number): string {
  return `And that's the match! ${winner} takes the crown with a total of ${totalScore.toFixed(0)} points. What an incredible competition!`;
}

export function heartbeatCommentary(round: number, elapsedMs: number): string {
  const seconds = Math.floor(elapsedMs / 1000);
  return `${seconds} seconds into the Round ${round} run phase. Agents are still working...`;
}
