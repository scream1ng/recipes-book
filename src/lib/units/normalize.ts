import {
  GRAMS_PER,
  ML_PER,
  isMassUnit,
  isVolumeUnit,
  toGrams,
  toMl,
} from "./dimensional";

export type CanonicalUnit = "MASS_G" | "VOLUME_ML" | "COUNT";

/** Ingredient-specific conversion factors, as stored on CatalogIngredient. */
export interface ConversionFactors {
  gramsPerCount?: number | null;
  mlPerCount?: number | null;
  gramsPerMl?: number | null;
  gramsPerBunch?: number | null;
}

const UNIT_ALIASES: Record<string, string> = {
  gram: "g",
  grams: "g",
  gm: "g",
  gms: "g",
  kilogram: "kg",
  kilograms: "kg",
  kilo: "kg",
  kilos: "kg",
  ounce: "oz",
  ounces: "oz",
  pound: "lb",
  pounds: "lb",
  lbs: "lb",
  millilitre: "ml",
  millilitres: "ml",
  milliliter: "ml",
  milliliters: "ml",
  litre: "l",
  litres: "l",
  liter: "l",
  liters: "l",
  teaspoon: "tsp",
  teaspoons: "tsp",
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  tbs: "tbsp",
  cups: "cup",
  whole: "count",
  ea: "count",
  each: "count",
  piece: "count",
  pieces: "count",
  clove: "count",
  cloves: "count",
  bunch: "bunch",
  bunches: "bunch",
};

/** Lowercases + strips punctuation/plurals so "Tbsp." and "tablespoons" both map to "tbsp". */
export function canonicalizeUnitToken(raw: string): string {
  const cleaned = raw.trim().toLowerCase().replace(/[.,]/g, "");
  return UNIT_ALIASES[cleaned] ?? cleaned;
}

export interface NormalizeResult {
  qtyCanonical: number | null;
  /** Set when the unit is recognised but a required ingredient factor is missing. */
  missingFactor?: "gramsPerCount" | "mlPerCount" | "gramsPerMl" | "gramsPerBunch";
}

/**
 * Converts a raw (amount, unit) pair into the ingredient's canonical unit.
 * Returns qtyCanonical=null (with missingFactor set) when the unit crosses
 * dimensions (e.g. volume unit but canonical is MASS_G) and the ingredient
 * doesn't yet have the conversion factor recorded — caller should prompt the
 * user to fill it in rather than silently guessing.
 */
export function normalizeToCanonical(
  amount: number,
  rawUnit: string,
  canonicalUnit: CanonicalUnit,
  factors: ConversionFactors = {}
): NormalizeResult {
  const unit = canonicalizeUnitToken(rawUnit);

  if (canonicalUnit === "COUNT") {
    if (unit === "count" || unit === "") return { qtyCanonical: amount };
    // A mass/volume amount given for a count-based ingredient can't be
    // converted back to "how many" without extra info — leave for review.
    return { qtyCanonical: null };
  }

  if (canonicalUnit === "MASS_G") {
    if (isMassUnit(unit)) return { qtyCanonical: toGrams(amount, unit) };
    if (isVolumeUnit(unit)) {
      if (!factors.gramsPerMl)
        return { qtyCanonical: null, missingFactor: "gramsPerMl" };
      return { qtyCanonical: toMl(amount, unit) * factors.gramsPerMl };
    }
    if (unit === "count") {
      if (!factors.gramsPerCount)
        return { qtyCanonical: null, missingFactor: "gramsPerCount" };
      return { qtyCanonical: amount * factors.gramsPerCount };
    }
    if (unit === "bunch") {
      if (!factors.gramsPerBunch)
        return { qtyCanonical: null, missingFactor: "gramsPerBunch" };
      return { qtyCanonical: amount * factors.gramsPerBunch };
    }
    return { qtyCanonical: null };
  }

  // VOLUME_ML
  if (isVolumeUnit(unit)) return { qtyCanonical: toMl(amount, unit) };
  if (isMassUnit(unit)) {
    if (!factors.gramsPerMl)
      return { qtyCanonical: null, missingFactor: "gramsPerMl" };
    return { qtyCanonical: toGrams(amount, unit) / factors.gramsPerMl };
  }
  if (unit === "count") {
    if (!factors.mlPerCount)
      return { qtyCanonical: null, missingFactor: "mlPerCount" };
    return { qtyCanonical: amount * factors.mlPerCount };
  }
  return { qtyCanonical: null };
}

export function normalizeIngredientName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ");
}

export const KNOWN_UNIT_TOKENS = new Set([
  ...Object.keys(GRAMS_PER),
  ...Object.keys(ML_PER),
  "count",
  "bunch",
]);
