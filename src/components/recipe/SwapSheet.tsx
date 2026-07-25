"use client";

import { useEffect, useState, useTransition } from "react";
import { applySwapSuggestion } from "@/lib/actions/recipes";
import { addColesProductAsOption } from "@/lib/actions/catalog";
import { centsToDisplay } from "@/lib/money";

interface StoredOption {
  id: string;
  store: "COLES" | "WOOLWORTHS";
  productName: string;
  packLabel: string;
  packQty: number;
  priceCents: number;
  source: "COLES_SCRAPE" | "MANUAL";
  isCurrent: boolean;
  isStale: boolean;
}

interface LiveColesProduct {
  name: string;
  packLabel: string;
  packQty: number | null;
  priceCents: number | null;
}

export function SwapSheet({
  catalogIngredientId,
  displayName,
  onClose,
}: {
  catalogIngredientId: string;
  displayName: string;
  onClose: () => void;
}) {
  const [stored, setStored] = useState<StoredOption[] | null>(null);
  const [liveColes, setLiveColes] = useState<LiveColesProduct[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/swap?catalogIngredientId=${catalogIngredientId}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) setError(data.error);
        else {
          setStored(data.stored);
          setLiveColes(data.liveColes ?? []);
        }
      })
      .catch(() => !cancelled && setError("Could not load options"));
    return () => {
      cancelled = true;
    };
  }, [catalogIngredientId]);

  function select(productOptionId: string) {
    startTransition(async () => {
      await applySwapSuggestion(catalogIngredientId, productOptionId);
      onClose();
    });
  }

  function selectLive(product: LiveColesProduct) {
    if (product.priceCents == null || product.packQty == null) return;
    startTransition(async () => {
      await addColesProductAsOption({
        catalogIngredientId,
        productName: product.name,
        packLabel: product.packLabel,
        packQty: product.packQty as number,
        priceCents: product.priceCents as number,
      });
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-20 flex items-end bg-black/40" onClick={onClose}>
      <div
        className="max-h-[80vh] w-full overflow-y-auto rounded-t-3xl bg-(--color-surface) p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-serif-heading text-xl">Swap: {displayName}</h2>
          <button onClick={onClose} className="text-(--color-ink-muted)" aria-label="Close">
            ✕
          </button>
        </div>

        {error && <p className="text-sm text-(--color-accent-dark)">{error}</p>}
        {!stored && !error && <p className="text-sm text-(--color-ink-muted)">Loading options…</p>}

        {stored && (
          <ul className="flex flex-col gap-2">
            {stored.map((opt) => (
              <li key={opt.id}>
                <button
                  disabled={isPending}
                  onClick={() => select(opt.id)}
                  className={`flex w-full items-center justify-between rounded-xl border p-3 text-left ${
                    opt.isCurrent
                      ? "border-(--color-accent) bg-(--color-surface-alt)"
                      : "border-(--color-border)"
                  }`}
                >
                  <span>
                    <span className="mr-2 rounded-full bg-(--color-surface-alt) px-2 py-0.5 text-xs font-medium">
                      {opt.store}
                    </span>
                    {opt.productName} <span className="text-(--color-ink-muted)">({opt.packLabel})</span>
                    {opt.isStale && (
                      <span className="ml-2 text-xs text-(--color-accent-dark)">stale price</span>
                    )}
                  </span>
                  <span className="font-medium">{centsToDisplay(opt.priceCents)}</span>
                </button>
              </li>
            ))}

            {liveColes.map((product, i) => (
              <li key={`live-${i}`}>
                <button
                  disabled={isPending || product.priceCents == null}
                  onClick={() => selectLive(product)}
                  className="flex w-full items-center justify-between rounded-xl border border-dashed border-(--color-border) p-3 text-left disabled:opacity-50"
                >
                  <span>
                    <span className="mr-2 rounded-full bg-(--color-surface-alt) px-2 py-0.5 text-xs font-medium">
                      COLES · live
                    </span>
                    {product.name} <span className="text-(--color-ink-muted)">({product.packLabel})</span>
                  </span>
                  <span className="font-medium">
                    {product.priceCents != null ? centsToDisplay(product.priceCents) : "—"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
