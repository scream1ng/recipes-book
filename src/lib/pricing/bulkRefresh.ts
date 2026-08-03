import { isPriceStale } from "./staleness";

interface BulkRefreshEligibleRow {
  id: string;
  name: string;
  productOptionId: string | null;
  source: string | null;
  priceUpdatedAt: Date | null;
  lastRefreshError: string | null;
}

/**
 * Ingredients eligible for a "Refresh prices" bulk run: Coles-sourced options that
 * are stale or previously failed to refresh. Never includes MANUAL (Woolworths /
 * user-entered) prices or unpriced ingredients — those stay per-row/sheet only.
 */
export function selectBulkRefreshTargets<T extends BulkRefreshEligibleRow>(
  rows: T[],
  stalePriceHours: number,
  now: Date = new Date()
): T[] {
  return rows.filter((row) => {
    if (row.source !== "COLES_SCRAPE" || !row.productOptionId) return false;
    if (row.lastRefreshError) return true;
    return row.priceUpdatedAt ? isPriceStale(row.priceUpdatedAt, stalePriceHours, now) : true;
  });
}
