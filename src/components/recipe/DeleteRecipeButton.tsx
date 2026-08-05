"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteRecipe } from "@/lib/actions/recipes";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export function DeleteRecipeButton({ recipeId, name }: { recipeId: string; name: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      await deleteRecipe(recipeId);
      router.push("/recipes");
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        disabled={isPending}
        className="mt-6 flex min-h-11 w-full items-center justify-center text-sm text-(--color-destructive) active:opacity-60"
      >
        Delete recipe
      </button>

      {confirming && (
        <ConfirmDialog
          title={`Delete "${name}"?`}
          message="This can't be undone."
          isPending={isPending}
          onConfirm={handleDelete}
          onCancel={() => setConfirming(false)}
        />
      )}
    </>
  );
}
