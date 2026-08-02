"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { deleteRecipe } from "@/lib/actions/recipes";
import { centsToDisplay } from "@/lib/money";
import { ListRow } from "@/components/ui/ListGroup";
import { SwipeRow } from "@/components/ui/SwipeRow";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export interface RecipeListRowData {
  id: string;
  name: string;
  tag: string | null;
  minutes: number | null;
  baseServes: number;
  ingredientCount: number;
  totalCents: number;
  costPerServeCents: number;
}

export function RecipeListRow({ recipe, tint }: { recipe: RecipeListRowData; tint: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  function handleDelete() {
    startTransition(async () => {
      await deleteRecipe(recipe.id);
      router.refresh();
    });
  }

  return (
    <SwipeRow onDelete={() => setConfirmingDelete(true)}>
      <Link href={`/recipes/${recipe.id}`}>
        <ListRow interactive>
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-(--color-ink)"
            style={{ background: tint }}
            aria-hidden
          >
            {recipe.name.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="recipe-name truncate text-lg">{recipe.name}</p>
            <p className="truncate text-xs text-(--color-ink-muted)">
              {recipe.tag ? `${recipe.tag} · ` : ""}
              {recipe.ingredientCount} ingredients
              {recipe.minutes ? ` · ${recipe.minutes} min` : ""} · serves {recipe.baseServes}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="tabular-nums font-medium">{centsToDisplay(recipe.totalCents)}</p>
            <p className="tabular-nums text-xs text-(--color-ink-muted)">
              {centsToDisplay(recipe.costPerServeCents)}/serve
            </p>
          </div>
        </ListRow>
      </Link>

      {confirmingDelete && (
        <ConfirmDialog
          title={`Delete "${recipe.name}"?`}
          message="This can't be undone."
          isPending={isPending}
          onConfirm={handleDelete}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </SwipeRow>
  );
}
