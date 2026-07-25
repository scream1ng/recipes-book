import Link from "next/link";

const PRESETS = [1, 2, 4, 6, 8];

export function ServesStepper({ recipeId, current }: { recipeId: string; current: number }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {PRESETS.map((n) => (
        <Link
          key={n}
          href={`/recipes/${recipeId}?serves=${n}`}
          className={`rounded-full px-4 py-1.5 text-sm font-medium ${
            current === n
              ? "bg-(--color-accent) text-white"
              : "border border-(--color-border) bg-(--color-surface) text-(--color-ink)"
          }`}
        >
          {n}
        </Link>
      ))}
      {!PRESETS.includes(current) && (
        <span className="rounded-full bg-(--color-accent) px-4 py-1.5 text-sm font-medium text-white">
          {current}
        </span>
      )}
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
