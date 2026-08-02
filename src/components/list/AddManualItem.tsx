"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addManualListItem } from "@/lib/actions/list";

export function AddManualItem() {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [isPending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = label.trim();
    if (!trimmed) return;
    startTransition(async () => {
      await addManualListItem(trimmed);
      setLabel("");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="mt-3 flex gap-2 px-4">
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Add an item"
        className="min-w-0 flex-1 rounded-lg border border-(--color-border) bg-(--color-surface) px-3 py-2 text-base"
      />
      <button
        type="submit"
        disabled={isPending || !label.trim()}
        className="shrink-0 rounded-full bg-(--color-accent) px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        Add
      </button>
    </form>
  );
}
