import type { BotPersonality } from './bot-policies.js';

// ─── Bot Manager Configuration ───────────────────────────────────────

/**
 * Configuration for a bot manager in the game.
 *
 * Each bot has a distinct identity (name, display name, flavor text),
 * a personality that drives bidding/equip behavior, and a model
 * provider key used to resolve which LLM handles code generation.
 */
export interface BotManagerConfig {
  /** Internal bot identifier (kebab-case, unique per config set). */
  readonly name: string;
  /** Human-friendly name shown in the UI. */
  readonly displayName: string;
  /**
   * Key into the {@link ProviderRegistry} that selects which model
   * powers this bot's code generation. For example `"mistral-codestral"`
   * or `"mistral-large"`.
   */
  readonly modelProvider: string;
  /** Personality drives deterministic bidding and equip strategies. */
  readonly personality: BotPersonality;
  /** Short narrative blurb displayed alongside the bot in match UI. */
  readonly flavorText: string;
  /**
   * A short visual tag for UI badges / icons (e.g. sponsor branding).
   * Kept to ~20 chars or less so it fits in compact layouts.
   */
  readonly visualTag: string;
}

// ─── Default Bot Configurations ──────────────────────────────────────

/**
 * The three built-in bot configurations shipped with every match.
 *
 * 1. **Mistral Agent** — sponsor-branded bot using Codestral for code
 *    generation with an aggressive bidding personality.
 * 2. **Sentinel** — defensive, risk-averse bot with a generic model.
 * 3. **Nexus** — adaptive bot that shifts strategy based on standings.
 */
export const DEFAULT_BOT_CONFIGS: readonly BotManagerConfig[] = [
  {
    name: 'mistral-agent',
    displayName: 'Mistral Agent',
    modelProvider: 'mistral-codestral',
    personality: 'aggressive',
    flavorText: 'A relentless competitor that bids high and codes fast. Powered by Mistral AI.',
    visualTag: 'Mistral AI',
  },
  {
    name: 'sentinel',
    displayName: 'Sentinel',
    modelProvider: 'mistral-large',
    personality: 'conservative',
    flavorText:
      'Patience is a virtue. Sentinel saves resources for the late game and only equips tools it truly needs.',
    visualTag: 'Defense',
  },
  {
    name: 'nexus',
    displayName: 'Nexus',
    modelProvider: 'mistral-large',
    personality: 'balanced',
    flavorText: 'Reads the room and adapts. Nexus pushes when behind and plays it safe when ahead.',
    visualTag: 'Adaptive',
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────

/**
 * Retrieve a bot configuration by 0-based index.
 *
 * Wraps around the {@link DEFAULT_BOT_CONFIGS} array so any index is valid
 * (uses modulo). Returns a frozen config object.
 */
export function getBotConfig(index: number): BotManagerConfig {
  const configs = DEFAULT_BOT_CONFIGS;
  return configs[((index % configs.length) + configs.length) % configs.length]!;
}
