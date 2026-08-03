import { redirect } from "next/navigation";
import { getCostBreakdown, getRecipe, markBakedToday } from "@/lib/actions/recipes";
import { setOrderQty } from "@/lib/actions/order";
import { getSettings } from "@/lib/actions/settings";
import { centsToDisplay } from "@/lib/money";
import { ServesStepper } from "@/components/recipe/ServesStepper";
import { IngredientRow } from "@/components/recipe/IngredientRow";
import { RecipeHeaderActions } from "@/components/recipe/RecipeHeaderActions";
import { DeleteRecipeButton } from "@/components/recipe/DeleteRecipeButton";
import { CostShareBar } from "@/components/recipe/CostShareBar";
import { StickyActionBar } from "@/components/ui/StickyActionBar";
import { NavBar } from "@/components/ui/NavBar";
import { BackLink } from "@/components/ui/BackLink";
import { ListGroup, ListRow, ListDivider } from "@/components/ui/ListGroup";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Icon } from "@/components/ui/Icon";

const dateFormatter = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric" });

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
  const [recipe, breakdown, settings] = await Promise.all([
    getRecipe(id, targetServes),
    getCostBreakdown(id, targetServes),
    getSettings(),
  ]);

  const topBreakdownItems = breakdown.items.slice(0, 6);
  const hasPricing = recipe.totalCents > 0;

  async function handleMarkBaked() {
    "use server";
    await markBakedToday(id);
  }

  async function handleAddToOrder() {
    "use server";
    await setOrderQty(id, recipe.orderQty + 1);
    redirect("/order");
  }

  return (
    <>
      <NavBar left={<BackLink href="/recipes" label="Recipes" />} />

      <RecipeHeaderActions recipeId={id} name={recipe.name} tag={recipe.tag} />

      <div className="pt-4">
        <ServesStepper recipeId={id} current={recipe.targetServes} />
      </div>

      <SectionHeader>Ingredients · {recipe.ingredients.length}</SectionHeader>
      <ListGroup>
        {recipe.ingredients.map((ing, i) => (
          <div key={ing.id}>
            {i > 0 && <ListDivider />}
            <IngredientRow ingredient={ing} showUnitPrices={settings.showUnitPrices} />
          </div>
        ))}
      </ListGroup>

      <SectionHeader>Method</SectionHeader>
      <ListGroup>
        {recipe.methodSteps.length === 0 ? (
          <ListRow>
            <span className="text-(--color-ink-muted)">No method steps recorded yet.</span>
          </ListRow>
        ) : (
          recipe.methodSteps.map((step, i) => (
            <div key={i}>
              {i > 0 && <ListDivider inset={44} />}
              <ListRow className="items-start py-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-(--color-surface-alt) text-xs font-semibold">
                  {i + 1}
                </span>
                <span>{step}</span>
              </ListRow>
            </div>
          ))
        )}
      </ListGroup>

      {hasPricing && (
        <>
          <SectionHeader>Cost</SectionHeader>
          <ListGroup>
            <ListRow>
              <span className="flex-1">Cost per serving</span>
              <span className="tabular-nums font-semibold text-(--color-accent)">
                {centsToDisplay(recipe.costPerServeCents)}
              </span>
            </ListRow>
            <ListDivider />
            <ListRow>
              <span className="flex-1">Total for {recipe.targetServes} servings</span>
              <span className="tabular-nums font-medium">{centsToDisplay(recipe.totalCents)}</span>
            </ListRow>
            <ListDivider />
            <ListRow>
              <span className="flex-1">Already have</span>
              <span className="tabular-nums text-(--color-good)">
                {centsToDisplay(recipe.pantryCents)}
              </span>
            </ListRow>
            <ListDivider />
            <ListRow>
              <span className="flex-1">Need to buy</span>
              <span className="tabular-nums font-medium">{centsToDisplay(recipe.buyingCents)}</span>
            </ListRow>
          </ListGroup>

          {topBreakdownItems.length > 0 && (
            <>
              <SectionHeader>Biggest costs</SectionHeader>
              <ListGroup className="p-4">
                <ul className="flex flex-col gap-3">
                  {topBreakdownItems.map((item) => (
                    <li key={item.ingredientId}>
                      <div className="mb-1 flex items-baseline justify-between text-sm">
                        <span className="truncate font-medium">{item.displayName}</span>
                        <span className="shrink-0 tabular-nums text-(--color-ink-muted)">
                          {centsToDisplay(item.costCents)} · {Math.round(item.shareOfTotal * 100)}%
                        </span>
                      </div>
                      <CostShareBar share={item.shareOfTotal} />
                    </li>
                  ))}
                </ul>

                {breakdown.totalPotentialSavingsCents > 0 && (
                  <div className="mt-4 rounded-xl border border-(--color-good) p-3">
                    <p className="text-sm font-medium text-(--color-good)">
                      Could save {centsToDisplay(breakdown.totalPotentialSavingsCents)} with cheaper alternatives
                    </p>
                    <p className="mt-1 text-xs text-(--color-ink-muted)">
                      Tap an ingredient above to swap to the suggested option.
                    </p>
                  </div>
                )}
              </ListGroup>
            </>
          )}
        </>
      )}

      <SectionHeader>In the book</SectionHeader>
      <ListGroup>
        <ListRow>
          <span className="flex-1">Photographed</span>
          <span className="text-(--color-ink-muted)">{dateFormatter.format(recipe.createdAt)}</span>
        </ListRow>
        <ListDivider />
        <ListRow>
          <span className="flex-1">Last cooked</span>
          <span className="text-(--color-ink-muted)">
            {recipe.lastBakedAt ? dateFormatter.format(recipe.lastBakedAt) : "Never"}
          </span>
        </ListRow>
        <ListDivider />
        <ListRow>
          <span className="flex-1">Cooked</span>
          <span className="text-(--color-ink-muted)">
            {recipe.bakeCount} {recipe.bakeCount === 1 ? "time" : "times"}
          </span>
        </ListRow>
        <ListDivider />
        <form action={handleMarkBaked}>
          <button
            type="submit"
            disabled={recipe.bakedToday}
            className="flex min-h-[48px] w-full items-center gap-3 px-4 py-2 text-left active:bg-(--color-surface-alt) disabled:active:bg-transparent"
          >
            <span
              className={`flex flex-1 items-center gap-1.5 font-medium ${
                recipe.bakedToday ? "text-(--color-good)" : "text-(--color-accent)"
              }`}
            >
              {recipe.bakedToday ? "Cooked today" : "Mark cooked today"}
              {recipe.bakedToday && <Icon name="checkmark" size={16} />}
            </span>
          </button>
        </form>
      </ListGroup>

      <DeleteRecipeButton recipeId={id} name={recipe.name} />

      <StickyActionBar>
        <form action={handleAddToOrder} className="flex-1">
          <button
            type="submit"
            className="w-full rounded-full bg-(--color-accent) px-4 py-2.5 text-center text-sm font-medium text-white"
          >
            Add to order
          </button>
        </form>
      </StickyActionBar>
    </>
  );
}
