"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PantryIngredientRow } from "@/lib/actions/catalog";
import { centsToDisplay } from "@/lib/money";
import { isPriceStale } from "@/lib/pricing/staleness";
import { ListRow } from "@/components/ui/ListGroup";
import { StoreBadge } from "@/components/ui/StoreBadge";
import { SwapSheet } from "@/components/recipe/SwapSheet";

export function PantryRow({
  ingredient,
  stalePriceHours,
}: {
  ingredient: PantryIngredientRow;
  stalePriceHours: number;
}) {
  const router = useRouter();
  const [swapOpen, setSwapOpen] = useState(false);

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
          {ingredient.lastRefreshError ? (
            <p className="text-xs text-(--color-accent-dark)">{ingredient.lastRefreshError}</p>
          ) : ingredient.priceCents != null ? (
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
        </button>
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
