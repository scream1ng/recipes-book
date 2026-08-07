import { z } from "zod";
import type { ColesProduct } from "@/lib/gemini/schemas";

// Pure — no "server-only" import. Coles search pages ship a `__NEXT_DATA__`
// script tag with fully structured product/pricing JSON; parsing that
// directly is deterministic and doesn't need Gemini. This is undocumented,
// unversioned Next.js internals, so every field we read is validated below —
// shape drift must fail loudly (thrown error) rather than silently return
// wrong or empty data.

const nextDataResultSchema = z
  .object({
    id: z.union([z.number(), z.string()]),
    name: z.string(),
    brand: z.string().nullable().optional(),
    size: z.string().nullable().optional(),
    availability: z.boolean(),
    pricing: z
      .object({
        now: z.number().nullable().optional(),
        unit: z
          .object({
            price: z.number().nullable().optional(),
            ofMeasureQuantity: z.number().nullable().optional(),
            ofMeasureUnits: z.string().nullable().optional(),
          })
          .passthrough()
          .nullable()
          .optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
  })
  .passthrough();

const nextDataSchema = z
  .object({
    props: z
      .object({
        pageProps: z
          .object({
            searchResults: z
              .object({
                results: z.array(nextDataResultSchema),
              })
              .passthrough(),
          })
          .passthrough(),
      })
      .passthrough(),
  })
  .passthrough();

const NEXT_DATA_RE = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/;

/** Extracts and validates the `__NEXT_DATA__` payload from a Coles page. Returns
 *  null only when the script tag itself is absent (not present on this page /
 *  blocked page) — a present-but-malformed payload throws, since that means
 *  Coles' internal shape drifted and silently returning nothing would look
 *  identical to "no results". */
export function extractNextData(html: string): z.infer<typeof nextDataSchema> | null {
  const match = NEXT_DATA_RE.exec(html);
  if (!match) return null;

  const parsed = JSON.parse(match[1]);
  const result = nextDataSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`__NEXT_DATA__ shape drifted: ${result.error.message}`);
  }
  return result.data;
}

/** Converts a Coles pack-size string to grams (mass) or ml (volume). Returns
 *  null for anything not a plain single-unit size (multipacks like "6x25g",
 *  "each", "per kg", missing) — callers treat null as "can't derive packQty",
 *  same as the existing Gemini-extraction contract. */
export function parseSize(size: string | null | undefined): number | null {
  if (!size) return null;
  const match = /^([\d.]+)\s*(kg|g|l|ml)\b/i.exec(size.trim());
  if (!match) return null;
  const value = parseFloat(match[1]);
  const unit = match[2].toLowerCase();
  if (unit === "kg" || unit === "l") return Math.round(value * 1000);
  return Math.round(value);
}

/** Maps validated `__NEXT_DATA__` search results to the same shape Gemini's
 *  HTML-parse produces, so nothing downstream (matching, cost math) needs to
 *  change. Skips unavailable and zero/missing-price items. */
export function mapToColesProducts(data: z.infer<typeof nextDataSchema>): ColesProduct[] {
  const results = data.props.pageProps.searchResults.results;

  return results
    .filter((r) => r.availability && r.pricing?.now != null && r.pricing.now > 0)
    .map((r) => {
      const priceCents = Math.round(r.pricing!.now! * 100);
      return {
        name: [r.brand, r.name].filter(Boolean).join(" ").trim() || r.name,
        packLabel: r.size ?? "",
        packQty: parseSize(r.size),
        priceCents,
        productUrl: null,
        productId: String(r.id),
      };
    });
}
