import type { RunnerJob, RunnerResult } from '@tle/contracts';
import type { SandboxProvider, SandboxResult } from '../sandbox/types.js';
import { FailureReason } from './fallback-types.js';
import { createFallbackResult, classifySandboxFailure } from './fallback-handler.js';
import type { FallbackContext } from './fallback-handler.js';

// === Harness Function Type ===

/**
 * An optional harness that evaluates sandbox output and produces
 * harness test results + score breakdown for the RunnerResult.
 *
 * If the harness itself throws, safeExecute catches the error and
 * falls back to a zero-score result.
 */
export interface ExecutionHarness {
  evaluate(job: RunnerJob, sandboxResult: SandboxResult): Promise<Partial<RunnerResult>>;
}

// === Safe Executor ===

/**
 * Execute a runner job inside a sandbox with full error protection.
 *
 * This function is the primary entry point for running submissions.
 * It guarantees that a valid RunnerResult is always returned, even if
 * the sandbox blows up, the harness throws, or something completely
 * unexpected happens.
 *
 * It NEVER throws.
 *
 * @param job     - The runner job to execute.
 * @param sandbox - The sandbox provider to run code in.
 * @param code    - The submitted source code to execute.
 * @param language - Language identifier for the sandbox.
 * @param harness - Optional harness to evaluate the sandbox result.
 */
export async function safeExecute(
  job: RunnerJob,
  sandbox: SandboxProvider,
  code: string,
  language: string,
  harness?: ExecutionHarness,
): Promise<RunnerResult> {
  const { jobId, matchId, agentId, round } = job;
  let sandboxResult: SandboxResult | undefined;

  try {
    // --- Phase 1: Sandbox execution ---
    try {
      sandboxResult = await sandbox.execute(code, language);
    } catch (sandboxError: unknown) {
      console.error(`[safe-executor] Sandbox execution failed for job ${jobId}:`, sandboxError);
      return createFallbackResult(
        jobId,
        matchId,
        agentId,
        round,
        FailureReason.UNKNOWN_ERROR,
        sandboxError instanceof Error ? sandboxError : new Error(String(sandboxError)),
        { submittedCode: code },
      );
    }

    // --- Phase 2: Check for sandbox-level failures ---
    const failureReason = classifySandboxFailure(sandboxResult);
    if (failureReason !== undefined) {
      console.warn(
        `[safe-executor] Sandbox failure for job ${jobId}: ${failureReason} (exit=${sandboxResult.exitCode})`,
      );
      return createFallbackResult(jobId, matchId, agentId, round, failureReason, undefined, {
        sandboxResult,
        submittedCode: code,
      });
    }

    // --- Phase 3: Run the harness (if provided) ---
    let harnessOutput: Partial<RunnerResult> = {};
    if (harness) {
      try {
        harnessOutput = await harness.evaluate(job, sandboxResult);
      } catch (harnessError: unknown) {
        console.error(`[safe-executor] Harness evaluation failed for job ${jobId}:`, harnessError);
        return createFallbackResult(
          jobId,
          matchId,
          agentId,
          round,
          FailureReason.RUNTIME_CRASH,
          harnessError instanceof Error ? harnessError : new Error(String(harnessError)),
          { sandboxResult, submittedCode: code },
        );
      }
    }

    // --- Phase 4: Build the successful result ---
    const result: RunnerResult = {
      jobId,
      matchId,
      agentId,
      round,
      success: true,
      stdout: sandboxResult.stdout,
      stderr: sandboxResult.stderr,
      submittedCode: code,
      harnessResults: harnessOutput.harnessResults ?? [],
      executionMetadata: {
        durationMs: sandboxResult.durationMs,
        memoryUsedBytes: sandboxResult.memoryUsedBytes ?? 0,
        exitCode: sandboxResult.exitCode,
        timedOut: false,
      },
      ...(harnessOutput.scoreBreakdown ? { scoreBreakdown: harnessOutput.scoreBreakdown } : {}),
    };

    return result;
  } catch (unexpectedError: unknown) {
    // Absolute last resort -- something completely unexpected happened.
    console.error(`[safe-executor] Unexpected error processing job ${jobId}:`, unexpectedError);
    const ctx: FallbackContext = { submittedCode: code };
    if (sandboxResult) {
      ctx.sandboxResult = sandboxResult;
    }
    return createFallbackResult(
      jobId,
      matchId,
      agentId,
      round,
      FailureReason.UNKNOWN_ERROR,
      unexpectedError instanceof Error ? unexpectedError : new Error(String(unexpectedError)),
      ctx,
    );
  }
}
