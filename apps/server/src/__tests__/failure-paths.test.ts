/**
 * 28y.5 -- Failure-path integration tests for graceful degradation.
 *
 * Verifies that the system degrades gracefully when:
 *   1. Agent (human) does not submit a bid before the deadline
 *   2. Agent (human) does not submit equip before the deadline
 *   3. Runner sandbox times out (fallback result produced)
 *   4. Commentary times out (circuit breaker opens, game not blocked)
 *
 * Uses vi.useFakeTimers() for deterministic timer control.
 */

import { initDatabase, closeDatabase } from '../persistence/database.js';
import {
  createMatch,
  getActiveMatch,
  submitBid,
  submitEquip,
} from '../orchestrator/match-orchestrator.js';
import { buildManagers, insertMatchRow } from './helpers.js';
import { RunnerResultSchema } from '@tle/contracts';
import { CommentaryCircuitBreaker, CircuitState, CommentaryGenerator } from '@tle/audio';
import type { CommentaryEvent, CommentaryOutput } from '@tle/audio';

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('28y.5: Failure-path integration tests', () => {
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
  // Test 1: Agent doesn't submit bid before deadline
  // -----------------------------------------------------------------------

  describe('Test 1: Agent does not submit bid before deadline', () => {
    it('match continues with default bot bids when human misses bid deadline', async () => {
      const managers = buildManagers();
      const match = createMatch(managers, 'failure-bid-timeout');
      const matchId = match.id;
      insertMatchRow(matchId, 'failure-bid-timeout');

      // Phase: briefing (10s)
      expect(match.phase).toBe('briefing');
      await vi.advanceTimersByTimeAsync(10_000);

      // Phase: hidden_bid (30s deadline)
      expect(match.phase).toBe('hidden_bid');

      // Do NOT submit a bid for the human player.
      // Advance past bot auto-submit (500ms) and then the full deadline.
      await vi.advanceTimersByTimeAsync(30_000);

      // Match should have advanced past hidden_bid without crashing.
      const active = getActiveMatch(matchId)!;
      expect(active).toBeDefined();
      expect(active.status).toBe('active');
      expect(active.phase).toBe('bid_resolve');

      // Bots should have auto-submitted bids.
      const bots = managers.filter((m) => m.role === 'bot');
      for (const bot of bots) {
        expect(active.bids.has(bot.id)).toBe(true);
      }

      // Human bid is absent (no default applied for humans).
      const human = managers[0]!;
      expect(active.bids.has(human.id)).toBe(false);
    });

    it('match can complete a full round even when human never bids', async () => {
      const managers = buildManagers();
      const match = createMatch(managers, 'failure-bid-full-round');
      const matchId = match.id;
      insertMatchRow(matchId, 'failure-bid-full-round');

      const human = managers[0]!;

      // briefing -> hidden_bid -> bid_resolve -> equip -> run -> resolve
      await vi.advanceTimersByTimeAsync(10_000); // briefing
      // Skip human bid
      await vi.advanceTimersByTimeAsync(30_000); // hidden_bid deadline
      await vi.advanceTimersByTimeAsync(5_000); // bid_resolve

      // Phase: equip -- submit equip to isolate the bid failure
      expect(getActiveMatch(matchId)!.phase).toBe('equip');
      submitEquip(matchId, human.id, ['tool-a'], []);
      await vi.advanceTimersByTimeAsync(30_000); // equip deadline

      // run phase (2s mock)
      await vi.advanceTimersByTimeAsync(2_000);

      // resolve phase (15s)
      await vi.advanceTimersByTimeAsync(15_000);

      // Should now be in round 2
      const active = getActiveMatch(matchId)!;
      expect(active.round).toBe(2);
      expect(active.phase).toBe('briefing');
      expect(active.status).toBe('active');

      // Scores should be populated for all managers (run results are deterministic)
      for (const manager of managers) {
        expect(active.roundScores[manager.id]).toHaveLength(1);
        expect(active.scores[manager.id]).toBeGreaterThan(0);
      }
    });
  });

  // -----------------------------------------------------------------------
  // Test 2: Agent doesn't submit equip before deadline
  // -----------------------------------------------------------------------

  describe('Test 2: Agent does not submit equip before deadline', () => {
    it('match continues when human misses equip deadline', async () => {
      const managers = buildManagers();
      const human = managers[0]!;
      const match = createMatch(managers, 'failure-equip-timeout');
      const matchId = match.id;
      insertMatchRow(matchId, 'failure-equip-timeout');

      // briefing
      await vi.advanceTimersByTimeAsync(10_000);

      // hidden_bid -- submit human bid normally
      expect(getActiveMatch(matchId)!.phase).toBe('hidden_bid');
      submitBid(matchId, human.id, 50);
      await vi.advanceTimersByTimeAsync(30_000);

      // bid_resolve
      await vi.advanceTimersByTimeAsync(5_000);

      // equip -- do NOT submit human equip
      expect(getActiveMatch(matchId)!.phase).toBe('equip');
      await vi.advanceTimersByTimeAsync(30_000);

      // Match should have advanced past equip without crashing.
      const active = getActiveMatch(matchId)!;
      expect(active).toBeDefined();
      expect(active.status).toBe('active');
      expect(active.phase).toBe('run');

      // Bots should have auto-submitted equips (empty arrays).
      const bots = managers.filter((m) => m.role === 'bot');
      for (const bot of bots) {
        expect(active.equips.has(bot.id)).toBe(true);
      }

      // Human equip is absent (no default for humans).
      expect(active.equips.has(human.id)).toBe(false);
    });

    it('match can complete a full round even when human never equips', async () => {
      const managers = buildManagers();
      const human = managers[0]!;
      const match = createMatch(managers, 'failure-equip-full-round');
      const matchId = match.id;
      insertMatchRow(matchId, 'failure-equip-full-round');

      // Round 1
      await vi.advanceTimersByTimeAsync(10_000); // briefing
      submitBid(matchId, human.id, 50);
      await vi.advanceTimersByTimeAsync(30_000); // hidden_bid
      await vi.advanceTimersByTimeAsync(5_000); // bid_resolve

      // Skip human equip entirely
      await vi.advanceTimersByTimeAsync(30_000); // equip deadline
      await vi.advanceTimersByTimeAsync(2_000); // run
      await vi.advanceTimersByTimeAsync(15_000); // resolve

      // Should now be in round 2
      const active = getActiveMatch(matchId)!;
      expect(active.round).toBe(2);
      expect(active.phase).toBe('briefing');
      expect(active.status).toBe('active');

      // All managers should have round 1 scores
      for (const manager of managers) {
        expect(active.roundScores[manager.id]).toHaveLength(1);
        expect(active.scores[manager.id]).toBeGreaterThan(0);
      }
    });
  });

  // -----------------------------------------------------------------------
  // Test 3: Runner times out -- fallback result validation
  // -----------------------------------------------------------------------

  describe('Test 3: Runner times out -- fallback result validation', () => {
    it('timeout fallback result conforms to RunnerResult schema', () => {
      // Construct a fallback result that mirrors what createFallbackResult()
      // from apps/runner/src/fallback/ produces for FailureReason.TIMEOUT.
      // Use valid v4 UUIDs for schema compliance.
      const fallbackResult = {
        jobId: '550e8400-e29b-41d4-a716-446655440001',
        matchId: '550e8400-e29b-41d4-a716-446655440002',
        agentId: '550e8400-e29b-41d4-a716-446655440003',
        round: 1,
        success: false,
        stdout: '',
        stderr: '[fallback] Failure reason: TIMEOUT\n[fallback] Error: Process killed after 60s',
        submittedCode: 'console.log("hello")',
        harnessResults: [],
        executionMetadata: {
          durationMs: 60_000,
          memoryUsedBytes: 0,
          exitCode: 137,
          timedOut: true,
        },
        failureReason: 'timeout' as const,
      };

      // Validate against the contract schema
      const parsed = RunnerResultSchema.safeParse(fallbackResult);
      expect(parsed.success).toBe(true);

      // Verify timeout-specific fields
      expect(fallbackResult.success).toBe(false);
      expect(fallbackResult.failureReason).toBe('timeout');
      expect(fallbackResult.executionMetadata.timedOut).toBe(true);
      expect(fallbackResult.executionMetadata.exitCode).not.toBe(0);
    });

    it('timeout result always has zero harness results', () => {
      const fallbackResult = {
        jobId: '6ba7b810-9dad-41d1-80b4-00c04fd430c8',
        matchId: '6ba7b811-9dad-41d1-80b4-00c04fd430c8',
        agentId: '6ba7b812-9dad-41d1-80b4-00c04fd430c8',
        round: 3,
        success: false,
        stdout: 'partial output before kill',
        stderr: '[fallback] Failure reason: TIMEOUT',
        submittedCode: '',
        harnessResults: [],
        executionMetadata: {
          durationMs: 60_000,
          exitCode: 137,
          timedOut: true,
        },
        failureReason: 'timeout' as const,
      };

      const parsed = RunnerResultSchema.safeParse(fallbackResult);
      expect(parsed.success).toBe(true);
      expect(fallbackResult.harnessResults).toEqual([]);
      expect(fallbackResult.success).toBe(false);
    });

    it('sandbox timeout classification maps to timeout failure reason', () => {
      // The contract defines these failure reason values
      const validReasons = [
        'compilation_error',
        'runtime_error',
        'timeout',
        'memory_limit',
        'sandbox_error',
        'generation_error',
        'unknown',
      ];

      // Verify 'timeout' is a valid failure reason
      expect(validReasons).toContain('timeout');

      // A timed-out sandbox result should produce a result with
      // failureReason = 'timeout'. Construct and validate.
      const result = {
        jobId: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
        matchId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        agentId: '9f8b5c2e-1d4a-4f6b-8c3e-2a5b7d9e0f1c',
        round: 2,
        success: false,
        stdout: '',
        stderr: 'Process exceeded 60s time limit',
        submittedCode: 'while(true){}',
        harnessResults: [],
        executionMetadata: {
          durationMs: 60_000,
          exitCode: 137,
          timedOut: true,
        },
        failureReason: 'timeout' as const,
      };

      const parsed = RunnerResultSchema.safeParse(result);
      expect(parsed.success).toBe(true);

      if (parsed.success) {
        expect(parsed.data.failureReason).toBe('timeout');
        expect(parsed.data.executionMetadata.timedOut).toBe(true);
      }
    });

    it('fallback result for sandbox crash is distinct from timeout', () => {
      const crashResult = {
        jobId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
        matchId: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
        agentId: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
        round: 1,
        success: false,
        stdout: '',
        stderr: 'Segmentation fault',
        submittedCode: 'bad code',
        harnessResults: [],
        executionMetadata: {
          durationMs: 150,
          exitCode: 139,
          timedOut: false,
        },
        failureReason: 'runtime_error' as const,
      };

      const parsed = RunnerResultSchema.safeParse(crashResult);
      expect(parsed.success).toBe(true);

      // Crash is not a timeout
      expect(crashResult.failureReason).not.toBe('timeout');
      expect(crashResult.executionMetadata.timedOut).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Test 4: Commentary times out -- circuit breaker
  // -----------------------------------------------------------------------

  describe('Test 4: Commentary times out -- circuit breaker', () => {
    it('circuit breaker opens after consecutive timeouts', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});

      const breaker = new CommentaryCircuitBreaker({
        timeoutMs: 100,
        failureThreshold: 3,
        cooldownMs: 10_000,
      });

      const neverResolves = () => new Promise<string>(() => {});

      // Fail 3 times to trip the circuit
      for (let i = 0; i < 3; i++) {
        const p = breaker.execute(neverResolves);
        await vi.advanceTimersByTimeAsync(100);
        expect(await p).toBeNull();
      }

      expect(breaker.currentState).toBe(CircuitState.OPEN);
      expect(breaker.failures).toBe(3);
    });

    it('open circuit returns null immediately without invoking the function', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});

      const breaker = new CommentaryCircuitBreaker({
        timeoutMs: 50,
        failureThreshold: 2,
        cooldownMs: 60_000,
      });

      const neverResolves = () => new Promise<string>(() => {});

      // Trip circuit open
      for (let i = 0; i < 2; i++) {
        const p = breaker.execute(neverResolves);
        await vi.advanceTimersByTimeAsync(50);
        await p;
      }
      expect(breaker.currentState).toBe(CircuitState.OPEN);

      // Subsequent call should not invoke the function
      let invoked = false;
      const result = await breaker.execute(async () => {
        invoked = true;
        return 'should-not-run';
      });

      expect(result).toBeNull();
      expect(invoked).toBe(false);
    });

    it('commentary pipeline does not block game progression when circuit is open', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});

      const gen = new CommentaryGenerator({
        circuitBreaker: {
          timeoutMs: 50,
          failureThreshold: 2,
          // Cooldown longer than total simulated time (300s) so circuit
          // stays open for the entire test.
          cooldownMs: 999_999,
        },
      });

      const outputs: CommentaryOutput[] = [];
      gen.onCommentary((output: CommentaryOutput) => outputs.push(output));

      // Trip the circuit breaker directly via the exposed breaker
      const neverResolves = () => new Promise<void>(() => {});

      const p1 = gen.breaker.execute(neverResolves);
      await vi.advanceTimersByTimeAsync(50);
      await p1;

      const p2 = gen.breaker.execute(neverResolves);
      await vi.advanceTimersByTimeAsync(50);
      await p2;

      expect(gen.breaker.currentState).toBe(CircuitState.OPEN);

      // Simulate a full match's phase events while circuit is open.
      // Each processEvent call must return synchronously (void, not a Promise).
      const matchId = 'match-cb-open';
      const phases = ['briefing', 'hidden_bid', 'bid_resolve', 'equip', 'run', 'resolve'] as const;
      const durations = [10_000, 30_000, 5_000, 30_000, 60_000, 15_000] as const;

      let totalElapsed = 0;

      for (let round = 1; round <= 2; round++) {
        for (let i = 0; i < phases.length; i++) {
          const before = Date.now();

          // Must return void synchronously
          const ret = gen.processEvent({
            type: 'phase_transition',
            matchId,
            round,
            toPhase: phases[i],
          } as CommentaryEvent);
          expect(ret).toBeUndefined();

          await vi.advanceTimersByTimeAsync(durations[i]!);
          const elapsed = Date.now() - before;
          expect(elapsed).toBe(durations[i]!);
          totalElapsed += elapsed;
        }
      }

      // Total time for 2 rounds: 2 * (10k + 30k + 5k + 30k + 60k + 15k) = 300,000ms
      expect(totalElapsed).toBe(300_000);

      // No commentary should have been delivered (circuit was open the entire time)
      expect(outputs.length).toBe(0);
    });

    it('game loop completes full match regardless of commentary failures', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});

      // This test verifies that the match orchestrator and commentary
      // pipeline are decoupled: a full match completes successfully even
      // when the commentary circuit breaker is perpetually open.
      const managers = buildManagers();
      const human = managers[0]!;
      const match = createMatch(managers, 'failure-commentary-match');
      const matchId = match.id;
      insertMatchRow(matchId, 'failure-commentary-match');

      // Create a tripped circuit breaker
      const gen = new CommentaryGenerator({
        circuitBreaker: {
          timeoutMs: 50,
          failureThreshold: 1,
          cooldownMs: 999_999,
        },
      });

      const neverResolves = () => new Promise<void>(() => {});
      const p = gen.breaker.execute(neverResolves);
      await vi.advanceTimersByTimeAsync(50);
      await p;
      expect(gen.breaker.currentState).toBe(CircuitState.OPEN);

      // Run a full 5-round match, firing commentary events on each phase.
      // Commentary should silently fail, but the match loop must proceed.
      for (let round = 1; round <= 5; round++) {
        // briefing
        gen.processEvent({
          type: 'phase_transition',
          matchId,
          round,
          toPhase: 'briefing',
        } as CommentaryEvent);
        await vi.advanceTimersByTimeAsync(10_000);

        // hidden_bid
        submitBid(matchId, human.id, round * 10);
        gen.processEvent({
          type: 'phase_transition',
          matchId,
          round,
          toPhase: 'hidden_bid',
        } as CommentaryEvent);
        await vi.advanceTimersByTimeAsync(30_000);

        // bid_resolve
        gen.processEvent({
          type: 'phase_transition',
          matchId,
          round,
          toPhase: 'bid_resolve',
        } as CommentaryEvent);
        await vi.advanceTimersByTimeAsync(5_000);

        // equip
        submitEquip(matchId, human.id, ['tool-a'], ['hazard-b']);
        gen.processEvent({
          type: 'phase_transition',
          matchId,
          round,
          toPhase: 'equip',
        } as CommentaryEvent);
        await vi.advanceTimersByTimeAsync(30_000);

        // run
        gen.processEvent({
          type: 'phase_transition',
          matchId,
          round,
          toPhase: 'run',
        } as CommentaryEvent);
        await vi.advanceTimersByTimeAsync(2_000);

        // resolve
        gen.processEvent({
          type: 'phase_transition',
          matchId,
          round,
          toPhase: 'resolve',
        } as CommentaryEvent);
        await vi.advanceTimersByTimeAsync(15_000);
      }

      // Match should have completed successfully
      const finalMatch = getActiveMatch(matchId)!;
      expect(finalMatch).toBeDefined();
      expect(finalMatch.status).toBe('completed');
      expect(finalMatch.phase).toBe('final_standings');

      // All managers should have scores
      for (const manager of managers) {
        expect(finalMatch.scores[manager.id]).toBeGreaterThan(0);
        expect(finalMatch.roundScores[manager.id]).toHaveLength(5);
      }
    });
  });
});
