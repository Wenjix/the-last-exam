/**
 * Circuit breaker for the commentary pipeline.
 *
 * Wraps async commentary operations with a timeout and the classic
 * circuit-breaker pattern (CLOSED / OPEN / HALF_OPEN). This ensures
 * that phase transitions are **never** blocked by slow or failing
 * commentary generation.
 *
 * Guarantees:
 * - {@link execute} never throws -- all errors are caught and logged.
 * - Returns `null` when the operation times out, fails, or the
 *   circuit is open.
 * - The circuit opens after {@link failureThreshold} consecutive
 *   failures and automatically half-opens after {@link cooldownMs}.
 */

/** Circuit breaker states. */
export enum CircuitState {
  /** Normal operation -- requests flow through. */
  CLOSED = 'CLOSED',
  /** Too many failures -- requests are short-circuited (skipped). */
  OPEN = 'OPEN',
  /** Cooldown elapsed -- next request is a probe to test recovery. */
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerConfig {
  /** Timeout in ms for each wrapped operation. @default 5000 */
  readonly timeoutMs?: number;
  /** Consecutive failures before opening the circuit. @default 3 */
  readonly failureThreshold?: number;
  /** How long (ms) to stay open before moving to half-open. @default 30000 */
  readonly cooldownMs?: number;
}

const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_FAILURE_THRESHOLD = 3;
const DEFAULT_COOLDOWN_MS = 30_000;

export class CommentaryCircuitBreaker {
  private readonly timeoutMs: number;
  private readonly failureThreshold: number;
  private readonly cooldownMs: number;

  private state: CircuitState = CircuitState.CLOSED;
  private consecutiveFailures: number = 0;
  private lastFailureTime: number = 0;

  constructor(config: CircuitBreakerConfig = {}) {
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.failureThreshold = config.failureThreshold ?? DEFAULT_FAILURE_THRESHOLD;
    this.cooldownMs = config.cooldownMs ?? DEFAULT_COOLDOWN_MS;
  }

  // -- public API -------------------------------------------------------

  /**
   * Execute an async operation with timeout and circuit-breaker
   * protection.
   *
   * - If the circuit is **OPEN** and cooldown has not elapsed, the
   *   call is skipped immediately (returns `null`).
   * - If the circuit is **HALF_OPEN**, one probe call is allowed.
   *   Success closes the circuit; failure re-opens it.
   * - If the operation exceeds {@link timeoutMs}, it is abandoned
   *   (returns `null`) and counted as a failure.
   *
   * **This method never throws.**
   *
   * @param fn       The async operation to execute.
   * @param timeoutMs Optional per-call timeout override.
   * @returns The result of `fn`, or `null` on timeout / failure / open circuit.
   */
  async execute<T>(fn: () => Promise<T>, timeoutMs?: number): Promise<T | null> {
    try {
      // --- Check circuit state ---
      if (this.state === CircuitState.OPEN) {
        if (this.shouldTransitionToHalfOpen()) {
          this.state = CircuitState.HALF_OPEN;
        } else {
          // Circuit is open -- skip immediately
          return null;
        }
      }

      // --- Run with timeout ---
      const effectiveTimeout = timeoutMs ?? this.timeoutMs;
      const result = await this.withTimeout(fn, effectiveTimeout);

      // --- Success path ---
      this.onSuccess();
      return result;
    } catch (error: unknown) {
      this.onFailure(error);
      return null;
    }
  }

  /**
   * Returns the current circuit state.
   */
  get currentState(): CircuitState {
    return this.state;
  }

  /**
   * Returns the number of consecutive failures since the last success.
   */
  get failures(): number {
    return this.consecutiveFailures;
  }

  /**
   * Manually reset the circuit breaker to CLOSED state.
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.consecutiveFailures = 0;
    this.lastFailureTime = 0;
  }

  // -- private ----------------------------------------------------------

  private shouldTransitionToHalfOpen(): boolean {
    return Date.now() - this.lastFailureTime >= this.cooldownMs;
  }

  private onSuccess(): void {
    this.consecutiveFailures = 0;
    this.state = CircuitState.CLOSED;
  }

  private onFailure(error: unknown): void {
    this.consecutiveFailures += 1;
    this.lastFailureTime = Date.now();

    const message = error instanceof Error ? error.message : String(error);

    if (this.state === CircuitState.HALF_OPEN) {
      // Probe failed -- reopen circuit
      this.state = CircuitState.OPEN;
      console.warn(
        `[CommentaryCircuitBreaker] Half-open probe failed, circuit re-opened: ${message}`,
      );
    } else if (this.consecutiveFailures >= this.failureThreshold) {
      this.state = CircuitState.OPEN;
      console.warn(
        `[CommentaryCircuitBreaker] ${this.consecutiveFailures} consecutive failures, circuit opened: ${message}`,
      );
    } else {
      console.warn(
        `[CommentaryCircuitBreaker] Commentary failure (${this.consecutiveFailures}/${this.failureThreshold}): ${message}`,
      );
    }
  }

  /**
   * Run an async function with a timeout. Rejects with a
   * descriptive error if the timeout elapses first.
   */
  private withTimeout<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      let settled = false;

      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          reject(new Error(`Commentary operation timed out after ${timeoutMs}ms`));
        }
      }, timeoutMs);

      fn().then(
        (value) => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve(value);
          }
        },
        (error) => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            reject(error);
          }
        },
      );
    });
  }
}
