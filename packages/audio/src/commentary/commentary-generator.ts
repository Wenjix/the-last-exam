import {
  briefingCommentary,
  biddingCommentary,
  bidResultCommentary,
  strategyCommentary,
  executionCommentary,
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
  readonly circuitBreaker?: CircuitBreakerConfig;
}

export class CommentaryGenerator {
  private listeners: CommentaryListener[] = [];
  private language: string = 'en';
  private readonly circuitBreaker: CommentaryCircuitBreaker;

  constructor(options: CommentaryGeneratorOptions = {}) {
    this.circuitBreaker = new CommentaryCircuitBreaker(options.circuitBreaker);
  }

  onCommentary(listener: CommentaryListener): void {
    this.listeners.push(listener);
  }

  removeListener(listener: CommentaryListener): void {
    this.listeners = this.listeners.filter((l) => l !== listener);
  }

  setLanguage(lang: string): void {
    this.language = lang;
  }

  processEvent(event: CommentaryEvent): void {
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

      for (const listener of this.listeners) {
        try {
          listener(output);
        } catch {
          // Never let listener errors propagate
        }
      }
    });
  }

  get breaker(): CommentaryCircuitBreaker {
    return this.circuitBreaker;
  }

  private generateText(event: CommentaryEvent): string | null {
    const round = (event.round as number) || 1;

    switch (event.type) {
      case 'phase_transition': {
        const toPhase = event.toPhase as string;
        switch (toPhase) {
          case 'briefing':
            return briefingCommentary(round);
          case 'bidding':
            return biddingCommentary(round);
          case 'strategy': {
            // Also include bid result commentary
            const bidWinner = event.bidWinner as
              | { managerName: string; amount: number }
              | null
              | undefined;
            const bidText = bidResultCommentary(
              bidWinner?.managerName ?? null,
              bidWinner?.amount ?? 0,
            );
            return `${bidText} ${strategyCommentary(round)}`;
          }
          case 'execution':
            return executionCommentary(round);
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
