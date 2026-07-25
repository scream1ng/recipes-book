/**
 * Recipe/ingredient cost math. Money is always integer cents; qty is always in
 * the ingredient's canonical unit (grams, ml, or count) so cost is a simple
 * proportion of the priced pack.
 */

export interface PricedPack {
  packQty: number; // in canonical unit
  priceCents: number;
}

/** Cost, in cents, for `qtyCanonical` of an ingredient priced as `pack`. */
export function lineCostCents(qtyCanonical: number, pack: PricedPack): number {
  if (pack.packQty <= 0) return 0;
  return Math.round((qtyCanonical / pack.packQty) * pack.priceCents);
}

/** Unit price in cents per canonical unit (e.g. cents/gram) — used for comparisons. */
export function unitPriceCents(pack: PricedPack): number {
  if (pack.packQty <= 0) return 0;
  return pack.priceCents / pack.packQty;
}

/** Scales a base-recipe quantity (at baseServes) to a target serve count. */
export function scaleQty(baseQty: number, baseServes: number, targetServes: number): number {
  if (baseServes <= 0) return baseQty;
  return (baseQty / baseServes) * targetServes;
}

export function costPerServe(totalCostCents: number, serves: number): number {
  if (serves <= 0) return 0;
  return Math.round(totalCostCents / serves);
}
