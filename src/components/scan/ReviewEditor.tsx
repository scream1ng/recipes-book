"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { saveScannedRecipe, type RecipeIngredientDraft } from "@/lib/actions/recipes";
import { findOrCreateCatalogIngredient } from "@/lib/actions/catalog";
import type { IngredientCategory } from "@/generated/prisma";
import { normalizeToCanonical, detectCanonicalUnitFromRawUnit } from "@/lib/units/normalize";
import { Icon } from "@/components/ui/Icon";
import { NavBar } from "@/components/ui/NavBar";
import { BackLink } from "@/components/ui/BackLink";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ListGroup, ListRow, ListDivider } from "@/components/ui/ListGroup";
import { StickyActionBar } from "@/components/ui/StickyActionBar";

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
  category: string;
}

interface ParsedResult {
  recipeName: string | null;
  minutes: number | null;
  serves: number | null;
  lines: ParsedLine[];
  method: string[];
  source?: "photo" | "paste";
}

export function ReviewEditor() {
  const router = useRouter();
  const [draft, setDraft] = useState<ParsedResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("scan-review-draft");
    if (raw) {
      const parsed = JSON.parse(raw) as ParsedResult;
      parsed.lines = parsed.lines.map((line) => ({ ...line, category: line.category ?? "OTHER" }));
      parsed.serves = parsed.serves ?? 4;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of sessionStorage on mount, not derivable from props/state
      setDraft(parsed);
    }
  }, []);

  if (!draft) {
    return (
      <>
        <NavBar title="Review" left={<BackLink href="/scan" label="Scan" />} />
        <p className="mt-6 text-(--color-ink-muted)">
          No scan in progress. Go back and take a photo first.
        </p>
      </>
    );
  }

  const method = draft.method ?? [];
  const hasContent = draft.lines.length > 0 || method.length > 0;
  const fromPaste = draft.source === "paste";
  const backHref = fromPaste ? "/scan/paste" : "/scan";
  const backLabel = fromPaste ? "Paste" : "Scan";

  function addLine() {
    setDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        lines: [
          ...prev.lines,
          {
            rawText: "",
            amount: null,
            unit: null,
            name: "",
            qtyCanonical: null,
            confidence: 1,
            flagged: false,
            note: null,
            catalogMatch: null,
            category: "OTHER",
          },
        ],
      };
    });
  }

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
      if ("name" in patch) {
        updated.catalogMatch = null;
      }
      lines[index] = updated;
      return { ...prev, lines };
    });
  }

  function updateMethodStep(index: number, value: string) {
    setDraft((prev) => {
      if (!prev) return prev;
      const method = [...(prev.method ?? [])];
      method[index] = value;
      return { ...prev, method };
    });
  }

  function removeMethodStep(index: number) {
    setDraft((prev) => {
      if (!prev) return prev;
      const method = (prev.method ?? []).filter((_, i) => i !== index);
      return { ...prev, method };
    });
  }

  function addMethodStep() {
    setDraft((prev) => {
      if (!prev) return prev;
      return { ...prev, method: [...(prev.method ?? []), ""] };
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
        if (!line.name.trim()) continue;
        let catalogIngredientId = line.catalogMatch?.id;
        if (!catalogIngredientId && line.name) {
          const created = await findOrCreateCatalogIngredient({
            name: line.name,
            category: (line.category ?? "OTHER") as IngredientCategory,
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
        methodSteps: method.map((s) => s.trim()).filter((s) => s !== ""),
      });

      sessionStorage.removeItem("scan-review-draft");
      router.push(`/recipes/${recipe.id}`);
    } catch {
      setError("Couldn't save. Try again.");
      setSaving(false);
    }
  }

  return (
    <>
      <NavBar title="Review" left={<BackLink href={backHref} label={backLabel} />} />

      <ListGroup className="mt-6">
        <ListRow>
          <input
            value={draft.recipeName ?? ""}
            onChange={(e) => setDraft({ ...draft, recipeName: e.target.value })}
            placeholder="Recipe name"
            className="recipe-name min-w-0 flex-1 bg-transparent text-xl outline-none"
          />
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <span className="text-sm text-(--color-ink-muted)">Serves</span>
            <button
              type="button"
              disabled={(draft.serves ?? 1) <= 1}
              onClick={() =>
                setDraft({ ...draft, serves: Math.max(1, (draft.serves ?? 1) - 1) })
              }
              aria-label="Decrease servings"
              className="flex h-7 w-7 items-center justify-center rounded-full bg-(--color-surface-alt) text-(--color-accent) active:opacity-60 disabled:opacity-40"
            >
              <Icon name="minus" size={14} />
            </button>
            <span className="w-4 text-center text-sm tabular-nums">{draft.serves ?? 4}</span>
            <button
              type="button"
              onClick={() => setDraft({ ...draft, serves: (draft.serves ?? 1) + 1 })}
              aria-label="Increase servings"
              className="flex h-7 w-7 items-center justify-center rounded-full bg-(--color-surface-alt) text-(--color-accent) active:opacity-60"
            >
              <Icon name="plus" size={14} />
            </button>
          </div>
        </ListRow>
      </ListGroup>

      {!hasContent && (
        <div className="mt-6 flex flex-col items-center gap-3 text-center">
          <p className="text-(--color-ink-muted)">
            {fromPaste ? "Nothing was read from that text." : "Nothing was read from those photos."}
          </p>
          <Link
            href={backHref}
            className="rounded-full bg-(--color-accent) px-6 py-3 font-medium text-white active:opacity-60"
          >
            {fromPaste ? "Try pasting again" : "Take another photo"}
          </Link>
        </div>
      )}

      {hasContent && (
        <>
          <SectionHeader>Ingredients</SectionHeader>

          <ListGroup>
            {draft.lines.map((line, i) => (
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
                          updateLine(i, {
                            amount: e.target.value === "" ? null : Number(e.target.value),
                          })
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
                    {line.catalogMatch && line.catalogMatch.name !== line.name && (
                      <p className="min-w-0 truncate text-xs text-(--color-ink-muted)">
                        also known as {line.catalogMatch.name}
                      </p>
                    )}
                    {line.flagged && (
                      <p className="text-xs text-(--color-accent-dark)">
                        {line.note ?? "Double-check this line"}
                      </p>
                    )}
                  </div>
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
              {saving ? "Saving…" : "Save recipe"}
            </button>
          </StickyActionBar>
        </>
      )}
    </>
  );
}
