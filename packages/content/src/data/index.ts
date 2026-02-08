import { loadHazards, loadTools } from '../loader.js';
import type { Hazard, Tool } from '../schemas.js';

const HAZARDS_DATA = [
  {
    id: 'time-crunch',
    name: 'Time Crunch',
    description: 'Execution time limit is halved. Write efficient code or face timeout.',
    modifierEffects: [{ target: 'time', operation: 'multiply', value: 0.5 }],
  },
  {
    id: 'memory-squeeze',
    name: 'Memory Squeeze',
    description: 'Memory limit reduced to 256MB. Watch your allocations.',
    modifierEffects: [{ target: 'memory', operation: 'set', value: 268435456 }],
  },
  {
    id: 'fog-of-war',
    name: 'Fog of War',
    description: 'Half of test cases are hidden. You only see partial feedback.',
    modifierEffects: [{ target: 'visibility', operation: 'multiply', value: 0.5 }],
  },
  {
    id: 'noisy-input',
    name: 'Noisy Input',
    description: 'Input data contains random noise that must be filtered out.',
    modifierEffects: [{ target: 'input', operation: 'set', value: 'noisy' }],
  },
  {
    id: 'restricted-stdlib',
    name: 'Restricted Standard Library',
    description: 'Common utility modules are unavailable. Implement from scratch.',
    modifierEffects: [{ target: 'stdlib', operation: 'restrict', value: true }],
  },
];

const TOOLS_DATA = [
  {
    id: 'extra-time',
    name: 'Extra Time',
    description: 'Gain 15 additional seconds of execution time.',
    effects: [{ target: 'time', operation: 'add', value: 15000 }],
  },
  {
    id: 'memory-boost',
    name: 'Memory Boost',
    description: 'Double the available memory limit.',
    effects: [{ target: 'memory', operation: 'multiply', value: 2 }],
  },
  {
    id: 'context-hints',
    name: 'Context Hints',
    description: 'Receive algorithmic hints about the optimal approach.',
    effects: [{ target: 'hints', operation: 'grant', value: true }],
  },
  {
    id: 'debugger-access',
    name: 'Debugger Access',
    description: 'Enable step-through debugging during execution.',
    effects: [{ target: 'debug', operation: 'grant', value: true }],
  },
  {
    id: 'test-preview',
    name: 'Test Preview',
    description: 'Reveal 2 additional hidden test cases before submission.',
    effects: [{ target: 'tests', operation: 'add', value: 2 }],
  },
  {
    id: 'retry-attempt',
    name: 'Retry Attempt',
    description: 'Get one additional submission attempt if the first fails.',
    effects: [{ target: 'retries', operation: 'add', value: 1 }],
  },
  {
    id: 'code-template',
    name: 'Code Template',
    description: 'Start with a pre-structured code template for the challenge.',
    effects: [{ target: 'template', operation: 'grant', value: true }],
  },
  {
    id: 'data-file-access',
    name: 'Data File Access',
    description: 'Access supplementary data files with useful reference information.',
    effects: [{ target: 'hints', operation: 'grant', value: 'data-files' }],
  },
];

/**
 * Load and validate the default hazards set (5 hazards).
 */
export function getDefaultHazards(): Hazard[] {
  return loadHazards(HAZARDS_DATA);
}

/**
 * Load and validate the default tools set (8 tools).
 */
export function getDefaultTools(): Tool[] {
  return loadTools(TOOLS_DATA);
}
