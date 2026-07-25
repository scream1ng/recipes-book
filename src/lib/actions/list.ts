"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { scaleQty } from "@/lib/pricing/cost";
import { computePackCount } from "@/lib/pricing/packs";

// ---------- addRecipeToList ----------

export async function addRecipeToList(recipeId: string, serves?: number) {
  const userId = await requireUser();

  const recipe = await prisma.recipe.findFirst({
    where: { id: recipeId, userId },
    include: { ingredients: true },
  });
  if (!recipe) throw new Error("Recipe not found");

  const servesUsed = serves ?? recipe.baseServes;

  for (const ing of recipe.ingredients) {
    if (!ing.catalogIngredientId || ing.qtyCanonical == null) continue;

    const qty = scaleQty(ing.qtyCanonical, recipe.baseServes, servesUsed);

    const item = await prisma.shoppingListItem.upsert({
      where: { userId_catalogIngredientId: { userId, catalogIngredientId: ing.catalogIngredientId } },
      create: {
        userId,
        catalogIngredientId: ing.catalogIngredientId,
        qtyCanonical: qty,
      },
      update: {
        qtyCanonical: { increment: qty },
      },
    });

    await prisma.shoppingListContribution.create({
      data: {
        itemId: item.id,
        recipeId: recipe.id,
        recipeName: recipe.name,
        servesUsed,
        qtyCanonical: qty,
      },
    });
  }

  revalidatePath("/list");
}

// ---------- removeRecipeFromList ----------

export async function removeRecipeFromList(recipeId: string) {
  const userId = await requireUser();

  const contributions = await prisma.shoppingListContribution.findMany({
    where: { recipeId, item: { userId } },
    include: { item: true },
  });

  for (const contribution of contributions) {
    await prisma.shoppingListContribution.delete({ where: { id: contribution.id } });

    const remaining = await prisma.shoppingListContribution.aggregate({
      where: { itemId: contribution.itemId },
      _sum: { qtyCanonical: true },
    });

    const remainingQty = remaining._sum.qtyCanonical ?? 0;
    if (remainingQty <= 0) {
      await prisma.shoppingListItem.delete({ where: { id: contribution.itemId } }).catch(() => {});
    } else {
      await prisma.shoppingListItem.update({
        where: { id: contribution.itemId },
        data: { qtyCanonical: remainingQty },
      });
    }
  }

  revalidatePath("/list");
}

// ---------- getShoppingList ----------

export async function getShoppingList() {
  const userId = await requireUser();
  const settings = await prisma.userSettings.findUniqueOrThrow({ where: { userId } });

  const items = await prisma.shoppingListItem.findMany({
    where: { userId },
    include: {
      catalogIngredient: { include: { selectedProductOption: true } },
      productOption: true,
    },
    orderBy: { addedAt: "asc" },
  });

  const rows = items.map((item) => {
    const option = item.productOption ?? item.catalogIngredient?.selectedProductOption ?? null;
    const category = item.catalogIngredient?.category ?? "OTHER";

    const pack =
      option && item.qtyCanonical != null
        ? computePackCount(item.qtyCanonical, option, settings.roundUpPartPacks)
        : null;

    return {
      id: item.id,
      label: item.catalogIngredient?.name ?? item.manualLabel ?? "Item",
      category,
      qtyCanonical: item.qtyCanonical,
      isChecked: item.isChecked,
      store: option?.store ?? null,
      packLabel: option?.packLabel ?? null,
      packsToBuy: pack?.packsToBuy ?? null,
      totalCents: pack?.totalCents ?? 0,
      priceUpdatedAt: option?.priceUpdatedAt ?? null,
    };
  });

  const grouped = rows.reduce<Record<string, typeof rows>>((acc, row) => {
    (acc[row.category] ??= []).push(row);
    return acc;
  }, {});

  const basketTotalCents = rows.reduce((sum, r) => sum + r.totalCents, 0);
  const leftToBuyTotalCents = rows
    .filter((r) => !r.isChecked)
    .reduce((sum, r) => sum + r.totalCents, 0);

  return { grouped, basketTotalCents, leftToBuyTotalCents };
}

// ---------- item mutations ----------

export async function toggleListItem(itemId: string) {
  const userId = await requireUser();
  const item = await prisma.shoppingListItem.findFirst({ where: { id: itemId, userId } });
  if (!item) throw new Error("Item not found");

  await prisma.shoppingListItem.update({
    where: { id: itemId },
    data: { isChecked: !item.isChecked },
  });
  revalidatePath("/list");
}

export async function removeListItem(itemId: string) {
  const userId = await requireUser();
  const item = await prisma.shoppingListItem.findFirst({ where: { id: itemId, userId } });
  if (!item) throw new Error("Item not found");

  await prisma.shoppingListItem.delete({ where: { id: itemId } });
  revalidatePath("/list");
}

export async function addManualListItem(label: string, qtyCanonical?: number, productOptionId?: string) {
  const userId = await requireUser();

  const item = await prisma.shoppingListItem.create({
    data: {
      userId,
      manualLabel: label,
      qtyCanonical: qtyCanonical ?? undefined,
      productOptionId: productOptionId ?? undefined,
    },
  });

  revalidatePath("/list");
  return item;
}

export async function clearCheckedItems() {
  const userId = await requireUser();
  await prisma.shoppingListItem.deleteMany({ where: { userId, isChecked: true } });
  revalidatePath("/list");
}
