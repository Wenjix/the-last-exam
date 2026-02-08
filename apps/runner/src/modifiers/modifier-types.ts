import type { SandboxConfig } from '../sandbox/types.js';

// === Modifier Types ===

/**
 * A resolved tool effect that modifies sandbox configuration or
 * execution behaviour.
 */
export interface ResolvedToolEffect {
  /** Which tool ID produced this effect. */
  toolId: string;
  /** Target property being modified. */
  target: 'time' | 'memory' | 'hints' | 'debug' | 'tests' | 'retries' | 'template';
  /** Operation to apply. */
  operation: 'multiply' | 'add' | 'set' | 'grant';
  /** Operand value. */
  value: number | string | boolean;
}

/**
 * A resolved hazard modifier that adjusts sandbox configuration or
 * marks harness-level side-effects.
 */
export interface ResolvedHazardModifier {
  /** Which hazard ID produced this modifier. */
  hazardId: string;
  /** Target property being modified. */
  target: 'time' | 'memory' | 'visibility' | 'input' | 'stdlib';
  /** Operation to apply. */
  operation: 'multiply' | 'add' | 'set' | 'restrict';
  /** Operand value. */
  value: number | string | boolean;
}

/**
 * The combined result of resolving all tools and hazards for a run.
 *
 * Contains both the adjusted sandbox config (timeoutMs, memoryLimitBytes)
 * and flags that affect harness-level or AI-prompt-level behaviour.
 */
export interface ModifiedExecutionConfig {
  /** Adjusted sandbox configuration (timeout, memory, etc.). */
  sandboxOverrides: Partial<SandboxConfig>;

  /** Extra time granted by tools, in ms (informational -- already folded into sandboxOverrides). */
  extraTimeMs: number;
  /** Extra memory granted by tools, in bytes (informational -- already folded into sandboxOverrides). */
  extraMemoryBytes: number;

  /** Whether debug/verbose mode is enabled. */
  debugMode: boolean;
  /** Whether algorithmic hints should be provided. */
  hintsGranted: boolean;
  /** Number of additional hidden test cases to reveal. */
  extraTestsRevealed: number;
  /** Number of retry attempts granted. */
  retryAttempts: number;
  /** Whether a code template should be provided. */
  templateGranted: boolean;

  /** Whether the input is flagged as noisy (harness-level, no sandbox change). */
  noisyInput: boolean;
  /** Whether the standard library is restricted (set as env restriction). */
  restrictedStdlib: boolean;
  /** Visibility multiplier for hidden test cases (1 = full, 0.5 = half hidden). */
  visibilityFactor: number;
}
