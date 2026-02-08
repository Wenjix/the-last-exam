import type {
  GenerateOptions,
  GenerateResult,
  ModelInfo,
  ModelProvider,
  TokenUsage,
} from './model-provider.js';

// ─── Configuration ───────────────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 30_000;
const MISTRAL_API_BASE = 'https://api.mistral.ai/v1';

/** Default model IDs — overridable via environment variables. */
const DEFAULT_CODESTRAL_MODEL = 'codestral-latest';
const DEFAULT_LARGE_MODEL = 'mistral-large-latest';

// ─── Shared Helpers ──────────────────────────────────────────────────

/** Shape of a Mistral chat/completions response (subset we care about). */
interface MistralChatResponse {
  readonly id: string;
  readonly model: string;
  readonly choices: readonly {
    readonly message: { readonly content: string };
    readonly finish_reason: string;
  }[];
  readonly usage: {
    readonly prompt_tokens: number;
    readonly completion_tokens: number;
    readonly total_tokens: number;
  };
}

/** Shape of an error body returned by the Mistral API. */
interface MistralErrorBody {
  readonly message?: string;
  readonly detail?: string;
}

function getApiKey(): string {
  return process.env.MISTRAL_API_KEY ?? '';
}

function emptyUsage(): TokenUsage {
  return { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
}

function errorResult(model: string, error: string, latencyMs: number): GenerateResult {
  return { content: '', model, usage: emptyUsage(), latencyMs, error };
}

/**
 * Low-level fetch wrapper for the Mistral chat/completions endpoint.
 * Returns a structured `GenerateResult` — never throws.
 */
async function callMistralChat(
  modelId: string,
  messages: readonly { role: string; content: string }[],
  options: GenerateOptions,
): Promise<GenerateResult> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return errorResult(modelId, 'MISTRAL_API_KEY is not set', 0);
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const body: Record<string, unknown> = {
    model: modelId,
    messages,
  };
  if (options.temperature !== undefined) body.temperature = options.temperature;
  if (options.maxTokens !== undefined) body.max_tokens = options.maxTokens;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const start = Date.now();

  try {
    const res = await fetch(`${MISTRAL_API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const latencyMs = Date.now() - start;

    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try {
        const errBody = (await res.json()) as MistralErrorBody;
        detail = errBody.message ?? errBody.detail ?? detail;
      } catch {
        // body not parseable — keep status text
      }
      return errorResult(modelId, detail, latencyMs);
    }

    const data = (await res.json()) as MistralChatResponse;
    const latencyFinal = Date.now() - start;
    const choice = data.choices[0];
    const content = choice?.message?.content ?? '';
    const usage: TokenUsage = {
      promptTokens: data.usage?.prompt_tokens ?? 0,
      completionTokens: data.usage?.completion_tokens ?? 0,
      totalTokens: data.usage?.total_tokens ?? 0,
    };

    return { content, model: data.model ?? modelId, usage, latencyMs: latencyFinal };
  } catch (err: unknown) {
    const latencyMs = Date.now() - start;
    const message =
      err instanceof DOMException && err.name === 'AbortError'
        ? `Request timed out after ${timeoutMs}ms`
        : err instanceof Error
          ? err.message
          : 'Unknown error';
    return errorResult(modelId, message, latencyMs);
  } finally {
    clearTimeout(timer);
  }
}

// ─── MistralCodestralProvider ────────────────────────────────────────

/**
 * Model provider wrapping Mistral's Codestral model for code generation.
 *
 * `generateCode` builds a code-centric prompt while `generateText` falls back
 * to the same model with a generic chat prompt.
 */
export class MistralCodestralProvider implements ModelProvider {
  private readonly modelId: string;

  constructor(modelId?: string) {
    this.modelId = modelId ?? process.env.MISTRAL_CODESTRAL_MODEL ?? DEFAULT_CODESTRAL_MODEL;
  }

  async generateCode(prompt: string, options: GenerateOptions = {}): Promise<GenerateResult> {
    const systemPrompt =
      options.systemPrompt ??
      'You are an expert competitive programmer. Produce clean, correct, efficient code. Output ONLY the code — no explanations or markdown fences.';

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ];

    return callMistralChat(this.modelId, messages, options);
  }

  async generateText(prompt: string, options: GenerateOptions = {}): Promise<GenerateResult> {
    // Codestral can handle text, but it is not its strength — still usable as fallback.
    const messages = [
      { role: 'system', content: options.systemPrompt ?? 'You are a helpful assistant.' },
      { role: 'user', content: prompt },
    ];

    return callMistralChat(this.modelId, messages, options);
  }

  getModelInfo(): ModelInfo {
    return {
      provider: 'mistral',
      modelId: this.modelId,
      displayName: 'Mistral Codestral',
      attribution: 'Powered by Mistral AI',
    };
  }
}

// ─── MistralLargeProvider ────────────────────────────────────────────

/**
 * Model provider wrapping Mistral Large for free-form text generation,
 * commentary, and multilingual content.
 *
 * `generateText` supports an optional `language` option that is woven into
 * the system prompt. `generateCode` delegates to the text model as a fallback.
 */
export class MistralLargeProvider implements ModelProvider {
  private readonly modelId: string;

  constructor(modelId?: string) {
    this.modelId = modelId ?? process.env.MISTRAL_LARGE_MODEL ?? DEFAULT_LARGE_MODEL;
  }

  async generateCode(prompt: string, options: GenerateOptions = {}): Promise<GenerateResult> {
    // Mistral Large can produce code, though Codestral is preferred.
    const systemPrompt =
      options.systemPrompt ??
      'You are a helpful programming assistant. Output clean, correct code.';

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ];

    return callMistralChat(this.modelId, messages, options);
  }

  async generateText(prompt: string, options: GenerateOptions = {}): Promise<GenerateResult> {
    let systemPrompt = options.systemPrompt ?? 'You are a helpful assistant.';

    if (options.language) {
      systemPrompt += ` Respond in ${options.language}.`;
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ];

    return callMistralChat(this.modelId, messages, options);
  }

  getModelInfo(): ModelInfo {
    return {
      provider: 'mistral',
      modelId: this.modelId,
      displayName: 'Mistral Large',
      attribution: 'Powered by Mistral AI',
    };
  }
}
