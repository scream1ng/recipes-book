"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { applySwapSuggestion } from "@/lib/actions/recipes";
import { addColesProductAsOption, refreshProductPrice } from "@/lib/actions/catalog";
import { centsToDisplay } from "@/lib/money";
import { StoreBadge } from "@/components/ui/StoreBadge";
import { Icon } from "@/components/ui/Icon";
import { Spinner } from "@/components/ui/Spinner";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ManualPriceForm } from "./ManualPriceForm";

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
  lastRefreshError: string | null;
}

interface LiveColesProduct {
  name: string;
  packLabel: string;
  packQty: number | null;
  priceCents: number | null;
  productId: string | null;
  productUrl: string | null;
}

export function SwapSheet({
  catalogIngredientId,
  displayName,
  title,
  onClose,
}: {
  catalogIngredientId: string;
  displayName: string;
  title?: string;
  onClose: () => void;
}) {
  const [stored, setStored] = useState<StoredOption[] | null>(null);
  const [liveColes, setLiveColes] = useState<LiveColesProduct[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [closing, setClosing] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragState = useRef<{ startY: number; dragging: boolean } | null>(null);
  const loadIdRef = useRef(0);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  function handleClose() {
    setClosing(true);
    setTimeout(onClose, 200);
  }

  function onGrabberPointerDown(e: React.PointerEvent) {
    dragState.current = { startY: e.clientY, dragging: true };
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onGrabberPointerMove(e: React.PointerEvent) {
    if (!dragState.current?.dragging) return;
    const delta = e.clientY - dragState.current.startY;
    setDragY(Math.max(0, delta));
  }

  function onGrabberPointerUp() {
    if (!dragState.current?.dragging) return;
    dragState.current.dragging = false;
    setDragging(false);
    if (dragY > 100) {
      handleClose();
    } else {
      setDragY(0);
    }
  }

  function load() {
    const requestId = ++loadIdRef.current;
    return fetch(`/api/swap?catalogIngredientId=${catalogIngredientId}`)
      .then((res) => res.json())
      .then((data) => {
        if (requestId !== loadIdRef.current) return;
        if (data.error) setError(data.error);
        else {
          setStored(data.stored);
          setLiveColes(data.liveColes ?? []);
        }
      })
      .catch(() => {
        if (requestId !== loadIdRef.current) return;
        setError("Could not load options");
      });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogIngredientId]);

  function refresh(productOptionId: string) {
    setRefreshingId(productOptionId);
    startTransition(async () => {
      await refreshProductPrice(productOptionId);
      await load();
      setRefreshingId(null);
    });
  }

  function select(productOptionId: string) {
    startTransition(async () => {
      await applySwapSuggestion(catalogIngredientId, productOptionId);
      handleClose();
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
        colesProductId: product.productId,
        sourceUrl: product.productUrl,
      });
      handleClose();
    });
  }

  return (
    <div
      className={`fixed inset-0 z-30 flex items-end bg-black/40 transition-opacity duration-200 ${
        closing ? "opacity-0" : "motion-safe:animate-[fade-in_.2s_ease-out]"
      }`}
      onClick={handleClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${title ?? "Swap"}: ${displayName}`}
        className={`max-h-[80vh] w-full overflow-y-auto rounded-t-3xl bg-(--color-surface) pb-5 ${
          closing ? "" : "motion-safe:animate-[sheet-up_.25s_ease-out]"
        } ${dragging ? "" : "transition-transform duration-200"}`}
        style={{ transform: closing ? "translateY(100%)" : `translateY(${dragY}px)` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex touch-none justify-center pt-2 pb-1"
          onPointerDown={onGrabberPointerDown}
          onPointerMove={onGrabberPointerMove}
          onPointerUp={onGrabberPointerUp}
        >
          <div className="h-1 w-9 rounded-full bg-(--color-border)" />
        </div>

        <div className="mb-3 flex items-center justify-between px-5">
          <h2 className="text-xl">{title ?? "Swap"}: {displayName}</h2>
          <button
            onClick={handleClose}
            className="-mr-2 flex h-11 w-11 items-center justify-center text-(--color-ink-muted) active:opacity-60"
            aria-label="Close"
          >
            <Icon name="xmark" size={18} />
          </button>
        </div>

        {error && <p className="px-5 text-sm text-(--color-accent-dark)">{error}</p>}
        {!stored && !error && (
          <p className="px-5 text-sm text-(--color-ink-muted)">Loading options…</p>
        )}

        {stored && manualOpen && (
          <ManualPriceForm
            catalogIngredientId={catalogIngredientId}
            onDone={handleClose}
            onCancel={() => setManualOpen(false)}
          />
        )}

        {stored && !manualOpen && (
          <div>
            {stored.length === 0 && liveColes.length === 0 && (
              <p className="px-5 pb-3 text-sm text-(--color-ink-muted)">
                Couldn&apos;t reach Coles — enter a price manually.
              </p>
            )}
            {stored.length > 0 && <SectionHeader>Your prices</SectionHeader>}
            <ul className="flex flex-col divide-y divide-(--color-border)">
              {stored.map((opt) => (
                <li key={opt.id} className="flex items-center">
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => select(opt.id)}
                    className={`flex min-h-[48px] flex-1 items-center gap-3 px-4 py-2 text-left active:bg-(--color-surface-alt) ${
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
                      {opt.lastRefreshError && (
                        <span className="mt-0.5 block text-xs text-(--color-accent-dark)">
                          {opt.lastRefreshError}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 tabular-nums font-medium">
                      {centsToDisplay(opt.priceCents)}
                    </span>
                  </button>
                  {opt.source === "COLES_SCRAPE" && (
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => refresh(opt.id)}
                      aria-label="Refresh price"
                      className="flex h-11 w-11 shrink-0 items-center justify-center text-(--color-accent) active:opacity-60"
                    >
                      {refreshingId === opt.id && isPending ? (
                        <Spinner size={16} />
                      ) : (
                        <Icon name="arrow-clockwise" size={16} />
                      )}
                    </button>
                  )}
                </li>
              ))}
            </ul>

            {liveColes.length > 0 && <SectionHeader>From Coles</SectionHeader>}
            <ul className="flex flex-col divide-y divide-(--color-border)">
              {liveColes.map((product, i) => (
                <li key={`live-${i}`}>
                  <button
                    type="button"
                    disabled={isPending || product.priceCents == null}
                    onClick={() => selectLive(product)}
                    className="flex min-h-[48px] w-full items-center gap-3 px-4 py-2 text-left active:bg-(--color-surface-alt) disabled:opacity-50"
                  >
                    <StoreBadge store="COLES" />
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

            <div className="px-5 pt-3">
              <button
                type="button"
                onClick={() => setManualOpen(true)}
                className="w-full rounded-full border border-(--color-border) px-4 py-2.5 text-center text-sm font-medium text-(--color-ink)"
              >
                Add a Woolworths / other price
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
