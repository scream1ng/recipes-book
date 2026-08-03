"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { normalizeIngredientName } from "@/lib/units/normalize";
import { pickProductOption } from "@/lib/pricing/storeSelect";
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
  opts: { maxAgeMs?: number; revalidate: boolean }
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
  const results = await getCachedColesResults(userId, option.catalogIngredient.name, {
    maxAgeMs: opts.maxAgeMs,
  });
  const match = option.colesProductId
    ? (results.find((r) => r.productId === option.colesProductId) ?? results[0])
    : results[0];

  if (opts.revalidate) {
    revalidatePath("/pantry");
    revalidatePath("/order");
    revalidatePath("/list");
  }

  if (!match || match.priceCents == null) {
    const failed = await prisma.productOption.update({
      where: { id: option.id },
      data: { lastRefreshError: "Could not find a current price for this product." },
    });
    return { ok: false as const, option: failed };
  }

  const updated = await prisma.productOption.update({
    where: { id: option.id },
    data: {
      priceCents: match.priceCents,
      priceUpdatedAt: new Date(),
      lastRefreshError: null,
    },
  });

  await prisma.priceSnapshot.create({
    data: { productOptionId: option.id, priceCents: match.priceCents },
  });

  return { ok: true as const, option: updated };
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
  });
  return result.option;
}

/**
 * Bulk-refresh variant used by the "Refresh prices" run: uses the default 24h cache
 * (no bypass — repeat runs of the same ingredient name are mostly free), skips the
 * per-call revalidatePath (the client refreshes once at the end of the run), and
 * never throws — a bad item must not abort the rest of the queue.
 */
export async function bulkRefreshItem(
  productOptionId: string
): Promise<{ ok: true; priceCents: number } | { ok: false; reason: string }> {
  const userId = await requireUser();

  const { checkColesBulkRefreshRateLimit } = await import("@/lib/ratelimit");
  if (!checkColesBulkRefreshRateLimit(userId)) {
    return { ok: false, reason: "Rate limited" };
  }

  try {
    const result = await refreshProductPriceCore(userId, productOptionId, { revalidate: false });
    return result.ok
      ? { ok: true, priceCents: result.option.priceCents }
      : { ok: false, reason: result.option.lastRefreshError ?? "Not found" };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "Failed" };
  }
}

export interface BulkRefreshTarget {
  catalogIngredientId: string;
  name: string;
  productOptionId: string;
}

/** Ingredients eligible for a bulk refresh run: stale or errored Coles-sourced prices only. */
export async function getBulkRefreshTargets(): Promise<BulkRefreshTarget[]> {
  const userId = await requireUser();

  const { checkColesBulkRunRateLimit } = await import("@/lib/ratelimit");
  if (!checkColesBulkRunRateLimit(userId)) {
    throw new Error("Bulk refresh was run recently — try again later.");
  }

  const [settings, grouped] = await Promise.all([
    prisma.userSettings.findUniqueOrThrow({ where: { userId } }),
    getPantryIngredients(),
  ]);
  const rows = Object.values(grouped).flat();

  const { selectBulkRefreshTargets } = await import("@/lib/pricing/bulkRefresh");
  return selectBulkRefreshTargets(rows, settings.stalePriceHours).map((row) => ({
    catalogIngredientId: row.id,
    name: row.name,
    productOptionId: row.productOptionId as string,
  }));
}

export interface AddColesProductInput {
  catalogIngredientId: string;
  productName: string;
  packLabel: string;
  packQty: number;
  priceCents: number;
  colesProductId?: string | null;
  sourceUrl?: string | null;
}

/** Materializes a live Coles search result (from the swap sheet) into a stored ProductOption and selects it. */
export async function addColesProductAsOption(input: AddColesProductInput) {
  const userId = await requireUser();
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
    },
  });

  await prisma.priceSnapshot.create({
    data: { productOptionId: option.id, priceCents: option.priceCents },
  });

  await prisma.catalogIngredient.update({
    where: { id: catalogIngredient.id },
    data: { selectedProductOptionId: option.id },
  });

  revalidatePricePaths();

  return option;
}

/**
 * One-tap Coles fetch for an ingredient with no priced option yet. Auto-materializes
 * the result only when there's a single unambiguous candidate; otherwise leaves it to
 * the swap sheet so the user picks (multiple pack sizes/products for a vague name).
 */
export async function fetchColesPriceForIngredient(catalogIngredientId: string) {
  const userId = await requireUser();

  const { checkColesRefreshRateLimit } = await import("@/lib/ratelimit");
  if (!checkColesRefreshRateLimit(userId)) {
    throw new Error("Too many price refreshes — try again in a moment.");
  }

  const catalogIngredient = await prisma.catalogIngredient.findFirst({
    where: { id: catalogIngredientId, userId },
  });
  if (!catalogIngredient) throw new Error("Catalog ingredient not found");

  const { getCachedColesResults } = await import("@/lib/scrape/coles-cache");
  const results = await getCachedColesResults(userId, catalogIngredient.name);
  const priced = results.filter((r) => r.priceCents != null && r.packQty != null && r.packQty > 0);

  if (priced.length !== 1) {
    return { ok: false as const, reason: priced.length === 0 ? "not_found" : "ambiguous" };
  }

  const match = priced[0];
  const option = await addColesProductAsOption({
    catalogIngredientId,
    productName: match.name,
    packLabel: match.packLabel,
    packQty: match.packQty as number,
    priceCents: match.priceCents as number,
    colesProductId: match.productId,
    sourceUrl: match.productUrl,
  });

  return { ok: true as const, option };
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
    };
  });

  return rows.reduce<Record<string, PantryIngredientRow[]>>((acc, row) => {
    (acc[row.category] ??= []).push(row);
    return acc;
  }, {});
}
