import Link from "next/link";

const PRESETS = [1, 2, 4, 6, 8];

export function ServesStepper({ recipeId, current }: { recipeId: string; current: number }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
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
          <span className="rounded-full bg-(--color-surface) px-4 py-1.5 text-sm font-medium tabular-nums text-(--color-ink) shadow-sm">
            {current}
          </span>
        )}
      </div>
      <form action={`/recipes/${recipeId}`} className="flex items-center gap-1">
        <input
          type="number"
          name="serves"
          min={1}
          defaultValue={current}
          className="w-16 rounded-full border border-(--color-border) bg-(--color-surface) px-3 py-1.5 text-sm"
          aria-label="Custom serves"
        />
        <button
          type="submit"
          className="rounded-full border border-(--color-border) px-3 py-1.5 text-sm"
        >
          Go
        </button>
      </form>
    </div>
  );
}
