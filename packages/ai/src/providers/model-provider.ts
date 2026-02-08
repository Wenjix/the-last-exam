// ─── Model Provider Abstraction ──────────────────────────────────────

/**
 * Options controlling generation behavior.
 */
export interface GenerateOptions {
  /** Sampling temperature (0-2). Lower = more deterministic. */
  readonly temperature?: number;
  /** Maximum tokens to generate. */
  readonly maxTokens?: number;
  /** Target language for multilingual generation (e.g. "en", "fr", "ja"). */
  readonly language?: string;
  /** Optional system prompt prepended to the request. */
  readonly systemPrompt?: string;
  /** Request timeout in milliseconds. Defaults to 30 000. */
  readonly timeoutMs?: number;
}

/**
 * Token usage information returned from a generation call.
 */
export interface TokenUsage {
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly totalTokens: number;
}

/**
 * Result of a generation call. Errors are represented inline — providers
 * never throw; they return an error result instead.
 */
export interface GenerateResult {
  /** The generated content, or an empty string on error. */
  readonly content: string;
  /** Model identifier that handled the request. */
  readonly model: string;
  /** Token usage statistics. */
  readonly usage: TokenUsage;
  /** Wall-clock latency of the API call in milliseconds. */
  readonly latencyMs: number;
  /** If set, the generation failed. Contains a human-readable message. */
  readonly error?: string;
}

/**
 * Metadata about a model provider, including sponsor attribution.
 */
export interface ModelInfo {
  /** Provider namespace (e.g. "mistral"). */
  readonly provider: string;
  /** Concrete model identifier sent to the API. */
  readonly modelId: string;
  /** Human-friendly display name. */
  readonly displayName: string;
  /** Sponsor / attribution line for UI display. */
  readonly attribution: string;
}

/**
 * Unified interface for LLM model providers.
 *
 * Implementations wrap vendor-specific APIs behind a consistent contract
 * so the rest of the system can swap providers without code changes.
 */
export interface ModelProvider {
  /** Generate source code from a prompt. */
  generateCode(prompt: string, options?: GenerateOptions): Promise<GenerateResult>;

  /** Generate free-form text (commentary, explanations, etc.). */
  generateText(prompt: string, options?: GenerateOptions): Promise<GenerateResult>;

  /** Return metadata about this provider/model combination. */
  getModelInfo(): ModelInfo;
}
