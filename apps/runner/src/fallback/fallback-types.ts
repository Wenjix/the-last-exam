import type { RunnerResult, RunnerFailureReason } from '@tle/contracts';

// === Failure Categories ===

/**
 * Internal failure classification for the runner fallback system.
 * These map to the contract-level RunnerFailureReason for reporting.
 */
export enum FailureReason {
  /** AI code generation produced no usable code. */
  CODE_GENERATION_FAILED = 'CODE_GENERATION_FAILED',
  /** Generated code failed to parse / compile. */
  SYNTAX_ERROR = 'SYNTAX_ERROR',
  /** Code executed but crashed at runtime. */
  RUNTIME_CRASH = 'RUNTIME_CRASH',
  /** Execution exceeded the time limit. */
  TIMEOUT = 'TIMEOUT',
  /** Execution exceeded the memory limit. */
  MEMORY_EXCEEDED = 'MEMORY_EXCEEDED',
  /** Catch-all for any other unexpected error. */
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Map internal failure categories to the contract-level RunnerFailureReason.
 */
export function toRunnerFailureReason(reason: FailureReason): RunnerFailureReason {
  const mapping: Record<FailureReason, RunnerFailureReason> = {
    [FailureReason.CODE_GENERATION_FAILED]: 'generation_error',
    [FailureReason.SYNTAX_ERROR]: 'compilation_error',
    [FailureReason.RUNTIME_CRASH]: 'runtime_error',
    [FailureReason.TIMEOUT]: 'timeout',
    [FailureReason.MEMORY_EXCEEDED]: 'memory_limit',
    [FailureReason.UNKNOWN_ERROR]: 'unknown',
  };
  return mapping[reason];
}

// === Fallback Result ===

/**
 * A FallbackResult is a RunnerResult that always has:
 *  - success = false
 *  - zero scores
 *  - a failureReason set
 *
 * This type alias documents the intent; structurally it is a RunnerResult.
 */
export type FallbackResult = RunnerResult & {
  success: false;
  failureReason: RunnerFailureReason;
};
