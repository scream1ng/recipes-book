"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { normalizeIngredientName } from "@/lib/units/normalize";
import { pickProductOption } from "@/lib/pricing/storeSelect";
import type { CanonicalUnit, IngredientCategory, ProductOptionSource, Store } from "@/generated/prisma";

export interface CatalogSearchResult {
  id: string;
  name: string;
  category: IngredientCategory;
  canonicalUnit: CanonicalUnit;
  similarity: number;
}

/** Autocomplete over the user's own catalog using pg_trgm similarity. */
export async function searchCatalog(q: string): Promise<CatalogSearchResult[]> {
  const userId = await requireUser();
  const query = q.trim();
  if (!query) return [];

  return prisma.$queryRaw<CatalogSearchResult[]>`
    SELECT id, name, category, "canonicalUnit", similarity(name, ${query}) AS similarity
    FROM "CatalogIngredient"
    WHERE "userId" = ${userId}
      AND (name % ${query} OR name ILIKE ${"%" + query + "%"})
    ORDER BY similarity DESC
    LIMIT 10
  `;
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
export async function refreshProductPrice(productOptionId: string) {
  const userId = await requireUser();

  const option = await prisma.productOption.findFirst({
    where: { id: productOptionId, catalogIngredient: { userId } },
  });
  if (!option) throw new Error("Product option not found");
  if (option.source !== "COLES_SCRAPE") {
    throw new Error("Only Coles-scraped options can be refreshed; edit manual prices directly.");
  }

  const { getCachedColesResults } = await import("@/lib/scrape/coles-cache");
  const results = await getCachedColesResults(userId, option.productName);
  const match = results.find((r) => r.productId === option.colesProductId) ?? results[0];

  if (!match || match.priceCents == null) {
    return prisma.productOption.update({
      where: { id: option.id },
      data: { lastRefreshError: "Could not find a current price for this product." },
    });
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

  return updated;
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

  return option;
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

  revalidatePath("/pantry");
  revalidatePath("/order");
  revalidatePath("/list");
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
    };
  });

  return rows.reduce<Record<string, PantryIngredientRow[]>>((acc, row) => {
    (acc[row.category] ??= []).push(row);
    return acc;
  }, {});
}
