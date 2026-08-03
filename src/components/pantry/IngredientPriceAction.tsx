"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { fetchColesPriceForIngredient, refreshProductPrice } from "@/lib/actions/catalog";
import { Icon } from "@/components/ui/Icon";
import { Spinner } from "@/components/ui/Spinner";
import { Toast } from "@/components/ui/Toast";

/** Row-level one-tap Coles fetch/refresh — opens the sheet instead when the result is ambiguous. */
export function IngredientPriceAction({
  catalogIngredientId,
  productOptionId,
  onNeedsSheet,
}: {
  catalogIngredientId: string;
  productOptionId: string | null;
  onNeedsSheet: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);

  function run() {
    startTransition(async () => {
      try {
        if (productOptionId) {
          await refreshProductPrice(productOptionId);
          router.refresh();
          return;
        }

        const result = await fetchColesPriceForIngredient(catalogIngredientId);
        if (result.ok) {
          router.refresh();
        } else if (result.reason === "ambiguous") {
          onNeedsSheet();
        } else {
          setToast("Couldn't find this on Coles — enter a price manually.");
        }
      } catch (err) {
        setToast(err instanceof Error ? err.message : "Couldn't refresh price");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        disabled={isPending}
        onClick={run}
        aria-label="Fetch Coles price"
        className="flex h-11 w-11 shrink-0 items-center justify-center text-(--color-accent) active:opacity-60"
      >
        {isPending ? <Spinner size={18} /> : <Icon name="arrow-clockwise" size={18} />}
      </button>
      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </>
  );
}
