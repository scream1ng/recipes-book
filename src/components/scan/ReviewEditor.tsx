"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { saveScannedRecipe, type RecipeIngredientDraft } from "@/lib/actions/recipes";
import { findOrCreateCatalogIngredient } from "@/lib/actions/catalog";
import { normalizeToCanonical, detectCanonicalUnitFromRawUnit } from "@/lib/units/normalize";
import { NavBar } from "@/components/ui/NavBar";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ListGroup, ListRow, ListDivider } from "@/components/ui/ListGroup";
import { StickyActionBar } from "@/components/ui/StickyActionBar";
import { Toggle } from "@/components/ui/Toggle";

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
  method: string[];
}

const METHOD_PREVIEW_COUNT = 3;

export function ReviewEditor() {
  const router = useRouter();
  const [draft, setDraft] = useState<ParsedResult | null>(null);
  const [confirmed, setConfirmed] = useState<boolean[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("scan-review-draft");
    if (raw) {
      const parsed = JSON.parse(raw) as ParsedResult;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of sessionStorage on mount, not derivable from props/state
      setDraft(parsed);
      setConfirmed(parsed.lines.map(() => false));
    }
  }, []);

  if (!draft) {
    return (
      <p className="text-(--color-ink-muted)">
        No scan in progress. Go back and take a photo first.
      </p>
    );
  }

  const method = draft.method ?? [];
  const confirmedCount = confirmed.filter(Boolean).length;
  const hasContent = draft.lines.length > 0 || method.length > 0;
  const allConfirmed = confirmedCount === draft.lines.length && hasContent;

  function updateLine(index: number, patch: Partial<ParsedLine>) {
    setDraft((prev) => {
      if (!prev) return prev;
      const lines = [...prev.lines];
      const updated = { ...lines[index], ...patch };
      if ("amount" in patch || "unit" in patch) {
        const canonicalUnit = detectCanonicalUnitFromRawUnit(updated.unit);
        updated.qtyCanonical =
          updated.amount != null && updated.unit
            ? normalizeToCanonical(updated.amount, updated.unit, canonicalUnit).qtyCanonical
            : null;
      }
      lines[index] = updated;
      return { ...prev, lines };
    });
  }

  function setLineConfirmed(index: number, value: boolean) {
    setConfirmed((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
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
            canonicalUnit: detectCanonicalUnitFromRawUnit(line.unit),
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
        methodSteps: method,
      });

      sessionStorage.removeItem("scan-review-draft");
      router.push(`/recipes/${recipe.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save recipe");
      setSaving(false);
    }
  }

  return (
    <>
      <div className="-mx-4" style={{ marginTop: "calc(-1.5rem - env(safe-area-inset-top))" }}>
        <NavBar title="Review" />
      </div>

      <ListGroup className="mt-6">
        <ListRow>
          <input
            value={draft.recipeName ?? ""}
            onChange={(e) => setDraft({ ...draft, recipeName: e.target.value })}
            placeholder="Recipe name"
            className="recipe-name w-full bg-transparent text-xl outline-none"
          />
        </ListRow>
      </ListGroup>

      <div className="flex items-center justify-between">
        <SectionHeader>Ingredients</SectionHeader>
        <span className="pr-4 text-xs text-(--color-ink-muted)">
          {confirmedCount}/{draft.lines.length} confirmed
        </span>
      </div>

      <ListGroup>
        {draft.lines.map((line, i) => (
          <div key={i}>
            {i > 0 && <ListDivider />}
            <ListRow>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-xs font-medium">
                  <span
                    className={
                      line.flagged ? "text-(--color-accent-dark)" : "text-(--color-good)"
                    }
                  >
                    {line.flagged ? "Needs review" : "OK"}
                  </span>
                  {line.catalogMatch && (
                    <span className="truncate text-(--color-ink-muted)">
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
                      updateLine(i, {
                        amount: e.target.value === "" ? null : Number(e.target.value),
                      })
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
              </div>
              <Toggle
                checked={confirmed[i] ?? false}
                onChange={(value) => setLineConfirmed(i, value)}
                label={`Confirm ${line.name || "ingredient"}`}
              />
            </ListRow>
          </div>
        ))}
      </ListGroup>

      {method.length > 0 && (
        <>
          <SectionHeader>Method</SectionHeader>
          <ListGroup>
            {method.slice(0, METHOD_PREVIEW_COUNT).map((step, i) => (
              <div key={i}>
                {i > 0 && <ListDivider />}
                <ListRow>
                  <span className="shrink-0 text-sm text-(--color-ink-muted)">{i + 1}.</span>
                  <p className="min-w-0 flex-1 text-sm">{step}</p>
                </ListRow>
              </div>
            ))}
          </ListGroup>
          <p className="px-4 pt-2 text-xs text-(--color-ink-muted)">
            {method.length > METHOD_PREVIEW_COUNT
              ? `+${method.length - METHOD_PREVIEW_COUNT} more steps — `
              : ""}
            Full method will be on the recipe page after saving.
          </p>
        </>
      )}

      {error && <p className="px-4 pt-4 text-sm text-(--color-accent-dark)">{error}</p>}

      <StickyActionBar>
        <button
          type="button"
          disabled={saving || !allConfirmed}
          onClick={handleSave}
          className="flex-1 rounded-full bg-(--color-accent) px-6 py-3 font-medium text-white disabled:opacity-40"
        >
          {saving
            ? "Saving…"
            : allConfirmed
              ? "Save recipe"
              : hasContent
                ? "Confirm all lines to save"
                : "Nothing was read from these photos"}
        </button>
      </StickyActionBar>
    </>
  );
}
