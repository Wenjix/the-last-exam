import { heartbeatCommentary } from './templates.js';

/** Default heartbeat interval in milliseconds (15 seconds). */
const DEFAULT_HEARTBEAT_INTERVAL_MS = 15_000;

export type HeartbeatCallback = (text: string, round: number, elapsedMs: number) => void;

/**
 * Fires periodic heartbeat commentary during long game phases
 * (especially the Run phase, which can last up to 60s).
 *
 * Heartbeats are automatically suppressed while event-triggered
 * commentary is in flight — call {@link pause} before emitting
 * event commentary and {@link resume} afterwards.
 */
export class HeartbeatScheduler {
  private readonly intervalMs: number;
  private timerId: ReturnType<typeof setInterval> | null = null;
  private startTimestamp: number = 0;
  private currentRound: number = 0;
  private paused: boolean = false;
  private callbacks: HeartbeatCallback[] = [];

  constructor(intervalMs: number = DEFAULT_HEARTBEAT_INTERVAL_MS) {
    this.intervalMs = intervalMs;
  }

  /**
   * Register a handler that will be called on every heartbeat tick.
   */
  onHeartbeat(callback: HeartbeatCallback): void {
    this.callbacks.push(callback);
  }

  /**
   * Remove a previously registered heartbeat handler.
   */
  removeCallback(callback: HeartbeatCallback): void {
    this.callbacks = this.callbacks.filter((cb) => cb !== callback);
  }

  /**
   * Start emitting heartbeats for the given phase.
   *
   * @param round    Current game round (1-based).
   * @param interval Optional override for the heartbeat interval (ms).
   *                 Falls back to the interval set in the constructor.
   */
  start(round: number, interval?: number): void {
    // Always clean up any previous timer first
    this.stop();

    const tickMs = interval ?? this.intervalMs;
    this.currentRound = round;
    this.startTimestamp = Date.now();
    this.paused = false;

    this.timerId = setInterval(() => {
      this.tick();
    }, tickMs);
  }

  /**
   * Stop heartbeats and reset internal state.
   */
  stop(): void {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    this.paused = false;
    this.startTimestamp = 0;
  }

  /**
   * Temporarily suppress heartbeats while event commentary is
   * being generated. This prevents overlapping or duplicate
   * commentary.
   */
  pause(): void {
    this.paused = true;
  }

  /**
   * Resume heartbeat emission after event commentary completes.
   */
  resume(): void {
    this.paused = false;
  }

  /**
   * Returns `true` when a timer is active (regardless of pause state).
   */
  get running(): boolean {
    return this.timerId !== null;
  }

  // ── private ────────────────────────────────────────────────

  private tick(): void {
    // Skip this tick if paused (event commentary in progress)
    if (this.paused) return;

    const elapsedMs = Date.now() - this.startTimestamp;
    const text = heartbeatCommentary(this.currentRound, elapsedMs);

    for (const cb of this.callbacks) {
      try {
        cb(text, this.currentRound, elapsedMs);
      } catch {
        // Listener errors must never propagate
      }
    }
  }
}
