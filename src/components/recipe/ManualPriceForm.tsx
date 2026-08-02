"use client";

import { useState, useTransition } from "react";
import { upsertProductOption } from "@/lib/actions/catalog";

export function ManualPriceForm({
  catalogIngredientId,
  onDone,
  onCancel,
}: {
  catalogIngredientId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [store, setStore] = useState<"COLES" | "WOOLWORTHS">("WOOLWORTHS");
  const [productName, setProductName] = useState("");
  const [packLabel, setPackLabel] = useState("");
  const [packQty, setPackQty] = useState("");
  const [price, setPrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const packQtyNum = Number(packQty);
    const priceNum = Number(price);
    if (!productName.trim() || !packLabel.trim()) {
      setError("Fill in the product name and pack size.");
      return;
    }
    if (!(packQtyNum > 0)) {
      setError("Pack quantity must be a positive number.");
      return;
    }
    if (!(priceNum > 0)) {
      setError("Enter a valid price.");
      return;
    }
    setError(null);
    startTransition(async () => {
      await upsertProductOption({
        catalogIngredientId,
        store,
        productName: productName.trim(),
        packLabel: packLabel.trim(),
        packQty: packQtyNum,
        priceCents: Math.round(priceNum * 100),
        setAsSelected: true,
      });
      onDone();
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 px-5 pt-2 pb-4 text-left">
      <div className="flex gap-2">
        {(["WOOLWORTHS", "COLES"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStore(s)}
            className={`flex-1 rounded-full border px-3 py-2 text-sm font-medium ${
              store === s
                ? "border-(--color-accent) bg-(--color-accent) text-white"
                : "border-(--color-border) text-(--color-ink)"
            }`}
          >
            {s === "WOOLWORTHS" ? "Woolworths" : "Coles"}
          </button>
        ))}
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Product name
        <input
          value={productName}
          onChange={(e) => setProductName(e.target.value)}
          className="rounded-lg border border-(--color-border) px-3 py-2 text-base"
          placeholder="e.g. CSR White Sugar"
        />
      </label>

      <div className="flex gap-3">
        <label className="flex flex-1 flex-col gap-1 text-sm">
          Pack size
          <input
            value={packLabel}
            onChange={(e) => setPackLabel(e.target.value)}
            className="rounded-lg border border-(--color-border) px-3 py-2 text-base"
            placeholder="e.g. 1kg"
          />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-sm">
          Pack qty (g/ml/ea)
          <input
            type="number"
            inputMode="decimal"
            value={packQty}
            onChange={(e) => setPackQty(e.target.value)}
            className="rounded-lg border border-(--color-border) px-3 py-2 text-base"
            placeholder="1000"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        Price ($)
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="rounded-lg border border-(--color-border) px-3 py-2 text-base"
          placeholder="4.50"
        />
      </label>

      {error && <p className="text-sm text-(--color-accent-dark)">{error}</p>}

      <div className="mt-1 flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-full border border-(--color-border) px-4 py-2.5 text-sm font-medium"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 rounded-full bg-(--color-accent) px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
        >
          {isPending ? "Saving…" : "Save price"}
        </button>
      </div>
    </form>
  );
}
