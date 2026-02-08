/**
 * Shared test helpers for server integration tests.
 *
 * Provides deterministic manager fixtures and a utility to drive
 * the match orchestrator through all 5 rounds using fake timers.
 */
import { v4 as uuidv4 } from 'uuid';
import { initDatabase, getDatabase } from '../persistence/database.js';
import { createMatch, submitBid, submitStrategy, getActiveMatch } from '../orchestrator/match-orchestrator.js';

// ---------------------------------------------------------------------------
// Manager fixtures (deterministic UUIDs via fixed seed)
// ---------------------------------------------------------------------------

export function buildManagers() {
  return [
    { id: uuidv4(), name: 'Human Player', role: 'human' as const },
    { id: uuidv4(), name: 'Cult of S.A.M.', role: 'bot' as const },
    { id: uuidv4(), name: 'iClaudius', role: 'bot' as const },
    { id: uuidv4(), name: 'Star3.14', role: 'bot' as const },
  ];
}

// ---------------------------------------------------------------------------
// Database helpers
// ---------------------------------------------------------------------------

/**
 * Initialize an in-memory SQLite database for testing.
 * Returns the database instance.
 */
export function setupMemoryDb() {
  return initDatabase(':memory:');
}

/**
 * Insert a match row into the matches table so that the replay service
 * can look it up. The orchestrator keeps match state in-memory and does
 * not write to this table, so tests must do it explicitly.
 */
export function insertMatchRow(matchId: string, seed: string, status: string = 'active') {
  const db = getDatabase();
  db.prepare('INSERT OR REPLACE INTO matches (id, seed, status) VALUES (?, ?, ?)').run(
    matchId,
    seed,
    status,
  );
}

// ---------------------------------------------------------------------------
// Full match runner (drives all 5 rounds with fake timers)
// ---------------------------------------------------------------------------

/**
 * Run a complete 5-round match using the orchestrator, advancing fake timers
 * to move through every phase. Submits bids and strategies for the human
 * manager at appropriate phases.
 *
 * IMPORTANT: Caller must have called `vi.useFakeTimers()` before invoking this.
 *
 * Returns the matchId and the list of manager objects (with their IDs).
 */
export async function runCompleteMatch(seed: string) {
  const managers = buildManagers();
  const humanManager = managers[0]!;

  const match = createMatch(managers, seed);
  const matchId = match.id;

  // Insert into the matches SQL table for replay service
  insertMatchRow(matchId, seed);

  for (let round = 1; round <= 5; round++) {
    // Phase: briefing -> auto-advances after 5s
    await vi.advanceTimersByTimeAsync(5_000);

    // Phase: bidding (5s deadline)
    // Submit human bid (clamped to remaining budget)
    const m = getActiveMatch(matchId)!;
    const budget = m.budgets[humanManager.id] ?? 0;
    submitBid(matchId, humanManager.id, Math.min(round * 10, budget));
    // Advance past the bot auto-submit delay (500ms) and the phase deadline
    await vi.advanceTimersByTimeAsync(5_000);

    // Phase: strategy (10s deadline)
    // Submit human strategy immediately
    submitStrategy(matchId, humanManager.id, `Solve problem ${round} efficiently`);
    // Advance past the bot auto-submit delay and phase deadline
    await vi.advanceTimersByTimeAsync(10_000);

    // Phase: execution -> mock run completes after 2s
    await vi.advanceTimersByTimeAsync(2_000);

    // Phase: scoring -> auto-advances after 5s
    await vi.advanceTimersByTimeAsync(5_000);
  }

  // Update match status in the DB
  insertMatchRow(matchId, seed, 'completed');

  return { matchId, managers, humanManager };
}

// ---------------------------------------------------------------------------
// Expected event counts
// ---------------------------------------------------------------------------

export const TOTAL_ROUNDS = 5;
export const PHASES_PER_ROUND = [
  'briefing',
  'bidding',
  'strategy',
  'execution',
  'scoring',
] as const;
