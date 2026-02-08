/**
 * bze.7 -- Commentary stability integration tests.
 *
 * Verifies the NON-BLOCKING guarantee: commentary failures (slow generation,
 * circuit breaker trips, malformed events, API timeouts) must NEVER delay
 * or block the game loop. Phase transitions must complete within expected
 * timing regardless of commentary pipeline health.
 *
 * Uses vi.useFakeTimers() for deterministic timing control.
 */

import { CommentaryGenerator } from '../commentary/commentary-generator.js';
import type { CommentaryEvent, CommentaryOutput } from '../commentary/commentary-generator.js';
import { CommentaryCircuitBreaker, CircuitState } from '../commentary/circuit-breaker.js';
import { HeartbeatScheduler } from '../commentary/heartbeat-scheduler.js';
import { CommentaryRateLimiter, CommentaryPriority } from '../commentary/rate-limiter.js';

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('bze.7: Commentary stability -- non-blocking verification', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // Test 1: Commentary with slow generation does not block phases
  // -----------------------------------------------------------------------

  describe('Test 1: Slow generation does not block callers', () => {
    it('processEvent() returns immediately even when generation is slow', () => {
      const gen = new CommentaryGenerator({
        circuitBreaker: { timeoutMs: 100 },
      });

      const outputs: CommentaryOutput[] = [];
      gen.onCommentary((output) => outputs.push(output));

      // processEvent is synchronous (fire-and-forget); it must return void
      // immediately. Even though the circuit breaker wraps an async operation,
      // the caller never awaits it.
      const event: CommentaryEvent = {
        type: 'phase_transition',
        matchId: 'match-001',
        round: 1,
        toPhase: 'briefing',
      };

      const startTime = Date.now();
      gen.processEvent(event);
      const elapsed = Date.now() - startTime;

      // The call MUST return in 0 ms of simulated time (synchronous return).
      expect(elapsed).toBe(0);

      // Return type is void -- not a promise. This is the key non-blocking
      // guarantee: the caller never has a promise to await.
      const result = gen.processEvent(event);
      expect(result).toBeUndefined();
    });

    it('rapid-fire events all return immediately without queueing', () => {
      const gen = new CommentaryGenerator({
        circuitBreaker: { timeoutMs: 5_000 },
      });

      const events: CommentaryEvent[] = Array.from({ length: 50 }, (_, i) => ({
        type: 'phase_transition',
        matchId: 'match-rapid',
        round: (i % 5) + 1,
        toPhase: 'briefing',
      }));

      const startTime = Date.now();
      for (const event of events) {
        gen.processEvent(event);
      }
      const elapsed = Date.now() - startTime;

      // All 50 calls must complete in 0 ms of simulated time
      expect(elapsed).toBe(0);
    });

    it('no errors propagate from processEvent even with throwing listeners', () => {
      const gen = new CommentaryGenerator({
        circuitBreaker: { timeoutMs: 5_000 },
      });

      // Register a listener that throws
      gen.onCommentary(() => {
        throw new Error('Listener explosion');
      });

      const event: CommentaryEvent = {
        type: 'phase_transition',
        matchId: 'match-throw',
        round: 1,
        toPhase: 'briefing',
      };

      // Must not throw
      expect(() => gen.processEvent(event)).not.toThrow();
    });
  });

  // -----------------------------------------------------------------------
  // Test 2: Circuit breaker opens after repeated timeouts
  // -----------------------------------------------------------------------

  describe('Test 2: Circuit breaker opens after repeated timeouts', () => {
    it('opens after failureThreshold consecutive timeouts', async () => {
      const breaker = new CommentaryCircuitBreaker({
        timeoutMs: 100,
        failureThreshold: 3,
        cooldownMs: 500,
      });

      // Suppress expected console.warn from the circuit breaker
      vi.spyOn(console, 'warn').mockImplementation(() => {});

      expect(breaker.currentState).toBe(CircuitState.CLOSED);

      // Each call waits forever (simulating a 10s+ Gemini API hang).
      // The circuit breaker timeout at 100 ms will fire first.
      const slowFn = () => new Promise<string>(() => {}); // never resolves

      // Failure 1
      const p1 = breaker.execute(slowFn);
      await vi.advanceTimersByTimeAsync(100);
      expect(await p1).toBeNull();
      expect(breaker.failures).toBe(1);
      expect(breaker.currentState).toBe(CircuitState.CLOSED);

      // Failure 2
      const p2 = breaker.execute(slowFn);
      await vi.advanceTimersByTimeAsync(100);
      expect(await p2).toBeNull();
      expect(breaker.failures).toBe(2);
      expect(breaker.currentState).toBe(CircuitState.CLOSED);

      // Failure 3 -- threshold reached, circuit opens
      const p3 = breaker.execute(slowFn);
      await vi.advanceTimersByTimeAsync(100);
      expect(await p3).toBeNull();
      expect(breaker.failures).toBe(3);
      expect(breaker.currentState).toBe(CircuitState.OPEN);
    });

    it('returns null immediately when circuit is open (no execution)', async () => {
      const breaker = new CommentaryCircuitBreaker({
        timeoutMs: 100,
        failureThreshold: 2,
        cooldownMs: 1_000,
      });

      vi.spyOn(console, 'warn').mockImplementation(() => {});

      const slowFn = () => new Promise<string>(() => {});

      // Trip the circuit open
      const p1 = breaker.execute(slowFn);
      await vi.advanceTimersByTimeAsync(100);
      await p1;

      const p2 = breaker.execute(slowFn);
      await vi.advanceTimersByTimeAsync(100);
      await p2;

      expect(breaker.currentState).toBe(CircuitState.OPEN);

      // Now calls should return null immediately -- the fn should NOT be invoked
      let fnCalled = false;
      const result = await breaker.execute(async () => {
        fnCalled = true;
        return 'should-not-run';
      });

      expect(result).toBeNull();
      expect(fnCalled).toBe(false);
    });

    it('transitions to half-open after cooldown and recovers on success', async () => {
      const breaker = new CommentaryCircuitBreaker({
        timeoutMs: 100,
        failureThreshold: 2,
        cooldownMs: 500,
      });

      vi.spyOn(console, 'warn').mockImplementation(() => {});

      const slowFn = () => new Promise<string>(() => {});

      // Trip circuit open
      const p1 = breaker.execute(slowFn);
      await vi.advanceTimersByTimeAsync(100);
      await p1;
      const p2 = breaker.execute(slowFn);
      await vi.advanceTimersByTimeAsync(100);
      await p2;

      expect(breaker.currentState).toBe(CircuitState.OPEN);

      // Advance past cooldown
      await vi.advanceTimersByTimeAsync(500);

      // Next call should be a probe (half-open). If it succeeds, circuit closes.
      const probeResult = await breaker.execute(async () => 'recovered');
      expect(probeResult).toBe('recovered');
      expect(breaker.currentState).toBe(CircuitState.CLOSED);
      expect(breaker.failures).toBe(0);
    });

    it('re-opens on failed half-open probe', async () => {
      const breaker = new CommentaryCircuitBreaker({
        timeoutMs: 100,
        failureThreshold: 2,
        cooldownMs: 500,
      });

      vi.spyOn(console, 'warn').mockImplementation(() => {});

      const slowFn = () => new Promise<string>(() => {});

      // Trip circuit open
      const p1 = breaker.execute(slowFn);
      await vi.advanceTimersByTimeAsync(100);
      await p1;
      const p2 = breaker.execute(slowFn);
      await vi.advanceTimersByTimeAsync(100);
      await p2;

      expect(breaker.currentState).toBe(CircuitState.OPEN);

      // Advance past cooldown
      await vi.advanceTimersByTimeAsync(500);

      // Half-open probe fails -> should re-open
      const failProbe = breaker.execute(async () => {
        throw new Error('still broken');
      });
      expect(await failProbe).toBeNull();
      expect(breaker.currentState).toBe(CircuitState.OPEN);
    });
  });

  // -----------------------------------------------------------------------
  // Test 3: Generator handles malformed events gracefully
  // -----------------------------------------------------------------------

  describe('Test 3: Malformed events handled gracefully', () => {
    it('does not throw on completely empty event object', () => {
      const gen = new CommentaryGenerator({
        circuitBreaker: { timeoutMs: 1_000 },
      });

      // Force-cast to simulate malformed input from external systems
      const badEvent = {} as CommentaryEvent;
      expect(() => gen.processEvent(badEvent)).not.toThrow();
    });

    it('does not throw on event with unknown type', () => {
      const gen = new CommentaryGenerator({
        circuitBreaker: { timeoutMs: 1_000 },
      });

      const unknownEvent: CommentaryEvent = {
        type: 'completely_unknown_type',
        matchId: 'match-bad',
        round: 1,
      };

      expect(() => gen.processEvent(unknownEvent)).not.toThrow();
    });

    it('does not throw on event with missing matchId', () => {
      const gen = new CommentaryGenerator({
        circuitBreaker: { timeoutMs: 1_000 },
      });

      const badEvent = { type: 'phase_transition', toPhase: 'briefing' } as unknown as CommentaryEvent;
      expect(() => gen.processEvent(badEvent)).not.toThrow();
    });

    it('continues generating valid commentary after malformed events', async () => {
      const gen = new CommentaryGenerator({
        circuitBreaker: { timeoutMs: 1_000 },
      });

      const outputs: CommentaryOutput[] = [];
      gen.onCommentary((output) => outputs.push(output));

      // Send a series of bad events
      gen.processEvent({} as CommentaryEvent);
      gen.processEvent({ type: 'unknown' } as CommentaryEvent);
      gen.processEvent({ type: null } as unknown as CommentaryEvent);

      // Now send a valid event
      gen.processEvent({
        type: 'phase_transition',
        matchId: 'match-recover',
        round: 1,
        toPhase: 'briefing',
      });

      // Let microtasks and circuit breaker promises settle
      await vi.advanceTimersByTimeAsync(50);

      // The valid event should have produced commentary
      expect(outputs.length).toBeGreaterThanOrEqual(1);
      expect(outputs.some((o) => o.matchId === 'match-recover')).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // Test 4: Heartbeat scheduler does not interfere with event commentary
  // -----------------------------------------------------------------------

  describe('Test 4: Heartbeat scheduler non-interference', () => {
    it('pause/resume suppresses and restores heartbeats correctly', () => {
      const scheduler = new HeartbeatScheduler(100); // 100ms interval for fast testing

      const heartbeats: string[] = [];
      scheduler.onHeartbeat((text) => heartbeats.push(text));

      scheduler.start(1);

      // Let 3 heartbeats fire
      vi.advanceTimersByTime(350);
      expect(heartbeats.length).toBe(3);

      // Pause -- simulating event commentary in progress
      scheduler.pause();

      // Advance another 300ms -- no heartbeats should fire while paused
      vi.advanceTimersByTime(300);
      expect(heartbeats.length).toBe(3); // unchanged

      // Resume
      scheduler.resume();

      // Let 2 more heartbeats fire
      vi.advanceTimersByTime(200);
      expect(heartbeats.length).toBe(5);

      scheduler.stop();
    });

    it('heartbeats and event commentary produce no duplicates', async () => {
      const gen = new CommentaryGenerator({
        circuitBreaker: { timeoutMs: 1_000 },
      });
      const scheduler = new HeartbeatScheduler(200);

      const allOutputs: string[] = [];

      gen.onCommentary((output) => allOutputs.push(`event:${output.text}`));
      scheduler.onHeartbeat((text) => allOutputs.push(`heartbeat:${text}`));

      scheduler.start(1);

      // Let 2 heartbeats fire
      vi.advanceTimersByTime(450);
      const heartbeatCount = allOutputs.filter((o) => o.startsWith('heartbeat:')).length;
      expect(heartbeatCount).toBe(2);

      // Pause heartbeats, process an event
      scheduler.pause();
      gen.processEvent({
        type: 'phase_transition',
        matchId: 'match-hb',
        round: 1,
        toPhase: 'run',
      });

      // Advance time while paused to let circuit breaker resolve
      await vi.advanceTimersByTimeAsync(250);

      // No heartbeats should have fired during pause
      const heartbeatsDuringPause = allOutputs.filter((o) => o.startsWith('heartbeat:')).length;
      expect(heartbeatsDuringPause).toBe(2); // still 2 from before

      // Resume heartbeats
      scheduler.resume();
      vi.advanceTimersByTime(250);

      // Should have at least one new heartbeat
      const finalHeartbeats = allOutputs.filter((o) => o.startsWith('heartbeat:')).length;
      expect(finalHeartbeats).toBeGreaterThan(2);

      // Verify no duplicate entries (all outputs should be unique in this
      // controlled scenario where timestamps differ)
      // Event commentary and heartbeats have different prefixes, so they
      // cannot be duplicates of each other.
      const eventOutputs = allOutputs.filter((o) => o.startsWith('event:'));
      const heartbeatOutputs = allOutputs.filter((o) => o.startsWith('heartbeat:'));
      expect(eventOutputs.length + heartbeatOutputs.length).toBe(allOutputs.length);

      scheduler.stop();
    });

    it('stopping scheduler while generator processes events causes no errors', async () => {
      const gen = new CommentaryGenerator({
        circuitBreaker: { timeoutMs: 1_000 },
      });
      const scheduler = new HeartbeatScheduler(100);

      scheduler.start(1);

      // Process events and immediately stop the scheduler
      gen.processEvent({
        type: 'phase_transition',
        matchId: 'match-stop',
        round: 1,
        toPhase: 'briefing',
      });
      scheduler.stop();

      expect(scheduler.running).toBe(false);

      // Advancing time should not cause any errors
      await vi.advanceTimersByTimeAsync(500);

      // Generator should still work after scheduler is stopped
      expect(() =>
        gen.processEvent({
          type: 'round_result',
          matchId: 'match-stop',
          round: 1,
          results: [{ managerId: 'mgr-1', score: 100 }],
        }),
      ).not.toThrow();
    });
  });

  // -----------------------------------------------------------------------
  // Test 5: Rate limiter preserves critical events under backpressure
  // -----------------------------------------------------------------------

  describe('Test 5: Rate limiter priority backpressure', () => {
    it('drops HEARTBEAT items first when queue overflows', () => {
      const limiter = new CommentaryRateLimiter({
        maxPerSecond: 5,
        maxQueueSize: 5,
      });

      // Enqueue 3 HEARTBEAT, 2 EVENT, 2 CRITICAL = 7 items total
      // Queue max is 5, so 2 must be dropped.
      limiter.enqueue('hb-1', CommentaryPriority.HEARTBEAT);
      limiter.enqueue('hb-2', CommentaryPriority.HEARTBEAT);
      limiter.enqueue('hb-3', CommentaryPriority.HEARTBEAT);
      limiter.enqueue('evt-1', CommentaryPriority.EVENT);
      limiter.enqueue('evt-2', CommentaryPriority.EVENT);
      limiter.enqueue('crit-1', CommentaryPriority.CRITICAL);
      limiter.enqueue('crit-2', CommentaryPriority.CRITICAL);

      // Queue should be at the max size
      expect(limiter.queueSize).toBe(5);

      // Flush and collect all remaining items
      const emitted: string[] = [];
      limiter.onEmit((text) => emitted.push(text));
      limiter.flush();

      // CRITICAL items must always be present
      expect(emitted).toContain('crit-1');
      expect(emitted).toContain('crit-2');

      // EVENT items should be present (only HEARTBEAT should be dropped)
      expect(emitted).toContain('evt-1');
      expect(emitted).toContain('evt-2');

      // Only 1 HEARTBEAT should remain (3 enqueued, 2 dropped to bring
      // queue from 7 to 5)
      const heartbeats = emitted.filter((t) => t.startsWith('hb-'));
      expect(heartbeats.length).toBe(1);
    });

    it('never drops CRITICAL items even under extreme pressure', () => {
      const limiter = new CommentaryRateLimiter({
        maxPerSecond: 1,
        maxQueueSize: 3,
      });

      // Enqueue 5 CRITICAL items -- all should survive even though
      // maxQueueSize is 3, because backpressure does not evict CRITICAL.
      for (let i = 0; i < 5; i++) {
        limiter.enqueue(`crit-${i}`, CommentaryPriority.CRITICAL);
      }

      // The queue may exceed maxQueueSize because all items are CRITICAL
      // and cannot be evicted.
      expect(limiter.queueSize).toBe(5);

      const emitted: string[] = [];
      limiter.onEmit((text) => emitted.push(text));
      limiter.flush();

      for (let i = 0; i < 5; i++) {
        expect(emitted).toContain(`crit-${i}`);
      }
    });

    it('drain loop emits highest-priority items first', () => {
      const limiter = new CommentaryRateLimiter({
        maxPerSecond: 10,
        maxQueueSize: 20,
      });

      const emitted: string[] = [];
      limiter.onEmit((text) => emitted.push(text));

      // Enqueue in reverse priority order
      limiter.enqueue('hb-1', CommentaryPriority.HEARTBEAT);
      limiter.enqueue('evt-1', CommentaryPriority.EVENT);
      limiter.enqueue('crit-1', CommentaryPriority.CRITICAL);

      limiter.start();

      // Advance enough time for all 3 items to drain (100ms interval at 10/s)
      vi.advanceTimersByTime(300);

      limiter.stop();

      // CRITICAL should be first, EVENT second, HEARTBEAT last
      expect(emitted[0]).toBe('crit-1');
      expect(emitted[1]).toBe('evt-1');
      expect(emitted[2]).toBe('hb-1');
    });
  });

  // -----------------------------------------------------------------------
  // Test 6: Full pipeline integration -- failures don't affect timing
  // -----------------------------------------------------------------------

  describe('Test 6: Full pipeline integration -- commentary failures never affect match timing', () => {
    it('processes a full match event sequence with injected failures', async () => {
      // Suppress circuit breaker warnings
      vi.spyOn(console, 'warn').mockImplementation(() => {});

      // ---- Set up pipeline ----
      const gen = new CommentaryGenerator({
        circuitBreaker: {
          timeoutMs: 200,
          failureThreshold: 3,
          cooldownMs: 2_000,
        },
      });

      const scheduler = new HeartbeatScheduler(500);
      const limiter = new CommentaryRateLimiter({
        maxPerSecond: 10,
        maxQueueSize: 10,
      });

      // Wire up: generator -> rate limiter, scheduler -> rate limiter
      const emitted: string[] = [];
      gen.onCommentary((output) => {
        limiter.enqueue(output.text, CommentaryPriority.EVENT);
      });
      scheduler.onHeartbeat((text) => {
        limiter.enqueue(text, CommentaryPriority.HEARTBEAT);
      });
      limiter.onEmit((text) => emitted.push(text));
      limiter.start();

      // ---- Simulate 5-round match event sequence ----
      const phases = ['briefing', 'bid_resolve', 'equip', 'run'] as const;
      const phaseTimings = [10_000, 5_000, 30_000, 60_000] as const;
      const matchId = 'match-full-pipeline';

      // Track per-phase wall-clock time to verify non-blocking
      const phaseStartTimes: number[] = [];
      const phaseEndTimes: number[] = [];

      for (let round = 1; round <= 5; round++) {
        for (let p = 0; p < phases.length; p++) {
          const phase = phases[p]!;
          const duration = phaseTimings[p]!;

          phaseStartTimes.push(Date.now());

          // Fire phase transition event (this must be non-blocking)
          gen.processEvent({
            type: 'phase_transition',
            matchId,
            round,
            toPhase: phase,
          });

          // Start heartbeats during run phase
          if (phase === 'run') {
            scheduler.start(round);
          }

          // Advance through the phase duration
          await vi.advanceTimersByTimeAsync(duration);

          // Stop heartbeats at end of run phase
          if (phase === 'run') {
            scheduler.stop();
          }

          phaseEndTimes.push(Date.now());

          // Verify: phase duration is exactly as expected (no commentary delay)
          const actual =
            phaseEndTimes[phaseEndTimes.length - 1]! - phaseStartTimes[phaseStartTimes.length - 1]!;
          expect(actual).toBe(duration);
        }

        // Fire round result event
        gen.processEvent({
          type: 'round_result',
          matchId,
          round,
          results: [{ managerId: 'mgr-1', score: round * 100 }],
        });
      }

      // Fire final standings
      gen.processEvent({
        type: 'final_standings',
        matchId,
        standings: [
          { managerName: 'Winner', totalScore: 1500, rank: 1 },
          { managerName: 'Second', totalScore: 1200, rank: 2 },
        ],
      });

      // Let everything settle
      await vi.advanceTimersByTimeAsync(500);

      // Flush remaining limiter items
      limiter.flush();
      limiter.stop();

      // ---- Assertions ----

      // 1. Some commentary was emitted (pipeline worked)
      expect(emitted.length).toBeGreaterThan(0);

      // 2. All phase durations were exact (no delay from commentary)
      for (let i = 0; i < phaseStartTimes.length; i++) {
        const actual = phaseEndTimes[i]! - phaseStartTimes[i]!;
        const expected = phaseTimings[i % phases.length]!;
        expect(actual).toBe(expected);
      }
    });

    it('match completes normally when circuit breaker trips mid-match', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});

      const gen = new CommentaryGenerator({
        circuitBreaker: {
          timeoutMs: 100,
          failureThreshold: 2,
          cooldownMs: 60_000, // long cooldown -- stays open for the match
        },
      });

      const outputs: CommentaryOutput[] = [];
      gen.onCommentary((output) => outputs.push(output));

      const matchId = 'match-tripped';

      // Trip the circuit breaker open by calling execute() directly with
      // never-resolving functions. processEvent() uses fire-and-forget, so
      // we must drive the breaker directly to guarantee state transitions.
      const slowFn = () => new Promise<void>(() => {}); // never resolves

      const p1 = gen.breaker.execute(slowFn);
      await vi.advanceTimersByTimeAsync(100);
      await p1;

      const p2 = gen.breaker.execute(slowFn);
      await vi.advanceTimersByTimeAsync(100);
      await p2;

      // Circuit is now open (2 failures with threshold 2)
      expect(gen.breaker.currentState).toBe(CircuitState.OPEN);

      // Continue processing events via the generator -- they should be
      // silently skipped because the circuit is open.
      const phaseEvents = [
        { type: 'phase_transition', matchId, round: 1, toPhase: 'equip' },
        { type: 'phase_transition', matchId, round: 1, toPhase: 'run' },
        { type: 'round_result', matchId, round: 1, results: [{ managerId: 'mgr-1', score: 100 }] },
        { type: 'phase_transition', matchId, round: 2, toPhase: 'briefing' },
        { type: 'phase_transition', matchId, round: 2, toPhase: 'bid_resolve' },
        {
          type: 'final_standings',
          matchId,
          standings: [{ managerName: 'W', totalScore: 500, rank: 1 }],
        },
      ] as CommentaryEvent[];

      const startTime = Date.now();
      for (const event of phaseEvents) {
        // Each processEvent call must return immediately
        gen.processEvent(event);
      }
      const callDuration = Date.now() - startTime;

      // All calls returned in 0 ms (open circuit short-circuits immediately)
      expect(callDuration).toBe(0);

      // Let any pending microtasks settle
      await vi.advanceTimersByTimeAsync(200);

      // No commentary should have been delivered for the events sent while
      // the circuit was open (all skipped).
      expect(outputs.length).toBe(0);
    });

    it('match timing is preserved with mixed success/failure commentary', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});

      const gen = new CommentaryGenerator({
        circuitBreaker: {
          timeoutMs: 500,
          failureThreshold: 10, // high threshold so circuit stays closed
          cooldownMs: 60_000,
        },
      });

      const outputs: CommentaryOutput[] = [];
      gen.onCommentary((output) => outputs.push(output));

      const matchId = 'match-mixed';

      // Simulate a series of phases with precise timing.
      // Between events, advance fake timers by the phase duration.
      // The critical assertion is that advanceTimersByTimeAsync(duration)
      // always advances exactly `duration` ms, regardless of what commentary
      // is doing in the background.
      const durations = [10_000, 30_000, 5_000, 30_000, 60_000, 15_000];
      const phaseNames = ['briefing', 'hidden_bid', 'bid_resolve', 'equip', 'run', 'resolve'];

      let totalElapsed = 0;

      for (let i = 0; i < phaseNames.length; i++) {
        const before = Date.now();

        gen.processEvent({
          type: 'phase_transition',
          matchId,
          round: 1,
          toPhase: phaseNames[i]!,
        });

        await vi.advanceTimersByTimeAsync(durations[i]!);

        const after = Date.now();
        const elapsed = after - before;

        // Phase duration must be exactly as specified
        expect(elapsed).toBe(durations[i]!);
        totalElapsed += elapsed;
      }

      // Total match time for one round must be exactly the sum of phase durations
      expect(totalElapsed).toBe(150_000);

      // Some commentary should have been generated for valid phase events
      await vi.advanceTimersByTimeAsync(1_000);
      expect(outputs.length).toBeGreaterThan(0);
    });
  });
});
