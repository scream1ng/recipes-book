"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { computePackCount } from "@/lib/pricing/packs";
import { getOrderIngredientList } from "@/lib/actions/order";

export interface ShoppingListRow {
  id: string;
  kind: "derived" | "manual";
  catalogIngredientId: string | null;
  label: string;
  category: string;
  store: string | null;
  packLabel: string | null;
  packsToBuy: number | null;
  totalCents: number;
  isChecked: boolean;
  lowConfidence: boolean;
}

// ---------- getShoppingList ----------

/**
 * The shopping list's contents are derived from the order (see
 * getOrderIngredientList). ShoppingListItem rows now hold only tick state
 * (for derived lines) plus any manual one-off items.
 */
export async function getShoppingList() {
  const userId = await requireUser();
  const settings = await prisma.userSettings.findUniqueOrThrow({ where: { userId } });
  const { grouped: derivedGrouped } = await getOrderIngredientList();

  const listItems = await prisma.shoppingListItem.findMany({
    where: { userId },
    include: { productOption: true },
  });
  const tickByIngredient = new Map(
    listItems.filter((i) => i.catalogIngredientId).map((i) => [i.catalogIngredientId as string, i])
  );
  const manualItems = listItems.filter((i) => !i.catalogIngredientId);

  const grouped: Record<string, ShoppingListRow[]> = {};
  for (const [category, rows] of Object.entries(derivedGrouped)) {
    grouped[category] = rows.map((r) => {
      const tick = tickByIngredient.get(r.catalogIngredientId);
      return {
        id: tick?.id ?? r.catalogIngredientId,
        kind: "derived" as const,
        catalogIngredientId: r.catalogIngredientId,
        label: r.label,
        category,
        store: r.store,
        packLabel: r.packLabel,
        packsToBuy: r.packsToBuy,
        totalCents: r.totalCents,
        isChecked: tick?.isChecked ?? false,
        lowConfidence: r.lowConfidence,
      };
    });
  }

  if (manualItems.length > 0) {
    grouped.MANUAL = manualItems.map((item) => {
      const option = item.productOption;
      const pack =
        option && item.qtyCanonical != null
          ? computePackCount(item.qtyCanonical, option, settings.roundUpPartPacks)
          : null;
      return {
        id: item.id,
        kind: "manual" as const,
        catalogIngredientId: null,
        label: item.manualLabel ?? "Item",
        category: "MANUAL",
        store: option?.store ?? null,
        packLabel: option?.packLabel ?? null,
        packsToBuy: pack?.packsToBuy ?? null,
        totalCents: pack?.totalCents ?? 0,
        isChecked: item.isChecked,
        lowConfidence: option?.lowConfidence ?? false,
      };
    });
  }

  const allRows = Object.values(grouped).flat();
  const basketTotalCents = allRows.reduce((sum, r) => sum + r.totalCents, 0);
  const leftToBuyTotalCents = allRows
    .filter((r) => !r.isChecked)
    .reduce((sum, r) => sum + r.totalCents, 0);

  return { grouped, basketTotalCents, leftToBuyTotalCents };
}

// ---------- tick-state mutations ----------

/** Toggles the checked state of a derived (recipe-sourced) line, keyed by catalog ingredient. */
export async function toggleDerivedListItem(catalogIngredientId: string) {
  const userId = await requireUser();
  const existing = await prisma.shoppingListItem.findUnique({
    where: { userId_catalogIngredientId: { userId, catalogIngredientId } },
  });

  if (existing) {
    await prisma.shoppingListItem.update({
      where: { id: existing.id },
      data: { isChecked: !existing.isChecked },
    });
  } else {
    const ingredient = await prisma.catalogIngredient.findFirst({
      where: { id: catalogIngredientId, userId },
    });
    if (!ingredient) return;
    await prisma.shoppingListItem.create({
      data: { userId, catalogIngredientId, isChecked: true },
    });
  }

  revalidatePath("/list");
}

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

  if (productOptionId) {
    const option = await prisma.productOption.findFirst({
      where: { id: productOptionId, catalogIngredient: { userId } },
    });
    if (!option) throw new Error("Product option not found");
  }

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
