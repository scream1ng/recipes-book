"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatQtyCanonical } from "@/lib/units/format";
import { centsToDisplay } from "@/lib/money";
import { StoreBadge } from "@/components/ui/StoreBadge";
import { SwapSheet } from "./SwapSheet";

export interface IngredientRowData {
  id: string;
  displayName: string;
  qtyCanonical: number | null;
  canonicalUnit: "MASS_G" | "VOLUME_ML" | "COUNT" | null;
  catalogIngredientId: string | null;
  needsReview: boolean;
  product: { store: string; productName: string; packLabel: string } | null;
  costCents: number | null;
}

export function IngredientRow({ ingredient }: { ingredient: IngredientRowData }) {
  const router = useRouter();
  const [swapOpen, setSwapOpen] = useState(false);
  const canSwap = Boolean(ingredient.catalogIngredientId);

  return (
    <>
      <button
        type="button"
        disabled={!canSwap}
        onClick={() => setSwapOpen(true)}
        className="flex min-h-[48px] w-full items-center gap-3 px-4 py-2 text-left disabled:opacity-70"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">
            {ingredient.qtyCanonical != null && ingredient.canonicalUnit
              ? `${formatQtyCanonical(ingredient.qtyCanonical, ingredient.canonicalUnit)} `
              : ""}
            {ingredient.displayName}
          </span>
          {ingredient.product ? (
            <span className="flex items-center gap-1 truncate text-xs text-(--color-ink-muted)">
              <StoreBadge store={ingredient.product.store} />
              {ingredient.product.productName} ({ingredient.product.packLabel})
            </span>
          ) : ingredient.needsReview ? (
            <span className="block text-xs text-(--color-accent-dark)">Needs review — no product matched</span>
          ) : (
            <span className="block text-xs text-(--color-ink-muted)">No product selected</span>
          )}
        </span>
        <span className="shrink-0 tabular-nums font-medium">
          {ingredient.costCents != null ? centsToDisplay(ingredient.costCents) : "—"}
        </span>
      </button>

      {swapOpen && ingredient.catalogIngredientId && (
        <SwapSheet
          catalogIngredientId={ingredient.catalogIngredientId}
          displayName={ingredient.displayName}
          onClose={() => {
            setSwapOpen(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
