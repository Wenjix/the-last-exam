import {
  briefingCommentary,
  bidRevealCommentary,
  equipCommentary,
  runStartCommentary,
  roundResultCommentary,
  finalStandingsCommentary,
} from './templates.js';
import { CommentaryCircuitBreaker } from './circuit-breaker.js';
import type { CircuitBreakerConfig } from './circuit-breaker.js';

export interface CommentaryEvent {
  readonly type: string;
  readonly matchId: string;
  readonly round?: number;
  readonly [key: string]: unknown;
}

export interface CommentaryOutput {
  readonly text: string;
  readonly matchId: string;
  readonly round: number;
  readonly language: string;
  readonly timestamp: string;
}

export type CommentaryListener = (output: CommentaryOutput) => void;

export interface CommentaryGeneratorOptions {
  /** Circuit breaker configuration for non-blocking commentary. */
  readonly circuitBreaker?: CircuitBreakerConfig;
}

/**
 * Async commentary generator. Subscribes to game events
 * and produces text commentary. Fire-and-forget -- never blocks
 * the game loop.
 *
 * Wraps commentary generation in a {@link CommentaryCircuitBreaker}
 * so that slow or failing operations are timed out (default 5 s)
 * and the circuit opens after repeated failures.
 */
export class CommentaryGenerator {
  private listeners: CommentaryListener[] = [];
  private language: string = 'en';
  private readonly circuitBreaker: CommentaryCircuitBreaker;

  constructor(options: CommentaryGeneratorOptions = {}) {
    this.circuitBreaker = new CommentaryCircuitBreaker(options.circuitBreaker);
  }

  /**
   * Register a listener for commentary output.
   */
  onCommentary(listener: CommentaryListener): void {
    this.listeners.push(listener);
  }

  /**
   * Remove a commentary listener.
   */
  removeListener(listener: CommentaryListener): void {
    this.listeners = this.listeners.filter((l) => l !== listener);
  }

  /**
   * Set commentary language.
   */
  setLanguage(lang: string): void {
    this.language = lang;
  }

  /**
   * Process a game event and generate commentary.
   *
   * Fire-and-forget -- returns immediately. The actual generation
   * runs inside the circuit breaker with a timeout. If commentary
   * takes too long or fails repeatedly, the circuit opens and
   * subsequent calls are skipped until the cooldown elapses.
   *
   * **This method never throws.**
   */
  processEvent(event: CommentaryEvent): void {
    // Fire-and-forget: kick off the async work but never await it
    // at the call site. The circuit breaker handles timeouts.
    void this.circuitBreaker.execute(async () => {
      const text = this.generateText(event);
      if (!text) return;

      const output: CommentaryOutput = {
        text,
        matchId: event.matchId,
        round: (event.round as number) || 0,
        language: this.language,
        timestamp: new Date().toISOString(),
      };

      // Emit to all listeners (fire-and-forget)
      for (const listener of this.listeners) {
        try {
          listener(output);
        } catch {
          // Never let listener errors propagate
        }
      }
    });
  }

  /**
   * Returns the underlying circuit breaker for inspection / testing.
   */
  get breaker(): CommentaryCircuitBreaker {
    return this.circuitBreaker;
  }

  /**
   * Generate commentary text based on event type.
   */
  private generateText(event: CommentaryEvent): string | null {
    const round = (event.round as number) || 1;

    switch (event.type) {
      case 'phase_transition': {
        const toPhase = event.toPhase as string;
        switch (toPhase) {
          case 'briefing':
            return briefingCommentary(round);
          case 'bid_resolve':
            return bidRevealCommentary(round, 'The top bidder', 0);
          case 'equip':
            return equipCommentary(round);
          case 'run':
            return runStartCommentary(round);
          default:
            return null;
        }
      }

      case 'round_result': {
        const results = event.results as Array<{ managerId: string; score: number }> | undefined;
        if (results && results.length > 0) {
          const top = results.reduce((a, b) => (a.score > b.score ? a : b));
          return roundResultCommentary(round, top.managerId, top.score);
        }
        return roundResultCommentary(round, 'Unknown', 0);
      }

      case 'final_standings': {
        const standings = event.standings as
          | Array<{ managerName: string; totalScore: number; rank: number }>
          | undefined;
        if (standings && standings.length > 0) {
          const winner = standings.find((s) => s.rank === 1);
          if (winner) {
            return finalStandingsCommentary(winner.managerName, winner.totalScore);
          }
        }
        return finalStandingsCommentary('The champion', 0);
      }

      default:
        return null;
    }
  }
}
