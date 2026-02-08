interface CachedResponse {
  statusCode: number;
  body: unknown;
  timestamp: number;
}

// In-memory cache keyed by composite key
const cache = new Map<string, CachedResponse>();

/**
 * Build idempotency cache key from match context.
 */
function buildKey(matchId: string, round: number, action: string, idempotencyKey: string): string {
  return `${matchId}:${round}:${action}:${idempotencyKey}`;
}

/**
 * Check if a request has been processed before.
 * Returns cached response if duplicate, null if new.
 */
export function checkIdempotency(
  matchId: string,
  round: number,
  action: string,
  idempotencyKey: string,
): CachedResponse | null {
  const key = buildKey(matchId, round, action, idempotencyKey);
  return cache.get(key) || null;
}

/**
 * Store a response for future idempotency checks.
 */
export function storeIdempotencyResult(
  matchId: string,
  round: number,
  action: string,
  idempotencyKey: string,
  statusCode: number,
  body: unknown,
): void {
  const key = buildKey(matchId, round, action, idempotencyKey);
  cache.set(key, { statusCode, body, timestamp: Date.now() });
}

/**
 * Clear idempotency cache for a specific match+round (called on round completion).
 */
export function clearRoundCache(matchId: string, round: number): void {
  const prefix = `${matchId}:${round}:`;
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
    }
  }
}

export { type CachedResponse };
