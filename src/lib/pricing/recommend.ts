import { normalizeIngredientName } from "@/lib/units/normalize";
import { unitPriceCents } from "./cost";

interface PricedColesProduct {
  name: string;
  packQty: number | null;
  priceCents: number | null;
}

// For single/short ingredient names, several genuinely different products (e.g.
// "Garlic Bread" vs "Garlic (loose)") can tie on name-match score since both contain
// every ingredient token. A big unit-price spread between tied top matches is the
// signal that they're different products, not just pack-size variants of the same
// one — treat that as ambiguous.
const AMBIGUITY_UNIT_PRICE_RATIO = 3;

export interface RecommendedMatch<T> {
  product: T;
  /** "low" means the pick came from a genuinely ambiguous candidate set
   *  (auto-picked as a ballpark, not a confident match) — callers must flag
   *  this to the user rather than treat it the same as a real match. */
  confidence: "high" | "low";
}

/** Picks the tied candidate closest to the median unit price. Used instead of
 *  cheapest for an ambiguous set — the minimum unit price across genuinely
 *  different products (e.g. dairy cream vs body lotion vs frosting) is a
 *  biased-low ballpark, not a neutral one, and this is a cost-tracking app
 *  where understating price is the worse direction to be wrong in. */
function medianByUnitPrice<T extends { packQty: number; priceCents: number }>(candidates: T[]): T {
  const sorted = [...candidates].sort((a, b) => unitPriceCents(a) - unitPriceCents(b));
  // Upper-middle index: for an even count this picks the higher of the two
  // middle candidates, not the lower — for the common 2-candidate ambiguous
  // case that means it doesn't just collapse back to "always cheapest".
  return sorted[Math.ceil((sorted.length - 1) / 2)];
}

/**
 * Picks the best Coles search result to auto-price an ingredient with, for the
 * one-button "Update prices" run. Real searches return many priced candidates: rank
 * by name match against the ingredient name, then tie-break on unit price. When the
 * top-matching candidates look like different products rather than pack-size variants
 * of the same one, still returns a ballpark pick (median unit price among the tied
 * group) but flags it "low" confidence — callers must show that to the user rather
 * than silently counting it as a confident price.
 */
export function pickRecommendedColesProduct<T extends PricedColesProduct>(
  ingredientName: string,
  products: T[]
): RecommendedMatch<T> | null {
  const priced = products.filter(
    (p): p is T & { packQty: number; priceCents: number } =>
      p.priceCents != null && p.packQty != null && p.packQty > 0
  );
  if (priced.length === 0) return null;

  const nameTokens = normalizeIngredientName(ingredientName).split(" ").filter(Boolean);

  function matchScore(product: T): number {
    const productTokens = new Set(normalizeIngredientName(product.name).split(" ").filter(Boolean));
    if (nameTokens.length === 0) return 0;
    const matched = nameTokens.filter((t) => productTokens.has(t)).length;
    return matched / nameTokens.length; // 1 = every ingredient token present
  }

  const bestScore = Math.max(...priced.map(matchScore));
  const topMatches = priced.filter((p) => matchScore(p) === bestScore);

  if (topMatches.length === 1) return { product: topMatches[0], confidence: "high" };

  const unitPrices = topMatches.map(unitPriceCents);
  const minUnit = Math.min(...unitPrices);
  const maxUnit = Math.max(...unitPrices);
  if (minUnit > 0 && maxUnit > minUnit * AMBIGUITY_UNIT_PRICE_RATIO) {
    return { product: medianByUnitPrice(topMatches), confidence: "low" };
  }

  const cheapest = topMatches.reduce((cheapest, p) =>
    unitPriceCents(p) < unitPriceCents(cheapest) ? p : cheapest
  );
  return { product: cheapest, confidence: "high" };
}
