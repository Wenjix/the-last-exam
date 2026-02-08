import type { ModelProvider, GenerateResult } from '@tle/ai';

// ─── Language Types ──────────────────────────────────────────────────

/** Supported commentary languages. */
export type CommentaryLanguage = 'en' | 'fr' | 'ja';

/** Human-readable labels for each supported language. */
export const LANGUAGE_LABELS: Readonly<Record<CommentaryLanguage, string>> = {
  en: 'English',
  fr: 'Français',
  ja: '日本語',
};

/** All supported language codes. */
export const SUPPORTED_LANGUAGES: readonly CommentaryLanguage[] = ['en', 'fr', 'ja'];

// ─── Prompt Templates ────────────────────────────────────────────────

/**
 * Language-specific system prompts used to instruct the LLM on
 * tone, register, and target language for commentary generation.
 */
const LANGUAGE_PROMPTS: Readonly<Record<CommentaryLanguage, string>> = {
  en: 'You are an enthusiastic esports commentator for an AI coding competition called The Last Exam. Generate short, exciting commentary in English.',
  fr: 'Tu es un commentateur esport enthousiaste pour une compétition de programmation IA appelée The Last Exam. Génère un commentaire court et excitant en français.',
  ja: 'あなたは「The Last Exam」というAIプログラミング大会の熱狂的なeスポーツ実況者です。日本語で短くエキサイティングな実況を生成してください。',
};

// ─── Commentary Event Shape ──────────────────────────────────────────

/**
 * Minimal event descriptor passed to multilingual commentary generation.
 * Mirrors the shape used in `CommentaryGenerator` but kept intentionally
 * lightweight to avoid tight coupling.
 */
export interface MultilingualCommentaryEvent {
  readonly type: string;
  readonly round?: number;
  readonly [key: string]: unknown;
}

// ─── English Fallback (template-based, no LLM) ──────────────────────

function englishFallback(event: MultilingualCommentaryEvent): string {
  const round = event.round ?? 1;

  switch (event.type) {
    case 'phase_transition': {
      const toPhase = event.toPhase as string | undefined;
      switch (toPhase) {
        case 'briefing':
          return `Round ${round} begins! Let's see what challenge awaits our competitors.`;
        case 'bid_resolve':
          return `Round ${round} bid reveal! The top bidder takes the lead.`;
        case 'equip':
          return `Round ${round} equipment phase. Managers are selecting their tools.`;
        case 'run':
          return `Round ${round} run phase! Agents are coding furiously.`;
        default:
          return `Round ${round} continues with a new phase.`;
      }
    }
    case 'round_result':
      return `Round ${round} complete! The standings are shifting.`;
    case 'final_standings':
      return `And that's the match! What an incredible competition!`;
    default:
      return `Something is happening in Round ${round}!`;
  }
}

// ─── Core Generation Function ────────────────────────────────────────

/**
 * Generate commentary for the given event in the requested language.
 *
 * - For English (`en`), returns a template-based string without calling
 *   an LLM, keeping latency near zero and avoiding API costs.
 * - For French (`fr`) and Japanese (`ja`), sends a prompt to the
 *   supplied {@link ModelProvider} (expected to be Mistral Large) with
 *   language-specific instructions.
 *
 * If the LLM call fails (network error, timeout, etc.) the function
 * falls back to the English template so the UI always has *something*
 * to display.
 *
 * @param event    - Game event to commentate on.
 * @param language - Target language code.
 * @param provider - A `ModelProvider` used for non-English generation.
 * @returns The commentary string.
 */
export async function generateMultilingualCommentary(
  event: MultilingualCommentaryEvent,
  language: CommentaryLanguage,
  provider?: ModelProvider,
): Promise<string> {
  // English path — deterministic template, no LLM needed
  if (language === 'en') {
    return englishFallback(event);
  }

  // For fr / ja we need a provider
  if (!provider) {
    return englishFallback(event);
  }

  const systemPrompt = LANGUAGE_PROMPTS[language];
  const userPrompt = buildUserPrompt(event);

  let result: GenerateResult;
  try {
    result = await provider.generateText(userPrompt, {
      systemPrompt,
      language,
      temperature: 0.7,
      maxTokens: 200,
    });
  } catch {
    // LLM failure — fall back to English
    return englishFallback(event);
  }

  // If the provider returned an error result, fall back
  if (result.error || !result.content) {
    return englishFallback(event);
  }

  return result.content.trim();
}

// ─── Prompt Builder ──────────────────────────────────────────────────

function buildUserPrompt(event: MultilingualCommentaryEvent): string {
  const round = event.round ?? 1;

  switch (event.type) {
    case 'phase_transition': {
      const toPhase = event.toPhase as string | undefined;
      return `Generate a short commentary line for the start of the "${toPhase ?? 'unknown'}" phase in round ${round} of the match.`;
    }
    case 'round_result':
      return `Generate a short commentary line announcing the results of round ${round}.`;
    case 'final_standings':
      return `Generate a short commentary line for the final standings announcement after the match is over.`;
    default:
      return `Generate a short commentary line for a "${event.type}" event in round ${round}.`;
  }
}
