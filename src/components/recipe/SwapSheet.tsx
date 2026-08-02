"use client";

import { useEffect, useState, useTransition } from "react";
import { applySwapSuggestion } from "@/lib/actions/recipes";
import { addColesProductAsOption } from "@/lib/actions/catalog";
import { centsToDisplay } from "@/lib/money";
import { StoreBadge } from "@/components/ui/StoreBadge";

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
    if (product.priceCents == null || product.packQty == null || product.packQty <= 0) return;
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
        className="max-h-[80vh] w-full overflow-y-auto rounded-t-3xl bg-(--color-surface) pb-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-2 pb-1">
          <div className="h-1 w-9 rounded-full bg-(--color-border)" />
        </div>

        <div className="mb-3 flex items-center justify-between px-5">
          <h2 className="text-xl">Swap: {displayName}</h2>
          <button onClick={onClose} className="text-(--color-ink-muted)" aria-label="Close">
            ✕
          </button>
        </div>

        {error && <p className="px-5 text-sm text-(--color-accent-dark)">{error}</p>}
        {!stored && !error && (
          <p className="px-5 text-sm text-(--color-ink-muted)">Loading options…</p>
        )}

        {stored && (
          <div>
            <ul className="flex flex-col divide-y divide-(--color-border)">
              {stored.map((opt) => (
                <li key={opt.id}>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => select(opt.id)}
                    className={`flex min-h-[48px] w-full items-center gap-3 px-4 py-2 text-left ${
                      opt.isCurrent ? "bg-(--color-surface-alt)" : ""
                    }`}
                  >
                    <StoreBadge store={opt.store} />
                    <span className="min-w-0 flex-1 truncate">
                      {opt.productName}{" "}
                      <span className="text-(--color-ink-muted)">({opt.packLabel})</span>
                      {opt.isStale && (
                        <span className="ml-2 text-xs text-(--color-accent-dark)">stale price</span>
                      )}
                    </span>
                    <span className="shrink-0 tabular-nums font-medium">
                      {centsToDisplay(opt.priceCents)}
                    </span>
                  </button>
                </li>
              ))}

              {liveColes.map((product, i) => (
                <li key={`live-${i}`}>
                  <button
                    type="button"
                    disabled={isPending || product.priceCents == null}
                    onClick={() => selectLive(product)}
                    className="flex min-h-[48px] w-full items-center gap-3 px-4 py-2 text-left disabled:opacity-50"
                  >
                    <StoreBadge store="COLES" />
                    <span className="text-[10px] font-medium text-(--color-ink-muted)">live</span>
                    <span className="min-w-0 flex-1 truncate">
                      {product.name}{" "}
                      <span className="text-(--color-ink-muted)">({product.packLabel})</span>
                    </span>
                    <span className="shrink-0 tabular-nums font-medium">
                      {product.priceCents != null ? centsToDisplay(product.priceCents) : "—"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
