import {
  briefingCommentary,
  bidRevealCommentary,
  equipCommentary,
  runStartCommentary,
  roundResultCommentary,
  finalStandingsCommentary,
} from './templates.js';

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

/**
 * Async commentary generator. Subscribes to game events
 * and produces text commentary. Fire-and-forget — never blocks
 * the game loop.
 */
export class CommentaryGenerator {
  private listeners: CommentaryListener[] = [];
  private language: string = 'en';

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
   * Async — returns immediately, commentary emitted via listeners.
   * Errors are caught and logged, never thrown.
   */
  async processEvent(event: CommentaryEvent): Promise<void> {
    try {
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
    } catch {
      // Commentary generation failures are non-blocking
      // Log but never throw
    }
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
