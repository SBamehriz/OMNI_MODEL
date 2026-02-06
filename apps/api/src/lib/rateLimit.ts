type RateLimitResult = {
  ok: boolean;
  remaining: number | null;
  resetSeconds: number | null;
};

/** In-memory fallback when Upstash is not configured. Single-process only. */
const memoryStore = new Map<string, { count: number; windowEndMs: number }>();

function checkRateLimitMemory(key: string, limit: number, windowSeconds: number): RateLimitResult {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const entry = memoryStore.get(key);
  if (!entry || now >= entry.windowEndMs) {
    const windowEndMs = now + windowMs;
    memoryStore.set(key, { count: 1, windowEndMs });
    return { ok: true, remaining: Math.max(0, limit - 1), resetSeconds: windowSeconds };
  }
  entry.count += 1;
  const remaining = Math.max(0, limit - entry.count);
  const resetSeconds = Math.ceil((entry.windowEndMs - now) / 1000);
  return {
    ok: entry.count <= limit,
    remaining,
    resetSeconds,
  };
}

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
    });
    if (!response.ok) {
      return checkRateLimitMemory(key, limit, windowSeconds);
    }
    const data = (await response.json()) as Array<{ result?: number }>;
    const count = Number(data?.[0]?.result ?? 0);
    const ttlRaw = Number(data?.[2]?.result ?? windowSeconds);
    const ttl = ttlRaw > 0 ? ttlRaw : windowSeconds;
    const remaining = Math.max(0, limit - count);
    return { ok: count <= limit, remaining, resetSeconds: ttl };
  } catch {
    return checkRateLimitMemory(key, limit, windowSeconds);
  }
}
