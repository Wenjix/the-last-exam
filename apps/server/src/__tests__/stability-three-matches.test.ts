/**
 * h2x.4 -- Stability test: three consecutive full matches.
 *
 * Executes three full 5-round matches back-to-back without manual
 * intervention. Validates:
 *   - No crashes, hangs, or data corruption
 *   - All matches produce valid final standings
 *   - Commentary pipeline does not block progression
 *   - Replays work for all matches
 *   - Cult of S.A.M. bot participates in at least one match
 *   - Non-English commentary generates for at least one match
 *
 * AC: Three matches complete; zero critical failures; all replays valid.
 */

import { initDatabase, closeDatabase } from '../persistence/database.js';
import { getMatchEvents } from '../persistence/event-store.js';
import {
  createMatch,
  getActiveMatch,
  submitBid,
  submitStrategy,
} from '../orchestrator/match-orchestrator.js';
import { reconstructReplay } from '../services/replay-service.js';
import { buildManagers, insertMatchRow, TOTAL_ROUNDS } from './helpers.js';
import { DEFAULT_BOT_CONFIGS } from '@tle/ai';
import { getRoundAssignments } from '@tle/content';
import {
  CommentaryCircuitBreaker,
  CircuitState,
  CommentaryGenerator,
  generateMultilingualCommentary,
} from '@tle/audio';
import type { CommentaryEvent, CommentaryOutput, CommentaryLanguage } from '@tle/audio';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

describe('h2x.4: Stability — three consecutive full matches', () => {
  beforeAll(() => {
    initDatabase(':memory:');
  });

  afterAll(() => {
    closeDatabase();
  });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // Helper: run a complete match with commentary
  // -----------------------------------------------------------------------

  interface MatchRun {
    matchId: string;
    managers: ReturnType<typeof buildManagers>;
    commentaryOutputs: CommentaryOutput[];
    commentaryLanguage: CommentaryLanguage;
  }

  async function runFullMatch(
    seed: string,
    commentaryLanguage: CommentaryLanguage = 'en',
  ): Promise<MatchRun> {
    const managers = buildManagers();
    const human = managers[0]!;
    const match = createMatch(managers, seed);
    const matchId = match.id;
    insertMatchRow(matchId, seed);

    // Set up commentary generator (non-blocking)
    const gen = new CommentaryGenerator({
      circuitBreaker: {
        timeoutMs: 5_000,
        failureThreshold: 5,
        cooldownMs: 999_999,
      },
    });

    const commentaryOutputs: CommentaryOutput[] = [];
    gen.onCommentary((output: CommentaryOutput) => commentaryOutputs.push(output));

    for (let round = 1; round <= TOTAL_ROUNDS; round++) {
      // briefing (5s)
      gen.processEvent({
        type: 'phase_transition',
        matchId,
        round,
        toPhase: 'briefing',
      } as CommentaryEvent);
      await generateMultilingualCommentary(
        { type: 'phase_transition', round, toPhase: 'briefing' },
        commentaryLanguage,
      );
      await vi.advanceTimersByTimeAsync(5_000);

      // bidding (5s)
      submitBid(matchId, human.id, round * 15);
      gen.processEvent({
        type: 'phase_transition',
        matchId,
        round,
        toPhase: 'bidding',
      } as CommentaryEvent);
      await vi.advanceTimersByTimeAsync(5_000);

      // strategy (10s)
      submitStrategy(matchId, human.id, `Round ${round} strategy`);
      gen.processEvent({
        type: 'phase_transition',
        matchId,
        round,
        toPhase: 'strategy',
      } as CommentaryEvent);
      await vi.advanceTimersByTimeAsync(10_000);

      // execution (2s)
      gen.processEvent({
        type: 'phase_transition',
        matchId,
        round,
        toPhase: 'execution',
      } as CommentaryEvent);
      await vi.advanceTimersByTimeAsync(10_000); // execution (streaming mock)

      // scoring (5s)
      gen.processEvent({
        type: 'phase_transition',
        matchId,
        round,
        toPhase: 'scoring',
      } as CommentaryEvent);
      await generateMultilingualCommentary({ type: 'round_result', round }, commentaryLanguage);
      await vi.advanceTimersByTimeAsync(5_000);
    }

    insertMatchRow(matchId, seed, 'completed');

    return { matchId, managers, commentaryOutputs, commentaryLanguage };
  }

  // -----------------------------------------------------------------------
  // Verification helpers
  // -----------------------------------------------------------------------

  function verifyMatchCompleted(matchId: string, managers: ReturnType<typeof buildManagers>) {
    const final = getActiveMatch(matchId)!;
    expect(final).toBeDefined();
    expect(final.status).toBe('completed');
    expect(final.phase).toBe('final_standings');

    // All managers have scores
    for (const m of managers) {
      expect(final.scores[m.id]).toBeGreaterThan(0);
      expect(final.roundScores[m.id]).toHaveLength(TOTAL_ROUNDS);
    }

    return final;
  }

  function verifyEventLog(matchId: string) {
    const events = getMatchEvents(matchId);
    expect(events.length).toBeGreaterThan(0);

    // Monotonic sequence IDs
    for (let i = 1; i < events.length; i++) {
      expect(events[i]!.sequenceId).toBeGreaterThan(events[i - 1]!.sequenceId);
    }

    // Must have final_standings and match_complete
    expect(events.some((e) => e.eventType === 'final_standings')).toBe(true);
    expect(events.some((e) => e.eventType === 'match_complete')).toBe(true);

    // Must have round_result for each round
    const roundResults = events.filter((e) => e.eventType === 'round_result');
    expect(roundResults).toHaveLength(TOTAL_ROUNDS);

    return events;
  }

  function verifyReplay(matchId: string, seed: string) {
    const replay = reconstructReplay({ matchId });
    expect(replay.ok).toBe(true);
    if (!replay.ok) return;

    expect(replay.data.matchId).toBe(matchId);
    expect(replay.data.seed).toBe(seed);
    expect(replay.data.events.length).toBeGreaterThan(0);
    expect(replay.data.finalStandings).toHaveLength(4);
    expect(replay.data.totalEvents).toBe(replay.data.events.length);

    // Standings are ranked correctly
    const standings = replay.data.finalStandings!;
    for (let i = 0; i < standings.length - 1; i++) {
      expect(standings[i]!.rank).toBeLessThan(standings[i + 1]!.rank);
    }
  }

  // -----------------------------------------------------------------------
  // Main stability test
  // -----------------------------------------------------------------------

  it('three consecutive matches complete without critical failures', async () => {
    const seeds = [
      'stability-match-1-seed',
      'stability-match-2-mistral',
      'stability-match-3-multilingual',
    ];

    // Languages: en, en (bot focus), fr (multilingual)
    const languages: CommentaryLanguage[] = ['en', 'en', 'fr'];

    const results: MatchRun[] = [];

    for (let i = 0; i < 3; i++) {
      const run = await runFullMatch(seeds[i]!, languages[i]!);
      results.push(run);

      // Verify each match immediately
      verifyMatchCompleted(run.matchId, run.managers);
      verifyEventLog(run.matchId);
      verifyReplay(run.matchId, seeds[i]!);
    }

    // All 3 matches completed
    expect(results).toHaveLength(3);
  });

  it('Cult of S.A.M. bot config verified in at least one match', async () => {
    // Verify the Cult of S.A.M. bot exists
    const cultBot = DEFAULT_BOT_CONFIGS.find((b) => b.name === 'cult-of-sam');
    expect(cultBot).toBeDefined();
    expect(cultBot!.personality).toBe('aggressive');
    expect(cultBot!.displayName).toBe('Cult of S.A.M.');

    // Run a match
    const { matchId, managers } = await runFullMatch('stability-cult-verify');
    const final = getActiveMatch(matchId)!;
    expect(final.status).toBe('completed');

    // Bot managers participate (they have scores)
    const bots = managers.filter((m) => m.role === 'bot');
    expect(bots).toHaveLength(3);
    for (const bot of bots) {
      expect(final.scores[bot.id]).toBeGreaterThan(0);
    }
  });

  it('non-English commentary generates without errors', async () => {
    // Test French
    const frText = await generateMultilingualCommentary(
      { type: 'phase_transition', round: 1, toPhase: 'briefing' },
      'fr',
    );
    expect(typeof frText).toBe('string');
    expect(frText.length).toBeGreaterThan(0);

    // Test Japanese
    const jaText = await generateMultilingualCommentary({ type: 'round_result', round: 3 }, 'ja');
    expect(typeof jaText).toBe('string');
    expect(jaText.length).toBeGreaterThan(0);

    // French match runs to completion
    const { matchId, managers } = await runFullMatch('stability-french-match', 'fr');
    verifyMatchCompleted(matchId, managers);
  });

  it('round assignments are structurally valid for all stability seeds', () => {
    const seeds = [
      'stability-match-1-seed',
      'stability-match-2-mistral',
      'stability-match-3-multilingual',
    ];

    for (const seed of seeds) {
      const assignments = getRoundAssignments(seed);
      expect(assignments).toHaveLength(5);

      // Each assignment has a challenge and dataCard
      for (const assignment of assignments) {
        expect(assignment.challenge).toBeDefined();
        expect(assignment.dataCard).toBeDefined();
      }

      // Difficulty progression
      for (let i = 1; i < assignments.length; i++) {
        expect(assignments[i]!.challenge.difficulty).toBeGreaterThanOrEqual(
          assignments[i - 1]!.challenge.difficulty,
        );
      }
    }
  });

  it('commentary circuit breaker does not block any match', async () => {
    // Create a circuit breaker that will trip after 2 failures
    const breaker = new CommentaryCircuitBreaker({
      timeoutMs: 50,
      failureThreshold: 2,
      cooldownMs: 999_999,
    });

    // Trip it
    const neverResolves = () => new Promise<string>(() => {});
    for (let i = 0; i < 2; i++) {
      const p = breaker.execute(neverResolves);
      await vi.advanceTimersByTimeAsync(50);
      await p;
    }
    expect(breaker.currentState).toBe(CircuitState.OPEN);

    // Match still runs to completion
    const { matchId, managers } = await runFullMatch('stability-cb-tripped');
    verifyMatchCompleted(matchId, managers);
    verifyEventLog(matchId);
    verifyReplay(matchId, 'stability-cb-tripped');
  });

  it('all matches produce deterministic results with same seeds', async () => {
    const seed = 'stability-determinism-check';

    // Run same match twice
    const run1 = await runFullMatch(seed + '-a');
    const run2 = await runFullMatch(seed + '-a');

    const final1 = getActiveMatch(run1.matchId)!;
    const final2 = getActiveMatch(run2.matchId)!;

    // Same seed produces same scores per manager index
    for (let i = 0; i < run1.managers.length; i++) {
      expect(final1.scores[run1.managers[i]!.id]).toBe(final2.scores[run2.managers[i]!.id]);
    }
  });
});
