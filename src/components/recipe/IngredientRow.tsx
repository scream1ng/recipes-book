"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatQtyCanonical } from "@/lib/units/format";
import { centsToDisplay } from "@/lib/money";
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
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-(--color-border) bg-(--color-surface) p-3 text-left disabled:opacity-70"
      >
        <div className="min-w-0">
          <p className="truncate font-medium">
            {ingredient.qtyCanonical != null && ingredient.canonicalUnit
              ? `${formatQtyCanonical(ingredient.qtyCanonical, ingredient.canonicalUnit)} `
              : ""}
            {ingredient.displayName}
          </p>
          {ingredient.product ? (
            <p className="truncate text-xs text-(--color-ink-muted)">
              <span className="mr-1 rounded-full bg-(--color-surface-alt) px-1.5 py-0.5 text-[10px] font-medium">
                {ingredient.product.store}
              </span>
              {ingredient.product.productName} ({ingredient.product.packLabel})
            </p>
          ) : ingredient.needsReview ? (
            <p className="text-xs text-(--color-accent-dark)">Needs review — no product matched</p>
          ) : (
            <p className="text-xs text-(--color-ink-muted)">No product selected</p>
          )}
        </div>
        <span className="shrink-0 font-medium">
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
