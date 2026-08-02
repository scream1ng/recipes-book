"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateRecipe, deleteRecipe } from "@/lib/actions/recipes";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export function RecipeHeaderActions({
  recipeId,
  name,
  tag,
}: {
  recipeId: string;
  name: string;
  tag: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(name);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isPending, startTransition] = useTransition();

  function saveName() {
    const trimmed = draftName.trim();
    if (!trimmed || trimmed === name) {
      setEditing(false);
      setDraftName(name);
      return;
    }
    startTransition(async () => {
      await updateRecipe(recipeId, { name: trimmed });
      setEditing(false);
      router.refresh();
    });
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteRecipe(recipeId);
      router.push("/recipes");
    });
  }

  return (
    <div className="pt-2">
      {editing ? (
        <input
          autoFocus
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onBlur={saveName}
          onKeyDown={(e) => {
            if (e.key === "Enter") saveName();
            if (e.key === "Escape") {
              setDraftName(name);
              setEditing(false);
            }
          }}
          disabled={isPending}
          className="recipe-name w-full bg-transparent text-3xl outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-left active:opacity-60"
        >
          <h1 className="recipe-name text-3xl">{name}</h1>
        </button>
      )}
      <div className="flex items-center justify-between">
        {tag ? <p className="text-sm text-(--color-ink-muted)">{tag}</p> : <span />}
        <button
          type="button"
          onClick={() => setConfirmingDelete(true)}
          disabled={isPending}
          className="text-sm text-(--color-destructive) active:opacity-60"
        >
          Delete recipe
        </button>
      </div>

      {confirmingDelete && (
        <ConfirmDialog
          title={`Delete "${name}"?`}
          message="This can't be undone."
          isPending={isPending}
          onConfirm={handleDelete}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </div>
  );
}
