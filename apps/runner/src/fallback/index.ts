// Types and classification
export { FailureReason, toRunnerFailureReason } from './fallback-types.js';
export type { FallbackResult } from './fallback-types.js';

// Fallback handler
export { createFallbackResult, classifySandboxFailure } from './fallback-handler.js';
export type { FallbackContext } from './fallback-handler.js';

// Safe executor
export { safeExecute } from './safe-executor.js';
export type { ExecutionHarness } from './safe-executor.js';
