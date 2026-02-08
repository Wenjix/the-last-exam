/**
 * mgm.9 -- E2E integration test for a full 5-round match with mocked runs.
 *
 * Creates a match via the orchestrator (1 human + 3 bots), submits bids and
 * equips for the human manager each round, verifies bot actions are auto-applied,
 * and asserts:
 *   - Final standings are produced with correct ranking
 *   - Event log contains all transitions in the correct order
 *   - Replay endpoint returns consistent data
 *
 * Uses vi.useFakeTimers() to control setTimeout-based phase advancement.
 * Deterministic: fixed seed, mocked Math.random.
 */
import { initDatabase, closeDatabase } from '../persistence/database.js';
import { getMatchEvents } from '../persistence/event-store.js';
import {
  createMatch,
  submitBid,
  submitEquip,
  getActiveMatch,
} from '../orchestrator/match-orchestrator.js';
import { reconstructReplay } from '../services/replay-service.js';
import { buildManagers, insertMatchRow, TOTAL_ROUNDS } from './helpers.js';

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('mgm.9: E2E 5-round match with mocked runs', () => {
  const SEED = 'test-seed-e2e-match-001';

  beforeAll(() => {
    // Initialize in-memory SQLite for event persistence
    initDatabase(':memory:');
  });

  afterAll(() => {
    closeDatabase();
  });

  beforeEach(() => {
    vi.useFakeTimers();
    // Fix Math.random for deterministic correctness values in mock run results
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should complete a full 5-round match lifecycle', async () => {
    // ---- Arrange ----
    const managers = buildManagers();
    const humanManager = managers[0]!;
    const match = createMatch(managers, SEED);
    const matchId = match.id;

    // Insert match row for replay service
    insertMatchRow(matchId, SEED);

    // Verify initial state
    expect(match.status).toBe('active');
    expect(match.round).toBe(1);
    expect(match.phase).toBe('briefing');
    expect(match.managers).toHaveLength(4);

    // ---- Act: drive through all 5 rounds ----
    for (let round = 1; round <= TOTAL_ROUNDS; round++) {
      // Phase: briefing (10s duration, then auto-advances)
      const currentMatch = getActiveMatch(matchId);
      expect(currentMatch).toBeDefined();
      expect(currentMatch!.round).toBe(round);
      expect(currentMatch!.phase).toBe('briefing');

      await vi.advanceTimersByTimeAsync(10_000);

      // Phase: hidden_bid (30s deadline)
      expect(currentMatch!.phase).toBe('hidden_bid');

      // Submit human bid
      const bidResult = submitBid(matchId, humanManager.id, round * 15);
      expect(bidResult).toBe(true);

      // Advance past bot auto-submit (500ms) and then phase deadline
      await vi.advanceTimersByTimeAsync(30_000);

      // Phase: bid_resolve (5s display, then auto-advance)
      expect(currentMatch!.phase).toBe('bid_resolve');
      await vi.advanceTimersByTimeAsync(5_000);

      // Phase: equip (30s deadline)
      expect(currentMatch!.phase).toBe('equip');

      // Submit human equip
      const equipResult = submitEquip(matchId, humanManager.id, ['tool-a'], ['hazard-b']);
      expect(equipResult).toBe(true);

      // Advance past bot auto-submit and phase deadline
      await vi.advanceTimersByTimeAsync(30_000);

      // Phase: run (2s mock duration)
      expect(currentMatch!.phase).toBe('run');
      await vi.advanceTimersByTimeAsync(2_000);

      // Phase: resolve (15s display)
      expect(currentMatch!.phase).toBe('resolve');
      await vi.advanceTimersByTimeAsync(15_000);

      // After resolve: either next round's briefing or final_standings
      if (round < TOTAL_ROUNDS) {
        expect(currentMatch!.phase).toBe('briefing');
        expect(currentMatch!.round).toBe(round + 1);
      }
    }

    // ---- Assert: match completed ----
    const finalMatch = getActiveMatch(matchId);
    expect(finalMatch).toBeDefined();
    expect(finalMatch!.status).toBe('completed');
    expect(finalMatch!.phase).toBe('final_standings');

    // ---- Assert: scores are populated for all managers ----
    for (const manager of managers) {
      expect(finalMatch!.scores[manager.id]).toBeGreaterThan(0);
      expect(finalMatch!.roundScores[manager.id]).toHaveLength(TOTAL_ROUNDS);
    }

    // ---- Assert: scores are deterministic ----
    // Manager scores are based on: 500 + round*50 + managerIndex*25
    // Round 1: index0=550, index1=575, index2=600, index3=625
    // Round 2: index0=600, index1=625, index2=650, index3=675
    // ...
    // Round 5: index0=750, index1=775, index2=800, index3=825
    // Total for index0: 550+600+650+700+750 = 3250
    // Total for index1: 575+625+675+725+775 = 3375
    // Total for index2: 600+650+700+750+800 = 3500
    // Total for index3: 625+675+725+775+825 = 3625
    expect(finalMatch!.scores[managers[0]!.id]).toBe(3250);
    expect(finalMatch!.scores[managers[1]!.id]).toBe(3375);
    expect(finalMatch!.scores[managers[2]!.id]).toBe(3500);
    expect(finalMatch!.scores[managers[3]!.id]).toBe(3625);
  });

  it('should produce correctly ordered event log', async () => {
    const managers = buildManagers();
    const humanManager = managers[0]!;
    const match = createMatch(managers, SEED + '-events');
    const matchId = match.id;
    insertMatchRow(matchId, SEED + '-events');

    // Run all 5 rounds
    for (let round = 1; round <= TOTAL_ROUNDS; round++) {
      await vi.advanceTimersByTimeAsync(10_000); // briefing
      submitBid(matchId, humanManager.id, round * 15);
      await vi.advanceTimersByTimeAsync(30_000); // hidden_bid
      await vi.advanceTimersByTimeAsync(5_000); // bid_resolve
      submitEquip(matchId, humanManager.id, ['tool-a'], ['hazard-b']);
      await vi.advanceTimersByTimeAsync(30_000); // equip
      await vi.advanceTimersByTimeAsync(2_000); // run
      await vi.advanceTimersByTimeAsync(15_000); // resolve
    }

    // Fetch persisted events
    const events = getMatchEvents(matchId);

    // Events should have monotonically increasing sequence IDs
    for (let i = 1; i < events.length; i++) {
      expect(events[i]!.sequenceId).toBeGreaterThan(events[i - 1]!.sequenceId);
    }

    // Should contain phase_transition events
    const phaseTransitions = events.filter((e) => e.eventType === 'phase_transition');
    expect(phaseTransitions.length).toBeGreaterThan(0);

    // Should contain round_result events (one per round)
    const roundResults = events.filter((e) => e.eventType === 'round_result');
    expect(roundResults).toHaveLength(TOTAL_ROUNDS);

    // Round results should be in order
    for (let i = 0; i < roundResults.length; i++) {
      expect((roundResults[i]!.payload as Record<string, unknown>).round).toBe(i + 1);
    }

    // Should end with final_standings and match_complete
    const finalStandings = events.filter((e) => e.eventType === 'final_standings');
    expect(finalStandings).toHaveLength(1);

    const matchComplete = events.filter((e) => e.eventType === 'match_complete');
    expect(matchComplete).toHaveLength(1);

    // final_standings should come before match_complete
    const standingsSeq = finalStandings[0]!.sequenceId;
    const completeSeq = matchComplete[0]!.sequenceId;
    expect(standingsSeq).toBeLessThan(completeSeq);

    // match_complete should be the last event
    expect(completeSeq).toBe(events[events.length - 1]!.sequenceId);
  });

  it('should return consistent replay data', async () => {
    const managers = buildManagers();
    const humanManager = managers[0]!;
    const match = createMatch(managers, SEED + '-replay');
    const matchId = match.id;
    insertMatchRow(matchId, SEED + '-replay', 'completed');

    // Run all 5 rounds
    for (let round = 1; round <= TOTAL_ROUNDS; round++) {
      await vi.advanceTimersByTimeAsync(10_000);
      submitBid(matchId, humanManager.id, round * 15);
      await vi.advanceTimersByTimeAsync(30_000);
      await vi.advanceTimersByTimeAsync(5_000);
      submitEquip(matchId, humanManager.id, ['tool-a'], ['hazard-b']);
      await vi.advanceTimersByTimeAsync(30_000);
      await vi.advanceTimersByTimeAsync(2_000);
      await vi.advanceTimersByTimeAsync(15_000);
    }

    // Reconstruct replay
    const replay = reconstructReplay({ matchId });

    expect(replay.ok).toBe(true);
    if (!replay.ok) return; // type narrowing

    const data = replay.data;

    // Replay seed matches
    expect(data.seed).toBe(SEED + '-replay');
    expect(data.matchId).toBe(matchId);

    // Events should be present
    expect(data.events.length).toBeGreaterThan(0);
    expect(data.totalEvents).toBe(data.events.length);

    // Final standings should be present
    expect(data.finalStandings).not.toBeNull();
    expect(data.finalStandings).toHaveLength(4);

    // Standings should be ranked correctly (descending by total score)
    const standings = data.finalStandings!;
    for (let i = 0; i < standings.length - 1; i++) {
      expect(standings[i]!.totalScore).toBeGreaterThanOrEqual(standings[i + 1]!.totalScore);
      expect(standings[i]!.rank).toBeLessThan(standings[i + 1]!.rank);
    }

    // Each standing should have 5 round scores
    for (const standing of standings) {
      expect(standing.roundScores).toHaveLength(TOTAL_ROUNDS);
    }

    // Replay events should be consistent with direct event store query
    const directEvents = getMatchEvents(matchId);
    expect(data.events.length).toBe(directEvents.length);

    // Sequence IDs should match
    for (let i = 0; i < data.events.length; i++) {
      expect(data.events[i]!.sequenceId).toBe(directEvents[i]!.sequenceId);
    }
  });

  it('should auto-apply bot actions during bid and equip phases', async () => {
    const managers = buildManagers();
    const humanManager = managers[0]!;
    const botManagers = managers.slice(1);
    const match = createMatch(managers, SEED + '-bots');
    const matchId = match.id;
    insertMatchRow(matchId, SEED + '-bots');

    // Advance to hidden_bid phase
    await vi.advanceTimersByTimeAsync(10_000);

    const activeMatch = getActiveMatch(matchId)!;
    expect(activeMatch.phase).toBe('hidden_bid');

    // Submit human bid
    submitBid(matchId, humanManager.id, 50);

    // Advance past bot auto-submit delay (500ms)
    await vi.advanceTimersByTimeAsync(600);

    // Bots should have auto-submitted bids
    for (const bot of botManagers) {
      expect(activeMatch.bids.has(bot.id)).toBe(true);
    }

    // Advance through remaining bid phase and bid_resolve
    await vi.advanceTimersByTimeAsync(29_400);
    await vi.advanceTimersByTimeAsync(5_000);

    // Now in equip phase
    expect(activeMatch.phase).toBe('equip');

    // Submit human equip
    submitEquip(matchId, humanManager.id, ['tool-x'], []);

    // Advance past bot auto-submit delay
    await vi.advanceTimersByTimeAsync(600);

    // Bots should have auto-submitted equips
    for (const bot of botManagers) {
      expect(activeMatch.equips.has(bot.id)).toBe(true);
    }
  });
});
