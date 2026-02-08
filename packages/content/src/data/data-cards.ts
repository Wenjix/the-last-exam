/** Data cards provide hints to the bid winner each round. */
export interface DataCard {
  readonly id: string;
  readonly title: string;
  /** Shown to all players before bidding. */
  readonly description: string;
  /** Injected into the winner's agent context — not shown to others. */
  readonly hint: string;
}

const DATA_CARDS: readonly DataCard[] = [
  {
    id: 'divisibility-patterns',
    title: 'Divisibility Patterns',
    description: 'A data card containing insights about number theory and modular arithmetic.',
    hint: 'Use modulo operators to check divisibility. Check for the combined case (15) before individual cases (3, 5).',
  },
  {
    id: 'hash-map-insight',
    title: 'Hash Map Insight',
    description: 'A data card revealing efficient lookup strategies for pair-finding problems.',
    hint: 'Use a hash map to store seen values. For each element, check if (target - element) exists in the map. O(n) solution.',
  },
  {
    id: 'stack-mastery',
    title: 'Stack Mastery',
    description: 'A data card with advanced techniques for bracket-matching and nested structures.',
    hint: 'Use a stack. Push opening brackets, pop on closing brackets. Check that the popped bracket matches the closing type. Valid if stack is empty at end.',
  },
  {
    id: 'binary-search-edge',
    title: 'Binary Search Edge',
    description: 'A data card detailing optimized approaches for subsequence problems.',
    hint: 'Use patience sorting / binary search approach for O(n log n). Maintain a tails array where tails[i] is the smallest tail element for increasing subsequences of length i+1.',
  },
  {
    id: 'boundary-walker',
    title: 'Boundary Walker',
    description: 'A data card with strategies for matrix traversal and boundary manipulation.',
    hint: 'Track four boundaries (top, bottom, left, right). Walk right across top row, down right column, left across bottom row, up left column. Shrink boundaries after each pass.',
  },
];

/** Get the default set of 5 data cards (one per round). */
export function getDefaultDataCards(): DataCard[] {
  return [...DATA_CARDS];
}
