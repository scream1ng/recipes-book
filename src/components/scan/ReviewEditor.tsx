"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { saveScannedRecipe, type RecipeIngredientDraft } from "@/lib/actions/recipes";
import { findOrCreateCatalogIngredient } from "@/lib/actions/catalog";

interface ParsedLine {
  rawText: string;
  amount: number | null;
  unit: string | null;
  name: string;
  qtyCanonical: number | null;
  confidence: number;
  flagged: boolean;
  note: string | null;
  catalogMatch: { id: string; name: string; confidence: number } | null;
}

interface ParsedResult {
  recipeName: string | null;
  minutes: number | null;
  serves: number | null;
  lines: ParsedLine[];
}

export function ReviewEditor() {
  const router = useRouter();
  const [draft, setDraft] = useState<ParsedResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("scan-review-draft");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of sessionStorage on mount, not derivable from props/state
    if (raw) setDraft(JSON.parse(raw));
  }, []);

  if (!draft) {
    return (
      <p className="text-(--color-ink-muted)">
        No scan in progress. Go back and take a photo first.
      </p>
    );
  }

  function updateLine(index: number, patch: Partial<ParsedLine>) {
    setDraft((prev) => {
      if (!prev) return prev;
      const lines = [...prev.lines];
      lines[index] = { ...lines[index], ...patch };
      return { ...prev, lines };
    });
  }

  async function handleSave() {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      const ingredients: RecipeIngredientDraft[] = [];
      for (let i = 0; i < draft.lines.length; i++) {
        const line = draft.lines[i];
        let catalogIngredientId = line.catalogMatch?.id;
        if (!catalogIngredientId && line.name) {
          const created = await findOrCreateCatalogIngredient({
            name: line.name,
            category: "OTHER",
            canonicalUnit: line.qtyCanonical != null ? "MASS_G" : "COUNT",
          });
          catalogIngredientId = created.id;
        }

        ingredients.push({
          catalogIngredientId,
          sortOrder: i,
          rawText: line.rawText,
          rawAmount: line.amount,
          rawUnit: line.unit,
          displayName: line.name,
          qtyCanonical: line.qtyCanonical,
          needsReview: line.flagged,
          reviewNote: line.note,
        });
      }

      const recipe = await saveScannedRecipe({
        name: draft.recipeName ?? "Untitled recipe",
        minutes: draft.minutes,
        baseServes: draft.serves ?? 4,
        sourceType: "SCAN",
        ingredients,
      });

      sessionStorage.removeItem("scan-review-draft");
      router.push(`/recipes/${recipe.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save recipe");
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <input
        value={draft.recipeName ?? ""}
        onChange={(e) => setDraft({ ...draft, recipeName: e.target.value })}
        placeholder="Recipe name"
        className="rounded-xl border border-(--color-border) bg-(--color-surface) px-3 py-2 font-serif-heading text-xl"
      />

      <ul className="flex flex-col gap-2">
        {draft.lines.map((line, i) => (
          <li
            key={i}
            className={`rounded-xl border p-3 ${
              line.flagged
                ? "border-(--color-accent) bg-(--color-surface)"
                : "border-(--color-good) bg-(--color-surface)"
            }`}
          >
            <div className="flex items-center gap-2 text-xs font-medium">
              <span className={line.flagged ? "text-(--color-accent-dark)" : "text-(--color-good)"}>
                {line.flagged ? "Needs review" : "OK"}
              </span>
              {line.catalogMatch && (
                <span className="text-(--color-ink-muted)">
                  matched: {line.catalogMatch.name} ({Math.round(line.catalogMatch.confidence * 100)}%)
                </span>
              )}
            </div>
            <input
              value={line.rawText}
              onChange={(e) => updateLine(i, { rawText: e.target.value })}
              className="mt-1 w-full bg-transparent text-sm outline-none"
            />
            {line.flagged && line.note && (
              <p className="mt-1 text-xs text-(--color-accent-dark)">{line.note}</p>
            )}
            <div className="mt-2 grid grid-cols-3 gap-2">
              <input
                type="number"
                value={line.amount ?? ""}
                onChange={(e) =>
                  updateLine(i, { amount: e.target.value === "" ? null : Number(e.target.value) })
                }
                placeholder="Amount"
                className="rounded-lg border border-(--color-border) px-2 py-1 text-sm"
              />
              <input
                value={line.unit ?? ""}
                onChange={(e) => updateLine(i, { unit: e.target.value })}
                placeholder="Unit"
                className="rounded-lg border border-(--color-border) px-2 py-1 text-sm"
              />
              <input
                value={line.name}
                onChange={(e) => updateLine(i, { name: e.target.value })}
                placeholder="Ingredient"
                className="rounded-lg border border-(--color-border) px-2 py-1 text-sm"
              />
            </div>
          </li>
        ))}
      </ul>

      {error && <p className="text-sm text-(--color-accent-dark)">{error}</p>}

      <button
        type="button"
        disabled={saving}
        onClick={handleSave}
        className="rounded-full bg-(--color-accent) px-6 py-3 font-medium text-white disabled:opacity-60"
      >
        {saving ? "Saving…" : "Save recipe"}
      </button>
    </div>
  );
}
