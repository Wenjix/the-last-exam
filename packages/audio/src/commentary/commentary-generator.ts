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

export interface LlmProvider {
  generateText: (
    prompt: string,
    options: { temperature?: number; maxTokens?: number; timeoutMs?: number },
  ) => Promise<{ content: string; error?: string }>;
}

export interface CommentaryGeneratorOptions {
  readonly circuitBreaker?: CircuitBreakerConfig;
  readonly llmProvider?: LlmProvider;
}

export class CommentaryGenerator {
  private listeners: CommentaryListener[] = [];
  private language: string = 'en';
  private readonly circuitBreaker: CommentaryCircuitBreaker;
  private readonly llmProvider?: LlmProvider;

  constructor(options: CommentaryGeneratorOptions = {}) {
    this.circuitBreaker = new CommentaryCircuitBreaker(options.circuitBreaker);
    this.llmProvider = options.llmProvider;
  }

  get isLiveAI(): boolean {
    return !!this.llmProvider;
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
      const templateText = this.generateTemplateText(event);
      if (!templateText) return;

      const text = await this.generateText(event, templateText);

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

  private async generateText(event: CommentaryEvent, templateHint: string): Promise<string> {
    if (!this.llmProvider) return templateHint;

    try {
      const prompt = this.buildLlmPrompt(event, templateHint);
      const result = await this.llmProvider.generateText(prompt, {
        temperature: 0.8,
        maxTokens: 150,
        timeoutMs: 5000,
      });

      if (result.error || !result.content) {
        return templateHint; // Fallback to template
      }

      return result.content.trim();
    } catch {
      return templateHint; // Fallback to template on any error
    }
  }

  private buildLlmPrompt(event: CommentaryEvent, templateHint: string): string {
    const round = (event.round as number) || 1;
    const eventType = event.type;

    return (
      `You are a dramatic esports commentator for an AI coding competition called "The Last Exam". ` +
      `Generate a short, exciting commentary line (1-2 sentences max) for this event.\n\n` +
      `Event: ${eventType}\n` +
      `Round: ${round}\n` +
      `Context hint: ${templateHint}\n\n` +
      `Be dramatic, concise, and exciting. Do not use markdown. Reply with ONLY the commentary text.`
    );
  }

  private generateTemplateText(event: CommentaryEvent): string | null {
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
