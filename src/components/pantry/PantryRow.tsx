"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteCatalogIngredient, type PantryIngredientRow } from "@/lib/actions/catalog";
import { centsToDisplay } from "@/lib/money";
import { isPriceStale } from "@/lib/pricing/staleness";
import { ListRow } from "@/components/ui/ListGroup";
import { StoreBadge } from "@/components/ui/StoreBadge";
import { SwapSheet } from "@/components/recipe/SwapSheet";
import { SwipeRow } from "@/components/ui/SwipeRow";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export function PantryRow({
  ingredient,
  stalePriceHours,
}: {
  ingredient: PantryIngredientRow;
  stalePriceHours: number;
}) {
  const router = useRouter();
  const [swapOpen, setSwapOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const stale = ingredient.priceUpdatedAt
    ? isPriceStale(new Date(ingredient.priceUpdatedAt), stalePriceHours)
    : false;

  function handleDelete() {
    startTransition(async () => {
      try {
        await deleteCatalogIngredient(ingredient.id);
        setConfirmingDelete(false);
        router.refresh();
      } catch (err) {
        setDeleteError(err instanceof Error ? err.message : "Could not delete ingredient");
      }
    });
  }

  return (
    <>
      <SwipeRow onDelete={() => setConfirmingDelete(true)}>
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
      </SwipeRow>

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

      {confirmingDelete && (
        <ConfirmDialog
          title={`Delete "${ingredient.name}"?`}
          message={deleteError ?? "This can't be undone."}
          isPending={isPending}
          onConfirm={handleDelete}
          onCancel={() => {
            setConfirmingDelete(false);
            setDeleteError(null);
          }}
        />
      )}
    </>
  );
}
