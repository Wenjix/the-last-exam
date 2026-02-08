import type { Tool, Hazard } from '@tle/content';
import type { SandboxConfig } from '../sandbox/types.js';
import { DEFAULT_SANDBOX_CONFIG } from '../sandbox/types.js';
import type { ModifiedExecutionConfig } from './modifier-types.js';

// === Modifier Resolver ===

/**
 * Resolve a list of tool IDs and hazard IDs against the full content
 * catalogues and produce a single {@link ModifiedExecutionConfig} describing
 * how the sandbox and harness should be adjusted for this run.
 *
 * Unknown tool/hazard IDs are silently skipped (the match state is
 * authoritative -- if a tool was granted it must exist, but defensive
 * coding never hurts).
 *
 * Effects are applied in order: tools first, then hazards.  Within
 * each group the effects are applied in catalogue order.
 *
 * @param toolIds  - Tool IDs the agent has equipped for this round.
 * @param hazardIds - Hazard IDs active for this round.
 * @param allTools  - Full validated tool catalogue.
 * @param allHazards - Full validated hazard catalogue.
 * @param baseConfig - Base sandbox config (defaults to DEFAULT_SANDBOX_CONFIG).
 */
export function resolveModifiers(
  toolIds: string[],
  hazardIds: string[],
  allTools: Tool[],
  allHazards: Hazard[],
  baseConfig: SandboxConfig = DEFAULT_SANDBOX_CONFIG,
): ModifiedExecutionConfig {
  // Start with base values.
  let timeoutMs = baseConfig.timeoutMs;
  let memoryLimitBytes = baseConfig.memoryLimitBytes;
  let extraTimeMs = 0;
  let extraMemoryBytes = 0;
  let debugMode = false;
  let hintsGranted = false;
  let extraTestsRevealed = 0;
  let retryAttempts = 0;
  let templateGranted = false;
  let noisyInput = false;
  let restrictedStdlib = false;
  let visibilityFactor = 1;

  // --- Apply tool effects ---
  for (const toolId of toolIds) {
    const tool = allTools.find((t) => t.id === toolId);
    if (!tool) continue;

    for (const effect of tool.effects) {
      switch (effect.target) {
        case 'time':
          if (effect.operation === 'add' && typeof effect.value === 'number') {
            timeoutMs += effect.value;
            extraTimeMs += effect.value;
          } else if (effect.operation === 'multiply' && typeof effect.value === 'number') {
            const delta = timeoutMs * effect.value - timeoutMs;
            timeoutMs = Math.round(timeoutMs * effect.value);
            extraTimeMs += delta;
          } else if (effect.operation === 'set' && typeof effect.value === 'number') {
            timeoutMs = effect.value;
          }
          break;

        case 'memory':
          if (effect.operation === 'add' && typeof effect.value === 'number') {
            memoryLimitBytes += effect.value;
            extraMemoryBytes += effect.value;
          } else if (effect.operation === 'multiply' && typeof effect.value === 'number') {
            const delta = memoryLimitBytes * effect.value - memoryLimitBytes;
            memoryLimitBytes = Math.round(memoryLimitBytes * effect.value);
            extraMemoryBytes += delta;
          } else if (effect.operation === 'set' && typeof effect.value === 'number') {
            memoryLimitBytes = effect.value;
          }
          break;

        case 'debug':
          if (effect.operation === 'grant') {
            debugMode = true;
          }
          break;

        case 'hints':
          if (effect.operation === 'grant') {
            hintsGranted = true;
          }
          break;

        case 'tests':
          if (effect.operation === 'add' && typeof effect.value === 'number') {
            extraTestsRevealed += effect.value;
          }
          break;

        case 'retries':
          if (effect.operation === 'add' && typeof effect.value === 'number') {
            retryAttempts += effect.value;
          }
          break;

        case 'template':
          if (effect.operation === 'grant') {
            templateGranted = true;
          }
          break;
      }
    }
  }

  // --- Apply hazard modifiers ---
  for (const hazardId of hazardIds) {
    const hazard = allHazards.find((h) => h.id === hazardId);
    if (!hazard) continue;

    for (const mod of hazard.modifierEffects) {
      switch (mod.target) {
        case 'time':
          if (mod.operation === 'multiply' && typeof mod.value === 'number') {
            timeoutMs = Math.round(timeoutMs * mod.value);
          } else if (mod.operation === 'add' && typeof mod.value === 'number') {
            timeoutMs += mod.value;
          } else if (mod.operation === 'set' && typeof mod.value === 'number') {
            timeoutMs = mod.value;
          }
          break;

        case 'memory':
          if (mod.operation === 'multiply' && typeof mod.value === 'number') {
            memoryLimitBytes = Math.round(memoryLimitBytes * mod.value);
          } else if (mod.operation === 'add' && typeof mod.value === 'number') {
            memoryLimitBytes += mod.value;
          } else if (mod.operation === 'set' && typeof mod.value === 'number') {
            memoryLimitBytes = mod.value;
          }
          break;

        case 'visibility':
          if (mod.operation === 'multiply' && typeof mod.value === 'number') {
            visibilityFactor *= mod.value;
          } else if (mod.operation === 'set' && typeof mod.value === 'number') {
            visibilityFactor = mod.value;
          }
          break;

        case 'input':
          if (mod.operation === 'set' && mod.value === 'noisy') {
            noisyInput = true;
          }
          break;

        case 'stdlib':
          if (mod.operation === 'restrict') {
            restrictedStdlib = true;
          }
          break;
      }
    }
  }

  // Ensure minimums -- never go below 1s timeout or 64MB memory.
  timeoutMs = Math.max(timeoutMs, 1_000);
  memoryLimitBytes = Math.max(memoryLimitBytes, 64 * 1024 * 1024);

  return {
    sandboxOverrides: {
      timeoutMs,
      memoryLimitBytes,
      // Restrict network if stdlib is restricted (defense in depth).
      ...(restrictedStdlib ? { networkEnabled: false } : {}),
    },
    extraTimeMs,
    extraMemoryBytes,
    debugMode,
    hintsGranted,
    extraTestsRevealed,
    retryAttempts,
    templateGranted,
    noisyInput,
    restrictedStdlib,
    visibilityFactor,
  };
}
