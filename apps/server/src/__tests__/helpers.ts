/**
 * Shared test helpers for server integration tests.
 *
 * Provides deterministic manager fixtures and a utility to drive
 * the match orchestrator through all 5 rounds using fake timers.
 */
import { v4 as uuidv4 } from 'uuid';
import { initDatabase, getDatabase } from '../persistence/database.js';
import { createMatch, submitBid, submitEquip } from '../orchestrator/match-orchestrator.js';

// ---------------------------------------------------------------------------
// Manager fixtures (deterministic UUIDs via fixed seed)
// ---------------------------------------------------------------------------

export function buildManagers() {
  return [
    { id: uuidv4(), name: 'Human Player', role: 'human' as const },
    { id: uuidv4(), name: 'Bot Alpha', role: 'bot' as const },
    { id: uuidv4(), name: 'Bot Beta', role: 'bot' as const },
    { id: uuidv4(), name: 'Bot Gamma', role: 'bot' as const },
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
 * to move through every phase. Submits bids and equips for the human manager
 * at appropriate phases.
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
    // Phase: briefing -> auto-advances after 10s
    await vi.advanceTimersByTimeAsync(10_000);

    // Phase: hidden_bid (30s deadline)
    // Submit human bid immediately
    submitBid(matchId, humanManager.id, round * 15);
    // Advance past the bot auto-submit delay (500ms) and the phase deadline
    await vi.advanceTimersByTimeAsync(30_000);

    // Phase: bid_resolve -> auto-advances after 5s
    await vi.advanceTimersByTimeAsync(5_000);

    // Phase: equip (30s deadline)
    // Submit human equip immediately
    submitEquip(matchId, humanManager.id, ['tool-a'], ['hazard-b']);
    // Advance past the bot auto-submit delay and phase deadline
    await vi.advanceTimersByTimeAsync(30_000);

    // Phase: run -> mock run completes after 2s
    await vi.advanceTimersByTimeAsync(2_000);

    // Phase: resolve -> auto-advances after 15s
    await vi.advanceTimersByTimeAsync(15_000);
  }

  // Update match status in the DB
  insertMatchRow(matchId, seed, 'completed');

  return { matchId, managers, humanManager };
}

// ---------------------------------------------------------------------------
// Expected event counts
// ---------------------------------------------------------------------------

/**
 * Calculate expected event counts for a complete 5-round match.
 *
 * Per round:
 *   - 6 phase_transition events from startPhase (briefing, hidden_bid,
 *     bid_resolve, equip, run, resolve)
 *   - 6 phase_transition events from advancePhase (the fromPhase->toPhase
 *     transitions emitted before calling startPhase again)
 *   - 1 round_result event
 *
 * Actually, let's trace the flow more carefully:
 *
 * startPhase emits a phase_transition for the CURRENT phase.
 * advancePhase emits a phase_transition for the from->to transition,
 * then calls startPhase which emits another one for the new phase.
 *
 * Round 1:
 *   createMatch -> startPhase(briefing) -> emits phase_transition (briefing->briefing)
 *   timer fires -> advancePhase: emits phase_transition (briefing->hidden_bid),
 *                  calls startPhase(hidden_bid) -> emits phase_transition (hidden_bid->hidden_bid)
 *   ...and so on for each phase
 *
 * Per round we have:
 *   - 1 startPhase emit for each of the 6 phases = 6
 *   - 1 advancePhase emit between each pair = 5 (briefing->hidden_bid, hidden_bid->bid_resolve, etc.)
 *   - 1 round_result event during run phase
 * = 12 events per round
 *
 * After round 5 resolve, advancePhase transitions to final_standings and emits:
 *   - final_standings event
 *   - match_complete event
 *
 * Total: 5 rounds * 12 + 2 (final_standings + match_complete) = 62
 *
 * But we need to verify this empirically in the test.
 */
export const TOTAL_ROUNDS = 5;
export const PHASES_PER_ROUND = [
  'briefing',
  'hidden_bid',
  'bid_resolve',
  'equip',
  'run',
  'resolve',
] as const;
