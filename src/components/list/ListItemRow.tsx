"use client";

import { useTransition } from "react";
import { toggleListItem, removeListItem } from "@/lib/actions/list";
import { centsToDisplay } from "@/lib/money";

export interface ListRow {
  id: string;
  label: string;
  store: string | null;
  packLabel: string | null;
  packsToBuy: number | null;
  totalCents: number;
  isChecked: boolean;
}

export function ListItemRow({ row }: { row: ListRow }) {
  const [isPending, startTransition] = useTransition();

  return (
    <li className="flex items-center gap-3 rounded-xl border border-(--color-border) bg-(--color-surface) p-3">
      <input
        type="checkbox"
        checked={row.isChecked}
        disabled={isPending}
        onChange={() => startTransition(() => toggleListItem(row.id))}
        className="h-5 w-5 accent-(--color-accent)"
      />
      <div className={`min-w-0 flex-1 ${row.isChecked ? "line-through text-(--color-ink-muted)" : ""}`}>
        <p className="truncate font-medium">{row.label}</p>
        {row.store && (
          <p className="truncate text-xs text-(--color-ink-muted)">
            <span className="mr-1 rounded-full bg-(--color-surface-alt) px-1.5 py-0.5 text-[10px] font-medium">
              {row.store}
            </span>
            {row.packLabel} {row.packsToBuy != null ? `× ${row.packsToBuy}` : ""}
          </p>
        )}
      </div>
      <span className="shrink-0 font-medium">{centsToDisplay(row.totalCents)}</span>
      <button
        type="button"
        onClick={() => startTransition(() => removeListItem(row.id))}
        className="shrink-0 text-(--color-ink-muted)"
        aria-label="Remove"
      >
        ✕
      </button>
    </li>
  );
}
