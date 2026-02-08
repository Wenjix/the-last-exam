/**
 * Contract for text-to-speech providers.
 *
 * Every provider must implement {@link synthesize}. On any failure
 * (network, rate-limit, missing credentials, etc.) the implementation
 * MUST return `null` rather than throwing — the caller falls back to
 * text-only commentary.
 */
export interface TtsProvider {
  /**
   * Convert text to audio.
   *
   * @param text     The commentary text to synthesize.
   * @param language BCP-47 language tag (e.g. "en", "ja"). Defaults to "en".
   * @returns A `Buffer` containing audio data (WAV/MP3/OGG depending on
   *          provider), or `null` when synthesis is unavailable.
   */
  synthesize(text: string, language?: string): Promise<Buffer | null>;
}

/** Options shared by all TTS provider constructors. */
export interface TtsProviderOptions {
  /** Request timeout in milliseconds. */
  readonly timeoutMs?: number;
}
