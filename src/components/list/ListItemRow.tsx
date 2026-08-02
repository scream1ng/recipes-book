"use client";

import { useTransition } from "react";
import { toggleListItem, toggleDerivedListItem, removeListItem } from "@/lib/actions/list";
import type { ShoppingListRow } from "@/lib/actions/list";
import { centsToDisplay } from "@/lib/money";
import { ListRow } from "@/components/ui/ListGroup";
import { StoreBadge } from "@/components/ui/StoreBadge";

export function ListItemRow({ row }: { row: ShoppingListRow }) {
  const [isPending, startTransition] = useTransition();

  function toggle() {
    if (row.kind === "manual") {
      startTransition(() => toggleListItem(row.id));
    } else {
      startTransition(() => toggleDerivedListItem(row.catalogIngredientId!));
    }
  }

  return (
    <ListRow>
      <input
        type="checkbox"
        checked={row.isChecked}
        disabled={isPending}
        onChange={toggle}
        className="h-5 w-5 shrink-0 accent-(--color-accent)"
      />
      <div className={`min-w-0 flex-1 ${row.isChecked ? "text-(--color-ink-muted) line-through" : ""}`}>
        <p className="truncate font-medium">{row.label}</p>
        {row.store && (
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-(--color-ink-muted)">
            <StoreBadge store={row.store} />
            <span className="truncate">
              {row.packLabel} {row.packsToBuy != null ? `× ${row.packsToBuy}` : ""}
            </span>
          </p>
        )}
      </div>
      <span className="tabular-nums shrink-0 font-medium">{centsToDisplay(row.totalCents)}</span>
      {row.kind === "manual" && (
        <button
          type="button"
          onClick={() => startTransition(() => removeListItem(row.id))}
          className="shrink-0 text-(--color-ink-muted)"
          aria-label="Remove"
        >
          ✕
        </button>
      )}
    </ListRow>
  );
}
