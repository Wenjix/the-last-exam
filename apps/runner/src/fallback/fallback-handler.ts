import type { SandboxResult } from '../sandbox/types.js';
import { FailureReason, toRunnerFailureReason } from './fallback-types.js';
import type { FallbackResult } from './fallback-types.js';

// === Fallback Handler ===

/**
 * Options for constructing a fallback result.
 * Allows passing partial sandbox output when available.
 */
export interface FallbackContext {
  /** Partial stdout captured before failure, if any. */
  stdout?: string;
  /** Partial stderr captured before failure, if any. */
  stderr?: string;
  /** The code that was submitted / attempted, if any. */
  submittedCode?: string;
  /** Sandbox result if execution partially completed. */
  sandboxResult?: SandboxResult;
}

/**
 * Build a valid RunnerResult representing a failed execution.
 *
 * This is the last line of defense: it NEVER throws. If something goes
 * wrong while building the fallback result itself, a minimal hard-coded
 * result is returned instead.
 *
 * @param jobId   - The runner job ID.
 * @param matchId - The match this job belongs to.
 * @param agentId - The agent that submitted the code.
 * @param round   - The match round number.
 * @param reason  - Why the execution failed.
 * @param error   - The original error, if available.
 * @param ctx     - Optional partial outputs captured before the failure.
 */
export function createFallbackResult(
  jobId: string,
  matchId: string,
  agentId: string,
  round: number,
  reason: FailureReason,
  error?: Error,
  ctx?: FallbackContext,
): FallbackResult {
  try {
    const stdout = ctx?.sandboxResult?.stdout ?? ctx?.stdout ?? '';
    const stderr = buildStderr(reason, error, ctx);
    const submittedCode = ctx?.submittedCode ?? '';

    const durationMs = ctx?.sandboxResult?.durationMs ?? 0;
    const memoryUsedBytes = ctx?.sandboxResult?.memoryUsedBytes ?? 0;
    const exitCode = ctx?.sandboxResult?.exitCode ?? 1;

    const result: FallbackResult = {
      jobId,
      matchId,
      agentId,
      round,
      success: false,
      stdout,
      stderr,
      submittedCode,
      harnessResults: [],
      executionMetadata: {
        durationMs,
        memoryUsedBytes,
        exitCode,
        timedOut: reason === FailureReason.TIMEOUT,
      },
      failureReason: toRunnerFailureReason(reason),
    };

    return result;
  } catch {
    // If even building the fallback fails, return the absolute minimum.
    return buildMinimalFallback(jobId, matchId, agentId, round);
  }
}

/**
 * Classify a SandboxResult into a FailureReason.
 * Returns undefined if the sandbox result looks like a success.
 */
export function classifySandboxFailure(sandboxResult: SandboxResult): FailureReason | undefined {
  if (sandboxResult.timedOut || sandboxResult.killed) {
    return sandboxResult.timedOut ? FailureReason.TIMEOUT : FailureReason.MEMORY_EXCEEDED;
  }
  if (sandboxResult.exitCode !== 0) {
    // Heuristic: if stderr mentions "SyntaxError" it's likely a parse error
    if (/SyntaxError|ParseError/i.test(sandboxResult.stderr)) {
      return FailureReason.SYNTAX_ERROR;
    }
    return FailureReason.RUNTIME_CRASH;
  }
  return undefined;
}

// === Internal Helpers ===

function buildStderr(reason: FailureReason, error?: Error, ctx?: FallbackContext): string {
  const parts: string[] = [];

  // Include any existing stderr from partial execution
  const rawStderr = ctx?.sandboxResult?.stderr ?? ctx?.stderr ?? '';
  if (rawStderr) {
    parts.push(rawStderr);
  }

  // Append failure context
  parts.push(`[fallback] Failure reason: ${reason}`);

  if (error) {
    parts.push(`[fallback] Error: ${error.message}`);
    if (error.stack) {
      parts.push(`[fallback] Stack: ${error.stack}`);
    }
  }

  return parts.join('\n');
}

function buildMinimalFallback(
  jobId: string,
  matchId: string,
  agentId: string,
  round: number,
): FallbackResult {
  return {
    jobId,
    matchId,
    agentId,
    round,
    success: false,
    stdout: '',
    stderr: '[fallback] Critical: fallback handler itself failed',
    submittedCode: '',
    harnessResults: [],
    executionMetadata: {
      durationMs: 0,
      exitCode: 1,
      timedOut: false,
    },
    failureReason: 'unknown',
  };
}
