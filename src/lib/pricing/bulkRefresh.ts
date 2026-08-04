import { isPriceStale } from "./staleness";

interface PriceRunEligibleRow {
  id: string;
  name: string;
  productOptionId: string | null;
  source: string | null;
  priceUpdatedAt: Date | null;
  lastRefreshError: string | null;
}

export interface PriceRunTarget {
  catalogIngredientId: string;
  name: string;
  productOptionId: string | null;
  kind: "discover" | "refresh";
}

/**
 * Ingredients eligible for the "Update prices" run: ingredients with no priced
 * option yet (discover), plus Coles-sourced options that are stale or previously
 * errored (refresh). Never includes MANUAL (Woolworths / user-entered) prices —
 * those stay per-row/sheet only.
 */
export function selectPriceRunTargets<T extends PriceRunEligibleRow>(
  rows: T[],
  stalePriceHours: number,
  now: Date = new Date()
): PriceRunTarget[] {
  const targets: PriceRunTarget[] = [];

  for (const row of rows) {
    if (row.source === "MANUAL") continue;

    if (row.source === "COLES_SCRAPE" && row.productOptionId) {
      const stale = row.lastRefreshError
        ? true
        : row.priceUpdatedAt
          ? isPriceStale(row.priceUpdatedAt, stalePriceHours, now)
          : true;
      if (stale) {
        targets.push({
          catalogIngredientId: row.id,
          name: row.name,
          productOptionId: row.productOptionId,
          kind: "refresh",
        });
      }
      continue;
    }

    if (!row.productOptionId) {
      targets.push({ catalogIngredientId: row.id, name: row.name, productOptionId: null, kind: "discover" });
    }
  }

  return targets;
}
