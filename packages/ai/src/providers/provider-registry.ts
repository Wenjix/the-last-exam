import type { ModelProvider } from './model-provider.js';
import { MistralCodestralProvider, MistralLargeProvider } from './mistral-provider.js';

// ─── Provider Registry ───────────────────────────────────────────────

/** Well-known provider names used as default registrations. */
const MISTRAL_CODESTRAL = 'mistral-codestral';
const MISTRAL_LARGE = 'mistral-large';

/**
 * Optional configuration for `createProviderRegistry`.
 * When omitted the registry is created with sensible defaults.
 */
export interface ProviderRegistryConfig {
  /** Override the Codestral model ID. */
  readonly codestralModel?: string;
  /** Override the Mistral Large model ID. */
  readonly largeModel?: string;
  /** If true, skip pre-registering the built-in Mistral providers. */
  readonly skipDefaults?: boolean;
}

/**
 * A simple name-keyed registry of `ModelProvider` instances.
 *
 * The registry ships with pre-registered Mistral providers. Additional
 * providers (OpenAI, Anthropic, etc.) can be registered at runtime.
 */
export class ProviderRegistry {
  private readonly providers = new Map<string, ModelProvider>();

  /** Register a provider under the given name, replacing any previous entry. */
  register(name: string, provider: ModelProvider): void {
    this.providers.set(name, provider);
  }

  /** Retrieve a provider by name, or `undefined` if not registered. */
  get(name: string): ModelProvider | undefined {
    return this.providers.get(name);
  }

  /** List all registered provider names. */
  listProviders(): string[] {
    return [...this.providers.keys()];
  }

  /**
   * Convenience: return the default provider for code generation tasks.
   * Falls back to the first registered provider if `mistral-codestral` is absent.
   */
  getDefaultCodeProvider(): ModelProvider | undefined {
    return this.providers.get(MISTRAL_CODESTRAL) ?? this.firstProvider();
  }

  /**
   * Convenience: return the default provider for text generation tasks.
   * Falls back to the first registered provider if `mistral-large` is absent.
   */
  getDefaultTextProvider(): ModelProvider | undefined {
    return this.providers.get(MISTRAL_LARGE) ?? this.firstProvider();
  }

  private firstProvider(): ModelProvider | undefined {
    const first = this.providers.values().next();
    return first.done ? undefined : first.value;
  }
}

/**
 * Factory: create a `ProviderRegistry` pre-loaded with the built-in
 * Mistral providers (unless `skipDefaults` is set).
 */
export function createProviderRegistry(config?: ProviderRegistryConfig): ProviderRegistry {
  const registry = new ProviderRegistry();

  if (!config?.skipDefaults) {
    registry.register(MISTRAL_CODESTRAL, new MistralCodestralProvider(config?.codestralModel));
    registry.register(MISTRAL_LARGE, new MistralLargeProvider(config?.largeModel));
  }

  return registry;
}
