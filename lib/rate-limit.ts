// A fixed-window counter kept in this server's memory: up to `limit` hits per
// key every `windowMs`. Enough to slow down password guessing and runaway
// clients on one server. Each instance counts on its own, so with several
// instances (serverless, a cluster) the real limit is higher; a shared store
// such as Redis is the fix for that.

type Window = { count: number; resetAt: number };

const windows = new Map<string, Window>();

// Old windows are dropped once this many keys pile up, so a stream of new
// keys (e.g. random emails) can't grow the map forever
const MAX_KEYS = 10_000;

export type RateLimitResult =
  { allowed: true } | { allowed: false; retryAfterSeconds: number };

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): RateLimitResult {
  const current = windows.get(key);

  if (!current || current.resetAt <= now) {
    if (windows.size >= MAX_KEYS) {
      for (const [oldKey, window] of windows) {
        if (window.resetAt <= now) windows.delete(oldKey);
      }
    }

    windows.set(key, { count: 1, resetAt: now + windowMs });

    return { allowed: true };
  }

  if (current.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((current.resetAt - now) / 1000),
    };
  }

  current.count += 1;

  return { allowed: true };
}

// Forgets a key, e.g. after a successful login, so earlier failed attempts
// don't count against the next session
export function resetRateLimit(key: string) {
  windows.delete(key);
}

// The client's address as the proxy in front of the app reports it. Only a
// rate-limit key: the header can be forged when there's no proxy, so it must
// never be used for anything security-critical on its own.
export function clientIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}
