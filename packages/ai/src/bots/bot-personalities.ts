import type { BotPersonality } from './bot-policies.js';

// ─── Bot Manager Configuration ───────────────────────────────────────

export interface BotManagerConfig {
  readonly name: string;
  readonly displayName: string;
  readonly modelProvider: string;
  readonly personality: BotPersonality;
  readonly flavorText: string;
  readonly visualTag: string;
}

// ─── Default Bot Configurations (Named Characters) ───────────────────

export const DEFAULT_BOT_CONFIGS: readonly BotManagerConfig[] = [
  {
    name: 'cult-of-sam',
    displayName: 'Cult of S.A.M.',
    modelProvider: 'mistral-codestral',
    personality: 'aggressive',
    flavorText: 'Speed is truth. The Cult fires first and debugs never.',
    visualTag: 'S.A.M.',
  },
  {
    name: 'iclaudius',
    displayName: 'iClaudius',
    modelProvider: 'mistral-large',
    personality: 'conservative',
    flavorText: 'Protocol is paramount. Follows the spec to the letter.',
    visualTag: 'iClaudius',
  },
  {
    name: 'star314',
    displayName: 'Star3.14',
    modelProvider: 'mistral-large',
    personality: 'chaotic',
    flavorText: 'Why solve correctly when you can solve creatively?',
    visualTag: 'Star3.14',
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────

export function getBotConfig(index: number): BotManagerConfig {
  const configs = DEFAULT_BOT_CONFIGS;
  return configs[((index % configs.length) + configs.length) % configs.length]!;
}
