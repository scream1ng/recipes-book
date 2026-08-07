/**
 * Prints ingredients needing a Coles price (discover) or a refresh (stale/
 * errored) as JSON, across every account, grouped by ingredient name so the
 * same Coles search isn't done twice for two accounts wanting the same
 * thing. See apply-coles-prices.ts for why this isn't scraped automatically
 * (Railway's IP is bot-blocked; even a plain script from a residential IP
 * got the same block after a handful of requests).
 *
 * Each group reports cacheState against ColesSearchCache (shared globally,
 * no userId) — "fresh" means candidates are already sitting in the DB from
 * an earlier seed-coles-cache.ts run and this query needs zero Coles
 * traffic today. "fresh" is not "auto-pick": a cached row can still hold
 * only a bad match (see glucose) — it just means there's something to
 * review without browsing again.
 *
 * Usage:
 *   npm run list-price-targets                       # every account
 *   REFRESH_USER_EMAIL=<email> npm run list-price-targets   # one account
 */
import { PrismaClient } from "../src/generated/prisma";
import { selectPriceRunTargets } from "../src/lib/pricing/bulkRefresh";
import { normalizeQueryKey } from "../src/lib/scrape/coles-next-data";

const prisma = new PrismaClient();

interface Target {
  userEmail: string;
  kind: "discover" | "refresh";
  catalogIngredientId: string;
  productOptionId: string | null;
}

async function main() {
  const userEmail = process.env.REFRESH_USER_EMAIL;
  const users = userEmail
    ? [await prisma.user.findUniqueOrThrow({ where: { email: userEmail } })]
    : await prisma.user.findMany();

  // queryKey -> { query (display form), targets }
  const groups = new Map<string, { query: string; targets: Target[] }>();

  for (const user of users) {
    if (!user.email) continue;
    const settings = await prisma.userSettings.findUniqueOrThrow({ where: { userId: user.id } });

    const ingredients = await prisma.catalogIngredient.findMany({
      where: { userId: user.id },
      include: { selectedProductOption: true },
    });

    const rows = ingredients.map((ing) => ({
      id: ing.id,
      name: ing.name,
      productOptionId: ing.selectedProductOptionId,
      source: ing.selectedProductOption?.source ?? null,
      priceUpdatedAt: ing.selectedProductOption?.priceUpdatedAt ?? null,
      lastRefreshError: ing.selectedProductOption?.lastRefreshError ?? null,
    }));

    const targets = selectPriceRunTargets(rows, settings.stalePriceHours);
    for (const t of targets) {
      const key = normalizeQueryKey(t.name);
      if (!groups.has(key)) groups.set(key, { query: t.name, targets: [] });
      groups.get(key)!.targets.push({
        userEmail: user.email,
        kind: t.kind,
        catalogIngredientId: t.catalogIngredientId,
        productOptionId: t.productOptionId,
      });
    }
  }

  const queryKeys = [...groups.keys()];
  const cacheRows = await prisma.colesSearchCache.findMany({
    where: { queryKey: { in: queryKeys } },
  });
  const cacheByKey = new Map(cacheRows.map((r) => [r.queryKey, r]));
  const now = new Date();

  const result = queryKeys.map((key) => {
    const group = groups.get(key)!;
    const cached = cacheByKey.get(key);
    const cacheState = !cached ? "missing" : cached.expiresAt > now ? "fresh" : "expired";
    let cachedProductCount: number | null = null;
    if (cached) {
      try {
        cachedProductCount = JSON.parse(cached.resultsJson).length;
      } catch {
        // corrupt row — same "fall through" treatment as coles-cache.ts, just
        // report it rather than crash the whole listing over one bad row.
        cachedProductCount = null;
      }
    }
    return {
      query: group.query,
      cacheState,
      cachedProductCount,
      targets: group.targets,
    };
  });

  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
