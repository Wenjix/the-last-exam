/**
 * LLM judge for evaluating code quality/style.
 * Issue: 5li.2
 *
 * Accepts any ModelProvider and evaluates submitted code against the
 * challenge description. Returns a quality score (0-1) and rationale,
 * or null on failure. Never throws.
 */

import type { ModelProvider, GenerateResult } from '../providers/model-provider.js';

// ─── Types ───────────────────────────────────────────────────────────

/** Result returned by the LLM judge on success. */
export interface LlmJudgeResult {
  /** Quality score in the range [0, 1]. */
  readonly qualityScore: number;
  /** Brief rationale for the score. */
  readonly rationale: string;
  /** Wall-clock latency of the judge call in milliseconds. */
  readonly latencyMs: number;
}

/** Options for the LLM judge evaluation. */
export interface LlmJudgeOptions {
  /** Timeout in milliseconds. Defaults to 5000. */
  readonly timeoutMs?: number;
  /** Sampling temperature. Defaults to 0 for deterministic judging. */
  readonly temperature?: number;
}

// ─── Constants ───────────────────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_TEMPERATURE = 0;

const JUDGE_SYSTEM_PROMPT = `You are a code quality judge for a programming competition. You evaluate submitted code on clarity, efficiency, idiomatic style, and correctness of approach. You MUST respond with ONLY a JSON object in this exact format, with no other text:
{"score": <number between 0 and 1>, "rationale": "<brief explanation>"}

Scoring guide:
- 0.0-0.2: Poor quality — confusing, inefficient, non-idiomatic
- 0.2-0.4: Below average — works but has significant style/efficiency issues
- 0.4-0.6: Average — acceptable solution with room for improvement
- 0.6-0.8: Good — clean, efficient, mostly idiomatic
- 0.8-1.0: Excellent — elegant, highly efficient, perfectly idiomatic`;

// ─── Helpers ─────────────────────────────────────────────────────────

interface JudgeResponsePayload {
  readonly score: number;
  readonly rationale: string;
}

/**
 * Parse the LLM response into a score and rationale.
 * Returns null if the response is not valid JSON or is missing fields.
 */
function parseJudgeResponse(content: string): JudgeResponsePayload | null {
  try {
    // Strip markdown code fences if the model wraps its response
    const cleaned = content
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    const parsed: unknown = JSON.parse(cleaned);

    if (typeof parsed !== 'object' || parsed === null) return null;

    const obj = parsed as Record<string, unknown>;
    if (typeof obj.score !== 'number' || typeof obj.rationale !== 'string') return null;

    return { score: obj.score, rationale: obj.rationale };
  } catch {
    return null;
  }
}

/**
 * Clamp a value to the [0, 1] range.
 */
function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

// ─── Main Function ───────────────────────────────────────────────────

/**
 * Evaluate the quality of submitted code using an LLM judge.
 *
 * - Accepts any ModelProvider (Mistral, mock, etc.)
 * - Returns a LlmJudgeResult on success, or null on any failure
 * - Has a configurable timeout (default 5s); returns null if exceeded
 * - Never throws
 *
 * @param code - The submitted source code to evaluate
 * @param challenge - A description of the coding challenge
 * @param provider - The ModelProvider to use for the evaluation
 * @param options - Optional timeout and temperature overrides
 * @returns LlmJudgeResult or null on failure
 */
export async function evaluateCodeQuality(
  code: string,
  challenge: string,
  provider: ModelProvider,
  options?: LlmJudgeOptions,
): Promise<LlmJudgeResult | null> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const temperature = options?.temperature ?? DEFAULT_TEMPERATURE;

  const userPrompt = `## Challenge\n${challenge}\n\n## Submitted Code\n\`\`\`\n${code}\n\`\`\`\n\nEvaluate the code quality. Respond with ONLY the JSON object.`;

  const start = Date.now();

  try {
    const result: GenerateResult = await provider.generateText(userPrompt, {
      systemPrompt: JUDGE_SYSTEM_PROMPT,
      timeoutMs,
      temperature,
      maxTokens: 256,
    });

    const latencyMs = Date.now() - start;

    // Provider-level error (API key missing, HTTP error, etc.)
    if (result.error) {
      return null;
    }

    // Empty content
    if (!result.content.trim()) {
      return null;
    }

    // Parse the JSON response
    const parsed = parseJudgeResponse(result.content);
    if (!parsed) {
      return null;
    }

    // Normalize and clamp the score
    const qualityScore = clamp01(parsed.score);

    return {
      qualityScore,
      rationale: parsed.rationale,
      latencyMs,
    };
  } catch {
    // Catch any unexpected errors — never throw
    return null;
  }
}

// ─── Bonus Calculation Helper ────────────────────────────────────────

/** Default LLM bonus cap as a fraction of the base correctness score. */
const LLM_BONUS_CAP = 0.1;

/**
 * Calculate the bounded LLM bonus points given a base correctness score
 * and an LLM quality score.
 *
 * The bonus is capped at 10% of the base score. A base score of 0
 * always yields 0 bonus.
 *
 * @param baseScore - The base correctness score (e.g. 0-1000)
 * @param qualityScore - The LLM judge quality score (0-1)
 * @returns The bonus points to add, rounded to 2 decimal places
 */
export function calculateLlmBonus(baseScore: number, qualityScore: number): number {
  if (baseScore <= 0) return 0;
  const clamped = clamp01(qualityScore);
  const bonus = clamped * LLM_BONUS_CAP * baseScore;
  return Math.round(bonus * 100) / 100;
}
