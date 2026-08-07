"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { normalizeIngredientName } from "@/lib/units/normalize";
import { pickProductOption } from "@/lib/pricing/storeSelect";
import type { PriceRunTarget } from "@/lib/pricing/bulkRefresh";
import type { CanonicalUnit, IngredientCategory, ProductOptionSource, Store } from "@/generated/prisma";

function revalidatePricePaths() {
  revalidatePath("/pantry");
  revalidatePath("/order");
  revalidatePath("/list");
}

export interface UpsertProductOptionInput {
  id?: string; // update if provided, else create
  catalogIngredientId: string;
  store: Store;
  productName: string;
  packLabel: string;
  packQty: number;
  priceCents: number;
  sourceUrl?: string;
  colesProductId?: string;
  setAsSelected?: boolean;
}

/** Manual price entry — the only path for Woolworths, and for correcting Coles prices. */
export async function upsertProductOption(input: UpsertProductOptionInput) {
  const userId = await requireUser();

  const catalogIngredient = await prisma.catalogIngredient.findFirst({
    where: { id: input.catalogIngredientId, userId },
  });
  if (!catalogIngredient) throw new Error("Catalog ingredient not found");
  if (input.packQty <= 0) throw new Error("packQty must be positive");

  const source: ProductOptionSource = "MANUAL";

  const option = input.id
    ? await prisma.productOption.update({
        where: { id: input.id },
        data: {
          store: input.store,
          productName: input.productName,
          packLabel: input.packLabel,
          packQty: input.packQty,
          priceCents: input.priceCents,
          source,
          sourceUrl: input.sourceUrl,
          colesProductId: input.colesProductId,
          priceUpdatedAt: new Date(),
        },
      })
    : await prisma.productOption.create({
        data: {
          catalogIngredientId: input.catalogIngredientId,
          store: input.store,
          productName: input.productName,
          packLabel: input.packLabel,
          packQty: input.packQty,
          priceCents: input.priceCents,
          source,
          sourceUrl: input.sourceUrl,
          colesProductId: input.colesProductId,
        },
      });

  await prisma.priceSnapshot.create({
    data: { productOptionId: option.id, priceCents: option.priceCents },
  });

  if (input.setAsSelected) {
    await prisma.catalogIngredient.update({
      where: { id: catalogIngredient.id },
      data: { selectedProductOptionId: option.id },
    });
  }

  revalidatePricePaths();

  return option;
}

export interface ConversionFactorsInput {
  gramsPerCount?: number | null;
  mlPerCount?: number | null;
  gramsPerMl?: number | null;
  gramsPerBunch?: number | null;
}

export async function setCatalogConversion(id: string, factors: ConversionFactorsInput) {
  const userId = await requireUser();
  const existing = await prisma.catalogIngredient.findFirst({ where: { id, userId } });
  if (!existing) throw new Error("Catalog ingredient not found");

  return prisma.catalogIngredient.update({
    where: { id },
    data: factors,
  });
}

export interface CreateCatalogIngredientInput {
  name: string;
  category: IngredientCategory;
  canonicalUnit: CanonicalUnit;
  isPantryStaple?: boolean;
}

/** Finds an existing catalog ingredient by normalized name, or creates one. */
export async function findOrCreateCatalogIngredient(input: CreateCatalogIngredientInput) {
  const userId = await requireUser();
  const normalizedName = normalizeIngredientName(input.name);

  const existing = await prisma.catalogIngredient.findUnique({
    where: { userId_normalizedName: { userId, normalizedName } },
  });
  if (existing) return existing;

  return prisma.catalogIngredient.create({
    data: {
      userId,
      name: input.name.trim(),
      normalizedName,
      category: input.category,
      canonicalUnit: input.canonicalUnit,
      isPantryStaple: input.isPantryStaple ?? false,
    },
  });
}

/**
 * Re-scrapes a single Coles-sourced product's price and records a snapshot.
 * Never touches MANUAL-source options (Woolworths / user overrides), per spec.
 */
const REFRESH_CACHE_MAX_AGE_MS = 60 * 60 * 1000; // 1h: user-tapped refresh tolerates an hour-old cache

async function refreshProductPriceCore(
  userId: string,
  productOptionId: string,
  opts: { maxAgeMs?: number; revalidate: boolean; priority?: "bulk" | "interactive" }
) {
  const option = await prisma.productOption.findFirst({
    where: { id: productOptionId, catalogIngredient: { userId } },
    include: { catalogIngredient: true },
  });
  if (!option) throw new Error("Product option not found");
  if (option.source !== "COLES_SCRAPE") {
    throw new Error("Only Coles-scraped options can be refreshed; edit manual prices directly.");
  }

  const { getCachedColesResults } = await import("@/lib/scrape/coles-cache");
  const { products: results, cached, error, stale } = await getCachedColesResults(
    userId,
    option.catalogIngredient.name,
    { maxAgeMs: opts.maxAgeMs, priority: opts.priority ?? "bulk" }
  );
  // Match by Coles product id only — picking an arbitrary result[0] among
  // possibly dozens of unrelated candidates (e.g. "cream" matches lotion,
  // frosting, ice cream) would silently write a wrong price/pack into cost
  // math. No id to match against means we can't safely refresh this option.
  const match = option.colesProductId
    ? results.find((r) => r.productId === option.colesProductId)
    : undefined;

  if (opts.revalidate) {
    revalidatePath("/pantry");
    revalidatePath("/order");
    revalidatePath("/list");
  }

  if (!match || match.priceCents == null) {
    const failed = await prisma.productOption.update({
      where: { id: option.id },
      data: {
        lastRefreshError: !option.colesProductId
          ? "Can't auto-refresh this one — re-pick it from Coles to enable refresh."
          : error
            ? "Coles isn't responding right now — showing the last known price."
            : "Could not find a current price for this product.",
      },
    });
    return { ok: false as const, option: failed, cached, error };
  }

  const updated = await prisma.productOption.update({
    where: { id: option.id },
    data: {
      productName: match.name,
      packLabel: match.packLabel || option.packLabel,
      packQty: match.packQty ?? option.packQty,
      priceCents: match.priceCents,
      // A stale-cache-served price isn't actually fresh — don't stamp it as
      // just-refreshed, or the staleness badge goes silently wrong.
      priceUpdatedAt: stale ? option.priceUpdatedAt : new Date(),
      lastRefreshError: null,
    },
  });

  await prisma.priceSnapshot.create({
    data: { productOptionId: option.id, priceCents: match.priceCents },
  });

  return { ok: true as const, option: updated, cached, error: false };
}

/**
 * Re-scrapes a single Coles-sourced product's price and records a snapshot.
 * Never touches MANUAL-source options (Woolworths / user overrides), per spec.
 */
export async function refreshProductPrice(productOptionId: string) {
  const userId = await requireUser();

  const { checkColesRefreshRateLimit } = await import("@/lib/ratelimit");
  if (!checkColesRefreshRateLimit(userId)) {
    throw new Error("Too many price refreshes — try again in a moment.");
  }

  const result = await refreshProductPriceCore(userId, productOptionId, {
    maxAgeMs: REFRESH_CACHE_MAX_AGE_MS,
    revalidate: true,
    priority: "interactive",
  });
  return result.option;
}

export interface AddColesProductInput {
  catalogIngredientId: string;
  productName: string;
  packLabel: string;
  packQty: number;
  priceCents: number;
  colesProductId?: string | null;
  sourceUrl?: string | null;
  lowConfidence?: boolean;
}

async function addColesProductAsOptionCore(
  userId: string,
  input: AddColesProductInput,
  opts: { revalidate: boolean }
) {
  const catalogIngredient = await prisma.catalogIngredient.findFirst({
    where: { id: input.catalogIngredientId, userId },
  });
  if (!catalogIngredient) throw new Error("Catalog ingredient not found");
  if (input.packQty <= 0) throw new Error("packQty must be positive");

  const option = await prisma.productOption.create({
    data: {
      catalogIngredientId: input.catalogIngredientId,
      store: "COLES",
      productName: input.productName,
      packLabel: input.packLabel,
      packQty: input.packQty,
      priceCents: input.priceCents,
      source: "COLES_SCRAPE",
      colesProductId: input.colesProductId ?? undefined,
      sourceUrl: input.sourceUrl ?? undefined,
      lowConfidence: input.lowConfidence ?? false,
    },
  });

  await prisma.priceSnapshot.create({
    data: { productOptionId: option.id, priceCents: option.priceCents },
  });

  await prisma.catalogIngredient.update({
    where: { id: catalogIngredient.id },
    data: { selectedProductOptionId: option.id },
  });

  if (opts.revalidate) revalidatePricePaths();

  return option;
}

/** Materializes a live Coles search result (from the swap sheet) into a stored ProductOption and selects it. */
export async function addColesProductAsOption(input: AddColesProductInput) {
  const userId = await requireUser();
  return addColesProductAsOptionCore(userId, input, { revalidate: true });
}

/**
 * Ingredients eligible for the "Update prices" run: unpriced ingredients (discover)
 * plus stale/errored Coles-sourced prices (refresh). Rate-limits starting a run, but
 * only once the target list is known non-empty — an empty run shouldn't cost a token.
 */
export async function getPriceRunTargets(): Promise<PriceRunTarget[]> {
  const userId = await requireUser();

  const [settings, grouped] = await Promise.all([
    prisma.userSettings.findUniqueOrThrow({ where: { userId } }),
    getPantryIngredients(),
  ]);
  const rows = Object.values(grouped).flat();

  const { selectPriceRunTargets } = await import("@/lib/pricing/bulkRefresh");
  const targets = selectPriceRunTargets(rows, settings.stalePriceHours);
  if (targets.length === 0) return targets;

  const { checkColesBulkRunRateLimit } = await import("@/lib/ratelimit");
  if (!checkColesBulkRunRateLimit(userId)) {
    throw new Error("Price update was run recently — try again later.");
  }

  return targets;
}

/**
 * Runs one item of an "Update prices" run: refreshes an existing Coles price, or
 * discovers + materializes one for an unpriced ingredient using the best-match Coles
 * result. Uses the default 24h cache (repeat runs of the same name are mostly free),
 * skips the per-call revalidatePath (the client refreshes once at the end of the
 * run), and never throws — a bad item must not abort the rest of the queue.
 */
export async function runPriceItem(
  target: PriceRunTarget
): Promise<
  | { ok: true; kind: "discover" | "refresh"; cached: boolean }
  // apiFailure: true means Coles/the scraper genuinely didn't respond (rate limit,
  // exception, zero search results, a known-product refresh that came back empty) —
  // a real signal something's wrong. false means Coles responded with real data but
  // no confident match was found for this ingredient — expected for odd/home-made
  // ingredient names, not a sign anything's broken.
  | { ok: false; kind: "discover" | "refresh"; reason: string; cached: boolean; apiFailure: boolean }
> {
  const userId = await requireUser();

  const { checkColesBulkRefreshRateLimit } = await import("@/lib/ratelimit");
  if (!checkColesBulkRefreshRateLimit(userId)) {
    // Our own pacing limit, not a Coles outage — don't count it toward the
    // "Coles isn't responding" breaker.
    return {
      ok: false,
      kind: target.kind,
      reason: "Slowing down to avoid Coles' bot defense — try again shortly.",
      cached: false,
      apiFailure: false,
    };
  }

  try {
    if (target.kind === "refresh") {
      const result = await refreshProductPriceCore(userId, target.productOptionId as string, {
        revalidate: false,
      });
      return result.ok
        ? { ok: true, kind: "refresh", cached: result.cached }
        : {
            ok: false,
            kind: "refresh",
            reason: result.option.lastRefreshError ?? "Not found",
            cached: result.cached,
            apiFailure: result.error,
          };
    }

    const { getCachedColesResults } = await import("@/lib/scrape/coles-cache");
    const { products, cached, error } = await getCachedColesResults(userId, target.name);
    if (products.length === 0) {
      // A cached or live "genuinely zero results" isn't an outage signal — only
      // a real scrape/parse throw should count toward the breaker.
      return { ok: false, kind: "discover", reason: "not_found", cached, apiFailure: error };
    }

    const { pickRecommendedColesProduct } = await import("@/lib/pricing/recommend");
    const recommended = pickRecommendedColesProduct(target.name, products);
    if (!recommended) {
      return { ok: false, kind: "discover", reason: "not_found", cached, apiFailure: false };
    }
    const match = recommended.product;

    await addColesProductAsOptionCore(
      userId,
      {
        catalogIngredientId: target.catalogIngredientId,
        productName: match.name,
        packLabel: match.packLabel,
        packQty: match.packQty as number,
        priceCents: match.priceCents as number,
        colesProductId: match.productId,
        sourceUrl: match.productUrl,
        lowConfidence: recommended.confidence === "low",
      },
      { revalidate: false }
    );
    return { ok: true, kind: "discover", cached };
  } catch (err) {
    return {
      ok: false,
      kind: target.kind,
      reason: err instanceof Error ? err.message : "Failed",
      cached: false,
      apiFailure: true,
    };
  }
}

// ---------- onHand (Pantry) ----------

export async function toggleOnHand(catalogIngredientId: string) {
  const userId = await requireUser();
  const existing = await prisma.catalogIngredient.findFirst({
    where: { id: catalogIngredientId, userId },
  });
  if (!existing) throw new Error("Catalog ingredient not found");

  await prisma.catalogIngredient.update({
    where: { id: catalogIngredientId },
    data: { onHand: !existing.onHand },
  });

  revalidatePricePaths();
}

export async function deleteCatalogIngredient(catalogIngredientId: string) {
  const userId = await requireUser();
  const existing = await prisma.catalogIngredient.findFirst({
    where: { id: catalogIngredientId, userId },
  });
  if (!existing) throw new Error("Catalog ingredient not found");

  const usedIn = await prisma.recipeIngredient.findMany({
    where: { catalogIngredientId },
    select: { recipe: { select: { name: true } } },
    distinct: ["recipeId"],
  });
  if (usedIn.length > 0) {
    const names = usedIn.map((r) => r.recipe.name).join(", ");
    throw new Error(`Used in ${names}. Remove it from those recipes first.`);
  }

  await prisma.catalogIngredient.delete({ where: { id: catalogIngredientId } });

  revalidatePricePaths();
}

export interface PantryIngredientRow {
  id: string;
  name: string;
  category: IngredientCategory;
  onHand: boolean;
  store: Store | null;
  priceCents: number | null;
  packLabel: string | null;
  priceUpdatedAt: Date | null;
  productOptionId: string | null;
  source: ProductOptionSource | null;
  lastRefreshError: string | null;
  lowConfidence: boolean;
}

/** All of the user's catalog ingredients, grouped by category, for the Pantry screen. */
export async function getPantryIngredients(): Promise<Record<string, PantryIngredientRow[]>> {
  const userId = await requireUser();
  const settings = await prisma.userSettings.findUniqueOrThrow({ where: { userId } });

  const ingredients = await prisma.catalogIngredient.findMany({
    where: { userId },
    include: { productOptions: { where: { isArchived: false } }, selectedProductOption: true },
    orderBy: { name: "asc" },
  });

  const rows: PantryIngredientRow[] = ingredients.map((ci) => {
    const option = pickProductOption(ci, settings.storePreference);
    return {
      id: ci.id,
      name: ci.name,
      category: ci.category,
      onHand: ci.onHand,
      store: option?.store ?? null,
      priceCents: option?.priceCents ?? null,
      packLabel: option?.packLabel ?? null,
      priceUpdatedAt: option?.priceUpdatedAt ?? null,
      productOptionId: option?.id ?? null,
      source: option?.source ?? null,
      lastRefreshError: option?.lastRefreshError ?? null,
      lowConfidence: option?.lowConfidence ?? false,
    };
  });

  return rows.reduce<Record<string, PantryIngredientRow[]>>((acc, row) => {
    (acc[row.category] ??= []).push(row);
    return acc;
  }, {});
}
