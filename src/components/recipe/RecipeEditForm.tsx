"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateRecipe, type RecipeIngredientDraft } from "@/lib/actions/recipes";
import { findOrCreateCatalogIngredient } from "@/lib/actions/catalog";
import { normalizeToCanonical, detectCanonicalUnitFromRawUnit } from "@/lib/units/normalize";
import { Icon } from "@/components/ui/Icon";
import { NavBar } from "@/components/ui/NavBar";
import { BackLink } from "@/components/ui/BackLink";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ListGroup, ListRow, ListDivider } from "@/components/ui/ListGroup";
import { StickyActionBar } from "@/components/ui/StickyActionBar";

interface EditLine {
  catalogIngredientId: string | null;
  initialName: string;
  name: string;
  amount: number | null;
  unit: string | null;
  qtyCanonical: number | null;
  needsReview: boolean;
  reviewNote: string | null;
  excludeFromCost: boolean;
}

export interface RecipeEditData {
  id: string;
  name: string;
  baseServes: number;
  methodSteps: string[];
  ingredients: {
    catalogIngredientId: string | null;
    displayName: string;
    rawAmount: number | null;
    rawUnit: string | null;
    qtyCanonical: number | null;
    needsReview: boolean;
    reviewNote: string | null;
    excludeFromCost: boolean;
  }[];
}

export function RecipeEditForm({ recipe }: { recipe: RecipeEditData }) {
  const router = useRouter();
  const [name, setName] = useState(recipe.name);
  const [baseServes, setBaseServes] = useState(recipe.baseServes);
  const [lines, setLines] = useState<EditLine[]>(
    recipe.ingredients.map((ing) => ({
      catalogIngredientId: ing.catalogIngredientId,
      initialName: ing.displayName,
      name: ing.displayName,
      amount: ing.rawAmount,
      unit: ing.rawUnit,
      qtyCanonical: ing.qtyCanonical,
      needsReview: ing.needsReview,
      reviewNote: ing.reviewNote,
      excludeFromCost: ing.excludeFromCost,
    }))
  );
  const [method, setMethod] = useState<string[]>(recipe.methodSteps);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addLine() {
    setLines((prev) => [
      ...prev,
      {
        catalogIngredientId: null,
        initialName: "",
        name: "",
        amount: null,
        unit: null,
        qtyCanonical: null,
        needsReview: false,
        reviewNote: null,
        excludeFromCost: false,
      },
    ]);
  }

  function updateLine(index: number, patch: Partial<EditLine>) {
    setLines((prev) => {
      const next = [...prev];
      const updated = { ...next[index], ...patch };
      if ("amount" in patch || "unit" in patch) {
        const canonicalUnit = detectCanonicalUnitFromRawUnit(updated.unit);
        updated.qtyCanonical =
          updated.amount != null && updated.unit
            ? normalizeToCanonical(updated.amount, updated.unit, canonicalUnit).qtyCanonical
            : null;
      }
      next[index] = updated;
      return next;
    });
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  function updateMethodStep(index: number, value: string) {
    setMethod((prev) => prev.map((s, i) => (i === index ? value : s)));
  }

  function removeMethodStep(index: number) {
    setMethod((prev) => prev.filter((_, i) => i !== index));
  }

  function addMethodStep() {
    setMethod((prev) => [...prev, ""]);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const validLines = lines
        .map((line, i) => ({ line, sortOrder: i }))
        .filter(({ line }) => line.name.trim());

      const resolvedIds = await Promise.all(
        validLines.map(({ line }) =>
          !line.catalogIngredientId || line.name.trim() !== line.initialName.trim()
            ? findOrCreateCatalogIngredient({
                name: line.name,
                category: "OTHER",
                canonicalUnit: detectCanonicalUnitFromRawUnit(line.unit),
              }).then((created) => created.id)
            : line.catalogIngredientId
        )
      );

      const ingredients: RecipeIngredientDraft[] = validLines.map(({ line, sortOrder }, idx) => ({
        catalogIngredientId: resolvedIds[idx],
        sortOrder,
        rawAmount: line.amount,
        rawUnit: line.unit,
        displayName: line.name,
        qtyCanonical: line.qtyCanonical,
        needsReview: line.needsReview,
        reviewNote: line.reviewNote,
        excludeFromCost: line.excludeFromCost,
      }));

      await updateRecipe(recipe.id, {
        name: name.trim() || recipe.name,
        baseServes,
        ingredients,
        methodSteps: method.map((s) => s.trim()).filter((s) => s !== ""),
      });

      router.push(`/recipes/${recipe.id}`);
    } catch {
      setError("Couldn't save. Try again.");
      setSaving(false);
    }
  }

  return (
    <>
      <NavBar title="Edit recipe" left={<BackLink href={`/recipes/${recipe.id}`} label="Recipe" />} />

      <ListGroup className="mt-6">
        <ListRow>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Recipe name"
            className="recipe-name min-w-0 flex-1 bg-transparent text-xl outline-none"
          />
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <span className="text-sm text-(--color-ink-muted)">Serves</span>
            <button
              type="button"
              disabled={baseServes <= 1}
              onClick={() => setBaseServes((s) => Math.max(1, s - 1))}
              aria-label="Decrease servings"
              className="-my-2 flex h-11 w-11 items-center justify-center text-(--color-accent) active:opacity-60 disabled:opacity-40"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-(--color-surface-alt)">
                <Icon name="minus" size={14} />
              </span>
            </button>
            <span className="w-4 text-center text-sm tabular-nums">{baseServes}</span>
            <button
              type="button"
              onClick={() => setBaseServes((s) => s + 1)}
              aria-label="Increase servings"
              className="-my-2 flex h-11 w-11 items-center justify-center text-(--color-accent) active:opacity-60"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-(--color-surface-alt)">
                <Icon name="plus" size={14} />
              </span>
            </button>
          </div>
        </ListRow>
      </ListGroup>

      <SectionHeader>Ingredients</SectionHeader>
      <ListGroup>
        {lines.map((line, i) => (
          <div key={i}>
            {i > 0 && <ListDivider />}
            <ListRow className="items-start">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-1.5 text-[15px]">
                  <input
                    value={line.name}
                    onChange={(e) => updateLine(i, { name: e.target.value })}
                    placeholder="Ingredient"
                    className="min-w-[4rem] flex-1 bg-transparent font-medium outline-none"
                  />
                  <span className="text-(--color-ink-muted)">×</span>
                  <input
                    type="number"
                    value={line.amount ?? ""}
                    onChange={(e) =>
                      updateLine(i, { amount: e.target.value === "" ? null : Number(e.target.value) })
                    }
                    placeholder="0"
                    className="w-14 bg-transparent text-(--color-ink-muted) outline-none"
                  />
                  <input
                    value={line.unit ?? ""}
                    onChange={(e) => updateLine(i, { unit: e.target.value })}
                    className="w-12 bg-transparent text-(--color-ink-muted) outline-none"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeLine(i)}
                aria-label={`Remove ${line.name || "ingredient"}`}
                className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center text-(--color-accent-dark) active:opacity-60"
              >
                <span aria-hidden className="text-[22px] leading-none">&minus;</span>
              </button>
            </ListRow>
          </div>
        ))}
        <ListDivider />
        <button
          type="button"
          onClick={addLine}
          className="flex min-h-[48px] w-full items-center gap-3 px-4 py-2 text-left text-[15px] font-medium text-(--color-accent) active:bg-(--color-surface-alt)"
        >
          <span
            aria-hidden
            className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-(--color-accent) text-[15px] leading-none font-semibold text-white"
          >
            +
          </span>
          Add ingredient
        </button>
      </ListGroup>

      <SectionHeader>Method</SectionHeader>
      <ListGroup>
        {method.length === 0 ? (
          <ListRow>
            <p className="text-sm text-(--color-ink-muted)">No steps yet.</p>
          </ListRow>
        ) : (
          method.map((step, i) => (
            <div key={i}>
              {i > 0 && <ListDivider />}
              <ListRow>
                <span className="shrink-0 text-sm text-(--color-ink-muted)">{i + 1}.</span>
                <input
                  value={step}
                  onChange={(e) => updateMethodStep(i, e.target.value)}
                  placeholder="Step description"
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                />
                <button
                  type="button"
                  onClick={() => removeMethodStep(i)}
                  aria-label={`Remove step ${i + 1}`}
                  className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center text-(--color-accent-dark) active:opacity-60"
                >
                  <span aria-hidden className="text-[22px] leading-none">&minus;</span>
                </button>
              </ListRow>
            </div>
          ))
        )}
        <ListDivider />
        <button
          type="button"
          onClick={addMethodStep}
          className="flex min-h-[48px] w-full items-center gap-3 px-4 py-2 text-left text-[15px] font-medium text-(--color-accent) active:bg-(--color-surface-alt)"
        >
          <span
            aria-hidden
            className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-(--color-accent) text-[15px] leading-none font-semibold text-white"
          >
            +
          </span>
          Add step
        </button>
      </ListGroup>

      {error && <p className="px-4 pt-4 text-sm text-(--color-accent-dark)">{error}</p>}

      <StickyActionBar>
        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className="flex-1 rounded-full bg-(--color-accent) px-6 py-3 font-medium text-white disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </StickyActionBar>
    </>
  );
}
