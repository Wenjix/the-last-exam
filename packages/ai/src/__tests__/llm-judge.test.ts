/**
 * Unit tests for the LLM judge.
 * Issue: 5li.2
 *
 * AC:
 *  - LLM judge callable with any ModelProvider
 *  - 5s timeout default, returns null on failure
 *  - Score in 0-1 range, mapped to bonus capped at 10% of base
 *  - All existing tests still pass + new tests
 */

import { describe, it, expect, vi } from 'vitest';

import { evaluateCodeQuality, calculateLlmBonus } from '../scoring/llm-judge.js';
import type { LlmJudgeResult } from '../scoring/llm-judge.js';
import type {
  ModelProvider,
  GenerateResult,
  GenerateOptions,
  ModelInfo,
} from '../providers/model-provider.js';

// ─── Mock Provider Factory ───────────────────────────────────────────

function createMockProvider(
  overrides: Partial<{
    generateText: (prompt: string, options?: GenerateOptions) => Promise<GenerateResult>;
    generateCode: (prompt: string, options?: GenerateOptions) => Promise<GenerateResult>;
    getModelInfo: () => ModelInfo;
  }> = {},
): ModelProvider {
  const defaultResult: GenerateResult = {
    content: JSON.stringify({ score: 0.75, rationale: 'Good code quality' }),
    model: 'mock-model',
    usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    latencyMs: 200,
  };

  return {
    generateText: overrides.generateText ?? vi.fn().mockResolvedValue(defaultResult),
    generateCode: overrides.generateCode ?? vi.fn().mockResolvedValue(defaultResult),
    getModelInfo:
      overrides.getModelInfo ??
      vi.fn().mockReturnValue({
        provider: 'mock',
        modelId: 'mock-model',
        displayName: 'Mock Model',
        attribution: 'Mock',
      }),
  };
}

// ─── evaluateCodeQuality ─────────────────────────────────────────────

describe('evaluateCodeQuality', () => {
  const sampleCode = 'function add(a: number, b: number): number { return a + b; }';
  const sampleChallenge = 'Write a function that adds two numbers.';

  it('returns a valid LlmJudgeResult for a well-formed LLM response', async () => {
    const provider = createMockProvider();
    const result = await evaluateCodeQuality(sampleCode, sampleChallenge, provider);

    expect(result).not.toBeNull();
    const r = result as LlmJudgeResult;
    expect(r.qualityScore).toBe(0.75);
    expect(r.rationale).toBe('Good code quality');
    expect(typeof r.latencyMs).toBe('number');
    expect(r.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('passes the correct options to the provider', async () => {
    const mockGenerateText = vi.fn().mockResolvedValue({
      content: JSON.stringify({ score: 0.5, rationale: 'OK' }),
      model: 'mock-model',
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      latencyMs: 100,
    });

    const provider = createMockProvider({ generateText: mockGenerateText });
    await evaluateCodeQuality(sampleCode, sampleChallenge, provider);

    expect(mockGenerateText).toHaveBeenCalledTimes(1);
    const [, options] = mockGenerateText.mock.calls[0] as [string, GenerateOptions];
    expect(options.timeoutMs).toBe(5_000); // default
    expect(options.temperature).toBe(0); // default
    expect(options.maxTokens).toBe(256);
    expect(typeof options.systemPrompt).toBe('string');
  });

  it('uses custom timeout and temperature when provided', async () => {
    const mockGenerateText = vi.fn().mockResolvedValue({
      content: JSON.stringify({ score: 0.5, rationale: 'OK' }),
      model: 'mock-model',
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      latencyMs: 100,
    });

    const provider = createMockProvider({ generateText: mockGenerateText });
    await evaluateCodeQuality(sampleCode, sampleChallenge, provider, {
      timeoutMs: 3_000,
      temperature: 0.5,
    });

    const [, options] = mockGenerateText.mock.calls[0] as [string, GenerateOptions];
    expect(options.timeoutMs).toBe(3_000);
    expect(options.temperature).toBe(0.5);
  });

  // ─── Failure Cases ───────────────────────────────────────────────

  it('returns null when the provider returns an error', async () => {
    const provider = createMockProvider({
      generateText: vi.fn().mockResolvedValue({
        content: '',
        model: 'mock-model',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        latencyMs: 100,
        error: 'API key missing',
      }),
    });

    const result = await evaluateCodeQuality(sampleCode, sampleChallenge, provider);
    expect(result).toBeNull();
  });

  it('returns null when the provider returns empty content', async () => {
    const provider = createMockProvider({
      generateText: vi.fn().mockResolvedValue({
        content: '',
        model: 'mock-model',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        latencyMs: 100,
      }),
    });

    const result = await evaluateCodeQuality(sampleCode, sampleChallenge, provider);
    expect(result).toBeNull();
  });

  it('returns null when the provider returns whitespace-only content', async () => {
    const provider = createMockProvider({
      generateText: vi.fn().mockResolvedValue({
        content: '   \n  ',
        model: 'mock-model',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        latencyMs: 100,
      }),
    });

    const result = await evaluateCodeQuality(sampleCode, sampleChallenge, provider);
    expect(result).toBeNull();
  });

  it('returns null when the provider returns invalid JSON', async () => {
    const provider = createMockProvider({
      generateText: vi.fn().mockResolvedValue({
        content: 'This is not JSON at all',
        model: 'mock-model',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        latencyMs: 100,
      }),
    });

    const result = await evaluateCodeQuality(sampleCode, sampleChallenge, provider);
    expect(result).toBeNull();
  });

  it('returns null when JSON is missing the score field', async () => {
    const provider = createMockProvider({
      generateText: vi.fn().mockResolvedValue({
        content: JSON.stringify({ rationale: 'No score here' }),
        model: 'mock-model',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        latencyMs: 100,
      }),
    });

    const result = await evaluateCodeQuality(sampleCode, sampleChallenge, provider);
    expect(result).toBeNull();
  });

  it('returns null when JSON is missing the rationale field', async () => {
    const provider = createMockProvider({
      generateText: vi.fn().mockResolvedValue({
        content: JSON.stringify({ score: 0.5 }),
        model: 'mock-model',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        latencyMs: 100,
      }),
    });

    const result = await evaluateCodeQuality(sampleCode, sampleChallenge, provider);
    expect(result).toBeNull();
  });

  it('returns null when the provider throws an exception', async () => {
    const provider = createMockProvider({
      generateText: vi.fn().mockRejectedValue(new Error('Network failure')),
    });

    const result = await evaluateCodeQuality(sampleCode, sampleChallenge, provider);
    expect(result).toBeNull();
  });

  // ─── Score Normalization ─────────────────────────────────────────

  it('clamps scores above 1 to 1', async () => {
    const provider = createMockProvider({
      generateText: vi.fn().mockResolvedValue({
        content: JSON.stringify({ score: 1.5, rationale: 'Over the top' }),
        model: 'mock-model',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        latencyMs: 100,
      }),
    });

    const result = await evaluateCodeQuality(sampleCode, sampleChallenge, provider);
    expect(result).not.toBeNull();
    expect(result!.qualityScore).toBe(1);
  });

  it('clamps negative scores to 0', async () => {
    const provider = createMockProvider({
      generateText: vi.fn().mockResolvedValue({
        content: JSON.stringify({ score: -0.3, rationale: 'Negative score' }),
        model: 'mock-model',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        latencyMs: 100,
      }),
    });

    const result = await evaluateCodeQuality(sampleCode, sampleChallenge, provider);
    expect(result).not.toBeNull();
    expect(result!.qualityScore).toBe(0);
  });

  it('handles score of exactly 0', async () => {
    const provider = createMockProvider({
      generateText: vi.fn().mockResolvedValue({
        content: JSON.stringify({ score: 0, rationale: 'Terrible' }),
        model: 'mock-model',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        latencyMs: 100,
      }),
    });

    const result = await evaluateCodeQuality(sampleCode, sampleChallenge, provider);
    expect(result).not.toBeNull();
    expect(result!.qualityScore).toBe(0);
  });

  it('handles score of exactly 1', async () => {
    const provider = createMockProvider({
      generateText: vi.fn().mockResolvedValue({
        content: JSON.stringify({ score: 1, rationale: 'Perfect' }),
        model: 'mock-model',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        latencyMs: 100,
      }),
    });

    const result = await evaluateCodeQuality(sampleCode, sampleChallenge, provider);
    expect(result).not.toBeNull();
    expect(result!.qualityScore).toBe(1);
  });

  // ─── JSON Parsing Edge Cases ─────────────────────────────────────

  it('handles response wrapped in markdown code fences', async () => {
    const provider = createMockProvider({
      generateText: vi.fn().mockResolvedValue({
        content: '```json\n{"score": 0.8, "rationale": "Clean code"}\n```',
        model: 'mock-model',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        latencyMs: 100,
      }),
    });

    const result = await evaluateCodeQuality(sampleCode, sampleChallenge, provider);
    expect(result).not.toBeNull();
    expect(result!.qualityScore).toBe(0.8);
    expect(result!.rationale).toBe('Clean code');
  });

  it('handles response with score as string (returns null)', async () => {
    const provider = createMockProvider({
      generateText: vi.fn().mockResolvedValue({
        content: JSON.stringify({ score: '0.5', rationale: 'string score' }),
        model: 'mock-model',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        latencyMs: 100,
      }),
    });

    const result = await evaluateCodeQuality(sampleCode, sampleChallenge, provider);
    expect(result).toBeNull();
  });
});

// ─── calculateLlmBonus ──────────────────────────────────────────────

describe('calculateLlmBonus', () => {
  it('calculates bonus as 10% of base score scaled by quality', () => {
    // qualityScore 1.0 on baseScore 1000 => 100 bonus (10% cap)
    expect(calculateLlmBonus(1000, 1.0)).toBe(100);
  });

  it('scales bonus linearly with quality score', () => {
    // qualityScore 0.5 on baseScore 1000 => 50 bonus
    expect(calculateLlmBonus(1000, 0.5)).toBe(50);
  });

  it('returns 0 bonus when base score is 0', () => {
    expect(calculateLlmBonus(0, 0.9)).toBe(0);
  });

  it('returns 0 bonus when base score is negative', () => {
    expect(calculateLlmBonus(-100, 0.9)).toBe(0);
  });

  it('returns 0 bonus when quality score is 0', () => {
    expect(calculateLlmBonus(1000, 0)).toBe(0);
  });

  it('clamps quality score above 1 to 1', () => {
    // qualityScore 1.5 clamped to 1.0 => 10% of 1000 => 100
    expect(calculateLlmBonus(1000, 1.5)).toBe(100);
  });

  it('clamps negative quality score to 0', () => {
    expect(calculateLlmBonus(1000, -0.5)).toBe(0);
  });

  it('rounds to 2 decimal places', () => {
    // qualityScore 0.33 on baseScore 1000 => 0.33 * 0.1 * 1000 = 33
    expect(calculateLlmBonus(1000, 0.33)).toBe(33);
    // qualityScore 0.333 on baseScore 100 => 0.333 * 0.1 * 100 = 3.33
    expect(calculateLlmBonus(100, 0.333)).toBe(3.33);
  });

  it('works with partial base scores', () => {
    // qualityScore 0.8 on baseScore 500 => 0.8 * 0.1 * 500 = 40
    expect(calculateLlmBonus(500, 0.8)).toBe(40);
  });

  it('bonus is always at most 10% of base score', () => {
    const baseScores = [100, 500, 750, 1000];
    const qualityScores = [0, 0.25, 0.5, 0.75, 1.0, 1.5];

    for (const base of baseScores) {
      for (const quality of qualityScores) {
        const bonus = calculateLlmBonus(base, quality);
        expect(bonus).toBeLessThanOrEqual(base * 0.1);
        expect(bonus).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
