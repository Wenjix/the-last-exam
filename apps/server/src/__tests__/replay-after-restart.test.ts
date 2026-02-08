/**
 * 28y.6 -- Verify matches replay after server restart.
 *
 * Runs a complete match with a REAL file-based SQLite database, closes the
 * database (simulating server shutdown), reopens it (simulating restart),
 * and fetches the replay. Asserts all data is intact with no in-memory
 * state required.
 *
 * Uses a temporary file for the SQLite database, cleaned up in afterAll.
 */
import { join } from 'path';
import { mkdirSync, rmSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { v4 as uuidv4 } from 'uuid';
import { initDatabase, closeDatabase } from '../persistence/database.js';
import { getMatchEvents } from '../persistence/event-store.js';
import { createMatch, submitBid, submitStrategy } from '../orchestrator/match-orchestrator.js';
import { reconstructReplay } from '../services/replay-service.js';
import { buildManagers, insertMatchRow, TOTAL_ROUNDS } from './helpers.js';

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('28y.6: Replay after server restart', () => {
  const SEED = 'restart-test-seed-001';
  let tempDbDir: string;
  let tempDbPath: string;

  beforeAll(() => {
    // Create a unique temp directory for this test run
    tempDbDir = join(tmpdir(), `tle-test-${uuidv4()}`);
    mkdirSync(tempDbDir, { recursive: true });
    tempDbPath = join(tempDbDir, 'test-restart.db');
  });

  afterAll(() => {
    // Clean up: close DB if open and remove temp files
    try {
      closeDatabase();
    } catch {
      // Already closed
    }
    if (existsSync(tempDbDir)) {
      rmSync(tempDbDir, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should preserve complete replay data after database close and reopen', async () => {
    // ---- Phase 1: Run a match with a file-based DB ----
    initDatabase(tempDbPath);

    const managers = buildManagers();
    const humanManager = managers[0]!;
    const match = createMatch(managers, SEED);
    const matchId = match.id;
    insertMatchRow(matchId, SEED);

    // Drive through all 5 rounds
    for (let round = 1; round <= TOTAL_ROUNDS; round++) {
      await vi.advanceTimersByTimeAsync(5_000); // briefing
      submitBid(matchId, humanManager.id, round * 15);
      await vi.advanceTimersByTimeAsync(5_000); // bidding
      submitStrategy(matchId, humanManager.id, `strategy round ${round}`);
      await vi.advanceTimersByTimeAsync(10_000); // strategy
      await vi.advanceTimersByTimeAsync(10_000); // execution (streaming mock)
      await vi.advanceTimersByTimeAsync(5_000); // scoring
    }

    insertMatchRow(matchId, SEED, 'completed');

    // Capture event count and standings before "shutdown"
    const preShutdownEvents = getMatchEvents(matchId);
    const preShutdownReplay = reconstructReplay({ matchId });
    expect(preShutdownReplay.ok).toBe(true);
    if (!preShutdownReplay.ok) return;

    const preShutdownEventCount = preShutdownEvents.length;
    const preShutdownStandings = preShutdownReplay.data.finalStandings;
    expect(preShutdownStandings).not.toBeNull();

    // ---- Phase 2: Simulate server shutdown ----
    closeDatabase();

    // Verify the database file exists on disk
    expect(existsSync(tempDbPath)).toBe(true);

    // ---- Phase 3: Simulate server restart (fresh process context) ----
    // Re-initialize with the same path -- this is what a restarting server does
    initDatabase(tempDbPath);

    // ---- Phase 4: Fetch replay from the "restarted" server ----
    const postRestartReplay = reconstructReplay({ matchId });
    expect(postRestartReplay.ok).toBe(true);
    if (!postRestartReplay.ok) return;

    const postData = postRestartReplay.data;

    // ---- Assert: No data loss ----

    // Match metadata
    expect(postData.matchId).toBe(matchId);
    expect(postData.seed).toBe(SEED);

    // Event count matches pre-shutdown
    expect(postData.events.length).toBe(preShutdownEventCount);
    expect(postData.totalEvents).toBe(preShutdownEventCount);

    // Events are in the same order
    const postRestartEvents = getMatchEvents(matchId);
    expect(postRestartEvents.length).toBe(preShutdownEventCount);

    for (let i = 0; i < preShutdownEvents.length; i++) {
      expect(postRestartEvents[i]!.sequenceId).toBe(preShutdownEvents[i]!.sequenceId);
      expect(postRestartEvents[i]!.eventType).toBe(preShutdownEvents[i]!.eventType);
      // Payload content should match (deep equality)
      expect(postRestartEvents[i]!.payload).toEqual(preShutdownEvents[i]!.payload);
    }

    // Final standings present and matching
    expect(postData.finalStandings).not.toBeNull();
    expect(postData.finalStandings).toHaveLength(preShutdownStandings!.length);

    for (let i = 0; i < preShutdownStandings!.length; i++) {
      const pre = preShutdownStandings![i]!;
      const post = postData.finalStandings![i]!;
      expect(post.managerId).toBe(pre.managerId);
      expect(post.managerName).toBe(pre.managerName);
      expect(post.totalScore).toBe(pre.totalScore);
      expect(post.rank).toBe(pre.rank);
      expect(post.roundScores).toEqual(pre.roundScores);
    }

    // All event types should be present
    const eventTypes = new Set(postData.events.map((e) => e.event.type));
    expect(eventTypes.has('phase_transition')).toBe(true);
    expect(eventTypes.has('round_result')).toBe(true);
    expect(eventTypes.has('final_standings')).toBe(true);
    expect(eventTypes.has('match_complete')).toBe(true);

    // Phase transitions should cover all expected phases
    const phaseTransitionEvents = postData.events.filter(
      (e) => e.event.type === 'phase_transition',
    );
    const toPhases = new Set(
      phaseTransitionEvents.map((e) => {
        const payload = e.event as unknown as Record<string, unknown>;
        return payload.toPhase;
      }),
    );
    expect(toPhases.has('briefing')).toBe(true);
    expect(toPhases.has('bidding')).toBe(true);
    expect(toPhases.has('strategy')).toBe(true);
    expect(toPhases.has('execution')).toBe(true);
    expect(toPhases.has('scoring')).toBe(true);

    // Round results should cover all 5 rounds
    const roundResultEvents = postData.events.filter((e) => e.event.type === 'round_result');
    expect(roundResultEvents).toHaveLength(TOTAL_ROUNDS);
  });

  it('should handle replay for a match that does not exist after restart', async () => {
    // The DB is already open from the previous test (same file)
    // Try to fetch a replay for a non-existent match
    const fakeMatchId = uuidv4();
    const result = reconstructReplay({ matchId: fakeMatchId });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('VALIDATION_MATCH_NOT_FOUND');
  });
});
