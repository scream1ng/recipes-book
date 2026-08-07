import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { extractNextData, mapToColesProducts, parseSize } from "../coles-next-data";

function fixture(name: string): string {
  return readFileSync(join(__dirname, "fixtures", name), "utf8");
}

describe("extractNextData", () => {
  it("parses __NEXT_DATA__ from a real search results page", () => {
    const data = extractNextData(fixture("coles-search-cream.html"));
    expect(data).not.toBeNull();
    expect(data!.props.pageProps.searchResults.results.length).toBeGreaterThan(0);
  });

  it("returns null when the script tag is absent (blocked page)", () => {
    expect(extractNextData(fixture("coles-blocked.html"))).toBeNull();
  });

  it("handles a genuine zero-results page without throwing", () => {
    const data = extractNextData(fixture("coles-search-empty.html"));
    expect(data!.props.pageProps.searchResults.results).toEqual([]);
  });

  it("throws when the payload shape has drifted, rather than silently returning nothing", () => {
    const html = fixture("coles-search-glucose.html");
    const match = /(<script id="__NEXT_DATA__"[^>]*>)([\s\S]*?)(<\/script>)/.exec(html)!;
    const data = JSON.parse(match[2]);
    // Simulate Coles renaming/removing the field our schema depends on.
    data.props.pageProps.searchResults.results[0].availability = "yes"; // was boolean
    const malformed = html.replace(match[2], JSON.stringify(data));
    expect(() => extractNextData(malformed)).toThrow(/shape drifted/);
  });
});

describe("parseSize", () => {
  it.each([
    ["500g", 500],
    ["1kg", 1000],
    ["2L", 2000],
    ["600mL", 600],
    ["1.5kg", 1500],
    ["6x25g", null], // multipack — not a plain single-unit size
    ["each", null],
    ["per kg", null],
    [null, null],
    [undefined, null],
  ])("parseSize(%s) -> %s", (input, expected) => {
    expect(parseSize(input as string | null | undefined)).toBe(expected);
  });
});

describe("mapToColesProducts", () => {
  it("maps real fixture data to ColesProduct shape, skipping unavailable/zero-price items", () => {
    const data = extractNextData(fixture("coles-search-cream.html"))!;
    const products = mapToColesProducts(data);

    expect(products.length).toBeGreaterThan(0);
    for (const p of products) {
      expect(p.priceCents).toBeGreaterThan(0);
      expect(typeof p.name).toBe("string");
      expect(p.name.length).toBeGreaterThan(0);
    }

    const thickenedCream = products.find((p) => p.name.includes("Thickened Cream"));
    expect(thickenedCream).toBeDefined();
    expect(thickenedCream!.packLabel).toBe("600mL");
    expect(thickenedCream!.packQty).toBe(600);
    expect(thickenedCream!.priceCents).toBe(520);
  });

  it("returns an empty array for a genuine zero-results page", () => {
    const data = extractNextData(fixture("coles-search-empty.html"))!;
    expect(mapToColesProducts(data)).toEqual([]);
  });

  it("single-candidate fixture (glucose) maps to exactly one priced product", () => {
    const data = extractNextData(fixture("coles-search-glucose.html"))!;
    const products = mapToColesProducts(data);
    expect(products.length).toBe(1);
    expect(products[0].productId).toBe("4695425");
  });
});
