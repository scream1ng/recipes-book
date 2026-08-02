import Link from "next/link";
import { listRecipes } from "@/lib/actions/recipes";
import { centsToDisplay } from "@/lib/money";
import { StickyActionBar } from "@/components/ui/StickyActionBar";
import { NavBar } from "@/components/ui/NavBar";
import { ListGroup, ListRow, ListDivider } from "@/components/ui/ListGroup";
import { SectionHeader } from "@/components/ui/SectionHeader";

// Phase 2 may add a persisted `tintHex` per recipe — until then, derive a
// deterministic pastel tint from the recipe id so avatars aren't all identical.
function tintFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  const hue = hash % 360;
  return `hsl(${hue}, 55%, 88%)`;
}

export default async function LibraryPage() {
  const recipes = await listRecipes();

  return (
    <>
      <div className="-mx-4" style={{ marginTop: "calc(-1.5rem - env(safe-area-inset-top))" }}>
        <NavBar title="Recipes" />
      </div>

      {recipes.length === 0 ? (
        <p className="mt-12 text-center text-(--color-ink-muted)">
          No recipes yet. Scan a photo or add one manually to get started.
        </p>
      ) : (
        <>
          <SectionHeader>Your recipes</SectionHeader>
          <ListGroup>
            {recipes.map((recipe, i) => (
              <div key={recipe.id}>
                {i > 0 && <ListDivider inset={76} />}
                <Link href={`/recipes/${recipe.id}`}>
                  <ListRow>
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-(--color-ink)"
                      style={{ background: tintFor(recipe.id) }}
                      aria-hidden
                    >
                      {recipe.name.charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="recipe-name truncate text-lg">{recipe.name}</p>
                      <p className="truncate text-xs text-(--color-ink-muted)">
                        {recipe.tag ? `${recipe.tag} · ` : ""}
                        {recipe.ingredientCount} ingredients
                        {recipe.minutes ? ` · ${recipe.minutes} min` : ""} · serves{" "}
                        {recipe.baseServes}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="tabular-nums font-medium">
                        {centsToDisplay(recipe.totalCents)}
                      </p>
                      <p className="tabular-nums text-xs text-(--color-ink-muted)">
                        {centsToDisplay(recipe.costPerServeCents)}/serve
                      </p>
                    </div>
                  </ListRow>
                </Link>
              </div>
            ))}
          </ListGroup>
        </>
      )}

      <StickyActionBar>
        <Link
          href="/scan"
          className="flex-1 rounded-full bg-(--color-accent) px-4 py-2.5 text-center text-sm font-medium text-white"
        >
          + Scan
        </Link>
        <Link
          href="/scan/manual"
          className="flex-1 rounded-full border border-(--color-border) px-4 py-2.5 text-center text-sm font-medium"
        >
          + Manual
        </Link>
      </StickyActionBar>
    </>
  );
}
