"use client";

import { useOptimistic, useTransition } from "react";
import { toggleOnHand } from "@/lib/actions/catalog";
import type { PantryIngredientRow } from "@/lib/actions/catalog";
import { centsToDisplay } from "@/lib/money";
import { isPriceStale } from "@/lib/pricing/staleness";
import { ListRow } from "@/components/ui/ListGroup";
import { StoreBadge } from "@/components/ui/StoreBadge";
import { Toggle } from "@/components/ui/Toggle";

export function PantryRow({
  ingredient,
  stalePriceHours,
}: {
  ingredient: PantryIngredientRow;
  stalePriceHours: number;
}) {
  const [optimisticOnHand, setOptimisticOnHand] = useOptimistic(ingredient.onHand);
  const [, startTransition] = useTransition();

  function change(next: boolean) {
    startTransition(() => {
      setOptimisticOnHand(next);
      toggleOnHand(ingredient.id);
    });
  }

  const stale = ingredient.priceUpdatedAt
    ? isPriceStale(new Date(ingredient.priceUpdatedAt), stalePriceHours)
    : false;

  return (
    <ListRow>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{ingredient.name}</p>
        {ingredient.priceCents != null ? (
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-(--color-ink-muted)">
            <StoreBadge store={ingredient.store} />
            <span className="truncate">
              {centsToDisplay(ingredient.priceCents)}
              {ingredient.packLabel ? ` · ${ingredient.packLabel}` : ""}
              {stale ? " · stale" : ""}
            </span>
          </p>
        ) : (
          <p className="text-xs text-(--color-ink-muted)">No price yet</p>
        )}
      </div>
      <Toggle checked={optimisticOnHand} onChange={change} label={`${ingredient.name} on hand`} />
    </ListRow>
  );
}
