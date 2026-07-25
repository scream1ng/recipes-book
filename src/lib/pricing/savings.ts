import { unitPriceCents, type PricedPack } from "./cost";

export interface SavingsCandidate extends PricedPack {
  id: string;
}

export interface SavingsResult {
  cheapestId: string;
  /** Cents saved per canonical unit vs the current selection. */
  perUnitSavingsCents: number;
  /** Cents saved for the given quantity vs the current selection. */
  totalSavingsCents: number;
}

/**
 * Compares the currently-selected pack against a set of candidate packs
 * (e.g. live Coles results + stored Woolworths options) and returns the
 * cheapest one, if it beats the current selection.
 */
export function findCheaperAlternative(
  current: PricedPack,
  candidates: SavingsCandidate[],
  qtyCanonical: number
): SavingsResult | null {
  const currentUnitPrice = unitPriceCents(current);

  let best: SavingsCandidate | null = null;
  let bestUnitPrice = currentUnitPrice;

  for (const candidate of candidates) {
    const price = unitPriceCents(candidate);
    if (price < bestUnitPrice) {
      best = candidate;
      bestUnitPrice = price;
    }
  }

  if (!best) return null;

  const perUnitSavingsCents = currentUnitPrice - bestUnitPrice;
  return {
    cheapestId: best.id,
    perUnitSavingsCents,
    totalSavingsCents: Math.round(perUnitSavingsCents * qtyCanonical),
  };
}
