"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { lineCostCents, scaleQty, costPerServe } from "@/lib/pricing/cost";
import { findCheaperAlternative } from "@/lib/pricing/savings";
import type { RecipeSourceType } from "@/generated/prisma";

// ---------- listRecipes ----------

export async function listRecipes() {
  const userId = await requireUser();
  const recipes = await prisma.recipe.findMany({
    where: { userId },
    include: {
      ingredients: {
        include: { catalogIngredient: { include: { selectedProductOption: true } } },
      },
    },
    orderBy: { name: "asc" },
  });

  return recipes.map((recipe) => summarizeRecipe(recipe));
}

function summarizeRecipe(recipe: RecipeWithIngredients) {
  const { totalCents } = computeIngredientCosts(recipe.ingredients, recipe.baseServes, recipe.baseServes);
  return {
    id: recipe.id,
    name: recipe.name,
    tag: recipe.tag,
    minutes: recipe.minutes,
    baseServes: recipe.baseServes,
    ingredientCount: recipe.ingredients.length,
    totalCents,
    costPerServeCents: costPerServe(totalCents, recipe.baseServes),
  };
}

// ---------- getRecipe ----------

type RecipeWithIngredients = Awaited<ReturnType<typeof fetchRecipeWithIngredients>>;

async function fetchRecipeWithIngredients(userId: string, id: string) {
  const recipe = await prisma.recipe.findFirst({
    where: { id, userId },
    include: {
      ingredients: {
        orderBy: { sortOrder: "asc" },
        include: { catalogIngredient: { include: { selectedProductOption: true } } },
      },
    },
  });
  if (!recipe) throw new Error("Recipe not found");
  return recipe;
}

function computeIngredientCosts(
  ingredients: RecipeWithIngredients["ingredients"],
  baseServes: number,
  targetServes: number
) {
  let totalCents = 0;
  const lines = ingredients.map((ing) => {
    const scaledQty =
      ing.qtyCanonical != null ? scaleQty(ing.qtyCanonical, baseServes, targetServes) : null;

    const option = ing.catalogIngredient?.selectedProductOption ?? null;
    let costCents: number | null = null;

    if (scaledQty != null && option && !ing.excludeFromCost) {
      costCents = lineCostCents(scaledQty, { packQty: option.packQty, priceCents: option.priceCents });
      totalCents += costCents;
    }

    return { ing, scaledQty, option, costCents };
  });

  return { lines, totalCents };
}

export async function getRecipe(id: string, serves?: number) {
  const userId = await requireUser();
  const recipe = await fetchRecipeWithIngredients(userId, id);
  const targetServes = serves ?? recipe.baseServes;
  const { lines, totalCents } = computeIngredientCosts(recipe.ingredients, recipe.baseServes, targetServes);

  return {
    id: recipe.id,
    name: recipe.name,
    tag: recipe.tag,
    minutes: recipe.minutes,
    baseServes: recipe.baseServes,
    targetServes,
    sourceType: recipe.sourceType,
    totalCents,
    costPerServeCents: costPerServe(totalCents, targetServes),
    ingredients: lines.map(({ ing, scaledQty, option, costCents }) => ({
      id: ing.id,
      displayName: ing.displayName,
      qtyCanonical: scaledQty,
      needsReview: ing.needsReview,
      reviewNote: ing.reviewNote,
      excludeFromCost: ing.excludeFromCost,
      catalogIngredientId: ing.catalogIngredientId,
      canonicalUnit: ing.catalogIngredient?.canonicalUnit ?? null,
      product: option
        ? {
            id: option.id,
            store: option.store,
            productName: option.productName,
            packLabel: option.packLabel,
            priceUpdatedAt: option.priceUpdatedAt,
          }
        : null,
      costCents,
    })),
  };
}

// ---------- createRecipe / saveScannedRecipe ----------

export interface RecipeIngredientDraft {
  catalogIngredientId?: string | null;
  sortOrder: number;
  rawText?: string | null;
  rawAmount?: number | null;
  rawUnit?: string | null;
  displayName: string;
  qtyCanonical?: number | null;
  needsReview?: boolean;
  reviewNote?: string | null;
  excludeFromCost?: boolean;
}

export interface RecipeDraft {
  name: string;
  tag?: string | null;
  minutes?: number | null;
  baseServes: number;
  sourceType: RecipeSourceType;
  ingredients: RecipeIngredientDraft[];
}

export async function createRecipe(draft: RecipeDraft) {
  const userId = await requireUser();

  const recipe = await prisma.recipe.create({
    data: {
      userId,
      name: draft.name,
      tag: draft.tag ?? undefined,
      minutes: draft.minutes ?? undefined,
      baseServes: draft.baseServes,
      sourceType: draft.sourceType,
      ingredients: {
        create: draft.ingredients.map((ing) => ({
          catalogIngredientId: ing.catalogIngredientId ?? undefined,
          sortOrder: ing.sortOrder,
          rawText: ing.rawText ?? undefined,
          rawAmount: ing.rawAmount ?? undefined,
          rawUnit: ing.rawUnit ?? undefined,
          displayName: ing.displayName,
          qtyCanonical: ing.qtyCanonical ?? undefined,
          needsReview: ing.needsReview ?? false,
          reviewNote: ing.reviewNote ?? undefined,
          excludeFromCost: ing.excludeFromCost ?? false,
        })),
      },
    },
  });

  revalidatePath("/recipes");
  return recipe;
}

/** Used by the Review screen to persist a scanned+edited draft as a new recipe. */
export async function saveScannedRecipe(draft: RecipeDraft) {
  return createRecipe({ ...draft, sourceType: "SCAN" });
}

// ---------- updateRecipe / deleteRecipe ----------

export interface UpdateRecipeInput {
  name?: string;
  tag?: string | null;
  minutes?: number | null;
  baseServes?: number;
  ingredients?: RecipeIngredientDraft[];
}

export async function updateRecipe(id: string, input: UpdateRecipeInput) {
  const userId = await requireUser();
  const existing = await prisma.recipe.findFirst({ where: { id, userId } });
  if (!existing) throw new Error("Recipe not found");

  await prisma.$transaction(async (tx) => {
    await tx.recipe.update({
      where: { id },
      data: {
        name: input.name,
        tag: input.tag,
        minutes: input.minutes,
        baseServes: input.baseServes,
      },
    });

    if (input.ingredients) {
      await tx.recipeIngredient.deleteMany({ where: { recipeId: id } });
      await tx.recipeIngredient.createMany({
        data: input.ingredients.map((ing) => ({
          recipeId: id,
          catalogIngredientId: ing.catalogIngredientId ?? undefined,
          sortOrder: ing.sortOrder,
          rawText: ing.rawText ?? undefined,
          rawAmount: ing.rawAmount ?? undefined,
          rawUnit: ing.rawUnit ?? undefined,
          displayName: ing.displayName,
          qtyCanonical: ing.qtyCanonical ?? undefined,
          needsReview: ing.needsReview ?? false,
          reviewNote: ing.reviewNote ?? undefined,
          excludeFromCost: ing.excludeFromCost ?? false,
        })),
      });
    }
  });

  revalidatePath("/recipes");
  revalidatePath(`/recipes/${id}`);
}

export async function deleteRecipe(id: string) {
  const userId = await requireUser();
  const existing = await prisma.recipe.findFirst({ where: { id, userId } });
  if (!existing) throw new Error("Recipe not found");

  await prisma.recipe.delete({ where: { id } });
  revalidatePath("/recipes");
}

// ---------- getCostBreakdown ----------

export async function getCostBreakdown(id: string, serves?: number) {
  const userId = await requireUser();
  const recipe = await fetchRecipeWithIngredients(userId, id);
  const targetServes = serves ?? recipe.baseServes;
  const { lines, totalCents } = computeIngredientCosts(recipe.ingredients, recipe.baseServes, targetServes);

  const items = await Promise.all(
    lines
      .filter((l) => l.costCents != null && l.scaledQty != null)
      .map(async (l) => {
        const catalogIngredientId = l.ing.catalogIngredientId!;
        const currentOption = l.option!;

        const alternatives = await prisma.productOption.findMany({
          where: { catalogIngredientId, isArchived: false, id: { not: currentOption.id } },
        });

        const savings = findCheaperAlternative(
          { packQty: currentOption.packQty, priceCents: currentOption.priceCents },
          alternatives.map((a) => ({ id: a.id, packQty: a.packQty, priceCents: a.priceCents })),
          l.scaledQty!
        );

        return {
          ingredientId: l.ing.id,
          displayName: l.ing.displayName,
          costCents: l.costCents!,
          shareOfTotal: totalCents > 0 ? l.costCents! / totalCents : 0,
          potentialSavingsCents: savings?.totalSavingsCents ?? 0,
          cheaperProductOptionId: savings?.cheapestId ?? null,
        };
      })
  );

  items.sort((a, b) => b.costCents - a.costCents);

  return {
    totalCents,
    costPerServeCents: costPerServe(totalCents, targetServes),
    items,
    totalPotentialSavingsCents: items.reduce((sum, i) => sum + i.potentialSavingsCents, 0),
  };
}

// ---------- applySwapSuggestion ----------

export async function applySwapSuggestion(catalogIngredientId: string, productOptionId: string) {
  const userId = await requireUser();

  const catalogIngredient = await prisma.catalogIngredient.findFirst({
    where: { id: catalogIngredientId, userId },
  });
  if (!catalogIngredient) throw new Error("Catalog ingredient not found");

  const option = await prisma.productOption.findFirst({
    where: { id: productOptionId, catalogIngredientId },
  });
  if (!option) throw new Error("Product option not found for this ingredient");

  await prisma.catalogIngredient.update({
    where: { id: catalogIngredientId },
    data: { selectedProductOptionId: productOptionId },
  });

  revalidatePath("/recipes");
  revalidatePath("/list");
}
