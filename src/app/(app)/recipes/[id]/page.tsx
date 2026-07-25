import Link from "next/link";
import { getRecipe } from "@/lib/actions/recipes";
import { addRecipeToList } from "@/lib/actions/list";
import { centsToDisplay } from "@/lib/money";
import { ServesStepper } from "@/components/recipe/ServesStepper";
import { IngredientRow } from "@/components/recipe/IngredientRow";
import { StickyActionBar } from "@/components/ui/StickyActionBar";

export default async function RecipeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ serves?: string }>;
}) {
  const { id } = await params;
  const { serves } = await searchParams;
  const targetServes = serves ? Number(serves) || undefined : undefined;
  const recipe = await getRecipe(id, targetServes);

  async function addToList() {
    "use server";
    await addRecipeToList(id, recipe.targetServes);
  }

  return (
    <>
      <div className="flex flex-col gap-5">
        <div>
          <h1 className="font-serif-heading text-3xl">{recipe.name}</h1>
          {recipe.tag && (
            <p className="text-sm text-(--color-ink-muted)">{recipe.tag}</p>
          )}
        </div>

        <ServesStepper recipeId={id} current={recipe.targetServes} />

        <ul className="flex flex-col gap-2">
          {recipe.ingredients.map((ing) => (
            <li key={ing.id}>
              <IngredientRow ingredient={ing} />
            </li>
          ))}
        </ul>

        <div className="rounded-2xl border border-(--color-border) bg-(--color-surface-alt) p-4">
          <div className="flex items-center justify-between">
            <span className="text-(--color-ink-muted)">Total</span>
            <span className="text-lg font-semibold">
              {centsToDisplay(recipe.totalCents)}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-(--color-ink-muted)">Cost / serve</span>
            <span>{centsToDisplay(recipe.costPerServeCents)}</span>
          </div>
        </div>
      </div>

      <StickyActionBar>
        <form action={addToList} className="flex-1">
          <button
            type="submit"
            className="w-full rounded-full bg-(--color-accent) px-4 py-2.5 text-sm font-medium text-white"
          >
            Add to shopping list
          </button>
        </form>
        <Link
          href={`/recipes/${id}/breakdown?serves=${recipe.targetServes}`}
          className="flex-1 rounded-full border border-(--color-border) px-4 py-2.5 text-center text-sm font-medium"
        >
          Cost breakdown
        </Link>
      </StickyActionBar>
    </>
  );
}
