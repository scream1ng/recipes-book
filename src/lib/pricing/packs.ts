/**
 * Shopping-list pack-count math. Pack count is ALWAYS derived at render time
 * from qty/packQty — never stored. roundUpPartPacks affects ONLY this display
 * (how many physical packs to buy / their combined price), never recipe cost
 * math, which stays proportional to exact qty.
 */

export interface PackInfo {
  packQty: number; // canonical units per pack
  priceCents: number; // price per pack
}

export interface PackCount {
  /** Exact fractional pack count, e.g. 1.4 packs. */
  exact: number;
  /** Whole packs to buy, per roundUpPartPacks. */
  packsToBuy: number;
  /** Total price for packsToBuy (or, if roundUpPartPacks=false, the proportional price). */
  totalCents: number;
}

export function computePackCount(
  qtyCanonical: number,
  pack: PackInfo,
  roundUpPartPacks: boolean
): PackCount {
  if (pack.packQty <= 0) {
    return { exact: 0, packsToBuy: 0, totalCents: 0 };
  }
  const exact = qtyCanonical / pack.packQty;

  if (roundUpPartPacks) {
    const packsToBuy = Math.ceil(exact);
    return { exact, packsToBuy, totalCents: packsToBuy * pack.priceCents };
  }

  return {
    exact,
    packsToBuy: exact,
    totalCents: Math.round(exact * pack.priceCents),
  };
}
