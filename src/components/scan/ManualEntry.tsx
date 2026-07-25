"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createRecipe, type RecipeIngredientDraft } from "@/lib/actions/recipes";
import { findOrCreateCatalogIngredient } from "@/lib/actions/catalog";
import { normalizeToCanonical } from "@/lib/units/normalize";
import { centsToDisplay } from "@/lib/money";

interface CatalogSuggestion {
  id: string;
  name: string;
  category: string;
  canonicalUnit: "MASS_G" | "VOLUME_ML" | "COUNT";
}

interface ColesSuggestion {
  name: string;
  packLabel: string;
  priceCents: number | null;
}

interface DraftLine {
  displayName: string;
  amount: number;
  unit: string;
  catalogIngredientId?: string;
  canonicalUnit: "MASS_G" | "VOLUME_ML" | "COUNT";
}

export function ManualEntry({ recipeName: initialName }: { recipeName?: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName ?? "");
  const [query, setQuery] = useState("");
  const [amount, setAmount] = useState("");
  const [unit, setUnit] = useState("g");
  const [catalogSuggestions, setCatalogSuggestions] = useState<CatalogSuggestion[]>([]);
  const [colesSuggestions, setColesSuggestions] = useState<ColesSuggestion[]>([]);
  const [selected, setSelected] = useState<CatalogSuggestion | null>(null);
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!query.trim()) {
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const res = await fetch(`/api/catalog/suggest?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setCatalogSuggestions(data.catalog ?? []);
      setColesSuggestions(data.coles ?? []);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  function addLine() {
    const amt = Number(amount);
    if (!query.trim() || !amt) return;

    setLines((prev) => [
      ...prev,
      {
        displayName: selected?.name ?? query,
        amount: amt,
        unit,
        catalogIngredientId: selected?.id,
        canonicalUnit: selected?.canonicalUnit ?? "MASS_G",
      },
    ]);
    setQuery("");
    setAmount("");
    setSelected(null);
    setCatalogSuggestions([]);
    setColesSuggestions([]);
  }

  async function handleSave() {
    if (!name.trim() || lines.length === 0) return;
    setSaving(true);
    try {
      const ingredients: RecipeIngredientDraft[] = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        let catalogIngredientId = line.catalogIngredientId;
        if (!catalogIngredientId) {
          const created = await findOrCreateCatalogIngredient({
            name: line.displayName,
            category: "OTHER",
            canonicalUnit: line.canonicalUnit,
          });
          catalogIngredientId = created.id;
        }
        const normalized = normalizeToCanonical(line.amount, line.unit, line.canonicalUnit);
        ingredients.push({
          catalogIngredientId,
          sortOrder: i,
          rawAmount: line.amount,
          rawUnit: line.unit,
          displayName: line.displayName,
          qtyCanonical: normalized.qtyCanonical,
          needsReview: normalized.qtyCanonical == null,
          reviewNote: normalized.missingFactor
            ? `Missing ${normalized.missingFactor} for this ingredient`
            : undefined,
        });
      }

      const recipe = await createRecipe({
        name,
        baseServes: 4,
        sourceType: "MANUAL",
        ingredients,
      });
      router.push(`/recipes/${recipe.id}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Recipe name"
        className="rounded-xl border border-(--color-border) bg-(--color-surface) px-3 py-2 font-serif-heading text-xl"
      />

      <div className="rounded-xl border border-(--color-border) bg-(--color-surface) p-3">
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelected(null);
              if (!e.target.value.trim()) {
                setCatalogSuggestions([]);
                setColesSuggestions([]);
              }
            }}
            placeholder="Ingredient"
            className="min-w-0 flex-1 rounded-lg border border-(--color-border) px-2 py-1.5 text-sm"
          />
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            type="number"
            placeholder="Amt"
            className="w-16 rounded-lg border border-(--color-border) px-2 py-1.5 text-sm"
          />
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            className="rounded-lg border border-(--color-border) px-2 py-1.5 text-sm"
          >
            {["g", "kg", "ml", "l", "tsp", "tbsp", "cup", "count"].map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </div>

        {(catalogSuggestions.length > 0 || colesSuggestions.length > 0) && (
          <ul className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-(--color-border)">
            {catalogSuggestions.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => {
                    setSelected(s);
                    setQuery(s.name);
                    setCatalogSuggestions([]);
                    setColesSuggestions([]);
                  }}
                  className="block w-full px-3 py-1.5 text-left text-sm hover:bg-(--color-surface-alt)"
                >
                  {s.name} <span className="text-(--color-ink-muted)">(your catalog)</span>
                </button>
              </li>
            ))}
            {colesSuggestions.map((s, i) => (
              <li key={`coles-${i}`}>
                <button
                  type="button"
                  onClick={() => {
                    setQuery(s.name);
                    setColesSuggestions([]);
                  }}
                  className="block w-full px-3 py-1.5 text-left text-sm hover:bg-(--color-surface-alt)"
                >
                  {s.name}{" "}
                  <span className="text-(--color-ink-muted)">
                    {s.priceCents != null ? centsToDisplay(s.priceCents) : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          onClick={addLine}
          className="mt-2 w-full rounded-lg border border-(--color-border) py-1.5 text-sm font-medium"
        >
          Add ingredient
        </button>
      </div>

      {lines.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm">
          {lines.map((line, i) => (
            <li key={i} className="flex justify-between rounded-lg bg-(--color-surface-alt) px-3 py-1.5">
              <span>
                {line.amount}
                {line.unit} {line.displayName}
              </span>
              <button
                type="button"
                onClick={() => setLines((prev) => prev.filter((_, j) => j !== i))}
                className="text-(--color-ink-muted)"
              >
                remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        disabled={saving || !name.trim() || lines.length === 0}
        onClick={handleSave}
        className="rounded-full bg-(--color-accent) px-6 py-3 font-medium text-white disabled:opacity-60"
      >
        {saving ? "Saving…" : "Save recipe"}
      </button>
    </div>
  );
}
