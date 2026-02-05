type RateLimitResult = {
  ok: boolean;
  remaining: number | null;
  resetSeconds: number | null;
};

export async function checkRateLimit(opts: {
  key: string;
  limit: number;
  windowSeconds: number;
}): Promise<RateLimitResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    return { ok: true, remaining: null, resetSeconds: null };
  }

  const limit = Number(opts.limit || 0);
  const windowSeconds = Number(opts.windowSeconds || 0);
  if (!limit || !windowSeconds) {
    return { ok: true, remaining: null, resetSeconds: null };
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
      return { ok: true, remaining: null, resetSeconds: null };
    }
    const data = (await response.json()) as Array<{ result?: number }>;
    const count = Number(data?.[0]?.result ?? 0);
    const ttlRaw = Number(data?.[2]?.result ?? windowSeconds);
    const ttl = ttlRaw > 0 ? ttlRaw : windowSeconds;
    const remaining = Math.max(0, limit - count);
    return { ok: count <= limit, remaining, resetSeconds: ttl };
  } catch {
    return { ok: true, remaining: null, resetSeconds: null };
  }
}
