type RateLimitResult = {
  ok: boolean;
  remaining: number | null;
  resetSeconds: number | null;
};

/**
 * In-memory fallback when Upstash is not configured.
 * WARNING: Single-process only. Does not work correctly with multiple instances.
 * For production with multiple instances, use Redis (UPSTASH_REDIS_REST_URL).
 */
const memoryStore = new Map<string, { count: number; windowEndMs: number }>();

/**
 * Simple queue to serialize memory store operations and prevent race conditions
 * JavaScript is single-threaded, but async operations can interleave
 */
const memoryOperationQueue = new Map<string, Promise<RateLimitResult>>();

function checkRateLimitMemory(
  key: string,
  limit: number,
  windowSeconds: number
): RateLimitResult {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;

  // Clean up expired entries to prevent memory leak
  const entry = memoryStore.get(key);
  if (!entry || now >= entry.windowEndMs) {
    // Window expired or doesn't exist - create new window
    const windowEndMs = now + windowMs;
    memoryStore.set(key, { count: 1, windowEndMs });
    return {
      ok: true,
      remaining: Math.max(0, limit - 1),
      resetSeconds: windowSeconds,
    };
  }

  // Increment count in existing window
  entry.count += 1;
  const remaining = Math.max(0, limit - entry.count);
  const resetSeconds = Math.ceil((entry.windowEndMs - now) / 1000);

  return {
    ok: entry.count <= limit,
    remaining,
    resetSeconds,
  };
}

/**
 * Periodically clean up expired entries from memory store
 * Prevents unbounded memory growth
 */
setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  for (const [key, entry] of memoryStore.entries()) {
    if (now >= entry.windowEndMs) {
      memoryStore.delete(key);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    console.log(`Cleaned ${cleaned} expired rate limit entries from memory`);
  }
}, 60000); // Clean every minute

export async function checkRateLimit(opts: {
  key: string;
  limit: number;
  windowSeconds: number;
}): Promise<RateLimitResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  const limit = Number(opts.limit || 0);
  const windowSeconds = Number(opts.windowSeconds || 0);

  if (!limit || !windowSeconds) {
    return { ok: true, remaining: null, resetSeconds: null };
  }

  if (!url || !token) {
    return checkRateLimitMemory(`ratelimit:${opts.key}`, limit, windowSeconds);
  }

  const key = `ratelimit:${opts.key}`;
  try {
    // Use Redis pipeline for atomic operations
    // INCR increments the counter
    // EXPIRE with NX sets expiry only if key doesn't have one (sliding window)
    // TTL gets remaining time
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout

    const response = await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        ['INCR', key],
        ['EXPIRE', key, windowSeconds, 'NX'],
        ['TTL', key],
      ]),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(
        `Redis rate limit check failed: ${response.status}, falling back to memory`
      );
      return checkRateLimitMemory(key, limit, windowSeconds);
    }

    const data = (await response.json()) as Array<{ result?: number }>;
    const count = Number(data?.[0]?.result ?? 0);
    const ttlRaw = Number(data?.[2]?.result ?? windowSeconds);
    const ttl = ttlRaw > 0 ? ttlRaw : windowSeconds;
    const remaining = Math.max(0, limit - count);

    return { ok: count <= limit, remaining, resetSeconds: ttl };
  } catch (error) {
    // Network error or timeout - fall back to memory
    console.warn(
      `Redis rate limit error: ${error instanceof Error ? error.message : 'unknown'}, falling back to memory`
    );
    return checkRateLimitMemory(key, limit, windowSeconds);
  }
}
