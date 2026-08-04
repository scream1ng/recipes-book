// Simple in-memory token bucket, per user, per bucket name. Fine for a
// single-instance v1 deployment; swap for a DB/Redis-backed bucket if the
// app ever runs multi-instance.

interface Bucket {
  tokens: number;
  lastRefill: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitOptions {
  capacity: number;
  refillPerSecond: number;
}

export function checkRateLimit(
  key: string,
  { capacity, refillPerSecond }: RateLimitOptions
): boolean {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { tokens: capacity, lastRefill: now };

  const elapsedSeconds = (now - bucket.lastRefill) / 1000;
  bucket.tokens = Math.min(capacity, bucket.tokens + elapsedSeconds * refillPerSecond);
  bucket.lastRefill = now;

  if (bucket.tokens < 1) {
    buckets.set(key, bucket);
    return false;
  }

  bucket.tokens -= 1;
  buckets.set(key, bucket);
  return true;
}

/** Coles search: generous enough for autocomplete debounce, tight enough to protect the scraper. */
export function checkColesSearchRateLimit(userId: string): boolean {
  return checkRateLimit(`coles-search:${userId}`, { capacity: 20, refillPerSecond: 0.5 });
}

/** Coles price refresh: each call is a scrape + Gemini parse, tighter than autocomplete. */
export function checkColesRefreshRateLimit(userId: string): boolean {
  return checkRateLimit(`coles-refresh:${userId}`, { capacity: 10, refillPerSecond: 0.1 });
}

/** Gates starting an "Update prices" run: roughly 5 runs, then 1 per 10 minutes. */
export function checkColesBulkRunRateLimit(userId: string): boolean {
  return checkRateLimit(`coles-bulk-run:${userId}`, { capacity: 5, refillPerSecond: 1 / 600 });
}

/** Per-item bucket for a bulk run — separate from the row button's bucket so they don't starve each other. */
export function checkColesBulkRefreshRateLimit(userId: string): boolean {
  return checkRateLimit(`coles-bulk:${userId}`, { capacity: 120, refillPerSecond: 1 });
}
