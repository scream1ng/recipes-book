import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function fixture(name: string): string {
  return readFileSync(join(__dirname, "fixtures", name), "utf8");
}

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

function textResponse(body: string, ok = true) {
  return { ok, status: ok ? 200 : 500, text: () => Promise.resolve(body) };
}

describe("searchColesProducts", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.useFakeTimers();
    // coles.ts keeps module-level pacing/cooldown state — reset the module
    // between tests so they don't leak into each other, except the one test
    // that deliberately imports it twice to assert the cooldown persists.
    vi.resetModules();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("parses real search results into products", async () => {
    fetchMock.mockResolvedValue(textResponse(fixture("coles-search-glucose.html")));
    const { searchColesProducts } = await import("../coles");

    const promise = searchColesProducts("glucose");
    await vi.runAllTimersAsync();
    const products = await promise;

    expect(products.length).toBe(1);
    expect(products[0].productId).toBe("4695425");
  });

  it("throws ColesBlockedError on a bot-challenge page and does not retry", async () => {
    fetchMock.mockResolvedValue(textResponse(fixture("coles-blocked.html")));
    const { searchColesProducts, ColesBlockedError } = await import("../coles");

    const promise = searchColesProducts("salt");
    const assertion = expect(promise).rejects.toBeInstanceOf(ColesBlockedError);
    await vi.runAllTimersAsync();
    await assertion;

    // A block must not be retried immediately (retrying it is what escalates
    // Imperva) — exactly one fetch call, not two.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries once on a network failure, then throws", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    const { searchColesProducts, ColesFetchError } = await import("../coles");

    const promise = searchColesProducts("milk");
    const assertion = expect(promise).rejects.toBeInstanceOf(ColesFetchError);
    await vi.runAllTimersAsync();
    await assertion;

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws when the page has no __NEXT_DATA__ at all (not a recognized block, not real data)", async () => {
    fetchMock.mockResolvedValue(textResponse("<html><body>unexpected page</body></html>"));
    const { searchColesProducts, ColesFetchError } = await import("../coles");

    const promise = searchColesProducts("water");
    const assertion = expect(promise).rejects.toBeInstanceOf(ColesFetchError);
    await vi.runAllTimersAsync();
    await assertion;
  });

  it("spaces consecutive fetches apart instead of firing back-to-back", async () => {
    fetchMock.mockResolvedValue(textResponse(fixture("coles-search-glucose.html")));
    const { searchColesProducts } = await import("../coles");

    const p1 = searchColesProducts("a");
    const p2 = searchColesProducts("b");

    // Let microtasks settle without advancing fake time — the second fetch
    // must not have fired yet if it's actually spaced.
    await Promise.resolve();
    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.runAllTimersAsync();
    await Promise.all([p1, p2]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("paces 'interactive' calls (autocomplete, swap sheet) much shorter than 'bulk' (price run)", async () => {
    fetchMock.mockResolvedValue(textResponse(fixture("coles-search-glucose.html")));
    const { searchColesProducts } = await import("../coles");

    // Prime the pacing clock with one call, then measure the gap before the
    // next resolves under each priority.
    await Promise.all([searchColesProducts("a", "bulk"), vi.runAllTimersAsync()]);

    const interactiveStart = Date.now();
    await Promise.all([searchColesProducts("b", "interactive"), vi.runAllTimersAsync()]);
    const interactiveGap = Date.now() - interactiveStart;

    const bulkStart = Date.now();
    await Promise.all([searchColesProducts("c", "bulk"), vi.runAllTimersAsync()]);
    const bulkGap = Date.now() - bulkStart;

    expect(interactiveGap).toBeLessThan(bulkGap);
    expect(interactiveGap).toBeLessThanOrEqual(2_000);
    expect(bulkGap).toBeGreaterThanOrEqual(6_000);
  });

  it("trips a cooldown after a block, refusing further live fetches without hitting the network again", async () => {
    fetchMock.mockResolvedValue(textResponse(fixture("coles-blocked.html")));
    const { searchColesProducts, ColesBlockedError } = await import("../coles");

    const first = searchColesProducts("salt");
    const firstAssertion = expect(first).rejects.toBeInstanceOf(ColesBlockedError);
    await vi.runAllTimersAsync();
    await firstAssertion;
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockClear();
    const second = searchColesProducts("sugar");
    const secondAssertion = expect(second).rejects.toBeInstanceOf(ColesBlockedError);
    await vi.runAllTimersAsync();
    await secondAssertion;
    // Cooldown short-circuits before ever calling fetch again.
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
