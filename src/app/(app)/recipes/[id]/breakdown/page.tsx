import Link from "next/link";
import { getCostBreakdown, getRecipe } from "@/lib/actions/recipes";
import { centsToDisplay } from "@/lib/money";

export default async function CostBreakdownPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ serves?: string }>;
}) {
  const { id } = await params;
  const { serves } = await searchParams;
  const targetServes = serves ? Number(serves) || undefined : undefined;

  const [recipe, breakdown] = await Promise.all([
    getRecipe(id, targetServes),
    getCostBreakdown(id, targetServes),
  ]);

  const maxCents = Math.max(...breakdown.items.map((i) => i.costCents), 1);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Link href={`/recipes/${id}`} className="text-sm text-(--color-ink-muted)">
          ← {recipe.name}
        </Link>
        <h1 className="font-serif-heading text-3xl">Cost breakdown</h1>
      </div>

      <ul className="flex flex-col gap-3">
        {breakdown.items.map((item) => (
          <li key={item.ingredientId}>
            <div className="mb-1 flex items-baseline justify-between text-sm">
              <span className="truncate font-medium">{item.displayName}</span>
              <span className="shrink-0 text-(--color-ink-muted)">
                {centsToDisplay(item.costCents)} · {Math.round(item.shareOfTotal * 100)}%
              </span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-(--color-surface-alt)">
              <div
                className="h-full rounded-full bg-(--color-accent)"
                style={{ width: `${(item.costCents / maxCents) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>

      {breakdown.totalPotentialSavingsCents > 0 && (
        <div className="rounded-2xl border border-(--color-good) bg-(--color-surface) p-4">
          <p className="font-medium text-(--color-good)">
            Could save {centsToDisplay(breakdown.totalPotentialSavingsCents)} with cheaper alternatives
          </p>
          <p className="mt-1 text-xs text-(--color-ink-muted)">
            Tap an ingredient on the recipe page and swap to the suggested option.
          </p>
        </div>
      )}

      <div className="rounded-2xl border border-(--color-border) bg-(--color-surface-alt) p-4">
        <div className="flex items-center justify-between">
          <span className="text-(--color-ink-muted)">Total</span>
          <span className="text-lg font-semibold">{centsToDisplay(breakdown.totalCents)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-(--color-ink-muted)">Cost / serve</span>
          <span>{centsToDisplay(breakdown.costPerServeCents)}</span>
        </div>
      </div>
    </div>
  );
}
