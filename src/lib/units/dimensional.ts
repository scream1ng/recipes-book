// Dimensional conversion constants. These convert *within* a physical dimension
// (mass or volume) into the canonical base unit (grams for mass, millilitres for
// volume). Converting between mass and volume (e.g. "1 cup flour") additionally
// requires a per-ingredient density (gramsPerMl) — see normalize.ts.

export type MassUnit = "g" | "kg" | "oz" | "lb";
export type VolumeUnit = "ml" | "l" | "tsp" | "tbsp" | "cup";

export const GRAMS_PER: Record<MassUnit, number> = {
  g: 1,
  kg: 1000,
  oz: 28.349523125,
  lb: 453.59237,
};

// Australian standard: 1 tbsp = 20ml, 1 tsp = 5ml, 1 cup = 250ml.
export const ML_PER: Record<VolumeUnit, number> = {
  ml: 1,
  l: 1000,
  tsp: 5,
  tbsp: 20,
  cup: 250,
};

export const MASS_UNITS = Object.keys(GRAMS_PER) as MassUnit[];
export const VOLUME_UNITS = Object.keys(ML_PER) as VolumeUnit[];

export function isMassUnit(unit: string): unit is MassUnit {
  return unit in GRAMS_PER;
}

export function isVolumeUnit(unit: string): unit is VolumeUnit {
  return unit in ML_PER;
}

export function toGrams(amount: number, unit: MassUnit): number {
  return amount * GRAMS_PER[unit];
}

export function toMl(amount: number, unit: VolumeUnit): number {
  return amount * ML_PER[unit];
}

export function fromGrams(grams: number, unit: MassUnit): number {
  return grams / GRAMS_PER[unit];
}

export function fromMl(ml: number, unit: VolumeUnit): number {
  return ml / ML_PER[unit];
}
