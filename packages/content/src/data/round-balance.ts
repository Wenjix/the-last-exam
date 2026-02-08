import type { Challenge } from '../schemas.js';
import type { DataCard } from './data-cards.js';
import { getDefaultChallenges } from './challenges.js';
import { getDefaultDataCards } from './data-cards.js';

// === Round Assignment ===

/** Content assignment for a single round. */
export interface RoundAssignment {
  /** 1-based round number. */
  readonly round: number;
  /** The challenge for this round (difficulty matches round). */
  readonly challenge: Challenge;
  /** The data card available for bidding this round. */
  readonly dataCard: DataCard;
}

/**
 * Generate deterministic round assignments for a 5-round match.
 *
 * Guarantees:
 * - Challenges are ordered by difficulty (round N gets difficulty N).
 * - Each round gets one data card matched to the challenge.
 *
 * @param _seed - Match seed (reserved for future use).
 * @returns Array of 5 RoundAssignment objects (index 0 = round 1).
 */
export function getRoundAssignments(_seed: string): RoundAssignment[] {
  const challenges = getDefaultChallenges();
  const dataCards = getDefaultDataCards();

  // Sort challenges by difficulty ascending (should already be, but enforce)
  const sortedChallenges = [...challenges].sort((a, b) => a.difficulty - b.difficulty);

  return sortedChallenges.map((challenge, index) => ({
    round: index + 1,
    challenge,
    dataCard: dataCards[index],
  }));
}
