/**
 * Rate limiter and backpressure for the commentary pipeline.
 *
 * Ensures clients are never flooded with commentary items.
 * When the queue exceeds the configured threshold, lowest-priority
 * items (heartbeats) are dropped first. Critical events (round results,
 * final standings) are always delivered.
 */

/** Priority levels for commentary items. Lower numeric value = higher priority. */
export enum CommentaryPriority {
  /** Round results, final standings -- always delivered. */
  CRITICAL = 0,
  /** Phase transitions, bid reveals. */
  EVENT = 1,
  /** Periodic heartbeat updates -- first to be dropped under pressure. */
  HEARTBEAT = 2,
}

export interface PrioritizedCommentary {
  readonly text: string;
  readonly priority: CommentaryPriority;
  readonly timestamp: number;
}

export interface RateLimiterConfig {
  /** Maximum commentary items emitted per second. @default 5 */
  readonly maxPerSecond?: number;
  /** Maximum queue depth before backpressure kicks in. @default 20 */
  readonly maxQueueSize?: number;
}

export type EmitCallback = (text: string) => void;

const DEFAULT_MAX_PER_SECOND = 5;
const DEFAULT_MAX_QUEUE_SIZE = 20;

/**
 * Commentary rate limiter with priority-based backpressure.
 *
 * Standalone component designed to sit between the {@link CommentaryGenerator}
 * (or {@link HeartbeatScheduler}) and the client transport layer.
 *
 * Items are enqueued with a priority. The drain loop emits the
 * highest-priority item first at a configurable rate. When the queue
 * overflows, the lowest-priority items are evicted (heartbeats before
 * event commentary; critical items are never dropped).
 *
 * All errors are caught internally -- the rate limiter never crashes
 * the host process.
 */
export class CommentaryRateLimiter {
  private readonly maxPerSecond: number;
  private readonly maxQueueSize: number;

  private queue: PrioritizedCommentary[] = [];
  private callbacks: EmitCallback[] = [];
  private drainTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config: RateLimiterConfig = {}) {
    this.maxPerSecond = config.maxPerSecond ?? DEFAULT_MAX_PER_SECOND;
    this.maxQueueSize = config.maxQueueSize ?? DEFAULT_MAX_QUEUE_SIZE;
  }

  // ── public API ───────────────────────────────────────────────

  /**
   * Register an output handler. Called each time a commentary item
   * is emitted from the queue.
   */
  onEmit(callback: EmitCallback): void {
    this.callbacks.push(callback);
  }

  /**
   * Remove a previously registered emit handler.
   */
  removeCallback(callback: EmitCallback): void {
    this.callbacks = this.callbacks.filter((cb) => cb !== callback);
  }

  /**
   * Enqueue a commentary item with the given priority.
   *
   * If the queue exceeds {@link maxQueueSize} after insertion,
   * backpressure is applied: the lowest-priority (highest numeric
   * value) items are dropped until the queue is within bounds.
   * Critical items are never dropped.
   */
  enqueue(text: string, priority: CommentaryPriority): void {
    try {
      const item: PrioritizedCommentary = {
        text,
        priority,
        timestamp: Date.now(),
      };

      this.queue.push(item);
      this.applyBackpressure();
    } catch {
      // Enqueue failures must never propagate
    }
  }

  /**
   * Start the drain loop. Items are emitted at the configured rate
   * (one item per `1000 / maxPerSecond` ms), highest priority first.
   *
   * Calling `start()` while already running is a no-op.
   */
  start(): void {
    if (this.drainTimer !== null) return;

    const intervalMs = Math.max(1, Math.floor(1000 / this.maxPerSecond));

    this.drainTimer = setInterval(() => {
      this.drainOne();
    }, intervalMs);
  }

  /**
   * Stop the drain loop and clear the queue.
   */
  stop(): void {
    if (this.drainTimer !== null) {
      clearInterval(this.drainTimer);
      this.drainTimer = null;
    }
    this.queue = [];
  }

  /**
   * Immediately emit all queued items in priority order.
   * Useful at match end to flush remaining commentary.
   */
  flush(): void {
    try {
      // Sort: lowest numeric priority value (highest importance) first,
      // then by timestamp for stable ordering within the same priority.
      const sorted = this.queue
        .slice()
        .sort((a, b) => a.priority - b.priority || a.timestamp - b.timestamp);

      this.queue = [];

      for (const item of sorted) {
        this.emit(item.text);
      }
    } catch {
      // Flush failures must never propagate
    }
  }

  /**
   * Returns the current number of queued items.
   */
  get queueSize(): number {
    return this.queue.length;
  }

  /**
   * Returns `true` when the drain loop is active.
   */
  get running(): boolean {
    return this.drainTimer !== null;
  }

  // ── private ──────────────────────────────────────────────────

  /**
   * Emit a single text item to all registered callbacks.
   */
  private emit(text: string): void {
    for (const cb of this.callbacks) {
      try {
        cb(text);
      } catch {
        // Listener errors must never propagate
      }
    }
  }

  /**
   * Drain the highest-priority item from the queue and emit it.
   */
  private drainOne(): void {
    if (this.queue.length === 0) return;

    try {
      // Find the index of the highest-priority (lowest numeric value) item.
      // Among equal priorities, prefer the oldest (lowest timestamp).
      let bestIdx = 0;
      for (let i = 1; i < this.queue.length; i++) {
        const current = this.queue[i]!;
        const best = this.queue[bestIdx]!;
        if (
          current.priority < best.priority ||
          (current.priority === best.priority && current.timestamp < best.timestamp)
        ) {
          bestIdx = i;
        }
      }

      const item = this.queue[bestIdx]!;
      this.queue.splice(bestIdx, 1);
      this.emit(item.text);
    } catch {
      // Drain failures must never propagate
    }
  }

  /**
   * Apply backpressure: drop lowest-priority items until the queue
   * is within bounds. Critical items are never dropped.
   */
  private applyBackpressure(): void {
    while (this.queue.length > this.maxQueueSize) {
      // Find the index of the lowest-priority (highest numeric value) item.
      // Among equal priorities, prefer the newest (highest timestamp) for eviction.
      // Never drop CRITICAL items.
      let worstIdx = -1;

      for (let i = 0; i < this.queue.length; i++) {
        const item = this.queue[i]!;

        // Never drop critical items
        if (item.priority === CommentaryPriority.CRITICAL) continue;

        if (worstIdx === -1) {
          worstIdx = i;
          continue;
        }

        const worst = this.queue[worstIdx]!;
        if (
          item.priority > worst.priority ||
          (item.priority === worst.priority && item.timestamp > worst.timestamp)
        ) {
          worstIdx = i;
        }
      }

      // If all remaining items are critical, stop evicting
      if (worstIdx === -1) break;

      this.queue.splice(worstIdx, 1);
    }
  }
}
