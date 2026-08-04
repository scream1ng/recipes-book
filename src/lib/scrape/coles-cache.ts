import "server-only";
import { prisma } from "@/lib/db";
import { searchColesProducts } from "./coles";
import type { ColesProduct } from "@/lib/gemini/schemas";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function normalizeQueryKey(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

export interface CachedColesResult {
  products: ColesProduct[];
  /** True when served from the 24h DB cache — no scrape/Gemini call happened. */
  cached: boolean;
}

/**
 * Looks up a Coles search query in the 24h DB cache, refetching + Gemini-
 * parsing on miss/expiry. Used by both /api/coles/search (manual-entry
 * autocomplete backing + general product search) and the swap sheet.
 *
 * On fetch/parse failure this returns an empty array rather than throwing,
 * so callers can leave price fields blank (per spec: no blocking, no
 * stale-cache fallback, no retry-with-headless-browser escalation).
 */
export async function getCachedColesResults(
  userId: string,
  query: string,
  opts?: { maxAgeMs?: number }
): Promise<CachedColesResult> {
  const queryKey = normalizeQueryKey(query);
  const now = new Date();
  const freshEnoughAt = opts?.maxAgeMs != null ? new Date(now.getTime() - opts.maxAgeMs) : null;

  const cached = await prisma.colesSearchCache.findUnique({ where: { queryKey } });
  if (cached && cached.expiresAt > now && (!freshEnoughAt || cached.fetchedAt > freshEnoughAt)) {
    try {
      return { products: JSON.parse(cached.resultsJson) as ColesProduct[], cached: true };
    } catch {
      // fall through to refetch on corrupt cache
    }
  }

  try {
    const products = await searchColesProducts(userId, query);
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
    return { products, cached: false };
  } catch {
    return { products: [], cached: false };
  }
}
