/** Compares a ProductOption's priceUpdatedAt against the user's stalePriceHours setting. */
export function isPriceStale(
  priceUpdatedAt: Date,
  stalePriceHours: number,
  now: Date = new Date()
): boolean {
  const ageMs = now.getTime() - priceUpdatedAt.getTime();
  const ageHours = ageMs / (1000 * 60 * 60);
  return ageHours > stalePriceHours;
}
