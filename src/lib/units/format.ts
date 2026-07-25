import type { CanonicalUnit } from "./normalize";

/**
 * Formats a canonical quantity for display, picking a sensible human unit
 * (e.g. 1500g -> "1.5kg", 30ml -> "30ml", 4 count -> "4").
 */
export function formatQtyCanonical(qty: number, canonicalUnit: CanonicalUnit): string {
  if (canonicalUnit === "COUNT") {
    return trimTrailingZeros(qty);
  }
  if (canonicalUnit === "MASS_G") {
    if (qty >= 1000) return `${trimTrailingZeros(qty / 1000)}kg`;
    return `${trimTrailingZeros(qty)}g`;
  }
  // VOLUME_ML
  if (qty >= 1000) return `${trimTrailingZeros(qty / 1000)}L`;
  return `${trimTrailingZeros(qty)}ml`;
}

function trimTrailingZeros(n: number): string {
  return Number(n.toFixed(2)).toString();
}
