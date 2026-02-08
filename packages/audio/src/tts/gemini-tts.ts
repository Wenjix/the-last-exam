import type { TtsProvider, TtsProviderOptions } from './types.js';

/** Default request timeout in milliseconds (5 seconds). */
const DEFAULT_TIMEOUT_MS = 5_000;

/** Gemini TTS API base URL. */
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

/** Model used for text-to-speech synthesis. */
const GEMINI_TTS_MODEL = 'gemini-2.0-flash';

/** Environment variable name for the API key. */
const API_KEY_ENV = 'GEMINI_API_KEY';

export interface GeminiTtsOptions extends TtsProviderOptions {
  /** Explicit API key. When omitted, read from `GEMINI_API_KEY` env var. */
  readonly apiKey?: string;
}

/**
 * Text-to-speech provider backed by the Gemini generative-AI API.
 *
 * This is the **only** TTS provider for MVP.  On any failure —
 * missing API key, network error, rate limit, unexpected response —
 * the provider returns `null` so the game can fall back to text-only
 * commentary without crashing or blocking.
 */
export class GeminiTtsProvider implements TtsProvider {
  private readonly timeoutMs: number;
  private readonly apiKey: string | undefined;

  constructor(options: GeminiTtsOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.apiKey = options.apiKey ?? process.env[API_KEY_ENV];
  }

  /**
   * Synthesize speech from text via the Gemini API.
   *
   * @returns Audio `Buffer` (WAV, linear16 PCM) or `null` on failure.
   */
  async synthesize(text: string, language?: string): Promise<Buffer | null> {
    try {
      if (!this.apiKey) {
        // No key configured — graceful degradation to text-only.
        return null;
      }

      if (!text || text.trim().length === 0) {
        return null;
      }

      const url = `${GEMINI_API_BASE}/models/${GEMINI_TTS_MODEL}:generateContent?key=${this.apiKey}`;

      const voiceName = this.resolveVoice(language);

      const body = {
        contents: [
          {
            parts: [{ text }],
          },
        ],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName,
              },
            },
          },
        },
      };

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      let response: Response;
      try {
        response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }

      if (!response.ok) {
        // Rate-limited, auth failure, server error — degrade gracefully.
        return null;
      }

      const json = (await response.json()) as GeminiResponse;

      const audioPart = json?.candidates?.[0]?.content?.parts?.find((p) =>
        p.inlineData?.mimeType?.startsWith('audio/'),
      );

      if (!audioPart?.inlineData?.data) {
        return null;
      }

      return Buffer.from(audioPart.inlineData.data, 'base64');
    } catch {
      // Any unexpected error — timeout, network, parse, etc.
      // Never crash, never block. Return null for text-only fallback.
      return null;
    }
  }

  // ── private ────────────────────────────────────────────────

  /**
   * Map a BCP-47 language tag to a Gemini voice name.
   * Falls back to a neutral English voice.
   */
  private resolveVoice(language?: string): string {
    const lang = (language ?? 'en').toLowerCase();

    const voices: Record<string, string> = {
      en: 'Kore',
      ja: 'Aoede',
      es: 'Kore',
      fr: 'Kore',
      de: 'Kore',
    };

    return voices[lang] ?? 'Kore';
  }
}

// ── Internal response types (not exported) ──────────────────

interface GeminiInlineData {
  readonly mimeType?: string;
  readonly data?: string;
}

interface GeminiPart {
  readonly text?: string;
  readonly inlineData?: GeminiInlineData;
}

interface GeminiContent {
  readonly parts?: GeminiPart[];
}

interface GeminiCandidate {
  readonly content?: GeminiContent;
}

interface GeminiResponse {
  readonly candidates?: GeminiCandidate[];
}
