import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({ requireUser: vi.fn().mockResolvedValue("user1") }));

const findUniqueOrThrow = vi.fn();
const findMany = vi.fn();
const catalogFindMany = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    userSettings: { findUniqueOrThrow: (...args: unknown[]) => findUniqueOrThrow(...args) },
    recipe: { findMany: (...args: unknown[]) => findMany(...args) },
    catalogIngredient: { findMany: (...args: unknown[]) => catalogFindMany(...args) },
  },
}));

const { getOrderIngredientList } = await import("../order");

const SETTINGS = { storePreference: "COLES", roundUpPartPacks: true };

const FLOUR_OPTION = { id: "opt-flour", store: "COLES", packQty: 1000, priceCents: 200, packLabel: "1Kg", priceUpdatedAt: null, lowConfidence: false };

function catalogIngredient(overrides: Partial<{ id: string; onHand: boolean }> = {}) {
  return {
    id: "ci-flour",
    name: "flour",
    category: "OTHER",
    onHand: false,
    productOptions: [FLOUR_OPTION],
    selectedProductOption: FLOUR_OPTION,
    ...overrides,
  };
}

beforeEach(() => {
  findUniqueOrThrow.mockReset();
  findMany.mockReset();
  catalogFindMany.mockReset();
  findUniqueOrThrow.mockResolvedValue(SETTINGS);
});

describe("getOrderIngredientList", () => {
  it("excludes an excludeFromCost ingredient from the shopping list entirely", async () => {
    findMany.mockResolvedValue([
      {
        orderQty: 1,
        ingredients: [
          { catalogIngredientId: "ci-flour", qtyCanonical: 200, excludeFromCost: true },
        ],
      },
    ]);

    const result = await getOrderIngredientList();

    expect(result).toEqual({ grouped: {}, totalCents: 0 });
    expect(catalogFindMany).not.toHaveBeenCalled();
  });

  it("includes a normal (non-excluded) ingredient in the total", async () => {
    findMany.mockResolvedValue([
      {
        orderQty: 1,
        ingredients: [
          { catalogIngredientId: "ci-flour", qtyCanonical: 200, excludeFromCost: false },
        ],
      },
    ]);
    catalogFindMany.mockResolvedValue([catalogIngredient()]);

    const result = await getOrderIngredientList();

    expect(result.totalCents).toBe(200); // 200/1000 pack -> rounds up to 1 pack @ 200c
    expect(result.grouped.OTHER).toHaveLength(1);
  });
});
