import { describe, expect, it } from "vitest";
import { lineCostCents, scaleQty, costPerServe, unitPriceCents } from "../cost";
import { computePackCount } from "../packs";
import { isPriceStale } from "../staleness";
import { findCheaperAlternative } from "../savings";

describe("cost", () => {
  it("computes proportional line cost", () => {
    // 500g pack @ $4.00, need 250g -> $2.00
    expect(lineCostCents(250, { packQty: 500, priceCents: 400 })).toBe(200);
  });

  it("scales quantity by serves", () => {
    expect(scaleQty(200, 4, 8)).toBe(400);
    expect(scaleQty(200, 4, 2)).toBe(100);
  });

  it("computes cost per serve", () => {
    expect(costPerServe(1000, 4)).toBe(250);
  });

  it("computes unit price", () => {
    expect(unitPriceCents({ packQty: 500, priceCents: 400 })).toBeCloseTo(0.8);
  });

  it("guards zero/negative packQty as a last-resort defense", () => {
    expect(unitPriceCents({ packQty: 0, priceCents: 400 })).toBe(0);
    expect(unitPriceCents({ packQty: -5, priceCents: 400 })).toBe(0);
    expect(lineCostCents(250, { packQty: 0, priceCents: 400 })).toBe(0);
    expect(lineCostCents(250, { packQty: -5, priceCents: 400 })).toBe(0);
  });
});

describe("packs", () => {
  it("rounds up part packs when enabled", () => {
    const result = computePackCount(750, { packQty: 500, priceCents: 400 }, true);
    expect(result.exact).toBe(1.5);
    expect(result.packsToBuy).toBe(2);
    expect(result.totalCents).toBe(800);
  });

  it("keeps proportional total when roundUpPartPacks is off", () => {
    const result = computePackCount(750, { packQty: 500, priceCents: 400 }, false);
    expect(result.packsToBuy).toBe(1.5);
    expect(result.totalCents).toBe(600);
  });
});

describe("staleness", () => {
  it("flags prices older than the threshold", () => {
    const now = new Date("2026-07-25T12:00:00Z");
    const updatedAt = new Date("2026-07-22T12:00:00Z"); // 72h ago
    expect(isPriceStale(updatedAt, 48, now)).toBe(true);
    expect(isPriceStale(updatedAt, 96, now)).toBe(false);
  });
});

describe("savings", () => {
  it("finds a cheaper alternative and computes savings", () => {
    const current = { packQty: 500, priceCents: 500 }; // $1/100g
    const candidates = [
      { id: "a", packQty: 500, priceCents: 500 },
      { id: "b", packQty: 1000, priceCents: 700 }, // cheaper per unit
    ];
    const result = findCheaperAlternative(current, candidates, 250);
    expect(result?.cheapestId).toBe("b");
    expect(result?.totalSavingsCents).toBeGreaterThan(0);
  });

  it("returns null when nothing is cheaper", () => {
    const current = { packQty: 500, priceCents: 300 };
    const candidates = [{ id: "a", packQty: 500, priceCents: 400 }];
    expect(findCheaperAlternative(current, candidates, 250)).toBeNull();
  });

  it("excludes candidates with zero or negative packQty instead of treating them as free", () => {
    const current = { packQty: 500, priceCents: 500 }; // $1/100g
    const candidates = [
      { id: "zero", packQty: 0, priceCents: 100 },
      { id: "negative", packQty: -1, priceCents: 100 },
    ];
    expect(findCheaperAlternative(current, candidates, 250)).toBeNull();
  });
});
