import { describe, expect, it, vi, beforeEach } from "vitest";

const findUnique = vi.fn();
const upsert = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: { colesSearchCache: { findUnique: (...args: unknown[]) => findUnique(...args), upsert: (...args: unknown[]) => upsert(...args) } },
}));

const searchColesProducts = vi.fn();
vi.mock("../coles", () => ({ searchColesProducts: (...args: unknown[]) => searchColesProducts(...args) }));

const { getCachedColesResults } = await import("../coles-cache");

const SAMPLE_PRODUCTS = [
  { name: "Coles Milk", packLabel: "1L", packQty: 1000, priceCents: 250, productUrl: null, productId: "1" },
];

beforeEach(() => {
  findUnique.mockReset();
  upsert.mockReset();
  searchColesProducts.mockReset();
});

describe("getCachedColesResults", () => {
  it("serves a fresh cache row without calling searchColesProducts", async () => {
    findUnique.mockResolvedValue({
      resultsJson: JSON.stringify(SAMPLE_PRODUCTS),
      fetchedAt: new Date(),
      expiresAt: new Date(Date.now() + 1000 * 60),
    });

    const result = await getCachedColesResults("user1", "milk");

    expect(result).toEqual({ products: SAMPLE_PRODUCTS, cached: true, error: false, stale: false });
    expect(searchColesProducts).not.toHaveBeenCalled();
  });

  it("fetches live and caches on a miss", async () => {
    findUnique.mockResolvedValue(null);
    searchColesProducts.mockResolvedValue(SAMPLE_PRODUCTS);

    const result = await getCachedColesResults("user1", "milk");

    expect(result).toEqual({ products: SAMPLE_PRODUCTS, cached: false, error: false, stale: false });
    expect(upsert).toHaveBeenCalledOnce();
  });

  it("serves a stale (expired) cache row on live failure instead of an empty array", async () => {
    const expired = {
      resultsJson: JSON.stringify(SAMPLE_PRODUCTS),
      fetchedAt: new Date(Date.now() - 1000 * 60 * 60 * 48),
      expiresAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
    };
    findUnique.mockResolvedValue(expired);
    searchColesProducts.mockRejectedValue(new Error("blocked"));

    const result = await getCachedColesResults("user1", "milk");

    expect(result).toEqual({ products: SAMPLE_PRODUCTS, cached: true, error: true, stale: true });
    // A failure must never overwrite the good (if expired) row still on disk.
    expect(upsert).not.toHaveBeenCalled();
  });

  it("returns empty (not stale) on live failure with no cache row at all", async () => {
    findUnique.mockResolvedValue(null);
    searchColesProducts.mockRejectedValue(new Error("blocked"));

    const result = await getCachedColesResults("user1", "milk");

    expect(result).toEqual({ products: [], cached: false, error: true, stale: false });
    expect(upsert).not.toHaveBeenCalled();
  });
});
