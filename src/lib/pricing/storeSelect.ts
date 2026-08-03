/**
 * Picks which ProductOption to price an ingredient at, honoring the user's
 * storePreference setting (COLES / WOOLWORTHS / CHEAPEST_OF_BOTH).
 */
import type { CatalogIngredient, ProductOption, StorePreference } from "@/generated/prisma";
import { unitPriceCents } from "./cost";

type CatalogIngredientWithOptions = CatalogIngredient & {
  productOptions: ProductOption[];
  selectedProductOption: ProductOption | null;
};

export function pickProductOption(
  ingredient: CatalogIngredientWithOptions,
  preference: StorePreference
): ProductOption | null {
  const options = ingredient.productOptions;
  if (options.length === 0) return ingredient.selectedProductOption;

  const pool = preference === "CHEAPEST_OF_BOTH" ? options : options.filter((o) => o.store === preference);
  const candidates = pool.length > 0 ? pool : options;

  const selected = ingredient.selectedProductOption;
  if (selected && candidates.some((o) => o.id === selected.id)) return selected;

  return candidates.reduce((cheapest, o) => (unitPriceCents(o) < unitPriceCents(cheapest) ? o : cheapest));
}
