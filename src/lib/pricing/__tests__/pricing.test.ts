import { describe, expect, it } from "vitest";
import { lineCostCents, scaleQty, costPerServe, unitPriceCents, pantryCostCents } from "../cost";
import { computePackCount } from "../packs";
import { isPriceStale } from "../staleness";
import { findCheaperAlternative } from "../savings";
import { pickProductOption } from "../storeSelect";
import { selectPriceRunTargets } from "../bulkRefresh";
import { pickRecommendedColesProduct } from "../recommend";

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

  it("sums cost of on-hand lines only", () => {
    expect(
      pantryCostCents([
        { costCents: 200, onHand: true },
        { costCents: 300, onHand: false },
        { costCents: null, onHand: true },
      ])
    ).toBe(200);
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

describe("storeSelect", () => {
  const coles = { id: "coles", store: "COLES", packQty: 500, priceCents: 500 };
  const cheaperColes = { id: "coles-cheap", store: "COLES", packQty: 1000, priceCents: 700 };
  const woolies = { id: "woolies", store: "WOOLWORTHS", packQty: 500, priceCents: 600 };

  function ingredient(selectedProductOption: object | null, productOptions: object[]) {
    return { selectedProductOption, productOptions } as never;
  }

  it("sticks with the explicitly selected option over a cheaper one in the same pool", () => {
    const result = pickProductOption(
      ingredient(coles, [coles, cheaperColes]),
      "CHEAPEST_OF_BOTH" as never
    );
    expect(result).toBe(coles);
  });

  it("falls back to cheapest when nothing is selected", () => {
    const result = pickProductOption(
      ingredient(null, [coles, cheaperColes]),
      "CHEAPEST_OF_BOTH" as never
    );
    expect(result).toBe(cheaperColes);
  });

  it("falls back to cheapest when the selected option is outside the preferred store pool", () => {
    const result = pickProductOption(ingredient(woolies, [coles, woolies]), "COLES" as never);
    expect(result).toBe(coles);
  });
});

describe("bulkRefresh", () => {
  const now = new Date("2026-07-25T12:00:00Z");
  const fresh = new Date("2026-07-25T06:00:00Z"); // 6h ago
  const old = new Date("2026-07-20T12:00:00Z"); // 5 days ago

  it("skips manual (Woolworths) options even when stale", () => {
    const rows = [
      { id: "a", name: "Milk", productOptionId: "opt-a", source: "MANUAL", priceUpdatedAt: old, lastRefreshError: null },
    ];
    expect(selectPriceRunTargets(rows, 48, now)).toHaveLength(0);
  });

  it("discovers unpriced ingredients", () => {
    const rows = [
      { id: "a", name: "Flour", productOptionId: null, source: null, priceUpdatedAt: null, lastRefreshError: null },
    ];
    const result = selectPriceRunTargets(rows, 48, now);
    expect(result).toEqual([{ catalogIngredientId: "a", name: "Flour", productOptionId: null, kind: "discover" }]);
  });

  it("includes stale Coles options and excludes fresh ones", () => {
    const rows = [
      { id: "a", name: "Stale", productOptionId: "opt-a", source: "COLES_SCRAPE", priceUpdatedAt: old, lastRefreshError: null },
      { id: "b", name: "Fresh", productOptionId: "opt-b", source: "COLES_SCRAPE", priceUpdatedAt: fresh, lastRefreshError: null },
    ];
    const result = selectPriceRunTargets(rows, 48, now);
    expect(result.map((r) => r.catalogIngredientId)).toEqual(["a"]);
    expect(result[0].kind).toBe("refresh");
  });

  it("includes a previously-errored Coles option even if not yet stale", () => {
    const rows = [
      {
        id: "a",
        name: "Errored",
        productOptionId: "opt-a",
        source: "COLES_SCRAPE",
        priceUpdatedAt: fresh,
        lastRefreshError: "Could not find a current price for this product.",
      },
    ];
    expect(selectPriceRunTargets(rows, 48, now)).toHaveLength(1);
  });
});

describe("recommend", () => {
  it("picks the candidate whose name matches best, ignoring cheaper unrelated products", () => {
    const products = [
      { name: "Coles Chicken Frames 1kg", packQty: 1000, priceCents: 200 },
      { name: "Coles Chicken Breast Fillets 500g", packQty: 500, priceCents: 900 },
    ];
    const result = pickRecommendedColesProduct("chicken breast", products);
    expect(result?.name).toBe("Coles Chicken Breast Fillets 500g");
  });

  it("tie-breaks equal name matches on cheapest unit price", () => {
    const products = [
      { name: "Coles Plain Flour 1kg", packQty: 1000, priceCents: 200 },
      { name: "Coles Plain Flour 2kg", packQty: 2000, priceCents: 300 },
    ];
    const result = pickRecommendedColesProduct("plain flour", products);
    expect(result?.name).toBe("Coles Plain Flour 2kg");
  });

  it("falls back to the first result when nothing is priced", () => {
    const products = [{ name: "Coles Garlic", packQty: null, priceCents: null }];
    expect(pickRecommendedColesProduct("garlic", products)).toBeNull();
  });

  it("bails out to null when top name-matches are different products, not pack-size variants", () => {
    // Both contain the single token "garlic" so they tie on name-match score, but a
    // 10x unit-price spread means they're different products, not the same one in
    // different sizes — must not silently auto-pick either.
    const products = [
      { name: "Coles Garlic Bread 375g", packQty: 375, priceCents: 750 }, // 2.0c/g
      { name: "Coles Garlic (loose)", packQty: 500, priceCents: 100 }, // 0.2c/g
    ];
    expect(pickRecommendedColesProduct("garlic", products)).toBeNull();
  });

  it("still auto-picks among tied matches that are just pack-size variants (small unit-price spread)", () => {
    const products = [
      { name: "Coles Garlic (loose) 100g", packQty: 100, priceCents: 60 },
      { name: "Coles Garlic (loose) 200g", packQty: 200, priceCents: 100 },
    ];
    const result = pickRecommendedColesProduct("garlic", products);
    expect(result?.name).toBe("Coles Garlic (loose) 200g");
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
