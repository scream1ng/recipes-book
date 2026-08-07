/**
 * Writes Coles search results (fetched by hand — see list-price-targets.ts
 * for why) into the app's existing 24h DB cache, so the live app's swap
 * sheet / autocomplete / one-tap refresh work off this data instead of
 * hitting Coles live from Railway (still bot-blocked).
 *
 * Input is a JSON array of { query, html } pairs — html is the raw page
 * source of https://www.coles.com.au/search/products?q=<query>, run through
 * the app's own tested __NEXT_DATA__ parser so nothing is hand-transcribed.
 *
 * Usage: npm run seed-coles-cache <pages.json>
 */
import { readFileSync } from "node:fs";
import { PrismaClient } from "../src/generated/prisma";
import { extractNextData, mapToColesProducts, normalizeQueryKey } from "../src/lib/scrape/coles-next-data";

const prisma = new PrismaClient();

// Comfortably longer than the daily seeding cadence, so the cache stays warm
// between runs (see coles-cache.ts's own 24h CACHE_TTL_MS for the live-fetch
// equivalent). Exported so list-price-targets.ts can report a seeded row as
// "fresh" using the same window this script writes.
export const SEED_TTL_MS = 48 * 60 * 60 * 1000;

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: npm run seed-coles-cache <pages.json>");
    process.exit(1);
  }

  const pages: { query: string; html: string }[] = JSON.parse(readFileSync(filePath, "utf-8"));
  const now = new Date();

  for (const page of pages) {
    const queryKey = normalizeQueryKey(page.query);
    const data = extractNextData(page.html);
    if (!data) {
      console.log(`${page.query}: no __NEXT_DATA__ found, skipped`);
      continue;
    }
    const products = mapToColesProducts(data);
    await prisma.colesSearchCache.upsert({
      where: { queryKey },
      create: {
        queryKey,
        resultsJson: JSON.stringify(products),
        fetchedAt: now,
        expiresAt: new Date(now.getTime() + SEED_TTL_MS),
      },
      update: {
        resultsJson: JSON.stringify(products),
        fetchedAt: now,
        expiresAt: new Date(now.getTime() + SEED_TTL_MS),
      },
    });
    console.log(`${page.query}: seeded ${products.length} product(s)`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
