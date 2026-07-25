import Link from "next/link";
import { listRecipes } from "@/lib/actions/recipes";
import { centsToDisplay } from "@/lib/money";

export default async function LibraryPage() {
  const recipes = await listRecipes();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="font-serif-heading text-3xl">Recipes</h1>
        <div className="flex gap-2">
          <Link
            href="/scan"
            className="rounded-full bg-(--color-accent) px-4 py-2 text-sm font-medium text-white"
          >
            + Scan
          </Link>
          <Link
            href="/scan/manual"
            className="rounded-full border border-(--color-border) px-4 py-2 text-sm font-medium"
          >
            + Manual
          </Link>
        </div>
      </div>

      {recipes.length === 0 ? (
        <p className="mt-12 text-center text-(--color-ink-muted)">
          No recipes yet. Scan a photo or add one manually to get started.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {recipes.map((recipe) => (
            <li key={recipe.id}>
              <Link
                href={`/recipes/${recipe.id}`}
                className="block rounded-2xl border border-(--color-border) bg-(--color-surface) p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-serif-heading text-xl">{recipe.name}</h2>
                    <p className="mt-1 text-sm text-(--color-ink-muted)">
                      {recipe.tag ? `${recipe.tag} · ` : ""}
                      {recipe.ingredientCount} ingredients
                      {recipe.minutes ? ` · ${recipe.minutes} min` : ""} · serves{" "}
                      {recipe.baseServes}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-medium">{centsToDisplay(recipe.totalCents)}</p>
                    <p className="text-xs text-(--color-ink-muted)">
                      {centsToDisplay(recipe.costPerServeCents)}/serve
                    </p>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
