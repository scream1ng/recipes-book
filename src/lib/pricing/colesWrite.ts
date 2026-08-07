import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";

// Deliberately NOT a "use server" file. These take `userId` as a plain
// argument with no session check — ownership is scoped to whatever userId
// is passed in, trusted entirely to the caller. A "use server" file exports
// every top-level async function as a network-reachable Server Action, so
// living there would make these two directly callable with an arbitrary
// userId, bypassing auth. Callers (the thin wrappers in actions/catalog.ts,
// and scripts/apply-coles-prices.ts) are responsible for authenticating
// first — see requireUser() in the former.

export const REFRESH_CACHE_MAX_AGE_MS = 60 * 60 * 1000; // 1h: user-tapped refresh tolerates an hour-old cache

/**
 * Re-scrapes a single Coles-sourced product's price and records a snapshot.
 * Never touches MANUAL-source options (Woolworths / user overrides), per spec.
 */
export async function refreshProductPriceCore(
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

export async function addColesProductAsOptionCore(
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

  if (opts.revalidate) {
    revalidatePath("/pantry");
    revalidatePath("/order");
    revalidatePath("/list");
  }

  return option;
}
