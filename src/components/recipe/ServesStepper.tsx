import Link from "next/link";

const PRESETS = [1, 2, 4, 6, 8, 12];

export function ServesStepper({ recipeId, current }: { recipeId: string; current: number }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-(--color-ink-muted)">Serves</span>
      <div className="flex items-center gap-0.5 rounded-full bg-(--color-surface-alt) p-1">
        {PRESETS.map((n) => (
          <Link
            key={n}
            href={`/recipes/${recipeId}?serves=${n}`}
            className={`rounded-full px-4 py-1.5 text-sm font-medium tabular-nums active:opacity-60 ${
              current === n
                ? "bg-(--color-surface) text-(--color-ink) shadow-sm"
                : "text-(--color-ink-muted)"
            }`}
          >
            {n}
          </Link>
        ))}
        {!PRESETS.includes(current) && (
          <Link
            href={`/recipes/${recipeId}`}
            className="rounded-full bg-(--color-surface) px-4 py-1.5 text-sm font-medium tabular-nums text-(--color-ink) shadow-sm active:opacity-60"
            aria-label={`Currently ${current} servings, tap to reset`}
          >
            {current}
          </Link>
        )}
      </div>
    </div>
  );
}
