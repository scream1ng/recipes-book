import Link from "next/link";
import { listRecipes } from "@/lib/actions/recipes";
import { StickyActionBar } from "@/components/ui/StickyActionBar";
import { NavBar } from "@/components/ui/NavBar";
import { ListGroup, ListDivider } from "@/components/ui/ListGroup";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { RecipeListRow } from "@/components/recipe/RecipeListRow";

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
      <NavBar title="Recipes" />

      {recipes.length === 0 ? (
        <p className="mt-12 text-center text-(--color-ink-muted)">
          No recipes yet. Scan a photo or paste one in to get started.
        </p>
      ) : (
        <>
          <SectionHeader>Your recipes</SectionHeader>
          <ListGroup>
            {recipes.map((recipe, i) => (
              <div key={recipe.id}>
                {i > 0 && <ListDivider inset={76} />}
                <RecipeListRow recipe={recipe} tint={tintFor(recipe.id)} />
              </div>
            ))}
          </ListGroup>
        </>
      )}

      <StickyActionBar>
        <Link
          href="/scan"
          className="flex-1 rounded-full bg-(--color-accent) px-4 py-3 text-center text-sm font-medium text-white"
        >
          + Scan
        </Link>
        <Link
          href="/scan/paste?from=recipes"
          className="flex-1 rounded-full border border-(--color-border) px-4 py-3 text-center text-sm font-medium"
        >
          + Paste
        </Link>
      </StickyActionBar>
    </>
  );
}
