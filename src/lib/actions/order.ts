"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { lineCostCents, scaleQty, costPerServe } from "@/lib/pricing/cost";
import { computePackCount } from "@/lib/pricing/packs";
import { pickProductOption } from "@/lib/pricing/storeSelect";

// ---------- setOrderQty ----------

export async function setOrderQty(recipeId: string, qty: number) {
  const userId = await requireUser();
  const recipe = await prisma.recipe.findFirst({ where: { id: recipeId, userId } });
  if (!recipe) throw new Error("Recipe not found");

  const clamped = Math.max(0, Math.trunc(qty));
  await prisma.recipe.update({ where: { id: recipeId }, data: { orderQty: clamped } });

  revalidatePath("/order");
  revalidatePath("/list");
}

// ---------- clearOrder ----------

export async function clearOrder() {
  const userId = await requireUser();
  await prisma.recipe.updateMany({ where: { userId }, data: { orderQty: 0 } });

  revalidatePath("/order");
  revalidatePath("/list");
}

// ---------- getOrder ----------

/** Recipes currently on the order (orderQty > 0), for the order-screen summary. */
export async function getOrder() {
  const userId = await requireUser();

  const recipes = await prisma.recipe.findMany({
    where: { userId, orderQty: { gt: 0 } },
    include: {
      ingredients: { include: { catalogIngredient: { include: { selectedProductOption: true } } } },
    },
    orderBy: { name: "asc" },
  });

  let aggregateCents = 0;
  const rows = recipes.map((recipe) => {
    let totalCents = 0;
    for (const ing of recipe.ingredients) {
      const option = ing.catalogIngredient?.selectedProductOption;
      if (ing.qtyCanonical != null && option && !ing.excludeFromCost) {
        totalCents += lineCostCents(ing.qtyCanonical, { packQty: option.packQty, priceCents: option.priceCents });
      }
    }
    aggregateCents += totalCents * recipe.orderQty;

    return {
      id: recipe.id,
      name: recipe.name,
      orderQty: recipe.orderQty,
      perSliceCents: costPerServe(totalCents, recipe.baseServes),
    };
  });

  const cakeCount = rows.reduce((sum, r) => sum + r.orderQty, 0);

  return { recipes: rows, recipeCount: rows.length, cakeCount, aggregateCents };
}

// ---------- getOrderIngredientList ----------

/**
 * Derived shopping list: for every recipe on the order, aggregate ingredient
 * needs (qtyCanonical * orderQty) across recipes by catalog ingredient, then
 * round up to whole packs, then exclude on-hand ingredients.
 */
export async function getOrderIngredientList() {
  const userId = await requireUser();
  const settings = await prisma.userSettings.findUniqueOrThrow({ where: { userId } });

  const recipes = await prisma.recipe.findMany({
    where: { userId, orderQty: { gt: 0 } },
    include: { ingredients: true },
  });

  const totals = new Map<string, number>();
  for (const recipe of recipes) {
    for (const ing of recipe.ingredients) {
      if (!ing.catalogIngredientId || ing.qtyCanonical == null) continue;
      const needed = scaleQty(ing.qtyCanonical, 1, recipe.orderQty);
      totals.set(ing.catalogIngredientId, (totals.get(ing.catalogIngredientId) ?? 0) + needed);
    }
  }

  if (totals.size === 0) {
    return { grouped: {} as Record<string, OrderIngredientRow[]>, totalCents: 0 };
  }

  const catalogIngredients = await prisma.catalogIngredient.findMany({
    where: { id: { in: [...totals.keys()] }, userId },
    include: { productOptions: { where: { isArchived: false } }, selectedProductOption: true },
  });

  const rows: OrderIngredientRow[] = catalogIngredients
    .filter((ci) => !ci.onHand)
    .map((ci) => {
      const qtyCanonical = totals.get(ci.id)!;
      const option = pickProductOption(ci, settings.storePreference);
      const pack = option ? computePackCount(qtyCanonical, option, settings.roundUpPartPacks) : null;

      return {
        catalogIngredientId: ci.id,
        label: ci.name,
        category: ci.category,
        qtyCanonical,
        store: option?.store ?? null,
        packLabel: option?.packLabel ?? null,
        packsToBuy: pack?.packsToBuy ?? null,
        totalCents: pack?.totalCents ?? 0,
        priceUpdatedAt: option?.priceUpdatedAt ?? null,
        lowConfidence: option?.lowConfidence ?? false,
      };
    });

  const grouped = rows.reduce<Record<string, OrderIngredientRow[]>>((acc, row) => {
    (acc[row.category] ??= []).push(row);
    return acc;
  }, {});

  const totalCents = rows.reduce((sum, r) => sum + r.totalCents, 0);
  return { grouped, totalCents };
}

export interface OrderIngredientRow {
  catalogIngredientId: string;
  label: string;
  category: string;
  qtyCanonical: number;
  store: string | null;
  packLabel: string | null;
  packsToBuy: number | null;
  totalCents: number;
  priceUpdatedAt: Date | null;
  lowConfidence: boolean;
}
