// Money is always stored/handled as integer cents. Only format at render boundaries.

export function centsToDisplay(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const remainder = abs % 100;
  return `${sign}$${dollars}.${remainder.toString().padStart(2, "0")}`;
}

export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}
