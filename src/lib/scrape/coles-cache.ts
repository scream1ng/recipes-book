import "server-only";
import { prisma } from "@/lib/db";
import { searchColesProducts } from "./coles";
import type { FetchPriority } from "./coles";
import type { ColesProduct } from "@/lib/gemini/schemas";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function normalizeQueryKey(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

export interface CachedColesResult {
  products: ColesProduct[];
  /** True when served from a DB cache row — either a fresh hit (no live scrape
   *  happened) or a stale-fallback row served after a live scrape attempt
   *  failed (see `stale`/`error`). Check `stale` to tell those apart. */
  cached: boolean;
  /** True when a live scrape/parse attempt threw — distinguishes a real failure
   *  from a live or cached attempt that genuinely found zero products. */
  error: boolean;
  /** True when `error` is true and the returned products are from an expired
   *  cache row served as a fallback, rather than empty. */
  stale: boolean;
}

/**
 * Looks up a Coles search query in the 24h DB cache, refetching on miss/
 * expiry. Used by /api/coles/search (autocomplete + swap sheet) and the
 * pantry price run.
 *
 * On fetch/parse failure this serves an expired cache row if one exists
 * (better to show a 3-day-old price than none, for a weekly-refresh app),
 * otherwise returns an empty array — either way it never throws, so callers
 * can leave price fields blank rather than block the user. A failure never
 * overwrites a good cache row.
 */
export async function getCachedColesResults(
  userId: string,
  query: string,
  opts?: { maxAgeMs?: number; priority?: FetchPriority }
): Promise<CachedColesResult> {
  const queryKey = normalizeQueryKey(query);
  const now = new Date();
  const freshEnoughAt = opts?.maxAgeMs != null ? new Date(now.getTime() - opts.maxAgeMs) : null;

  const cached = await prisma.colesSearchCache.findUnique({ where: { queryKey } });
  if (cached && cached.expiresAt > now && (!freshEnoughAt || cached.fetchedAt > freshEnoughAt)) {
    try {
      return {
        products: JSON.parse(cached.resultsJson) as ColesProduct[],
        cached: true,
        error: false,
        stale: false,
      };
    } catch {
      // fall through to refetch on corrupt cache
    }
  }

  try {
    const products = await searchColesProducts(query, opts?.priority ?? "bulk");
    await prisma.colesSearchCache.upsert({
      where: { queryKey },
      create: {
        queryKey,
        resultsJson: JSON.stringify(products),
        fetchedAt: now,
        expiresAt: new Date(now.getTime() + CACHE_TTL_MS),
      },
      update: {
        resultsJson: JSON.stringify(products),
        fetchedAt: now,
        expiresAt: new Date(now.getTime() + CACHE_TTL_MS),
      },
    });
    return { products, cached: false, error: false, stale: false };
  } catch {
    if (cached) {
      try {
        return {
          products: JSON.parse(cached.resultsJson) as ColesProduct[],
          cached: true,
          error: true,
          stale: true,
        };
      } catch {
        // corrupt expired row — fall through to empty
      }
    }
    return { products: [], cached: false, error: true, stale: false };
  }
}
