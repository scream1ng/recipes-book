"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleOnHand } from "@/lib/actions/catalog";
import type { PantryIngredientRow } from "@/lib/actions/catalog";
import { centsToDisplay } from "@/lib/money";
import { isPriceStale } from "@/lib/pricing/staleness";
import { ListRow } from "@/components/ui/ListGroup";
import { StoreBadge } from "@/components/ui/StoreBadge";
import { Toggle } from "@/components/ui/Toggle";
import { SwapSheet } from "@/components/recipe/SwapSheet";

export function PantryRow({
  ingredient,
  stalePriceHours,
}: {
  ingredient: PantryIngredientRow;
  stalePriceHours: number;
}) {
  const router = useRouter();
  const [optimisticOnHand, setOptimisticOnHand] = useOptimistic(ingredient.onHand);
  const [, startTransition] = useTransition();
  const [swapOpen, setSwapOpen] = useState(false);

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
    <>
      <ListRow>
        <button
          type="button"
          onClick={() => setSwapOpen(true)}
          className="-my-2 min-w-0 flex-1 py-2 text-left active:bg-(--color-surface-alt)"
        >
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
            <p className="text-xs text-(--color-ink-muted)">Tap to set a price</p>
          )}
        </button>
        <Toggle checked={optimisticOnHand} onChange={change} label={`${ingredient.name} on hand`} />
      </ListRow>

      {swapOpen && (
        <SwapSheet
          catalogIngredientId={ingredient.id}
          displayName={ingredient.name}
          onClose={() => {
            setSwapOpen(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
