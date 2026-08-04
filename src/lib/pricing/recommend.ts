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
// one — treat that as ambiguous rather than silently picking one.
const AMBIGUITY_UNIT_PRICE_RATIO = 3;

/**
 * Picks the best Coles search result to auto-price an ingredient with, for the
 * one-button "Update prices" run. Real searches return many priced candidates: rank
 * by name match against the ingredient name, then tie-break on cheapest unit price —
 * but bail out to null (left for manual review) when the top-matching candidates look
 * like different products rather than pack-size variants of the same one.
 */
export function pickRecommendedColesProduct<T extends PricedColesProduct>(
  ingredientName: string,
  products: T[]
): T | null {
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

  if (topMatches.length === 1) return topMatches[0];

  const unitPrices = topMatches.map(unitPriceCents);
  const minUnit = Math.min(...unitPrices);
  const maxUnit = Math.max(...unitPrices);
  if (minUnit > 0 && maxUnit > minUnit * AMBIGUITY_UNIT_PRICE_RATIO) return null;

  return topMatches.reduce((cheapest, p) => (unitPriceCents(p) < unitPriceCents(cheapest) ? p : cheapest));
}
