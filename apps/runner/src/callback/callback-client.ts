import { randomUUID } from 'node:crypto';
import { RunnerResultSchema } from '@tle/contracts';
import type { RunnerResult, RunnerCallback } from '@tle/contracts';

// === Configuration ===

export interface CallbackConfig {
  /** Base URL of the server callback endpoint */
  serverUrl: string;
  /** Maximum number of retry attempts for transient failures (default: 3) */
  maxRetries?: number;
  /** Initial delay in ms before first retry (default: 1000) */
  initialDelayMs?: number;
  /** Maximum delay cap in ms (default: 30000) */
  maxDelayMs?: number;
  /** HTTP request timeout in ms (default: 10000) */
  timeoutMs?: number;
}

// === Backoff Calculation ===

/**
 * Calculate exponential backoff delay with jitter.
 * Formula: min(maxDelay, initialDelay * 2^attempt) with +/- 25% jitter.
 */
export function calculateBackoffDelay(
  attempt: number,
  initialDelay: number,
  maxDelay: number,
): number {
  const exponential = initialDelay * Math.pow(2, attempt);
  const capped = Math.min(exponential, maxDelay);
  // Apply jitter: random value between 75% and 125% of the capped delay
  const jitter = 0.75 + Math.random() * 0.5;
  return Math.floor(capped * jitter);
}

// === Callback Client ===

export class CallbackClient {
  private readonly serverUrl: string;
  private readonly maxRetries: number;
  private readonly initialDelayMs: number;
  private readonly maxDelayMs: number;
  private readonly timeoutMs: number;

  constructor(config: CallbackConfig) {
    this.serverUrl = config.serverUrl;
    this.maxRetries = config.maxRetries ?? 3;
    this.initialDelayMs = config.initialDelayMs ?? 1000;
    this.maxDelayMs = config.maxDelayMs ?? 30000;
    this.timeoutMs = config.timeoutMs ?? 10000;
  }

  /**
   * Send a runner result to the server callback endpoint.
   *
   * - Validates the result against RunnerResultSchema before sending.
   * - Wraps the result in a RunnerCallback envelope with idempotencyKey + timestamp.
   * - On success (2xx): returns true.
   * - On transient failure (5xx, 429, network error, timeout): retries with exponential backoff.
   * - On permanent failure (4xx except 429): returns false immediately (no retry).
   * - Never throws -- all errors are caught and logged.
   */
  async sendResult(result: RunnerResult): Promise<boolean> {
    // Validate result against schema before attempting to send
    const validation = RunnerResultSchema.safeParse(result);
    if (!validation.success) {
      console.error('[callback-client] Result validation failed:', validation.error.issues);
      return false;
    }

    const payload: RunnerCallback = {
      result: validation.data,
      idempotencyKey: randomUUID(),
      timestamp: new Date().toISOString(),
    };

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const success = await this.attemptSend(payload, attempt);
        if (success !== null) {
          return success;
        }
        // success === null means transient failure -- continue to retry
      } catch {
        // Unexpected error in attemptSend itself -- treat as transient
        console.error(
          `[callback-client] Unexpected error on attempt ${attempt + 1}/${this.maxRetries + 1} for job ${result.jobId}`,
        );
      }

      // Wait before retrying (skip delay after last attempt)
      if (attempt < this.maxRetries) {
        const delay = calculateBackoffDelay(attempt, this.initialDelayMs, this.maxDelayMs);
        console.log(
          `[callback-client] Retrying job ${result.jobId} in ${delay}ms (attempt ${attempt + 2}/${this.maxRetries + 1})`,
        );
        await this.sleep(delay);
      }
    }

    console.error(
      `[callback-client] All ${this.maxRetries + 1} attempts failed for job ${result.jobId}`,
    );
    return false;
  }

  /**
   * Attempt a single HTTP POST to the server callback endpoint.
   *
   * Returns:
   *   - true  on 2xx (success)
   *   - false on permanent 4xx failure (no retry)
   *   - null  on transient failure (should retry)
   */
  private async attemptSend(payload: RunnerCallback, attempt: number): Promise<boolean | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(this.serverUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const status = response.status;

      // 2xx -- success
      if (status >= 200 && status < 300) {
        console.log(
          `[callback-client] Successfully delivered result for job ${payload.result.jobId}`,
        );
        return true;
      }

      // 429 Too Many Requests -- transient, retry
      if (status === 429) {
        console.warn(
          `[callback-client] Rate limited (429) on attempt ${attempt + 1} for job ${payload.result.jobId}`,
        );
        return null;
      }

      // 4xx (except 429) -- permanent failure, do not retry
      if (status >= 400 && status < 500) {
        console.error(
          `[callback-client] Permanent failure (${status}) for job ${payload.result.jobId}`,
        );
        return false;
      }

      // 5xx -- transient server error, retry
      if (status >= 500) {
        console.warn(
          `[callback-client] Server error (${status}) on attempt ${attempt + 1} for job ${payload.result.jobId}`,
        );
        return null;
      }

      // Any other status -- treat as transient
      console.warn(
        `[callback-client] Unexpected status ${status} on attempt ${attempt + 1} for job ${payload.result.jobId}`,
      );
      return null;
    } catch (error: unknown) {
      clearTimeout(timeoutId);

      // AbortError from timeout
      if (error instanceof DOMException && error.name === 'AbortError') {
        console.warn(
          `[callback-client] Request timeout on attempt ${attempt + 1} for job ${payload.result.jobId}`,
        );
        return null;
      }

      // Network / DNS / connection errors -- transient
      console.warn(
        `[callback-client] Network error on attempt ${attempt + 1} for job ${payload.result.jobId}:`,
        error instanceof Error ? error.message : String(error),
      );
      return null;
    }
  }

  /** Sleep helper -- extracted for testability. */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
