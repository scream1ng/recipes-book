// Simple in-memory token bucket, per user, per bucket name. Fine for a
// single-instance v1 deployment; swap for a DB/Redis-backed bucket if the
// app ever runs multi-instance.

interface Bucket {
  tokens: number;
  lastRefill: number;
}

const buckets = new Map<string, Bucket>();

// Every bucket so far has been keyed by authenticated userId (bounded by real user
// count). pw-reset-* buckets below are keyed by unauthenticated input (IP, hashed
// email), so an anonymous caller could otherwise grow this Map without limit. Cap it
// and evict oldest-inserted entries — simple, not true LRU, but enough to bound memory.
const MAX_BUCKETS = 5000;

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

  const allowed = bucket.tokens >= 1;
  if (allowed) bucket.tokens -= 1;

  buckets.delete(key); // re-insert to move this key to the end (insertion-order eviction)
  buckets.set(key, bucket);
  if (buckets.size > MAX_BUCKETS) {
    const oldestKey = buckets.keys().next().value;
    if (oldestKey !== undefined) buckets.delete(oldestKey);
  }

  return allowed;
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

/** Password reset requests, per email: cheap first line before the DB-level cooldown. */
export function checkPasswordResetEmailRateLimit(emailKey: string): boolean {
  return checkRateLimit(`pw-reset-email:${emailKey}`, { capacity: 3, refillPerSecond: 1 / 900 });
}

/** Password reset requests, per requesting IP — catches one IP cycling through many emails. */
export function checkPasswordResetIpRateLimit(ip: string): boolean {
  return checkRateLimit(`pw-reset-ip:${ip}`, { capacity: 10, refillPerSecond: 1 / 300 });
}
