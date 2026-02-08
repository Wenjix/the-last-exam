/**
 * h2x.3 -- Demo scenarios with pre-seeded matches.
 *
 * Three scripted scenarios designed to showcase interesting match dynamics:
 *   1. Dramatic Comeback  — trailing manager surges in late rounds
 *   2. Champion Showcase   — Cult of S.A.M. dominates with aggressive strategy
 *   3. Close Finish       — managers finish within tight score margins
 *
 * Each scenario uses a fixed seed for deterministic, reproducible outcomes.
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
import { generateMultilingualCommentary, SUPPORTED_LANGUAGES } from '@tle/audio';
import type { CommentaryLanguage } from '@tle/audio';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

describe('h2x.3: Demo scenarios', () => {
  beforeAll(() => {
    initDatabase(':memory:');
  });

  afterAll(() => {
    closeDatabase();
  });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // Helper: drive a match with custom bid strategy
  // -----------------------------------------------------------------------

  async function driveMatch(seed: string, humanBidFn: (round: number) => number) {
    const managers = buildManagers();
    const human = managers[0]!;
    const match = createMatch(managers, seed);
    const matchId = match.id;
    insertMatchRow(matchId, seed);

    for (let round = 1; round <= TOTAL_ROUNDS; round++) {
      // briefing (5s)
      await vi.advanceTimersByTimeAsync(5_000);

      // bidding (5s)
      const m = getActiveMatch(matchId)!;
      const budget = m.budgets[human.id] ?? 0;
      submitBid(matchId, human.id, Math.min(humanBidFn(round), budget));
      await vi.advanceTimersByTimeAsync(5_000);

      // strategy (10s)
      submitStrategy(matchId, human.id, `Solve round ${round} efficiently`);
      await vi.advanceTimersByTimeAsync(10_000);

      // execution (2s mock)
      await vi.advanceTimersByTimeAsync(2_000);

      // scoring (5s)
      await vi.advanceTimersByTimeAsync(5_000);
    }

    insertMatchRow(matchId, seed, 'completed');
    return { matchId, managers, human };
  }

  // -----------------------------------------------------------------------
  // Scenario 1: Dramatic Comeback
  // -----------------------------------------------------------------------

  describe('Scenario 1: Dramatic Comeback', () => {
    it('match completes with all managers having scores', async () => {
      const { matchId, managers } = await driveMatch(
        'demo-comeback-seed-001',
        (round) => round * 5, // Conservative early, grows later
      );

      const final = getActiveMatch(matchId)!;
      expect(final.status).toBe('completed');
      expect(final.phase).toBe('final_standings');

      // All managers scored
      for (const m of managers) {
        expect(final.scores[m.id]).toBeGreaterThan(0);
        expect(final.roundScores[m.id]).toHaveLength(5);
      }

      // Scores generally increase per round (data card bonuses may cause ties)
      for (const m of managers) {
        const rs = final.roundScores[m.id]!;
        for (let i = 1; i < rs.length; i++) {
          expect(rs[i]!).toBeGreaterThanOrEqual(rs[i - 1]!);
        }
      }
    });

    it('event log captures all transitions', async () => {
      const { matchId } = await driveMatch('demo-comeback-events-001', (round) => round * 5);

      const events = getMatchEvents(matchId);
      expect(events.length).toBeGreaterThan(0);

      // Monotonic sequence IDs
      for (let i = 1; i < events.length; i++) {
        expect(events[i]!.sequenceId).toBeGreaterThan(events[i - 1]!.sequenceId);
      }

      // Contains final_standings and match_complete
      expect(events.some((e) => e.eventType === 'final_standings')).toBe(true);
      expect(events.some((e) => e.eventType === 'match_complete')).toBe(true);
    });

    it('replay reconstructs successfully', async () => {
      const { matchId } = await driveMatch('demo-comeback-replay-001', (round) => round * 5);

      const replay = reconstructReplay({ matchId });
      expect(replay.ok).toBe(true);
      if (!replay.ok) return;

      expect(replay.data.finalStandings).toHaveLength(4);
      expect(replay.data.events.length).toBeGreaterThan(0);
    });
  });

  // -----------------------------------------------------------------------
  // Scenario 2: Champion Showcase (Cult of S.A.M.)
  // -----------------------------------------------------------------------

  describe('Scenario 2: Champion Showcase', () => {
    it('Cult of S.A.M. bot config exists and is aggressive', () => {
      const samBot = DEFAULT_BOT_CONFIGS.find((b) => b.name === 'cult-of-sam');
      expect(samBot).toBeDefined();
      expect(samBot!.personality).toBe('aggressive');
      expect(samBot!.displayName).toBe('Cult of S.A.M.');
    });

    it('match completes with named champion bots participating', async () => {
      const { matchId, managers } = await driveMatch(
        'demo-champion-seed-001',
        (round) => round * 20, // Aggressive human too
      );

      const final = getActiveMatch(matchId)!;
      expect(final.status).toBe('completed');

      // All bots have scores
      for (const m of managers) {
        expect(final.scores[m.id]).toBeGreaterThan(0);
      }
    });

    it('round assignments are valid for the demo seed', () => {
      const assignments = getRoundAssignments('demo-champion-seed-001');
      expect(assignments).toHaveLength(5);

      // Difficulty increases
      for (let i = 1; i < assignments.length; i++) {
        expect(assignments[i]!.challenge.difficulty).toBeGreaterThanOrEqual(
          assignments[i - 1]!.challenge.difficulty,
        );
      }

      // Each round has a data card
      for (const a of assignments) {
        expect(a.dataCard).toBeDefined();
        expect(a.dataCard.id).toBeTruthy();
      }
    });
  });

  // -----------------------------------------------------------------------
  // Scenario 3: Close Finish
  // -----------------------------------------------------------------------

  describe('Scenario 3: Close Finish', () => {
    it('match completes and all managers have similar scores', async () => {
      const { matchId, managers } = await driveMatch(
        'demo-close-finish-seed-001',
        (round) => 30 + round, // Moderate, consistent bids
      );

      const final = getActiveMatch(matchId)!;
      expect(final.status).toBe('completed');

      // All scores populated
      const scores = managers.map((m) => final.scores[m.id]!);
      expect(scores.every((s) => s > 0)).toBe(true);

      // Score spread: highest / lowest ratio < 1.2 (within 20%)
      const maxScore = Math.max(...scores);
      const minScore = Math.min(...scores);
      expect(maxScore / minScore).toBeLessThan(1.2);
    });

    it('replay is self-contained', async () => {
      const { matchId } = await driveMatch('demo-close-finish-replay-001', (round) => 30 + round);

      const replay = reconstructReplay({ matchId });
      expect(replay.ok).toBe(true);
      if (!replay.ok) return;

      // Replay has all data needed for reconstruction
      expect(replay.data.matchId).toBe(matchId);
      expect(replay.data.seed).toBe('demo-close-finish-replay-001');
      expect(replay.data.events.length).toBeGreaterThan(0);
      expect(replay.data.finalStandings).toHaveLength(4);
      expect(replay.data.totalEvents).toBe(replay.data.events.length);
    });
  });

  // -----------------------------------------------------------------------
  // Cross-cutting: Multilingual commentary smoke test
  // -----------------------------------------------------------------------

  describe('Demo: Multilingual commentary', () => {
    it('generates commentary in all supported languages without provider', async () => {
      const event = {
        type: 'phase_transition',
        round: 1,
        toPhase: 'briefing',
      };

      for (const lang of SUPPORTED_LANGUAGES) {
        const text = await generateMultilingualCommentary(event, lang as CommentaryLanguage);
        // Without a provider, non-English falls back to English template
        expect(typeof text).toBe('string');
        expect(text.length).toBeGreaterThan(0);
      }
    });
  });
});
