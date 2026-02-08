export {
  generateBotBudgetBid,
  generateBotStrategy,
  getDefaultPersonality,
} from './bot-policies.js';
export type { BotPersonality, BotBudgetBidContext, BotStrategyContext } from './bot-policies.js';

export { DEFAULT_BOT_CONFIGS, getBotConfig } from './bot-personalities.js';
export type { BotManagerConfig } from './bot-personalities.js';
